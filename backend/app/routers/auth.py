import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models import Estudiante, RolUsuario
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from app.utils.email import enviar_correo

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


# --- Schemas de Validación Pydantic ---

class RegisterSchema(BaseModel):
    nombres: str
    apellidos: str
    email: EmailStr
    password: str
    carrera_id_carrera: int


class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordSchema(BaseModel):
    email: EmailStr


class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str


# --- Endpoints ---

@router.post("/register", status_code=status.HTTP_201_CREATED)
def registrar_estudiante(datos: RegisterSchema, db: Session = Depends(get_db)):
    estudiante_existente = db.query(Estudiante).filter(Estudiante.email == datos.email).first()
    if estudiante_existente:
        raise HTTPException(
            status_code=400,
            detail="El correo electrónico ya se encuentra registrado."
        )

    nuevo_estudiante = Estudiante(
        nombres=datos.nombres,
        apellidos=datos.apellidos,
        email=datos.email,
        password_hash=hash_password(datos.password),
        carrera_id_carrera=datos.carrera_id_carrera,
        rol=RolUsuario.Estudiante,
        es_tutor=False,
        is_verified=False
    )
    db.add(nuevo_estudiante)
    db.commit()
    db.refresh(nuevo_estudiante)

    return {
        "message": "Registro completado exitosamente.",
        "id_estudiante": nuevo_estudiante.id_estudiante
    }


@router.post("/login")
def iniciar_sesion(datos: LoginSchema, db: Session = Depends(get_db)):
    usuario = db.query(Estudiante).filter(Estudiante.email == datos.email).first()
    if not usuario or not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos."
        )

    # Extraer el valor del rol de forma segura (sea Enum o str)
    rol_valor = usuario.rol.value if hasattr(usuario.rol, "value") else str(usuario.rol)

    access_token = create_access_token(
        data={"sub": usuario.email, "rol": rol_valor}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id_estudiante": usuario.id_estudiante,
            "nombres": usuario.nombres,
            "apellidos": usuario.apellidos,
            "email": usuario.email,
            "rol": rol_valor,
            "es_tutor": usuario.es_tutor,
            "carrera_id_carrera": usuario.carrera_id_carrera
        }
    }


@router.post("/forgot-password")
def solicitar_recuperacion(
    payload: ForgotPasswordSchema,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    usuario = db.query(Estudiante).filter(Estudiante.email == payload.email).first()
    
    # Respuesta estándar de seguridad (no revela la existencia del usuario)
    respuesta = {"message": "Si el correo está registrado en la FP-UNVES, recibirás las instrucciones de recuperación."}

    if not usuario:
        return respuesta

    # Generar token aleatorio seguro y expiración a 1 hora
    token = secrets.token_urlsafe(32)
    usuario.reset_token = token
    usuario.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    reset_link = f"http://localhost:8080/#/reset-password?token={token}"
    html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #004085;">TutorConnect - FP UNVES</h2>
            <p>Hola <strong>{usuario.nombres}</strong>,</p>
            <p>Se ha solicitado un restablecimiento de contraseña para tu cuenta.</p>
            <p>Haz clic en el botón a continuación para ingresar tu nueva contraseña (enlace válido por 1 hora):</p>
            <p style="text-align: center; margin: 25px 0;">
                <a href="{reset_link}" style="background-color: #004085; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    Restablecer Contraseña
                </a>
            </p>
            <p style="font-size: 0.85rem; color: #666;">Si no realizaste esta solicitud, puedes ignorar este mensaje de forma segura.</p>
        </div>
    """

    background_tasks.add_task(
        enviar_correo,
        usuario.email,
        "Recuperación de Contraseña - TutorConnect FP-UNVES",
        html_content
    )

    return respuesta


@router.post("/reset-password")
def restablecer_password(payload: ResetPasswordSchema, db: Session = Depends(get_db)):
    if not payload.token or not payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="Se requiere el token de recuperación y la nueva contraseña."
        )

    usuario = db.query(Estudiante).filter(Estudiante.reset_token == payload.token).first()

    if not usuario or not usuario.reset_token_expires or usuario.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="El token de recuperación es inválido o ha expirado."
        )

    usuario.password_hash = hash_password(payload.new_password)
    usuario.reset_token = None
    usuario.reset_token_expires = None
    db.commit()

    return {"message": "Contraseña actualizada exitosamente. Ahora puedes iniciar sesión."}


@router.get("/me")
def obtener_perfil_actual(current_user: Estudiante = Depends(get_current_user)):
    return {
        "id_estudiante": current_user.id_estudiante,
        "nombres": current_user.nombres,
        "apellidos": current_user.apellidos,
        "email": current_user.email,
        "rol": current_user.rol.value,
        "es_tutor": current_user.es_tutor,
        "carrera_id_carrera": current_user.carrera_id_carrera,
        "is_verified": current_user.is_verified
    }