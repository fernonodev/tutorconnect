import os
import re
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Estudiante, Auditoria, RolUsuario

SECRET_KEY = os.getenv("JWT_SECRET", "unves_politecnica_tutorconnect_secret_key_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password[:72], hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def log_audit(db: Session, request: Request, accion: str, detalles: str, usuario_id: int = None):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if "x-forwarded-for" in request.headers:
        client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Validar que usuario_id sea numérico o None para evitar fallos de inserción
    id_valido = None
    if usuario_id is not None:
        try:
            id_valido = int(usuario_id)
        except (ValueError, TypeError):
            id_valido = None

    log_entry = Auditoria(
        fecha_hora=datetime.utcnow(),
        usuario_id=id_valido,
        accion=accion,
        detalles=detalles,
        ip_origen=client_ip
    )
    db.add(log_entry)
    db.commit()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Estudiante:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación no válidas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 1. Buscar primero por email por si el token contiene el correo
    user = db.query(Estudiante).filter(Estudiante.email == str(user_id)).first()

    # 2. Si no se encuentra por correo y 'sub' es un número, buscar por ID
    if not user and str(user_id).isdigit():
        user = db.query(Estudiante).filter(Estudiante.id_estudiante == int(user_id)).first()

    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: Estudiante = Depends(get_current_user)) -> Estudiante:
    if current_user.rol != RolUsuario.Admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren permisos de Administrador."
        )
    return current_user