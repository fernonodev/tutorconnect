import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Estudiante, Tutor, DisponibilidadTutor, EstadoAprobacion, HonorarioTipo, RolUsuario, Resena, Materia
from app.schemas import TutorOut, DisponibilidadCreate, DisponibilidadOut
from app.auth import get_current_user, log_audit
from app.ocr import procesar_ficha_academica

router = APIRouter(prefix="/api/tutores", tags=["Tutores"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# --- 1. POSTULACIÓN A TUTOR ---
from typing import Optional
from app.models import Materia

# --- 1. POSTULACIÓN A TUTOR ---
@router.post("/postular", response_model=TutorOut, status_code=status.HTTP_201_CREATED)
@router.post("/solicitar", response_model=TutorOut, status_code=status.HTTP_201_CREATED)
async def solicitar_ser_tutor(
    request: Request,
    tipo_honorario: HonorarioTipo = Form(HonorarioTipo.Voluntario),
    materias_ids: Optional[str] = Form(None),  # Recibe cadena de IDs separados por comas, ej: "1,5,10"
    ficha: UploadFile = File(...),
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.es_tutor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya se encuentra registrado como tutor."
        )

    tutor_existente = db.query(Tutor).filter(
        Tutor.estudiante_id_estudiante == current_user.id_estudiante
    ).first()

    if tutor_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya tienes una postulación enviada o en proceso de revisión."
        )

    # Guardar archivo adjunto
    file_ext = os.path.splitext(ficha.filename)[1] if "." in ficha.filename else ".pdf"
    filename = f"ficha_{current_user.id_estudiante}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        content = await ficha.read()
        buffer.write(content)

    # Análisis OCR de la ficha académica
    promedio_detectado = procesar_ficha_academica(file_path)
    cumple_criterio = promedio_detectado >= 4.0
    estado = EstadoAprobacion.Aprobado if cumple_criterio else EstadoAprobacion.Rechazado

    # Procesar y consultar las materias seleccionadas desde la BD
    materias_seleccionadas = []
    if materias_ids:
        ids_list = [int(i.strip()) for i in materias_ids.split(",") if i.strip().isdigit()]
        if ids_list:
            materias_seleccionadas = db.query(Materia).filter(Materia.id_materia.in_(ids_list)).all()

    tutor_perfil = Tutor(
        promedio=promedio_detectado,
        tipo_honorario=tipo_honorario,
        tarifa_hora=0.0,
        estado_aprobacion=estado,
        ficha_academica_url=f"/uploads/{filename}",
        estudiante_id_estudiante=current_user.id_estudiante,
        materias_imparte=materias_seleccionadas  # Asigna la relación muchos a muchos con tutor_materia
    )

    if cumple_criterio:
        current_user.es_tutor = True
        current_user.rol = RolUsuario.Tutor

    db.add(tutor_perfil)
    db.commit()
    db.refresh(tutor_perfil)
    db.refresh(current_user)

    detalles_log = f"Ficha analizada con OCR. Promedio: {promedio_detectado}. Estado asignado: {estado.value}. Materias vinculadas: {len(materias_seleccionadas)}"
    log_audit(db, request, "SOLICITUD_TUTOR_OCR", detalles_log, current_user.id_estudiante)

    if not cumple_criterio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solicitud rechazada automáticamente. Su promedio ({promedio_detectado}) es inferior al mínimo requerido (4.0)."
        )

    return tutor_perfil

def adjuntar_rating_tutor(tutor: Tutor, db: Session):
    stats = db.query(
        func.avg(Resena.puntuacion).label("promedio"),
        func.count(Resena.id_resena).label("total")
    ).filter(Resena.tutor_id_tutor == tutor.id_tutor).first()

    tutor.rating_promedio = round(float(stats.promedio), 1) if stats.promedio else 0.0
    tutor.total_resenas = int(stats.total) if stats.total else 0
    return tutor

@router.get("", response_model=List[TutorOut])
def listar_tutores(
    carrera_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Tutor).join(Estudiante).filter(Tutor.estado_aprobacion == EstadoAprobacion.Aprobado)
    if carrera_id:
        query = query.filter(Estudiante.carrera_id_carrera == carrera_id)
    if q:
        search_pattern = f"%{q}%"
        query = query.filter((Estudiante.nombres.like(search_pattern)) | (Estudiante.apellidos.like(search_pattern)))

    tutores = query.all()
    for t in tutores:
        adjuntar_rating_tutor(t, db)
    return tutores
# --- 2. CONSULTAR Y GESTIONAR TARIFA DEL TUTOR (Rutas fijas antes de /{id}) ---
@router.get("/perfil/mi-perfil", response_model=TutorOut)
@router.get("/perfil/mi-perfil/", response_model=TutorOut)
def obtener_mi_perfil(
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tutor = db.query(Tutor).filter(Tutor.estudiante_id_estudiante == current_user.id_estudiante).first()
    if not tutor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de tutor no encontrado.")
    return tutor


@router.put("/perfil/tarifa", response_model=TutorOut)
@router.put("/perfil/tarifa/", response_model=TutorOut)
def actualizar_tarifa_tutor(
    tipo_honorario: str = Form("Voluntario"),
    tarifa_hora: float = Form(0.0),
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tutor = db.query(Tutor).filter(Tutor.estudiante_id_estudiante == current_user.id_estudiante).first()
    if not tutor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de tutor no encontrado.")
    
    # Actualizar explícitamente tipo_honorario y tarifa_hora en la base de datos
    if str(tipo_honorario).strip().capitalize() == "Remunerado":
        tutor.tipo_honorario = HonorarioTipo.Remunerado
        tutor.tarifa_hora = tarifa_hora
    else:
        tutor.tipo_honorario = HonorarioTipo.Voluntario
        tutor.tarifa_hora = 0.0

    db.commit()
    db.refresh(tutor)
    return tutor


# --- 3. CATÁLOGO Y CONSULTAS GENERALES ---
@router.get("", response_model=List[TutorOut])
def listar_tutores(
    carrera_id: Optional[int] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Tutor).join(Estudiante).filter(Tutor.estado_aprobacion == EstadoAprobacion.Aprobado)
    
    if carrera_id:
        query = query.filter(Estudiante.carrera_id_carrera == carrera_id)
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (Estudiante.nombres.like(search_pattern)) | 
            (Estudiante.apellidos.like(search_pattern))
        )
    
    return query.all()


# --- 4. GESTIÓN DE DISPONIBILIDAD ---
@router.get("/perfil/disponibilidad", response_model=List[DisponibilidadOut])
def obtener_mi_disponibilidad(
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tutor = db.query(Tutor).filter(Tutor.estudiante_id_estudiante == current_user.id_estudiante).first()
    if not tutor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de tutor no encontrado.")
    return tutor.disponibilidades


@router.post("/{id}/disponibilidad", response_model=DisponibilidadOut)
def agregar_disponibilidad(
    id: int,
    datos: DisponibilidadCreate,
    request: Request,
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tutor = db.query(Tutor).filter(Tutor.estudiante_id_estudiante == current_user.id_estudiante).first()
    if not tutor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para modificar la agenda de este tutor.")

    if datos.hora_fin <= datos.hora_inicio:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La hora de fin debe ser estrictamente mayor a la hora de inicio.")

    nueva_disp = DisponibilidadTutor(
        dia_semana=datos.dia_semana,
        hora_inicio=datos.hora_inicio,
        hora_fin=datos.hora_fin,
        tutor_id_tutor=tutor.id_tutor
    )
    db.add(nueva_disp)
    db.commit()
    db.refresh(nueva_disp)

    log_audit(db, request, "CREAR_DISPONIBILIDAD", f"Agregado horario: {datos.dia_semana} {datos.hora_inicio}-{datos.hora_fin}", current_user.id_estudiante)
    return nueva_disp


@router.delete("/disponibilidad/{disp_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_disponibilidad(
    disp_id: int,
    request: Request,
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    disp = db.query(DisponibilidadTutor).filter(DisponibilidadTutor.id == disp_id).first()
    if not disp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horario no encontrado.")
    
    tutor = db.query(Tutor).filter(Tutor.id_tutor == disp.tutor_id_tutor).first()
    if not tutor or tutor.estudiante_id_estudiante != current_user.id_estudiante:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado.")

    db.delete(disp)
    db.commit()

    log_audit(db, request, "ELIMINAR_DISPONIBILIDAD", f"Eliminado horario ID: {disp_id}", current_user.id_estudiante)
    return None