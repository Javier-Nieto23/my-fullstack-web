#!/bin/bash

echo "🚀 DEPLOY A RAILWAY CON HERRAMIENTAS PDF"
echo "========================================"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo "📦 Preparando proyecto para Railway..."

# 1. Verificar que Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI no encontrado. Instalando..."
    npm install -g @railway/cli
fi

# 2. Login a Railway (si no está logueado)
echo "🔐 Verificando autenticación Railway..."
railway status || railway login

# 3. Conectar proyecto o crear uno nuevo
echo "🔗 Conectando proyecto Railway..."
railway link || echo "⚠️  Si no existe, crea un proyecto nuevo en railway.app"

# 4. Configurar variables de entorno necesarias
echo "🔧 Configurando variables de entorno..."

# Variables básicas
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -hex 32)

echo "✅ Variables básicas configuradas"
echo ""
echo "⚠️  CONFIGURA MANUALMENTE EN RAILWAY:"
echo "   - DATABASE_URL (PostgreSQL)"
echo "   - CLOUDFLARE_ACCOUNT_ID"
echo "   - CLOUDFLARE_ACCESS_KEY_ID" 
echo "   - CLOUDFLARE_SECRET_ACCESS_KEY"
echo "   - CLOUDFLARE_BUCKET_NAME"
echo "   - CLOUDFLARE_BUCKET_URL"
echo ""

# 5. Verificar Dockerfile
echo "🐳 Verificando Dockerfile..."
if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile no encontrado"
    exit 1
fi

# Mostrar herramientas que se instalarán
echo "📋 Herramientas PDF que se instalarán en Railway:"
echo "   ✅ Ghostscript (conversión PDF)"
echo "   ✅ Poppler-utils (análisis PDF)" 
echo "   ✅ MuPDF-tools (validación PDF)"
echo "   ✅ ImageMagick (procesamiento imágenes)"
echo ""

# 6. Deploy
echo "🚀 Iniciando deploy a Railway..."
railway up

echo ""
echo "✅ Deploy completado!"
echo "🌐 Tu aplicación estará disponible en la URL de Railway"
echo "📊 Monitorea logs con: railway logs"
echo "🔧 Ver variables: railway variables"

echo ""
echo "📝 PASOS SIGUIENTES:"
echo "1. Configura las variables de Cloudflare en railway.app"
echo "2. Configura la base de datos PostgreSQL"
echo "3. Actualiza VITE_API_URL en Vercel"
echo "4. Prueba el procesamiento de PDFs"