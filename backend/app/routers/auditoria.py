from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Auditoria, Estudiante, RolUsuario
from app.schemas import AuditoriaOut  # O define la clase Pydantic en este archivo
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/auditoria", tags=["Auditoria"])

@router.get("", response_model=List[AuditoriaOut])
@router.get("/", response_model=List[AuditoriaOut])
def listar_logs_auditoria(
    current_user: Estudiante = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Restringir solo a Administradores
    if current_user.rol != RolUsuario.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Acceso denegado. Se requieren permisos de administrador."
        )
    
    logs = db.query(Auditoria).order_by(Auditoria.fecha_hora.desc()).all()
    return logs