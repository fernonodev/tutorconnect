from datetime import datetime, time
from typing import Optional, List, Union
from pydantic import BaseModel, EmailStr, Field
from app.models import RolUsuario, HonorarioTipo, EstadoAprobacion, ModalidadCita, EstadoCita


# --- CARRERA & ESTUDIANTE ---

class CarreraOut(BaseModel):
    id_carrera: int
    nombre: str

    class Config:
        from_attributes = True


class EstudianteRegister(BaseModel):
    nombres: str = Field(..., min_length=2, max_length=100)
    apellidos: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    carrera_id_carrera: int


class EstudianteOut(BaseModel):
    id_estudiante: int
    nombres: str
    apellidos: str
    email: str
    es_tutor: bool
    rol: RolUsuario
    carrera_id_carrera: Optional[int] = None
    carrera: Optional[CarreraOut] = None

    class Config:
        from_attributes = True


# --- AUTH & TOKEN ---

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: EstudianteOut


# --- DISPONIBILIDAD ---

class DisponibilidadCreate(BaseModel):
    dia_semana: str
    hora_inicio: Union[time, str]
    hora_fin: Union[time, str]


class DisponibilidadOut(BaseModel):
    id: int
    dia_semana: str
    hora_inicio: Union[time, str]
    hora_fin: Union[time, str]
    tutor_id_tutor: int

    class Config:
        from_attributes = True


# --- RESEÑAS & CALIFICACIONES ---

class ResenaCreate(BaseModel):
    puntuacion: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = None


class ResenaOut(BaseModel):
    id_resena: int
    puntuacion: int
    comentario: Optional[str] = None
    fecha_creacion: datetime
    cita_id_cita: int
    tutor_id_tutor: int
    estudiante_id_estudiante: int

    class Config:
        from_attributes = True


# --- TUTOR ---

class TutorOut(BaseModel):
    id_tutor: int
    promedio: float
    tipo_honorario: HonorarioTipo
    tarifa_hora: Optional[float] = 0.0
    estado_aprobacion: EstadoAprobacion
    ficha_academica_url: str
    estudiante_id_estudiante: int
    estudiante: Optional[EstudianteOut] = None
    rating_promedio: Optional[float] = 0.0
    total_resenas: Optional[int] = 0

    class Config:
        from_attributes = True


class ActualizarTarifaSchema(BaseModel):
    tipo_honorario: str
    tarifa_hora: float = 0.0


# --- CITAS Y TUTORÍAS ---

class CitaCreate(BaseModel):
    tutor_id_tutor: int
    fecha_hora_inicio: str
    fecha_hora_fin: str
    modalidad: ModalidadCita
    lugar_link: str
    materia_tema: str


class CitaStatusUpdate(BaseModel):
    nuevo_estado: Union[EstadoCita, str]


class CitaOut(BaseModel):
    id_cita: int
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    modalidad: ModalidadCita
    lugar_link: str
    estado: Union[EstadoCita, str]
    materia_tema: str
    tutor_id_tutor: int
    estudiante_id_estudiante: int
    tutor: Optional[TutorOut] = None
    estudiante: Optional[EstudianteOut] = None
    resena: Optional[ResenaOut] = None

    class Config:
        from_attributes = True


# --- AUDITORÍA ---

class AuditoriaOut(BaseModel):
    id_log: int
    fecha_hora: datetime
    usuario_id: Optional[int] = None
    accion: str
    detalles: str
    ip_origen: str

    class Config:
        from_attributes = True