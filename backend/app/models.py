import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, 
    Enum, DateTime, Time, ForeignKey, Text, Table
)
from sqlalchemy.orm import relationship
from app.database import Base


# --- TABLAS DE ASOCIACIÓN (Muchos a Muchos) ---

tutor_materia = Table(
    'tutor_materia',
    Base.metadata,
    Column('tutor_id_tutor', Integer, ForeignKey('tutor.id_tutor', ondelete="CASCADE"), primary_key=True),
    Column('materia_id_materia', Integer, ForeignKey('materia.id_materia', ondelete="CASCADE"), primary_key=True)
)


# --- ENUMS ---

class RolUsuario(str, enum.Enum):
    Estudiante = "Estudiante"
    Tutor = "Tutor"
    Admin = "Admin"


class HonorarioTipo(str, enum.Enum):
    Voluntario = "Voluntario"
    Remunerado = "Remunerado"


class EstadoAprobacion(str, enum.Enum):
    Pendiente = "Pendiente"
    Aprobado = "Aprobado"
    Rechazado = "Rechazado"


class ModalidadCita(str, enum.Enum):
    Presencial = "Presencial"
    Virtual = "Virtual"


class EstadoCita(str, enum.Enum):
    Pendiente = "Pendiente"
    Aprobada = "Aprobada"
    Programada = "Programada"
    Rechazada = "Rechazada"
    Cancelada = "Cancelada"
    Finalizada = "Finalizada"
    Reprogramada = "Reprogramada"
    Realizada = "Realizada"


# --- MODELOS ---

class Carrera(Base):
    __tablename__ = "carrera"

    id_carrera = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(150), nullable=False, unique=True)

    estudiantes = relationship("Estudiante", back_populates="carrera")
    materias = relationship("Materia", back_populates="carrera", cascade="all, delete-orphan")


class Materia(Base):
    __tablename__ = "materia"

    id_materia = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(150), nullable=False)
    carrera_id_carrera = Column(Integer, ForeignKey("carrera.id_carrera", ondelete="CASCADE"), nullable=False)

    carrera = relationship("Carrera", back_populates="materias")
    tutores = relationship("Tutor", secondary=tutor_materia, back_populates="materias_imparte")


class Estudiante(Base):
    __tablename__ = "estudiante"

    id_estudiante = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    es_tutor = Column(Boolean, default=False)
    rol = Column(Enum(RolUsuario), default=RolUsuario.Estudiante, nullable=False)
    carrera_id_carrera = Column(Integer, ForeignKey("carrera.id_carrera"), nullable=False)

    # Confirmación de correo y recuperación de contraseña
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

    carrera = relationship("Carrera", back_populates="estudiantes")
    perfil_tutor = relationship("Tutor", back_populates="estudiante", uselist=False)
    citas_solicitadas = relationship(
        "Cita",
        back_populates="estudiante",
        foreign_keys="Cita.estudiante_id_estudiante"
    )
    resenas_realizadas = relationship("Resena", back_populates="estudiante")


class Tutor(Base):
    __tablename__ = "tutor"

    id_tutor = Column(Integer, primary_key=True, index=True, autoincrement=True)
    promedio = Column(Float, nullable=False)
    tipo_honorario = Column(Enum(HonorarioTipo), default=HonorarioTipo.Voluntario, nullable=False)
    tarifa_hora = Column(Float, nullable=True, default=0.0)
    estado_aprobacion = Column(Enum(EstadoAprobacion), default=EstadoAprobacion.Pendiente, nullable=False)
    ficha_academica_url = Column(String(255), nullable=False)
    estudiante_id_estudiante = Column(Integer, ForeignKey("estudiante.id_estudiante"), unique=True, nullable=False)

    estudiante = relationship("Estudiante", back_populates="perfil_tutor")
    disponibilidades = relationship("DisponibilidadTutor", back_populates="tutor", cascade="all, delete-orphan")
    citas_recibidas = relationship(
        "Cita",
        back_populates="tutor",
        foreign_keys="Cita.tutor_id_tutor"
    )
    resenas = relationship("Resena", back_populates="tutor")
    materias_imparte = relationship("Materia", secondary=tutor_materia, back_populates="tutores")


class DisponibilidadTutor(Base):
    __tablename__ = "disponibilidad_tutor"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dia_semana = Column(String(20), nullable=False)
    hora_inicio = Column(Time, nullable=False)
    hora_fin = Column(Time, nullable=False)
    tutor_id_tutor = Column(Integer, ForeignKey("tutor.id_tutor"), nullable=False)

    tutor = relationship("Tutor", back_populates="disponibilidades")


class Cita(Base):
    __tablename__ = "cita"

    id_cita = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fecha_hora_inicio = Column(DateTime, nullable=False, index=True)
    fecha_hora_fin = Column(DateTime, nullable=False, index=True)
    modalidad = Column(Enum(ModalidadCita), default=ModalidadCita.Presencial, nullable=False)
    lugar_link = Column(String(255), nullable=False)
    estado = Column(String(50), default="Pendiente", nullable=False)
    materia_tema = Column(String(200), nullable=False)
    
    tutor_id_tutor = Column(Integer, ForeignKey("tutor.id_tutor"), nullable=False)
    estudiante_id_estudiante = Column(Integer, ForeignKey("estudiante.id_estudiante"), nullable=False)

    tutor = relationship("Tutor", back_populates="citas_recibidas")
    estudiante = relationship("Estudiante", back_populates="citas_solicitadas")
    resena = relationship("Resena", back_populates="cita", uselist=False, cascade="all, delete-orphan")


class Resena(Base):
    __tablename__ = "resena"

    id_resena = Column(Integer, primary_key=True, index=True, autoincrement=True)
    puntuacion = Column(Integer, nullable=False)
    comentario = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

    cita_id_cita = Column(Integer, ForeignKey("cita.id_cita"), unique=True, nullable=False)
    tutor_id_tutor = Column(Integer, ForeignKey("tutor.id_tutor"), nullable=False)
    estudiante_id_estudiante = Column(Integer, ForeignKey("estudiante.id_estudiante"), nullable=False)

    cita = relationship("Cita", back_populates="resena")
    tutor = relationship("Tutor", back_populates="resenas")
    estudiante = relationship("Estudiante", back_populates="resenas_realizadas")


class Auditoria(Base):
    __tablename__ = "auditoria"

    id_log = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fecha_hora = Column(DateTime, default=datetime.utcnow, nullable=False)
    usuario_id = Column(Integer, nullable=True)
    accion = Column(String(100), nullable=False)
    detalles = Column(Text, nullable=False)
    ip_origen = Column(String(45), nullable=False)