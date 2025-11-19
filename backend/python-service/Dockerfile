# Usar una imagen base de Python
FROM python:3.9-slim

# Establecer un directorio de trabajo
WORKDIR /app

# Copiar los archivos de la aplicación al contenedor
COPY . /app

# Instalar las dependencias necesarias
RUN pip install --no-cache-dir -r requirements.txt

# Exponer el puerto en el que Flask correrá (por defecto Flask usa el puerto 5000)
EXPOSE 5000

# Comando para ejecutar la API
CMD ["python", "app.py"]
