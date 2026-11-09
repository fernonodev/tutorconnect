from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import Estudiante, Tutor, Cita, EstadoCita, RolUsuario, Resena
from app.schemas import CitaCreate, CitaOut, CitaStatusUpdate, ResenaCreate, ResenaOut
from app.auth import get_current_user, log_audit
from app.utils.email import notificar_tutor_nueva_cita

router = APIRouter(prefix="/api/citas", tags=["Citas y Tutorías"])


def parse_iso_datetime(dt_str: str) -> datetime:
    cleaned = dt_str.replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned)
    return dt.replace(tzinfo=None)


# --- CREAR CITA (Soporta /api/citas y /api/citas/) ---
@router.post("", response_model=CitaOut)
@router.post("/", response_model=CitaOut)
def crear_cita(
    datos: CitaCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        inicio = parse_iso_datetime(datos.fecha_hora_inicio)
        fin = parse_iso_datetime(datos.fecha_hora_fin)
    except Exception:
        raise HTTPException(status_code=400, detail="Formato de fecha u hora no válido.")

    if fin <= inicio:
        raise HTTPException(status_code=400, detail="La fecha/hora de fin debe ser posterior al inicio.")

    tutor = db.query(Tutor).filter(Tutor.id_tutor == datos.tutor_id_tutor).first()
    if not tutor:
        raise HTTPException(status_code=404, detail="El tutor seleccionado no existe.")

    if tutor.estudiante_id_estudiante == current_user.id_estudiante:
        raise HTTPException(status_code=400, detail="No puede solicitar una tutoría consigo mismo.")

    # Control de solapamiento de horarios
    solapamiento = db.query(Cita).filter(
        Cita.tutor_id_tutor == datos.tutor_id_tutor,
        Cita.estado.in_(["Pendiente", "Aprobada", "Programada", "Reprogramada"]),
        and_(
            Cita.fecha_hora_inicio < fin,
            Cita.fecha_hora_fin > inicio
        )
    ).first()

    if solapamiento:
        raise HTTPException(
            status_code=400, 
            detail="El tutor ya cuenta con una cita en el rango de tiempo seleccionado."
        )

    nueva_cita = Cita(
        fecha_hora_inicio=inicio,
        fecha_hora_fin=fin,
        modalidad=datos.modalidad.value if hasattr(datos.modalidad, "value") else str(datos.modalidad),
        lugar_link=datos.lugar_link,
        materia_tema=datos.materia_tema,
        estado="Pendiente",
        tutor_id_tutor=datos.tutor_id_tutor,
        estudiante_id_estudiante=current_user.id_estudiante
    )

    db.add(nueva_cita)
    db.commit()
    db.refresh(nueva_cita)

    # Notificar al tutor por correo electrónico en segundo plano
    if tutor.estudiante and tutor.estudiante.email:
        nombre_tutor = f"{tutor.estudiante.nombres} {tutor.estudiante.apellidos}"
        nombre_estudiante = f"{current_user.nombres} {current_user.apellidos}"
        fecha_str = nueva_cita.fecha_hora_inicio.strftime("%d/%m/%Y %H:%M")

        background_tasks.add_task(
            notificar_tutor_nueva_cita,
            email_tutor=tutor.estudiante.email,
            nombre_tutor=nombre_tutor,
            nombre_estudiante=nombre_estudiante,
            materia=nueva_cita.materia_tema,
            fecha_inicio=fecha_str
        )

    log_audit(db, request, "SOLICITUD_CITA", f"Cita solicitada para el tutor ID {tutor.id_tutor}", current_user.id_estudiante)
    return nueva_cita
@router.post("/{id}/resena", response_model=ResenaOut)
@router.post("/{id}/resena/", response_model=ResenaOut)
def calificar_tutoria(
    id: int,
    datos: ResenaCreate,
    request: Request,
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cita = db.query(Cita).filter(Cita.id_cita == id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")

    if cita.estudiante_id_estudiante != current_user.id_estudiante:
        raise HTTPException(status_code=403, detail="Solo el estudiante que solicitó la tutoría puede calificarla.")

    estado_str = cita.estado.value if hasattr(cita.estado, 'value') else str(cita.estado)
    if estado_str not in ["Finalizada", "Realizada"]:
        raise HTTPException(status_code=400, detail="Solo se pueden calificar tutorías finalizadas.")

    if datos.puntuacion < 1 or datos.puntuacion > 5:
        raise HTTPException(status_code=400, detail="La calificación debe estar entre 1 y 5 estrellas.")

    resena_existente = db.query(Resena).filter(Resena.cita_id_cita == id).first()
    if resena_existente:
        raise HTTPException(status_code=400, detail="Esta tutoría ya fue calificada.")

    nueva_resena = Resena(
        puntuacion=datos.puntuacion,
        comentario=datos.comentario,
        cita_id_cita=id,
        tutor_id_tutor=cita.tutor_id_tutor,
        estudiante_id_estudiante=current_user.id_estudiante
    )
    db.add(nueva_resena)
    db.commit()
    db.refresh(nueva_resena)

    log_audit(db, request, "CALIFICAR_TUTORIA", f"Cita ID {id} calificada con {datos.puntuacion} estrellas", current_user.id_estudiante)
    return nueva_resena


# --- LISTAR CITAS (Responde en /api/citas y /api/citas/mis-citas) ---
@router.get("", response_model=List[CitaOut])
@router.get("/", response_model=List[CitaOut])
@router.get("/mis-citas", response_model=List[CitaOut])
@router.get("/mis-citas/", response_model=List[CitaOut])
def listar_citas_usuario(
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tutor_profile = db.query(Tutor).filter(Tutor.estudiante_id_estudiante == current_user.id_estudiante).first()
    
    conditions = [Cita.estudiante_id_estudiante == current_user.id_estudiante]
    if tutor_profile:
        conditions.append(Cita.tutor_id_tutor == tutor_profile.id_tutor)

    citas = db.query(Cita).filter(or_(*conditions)).order_by(Cita.fecha_hora_inicio.desc()).all()
    return citas


# --- ACTUALIZAR ESTADO DE CITA ---
@router.put("/{id}/estado")
@router.put("/{id}/estado/")
def actualizar_estado_cita(
    id: int,
    datos: CitaStatusUpdate,
    request: Request,
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cita = db.query(Cita).filter(Cita.id_cita == id).first()
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")

    tutor = db.query(Tutor).filter(Tutor.id_tutor == cita.tutor_id_tutor).first()
    
    es_su_estudiante = (cita.estudiante_id_estudiante == current_user.id_estudiante)
    es_su_tutor = (tutor and tutor.estudiante_id_estudiante == current_user.id_estudiante)
    rol_str = current_user.rol.value if hasattr(current_user.rol, 'value') else str(current_user.rol)
    es_admin = (rol_str == "Admin")

    if not (es_su_estudiante or es_su_tutor or es_admin):
        raise HTTPException(status_code=403, detail="No tiene permisos para modificar esta cita.")

    estado_anterior = cita.estado.value if hasattr(cita.estado, 'value') else str(cita.estado)

    # Extraer el valor en string limpio
    nuevo_val = datos.nuevo_estado
    nuevo_estado_str = nuevo_val.value if hasattr(nuevo_val, "value") else str(nuevo_val)

    cita.estado = nuevo_estado_str

    try:
        db.commit()
        db.refresh(cita)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en base de datos: {str(e)}")

    try:
        log_audit(db, request, "CAMBIO_ESTADO_CITA", f"Cita ID {cita.id_cita} cambió de '{estado_anterior}' a '{nuevo_estado_str}'", current_user.id_estudiante)
    except Exception:
        pass

    return {
        "id_cita": cita.id_cita,
        "estado": nuevo_estado_str,
        "materia_tema": cita.materia_tema,
        "message": "Estado de la cita actualizado con éxito."
    }