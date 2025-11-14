#!/bin/bash

# Script de inicio para Railway
# Este archivo permite que Railway detecte automáticamente cómo iniciar la aplicación

set -e

echo "🚀 Iniciando aplicación en Railway..."

# Navegar al directorio del backend
cd backend

# Instalar dependencias si es necesario
echo "📦 Verificando dependencias..."
npm ci --prefer-offline --no-audit || npm install

# Generar cliente Prisma
echo "🔧 Generando cliente Prisma..."
npx prisma generate || echo "⚠️ Cliente Prisma ya existe"

# Ejecutar migraciones
echo "🗄️ Ejecutando migraciones..."
npx prisma migrate deploy --skip-seed || echo "⚠️ Migraciones ya aplicadas"

# Iniciar servidor
echo "✅ Iniciando servidor..."
npm start
