FROM node:20-alpine
WORKDIR /app

# Instalar herramientas PDF necesarias y dependencias del sistema
RUN apk add --no-cache \
    openssl \
    poppler-utils \
    mupdf-tools \
    ghostscript \
    && ln -sf /usr/bin/mutool /usr/local/bin/mutool

# Verificar que las herramientas estén disponibles
RUN pdfinfo -v && pdfimages -help && mutool -v && gs --version

# Copiar archivos de dependencias del backend
COPY backend/package*.json ./

# Instalar dependencias del backend
RUN npm install

# Copiar prisma schema y migraciones
COPY prisma ./prisma

# Generar cliente Prisma
RUN npx prisma generate

# Copiar código fuente del backend
COPY backend/src ./src

# Exponer puerto
EXPOSE 3000

# Start script que ejecuta migraciones y luego el servidor
CMD ["sh", "-c", "npx prisma migrate deploy --skip-seed || echo 'Migration already applied' && node src/index.js"]