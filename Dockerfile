FROM node:20-alpine
WORKDIR /app

# Instalar dependencias necesarias para Prisma
RUN apk add --no-cache openssl

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

# Railway ejecutará el startCommand desde railway.json
CMD ["node", "src/index.js"]