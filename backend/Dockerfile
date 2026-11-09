FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copiamos solo requirements e instalamos sin guardar cache para ahorrar RAM
COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

# Copiamos el resto del codigo
COPY . .

# Exponemos el puerto 10000 que busca Render
EXPOSE 10000

# Forzamos a uvicorn a escuchar en el puerto 10000 de Render de forma liviana
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"]