FROM python:3.11-slim

WORKDIR /app

# Evita la creación de archivos .pyc y fuerza el buffering directo a stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instala dependencias del sistema necesarias para pymysql / compilación ligera
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar sin guardar cache para ahorrar RAM/espacio
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código del backend
COPY . .

# Render asigna dinámicamente un puerto en la variable PORT (por defecto 10000)
EXPOSE 8000

# Ejecutar uvicorn de forma liviana con un solo worker
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]