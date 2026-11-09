from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Materia
from pydantic import BaseModel

router = APIRouter(prefix="/api/carreras", tags=["Materias"])

class MateriaOut(BaseModel):
    id_materia: int
    nombre: str
    carrera_id_carrera: int

    class Config:
        from_attributes = True

@router.get("/{carrera_id}/materias", response_model=List[MateriaOut])
def listar_materias_por_carrera(carrera_id: int, db: Session = Depends(get_db)):
    materias = db.query(Materia).filter(Materia.carrera_id_carrera == carrera_id).order_by(Materia.nombre.asc()).all()
    if not materias:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontraron materias para esta carrera.")
    return materias