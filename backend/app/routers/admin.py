from typing import List
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Auditoria, Tutor, EstadoAprobacion, RolUsuario, Estudiante
from app.schemas import AuditoriaOut, TutorOut
from app.auth import require_admin, log_audit

router = APIRouter(prefix="/api/admin", tags=["Administración y Auditoría"])

@router.get("/auditoria", response_model=List[AuditoriaOut])
def consultar_auditoria(
    db: Session = Depends(get_db),
    admin_user: Estudiante = Depends(require_admin)
):
    return db.query(Auditoria).order_by(Auditoria.fecha_hora.desc()).limit(200).all()

@router.get("/tutores/pendientes", response_model=List[TutorOut])
def listar_postulaciones_pendientes(
    db: Session = Depends(get_db),
    admin_user: Estudiante = Depends(require_admin)
):
    return db.query(Tutor).filter(Tutor.estado_aprobacion == EstadoAprobacion.Pendiente).all()

@router.put("/tutores/{id}/aprobar", response_model=TutorOut)
def aprobar_tutor_manualmente(
    id: int,
    aprobar: bool,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: Estudiante = Depends(require_admin)
):
    tutor = db.query(Tutor).filter(Tutor.id_tutor == id).first()
    if not tutor:
        raise HTTPException(status_code=404, detail="Tutor no encontrado.")

    tutor.estado_aprobacion = EstadoAprobacion.Aprobado if aprobar else EstadoAprobacion.Rechazado
    if aprobar:
        tutor.estudiante.es_tutor = True
        tutor.estudiante.rol = RolUsuario.Tutor

    db.commit()
    db.refresh(tutor)

    log_audit(db, request, "REVISION_MANUAL_TUTOR", f"Admin aprobó={aprobar} al tutor ID {id}", admin_user.id_estudiante)
    return tutor
