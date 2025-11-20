#!/bin/bash

echo "🌐 CONFIGURACIÓN VERCEL FRONTEND"
echo "================================"

# Variables para Vercel (frontend)
echo "📝 Configurando variables de entorno para Vercel..."

# Vercel CLI check
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI no encontrado. Instalando..."
    npm install -g vercel
fi

echo "🔗 Conectando proyecto Vercel..."
vercel link || echo "⚠️  Si no existe, crea un proyecto nuevo en vercel.com"

echo "🔧 Configurando variables de entorno..."

# Solicitar URL del backend de Railway
echo ""
read -p "🌐 Ingresa la URL de tu backend de Railway (ej: https://your-app.railway.app): " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo "❌ URL del backend es requerida"
    exit 1
fi

# Configurar variables en Vercel
vercel env add VITE_API_URL production "$BACKEND_URL"
vercel env add VITE_API_URL preview "$BACKEND_URL"

echo "✅ Variables configuradas en Vercel"

# Deploy frontend
echo "🚀 Iniciando deploy del frontend a Vercel..."
vercel --prod

echo ""
echo "✅ Frontend deployado a Vercel!"
echo "🌐 URL: https://your-project.vercel.app"
echo ""
echo "📝 CONFIGURACIÓN COMPLETA:"
echo "   ✅ Frontend en Vercel"
echo "   ✅ Backend en Railway con herramientas PDF"
echo "   ✅ Variables de entorno configuradas"
echo ""
echo "🧪 PRUEBA EL SISTEMA:"
echo "1. Ve a tu URL de Vercel"
echo "2. Inicia sesión"
echo "3. Sube un PDF"
echo "4. Verifica que aparezca en 'Documentos Procesados'"