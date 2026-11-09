import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base, SessionLocal
from app.models import Carrera, Estudiante, RolUsuario
from app.auth import hash_password
from app.routers import auth, tutores, citas, admin, materias, auditoria

# Intentar importar auditoria si existe como router independiente
try:
    from app.routers import auditoria
    has_auditoria_router = True
except ImportError:
    has_auditoria_router = False

# Crear tablas en MySQL si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TutorConnect API - FP UNVES",
    description="Plataforma de gestión de tutorías para la Facultad Politécnica de la UNVES",
    version="1.0.0"
)

# Configuración de CORS para permitir solicitudes desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_initial_data():
    """Poblar datos iniciales requeridos: Carreras por defecto y Administrador."""
    db = SessionLocal()
    try:
        carreras_defecto = [
            "Ingeniería en Sistemas Informáticos",
            "Ingeniería Eléctrica"
        ]
        for nombre in carreras_defecto:
            if not db.query(Carrera).filter(Carrera.nombre == nombre).first():
                db.add(Carrera(nombre=nombre))
        db.commit()

        admin_email = "admin@fp-unves.edu.py"
        if not db.query(Estudiante).filter(Estudiante.email == admin_email).first():
            admin_user = Estudiante(
                nombres="Administrador",
                apellidos="FP-UNVES",
                email=admin_email,
                password_hash=hash_password("AdminUnves2026!"),
                es_tutor=False,
                rol=RolUsuario.Admin,
                carrera_id_carrera=1,
                is_verified=True
            )
            db.add(admin_user)
            db.commit()
    finally:
        db.close()


# Ejecutar siembra de datos al iniciar
seed_initial_data()

# Registrar Routers de la API
app.include_router(materias.router)
app.include_router(auth.router)
app.include_router(tutores.router)
app.include_router(citas.router)
app.include_router(admin.router)
app.include_router(auditoria.router)
if has_auditoria_router:
    app.include_router(auditoria.router)

# Asegurar directorio de subida de archivos (fichas académicas)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "institution": "FP-UNVES",
        "app": "TutorConnect"
    }