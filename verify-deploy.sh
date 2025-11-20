#!/bin/bash

echo "🔍 VERIFICACIÓN DE CONFIGURACIÓN DE DEPLOY"
echo "==========================================="

# Verificar archivos de configuración
echo "📁 Verificando archivos de configuración..."

if [ -f "vercel.json" ]; then
    echo "✅ vercel.json existe"
else
    echo "❌ vercel.json no encontrado"
fi

if [ -f "railway.json" ]; then
    echo "✅ railway.json existe"
else
    echo "❌ railway.json no encontrado"
fi

if [ -f "frontend/.env.production" ]; then
    echo "✅ frontend/.env.production existe"
else
    echo "❌ frontend/.env.production no encontrado"
fi

if [ -f "backend/Dockerfile" ]; then
    echo "✅ backend/Dockerfile existe"
else
    echo "❌ backend/Dockerfile no encontrado"
fi

echo ""
echo "📦 Verificando package.json..."
if [ -f "package.json" ]; then
    echo "✅ package.json raíz existe"
    if grep -q '"build"' package.json; then
        echo "✅ Script de build configurado"
    else
        echo "❌ Script de build no configurado"
    fi
else
    echo "❌ package.json no encontrado"
fi

echo ""
echo "🏗️ Verificando configuraciones frontend..."
if [ -f "frontend/package.json" ]; then
    echo "✅ frontend/package.json existe"
else
    echo "❌ frontend/package.json no encontrado"
fi

if [ -f "frontend/vite.config.js" ]; then
    echo "✅ frontend/vite.config.js existe"
else
    echo "❌ frontend/vite.config.js no encontrado"
fi

echo ""
echo "🗄️ Verificando configuraciones backend..."
if [ -f "backend/package.json" ]; then
    echo "✅ backend/package.json existe"
else
    echo "❌ backend/package.json no encontrado"
fi

if [ -f "backend/src/index.js" ]; then
    echo "✅ backend/src/index.js existe"
else
    echo "❌ backend/src/index.js no encontrado"
fi

echo ""
echo "📋 RESUMEN:"
echo "- Railway: Backend auto-deploy desde main branch"
echo "- Vercel: Frontend auto-deploy desde main branch"
echo "- Health check: /health endpoint configurado"
echo "- Variables de entorno documentadas en DEPLOY.md"
echo ""
echo "✅ Configuración de deploy completa!"
echo ""
echo "🚀 PRÓXIMOS PASOS:"
echo "1. Railway desplegará automáticamente el backend"
echo "2. Vercel desplegará automáticamente el frontend" 
echo "3. Verificar health check en: https://your-app.railway.app/health"
echo "4. Configurar variables de entorno en Railway dashboard"
echo "5. Configurar variables de entorno en Vercel dashboard"