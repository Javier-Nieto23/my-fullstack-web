#!/bin/bash

# Script para desplegar a Railway
# Uso: ./deploy-railway.sh

set -e

echo "🚀 Iniciando despliegue a Railway..."

# Verificar que Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI no está instalado."
    echo "Instálalo con: npm install -g @railway/cli"
    echo "O desde: https://railway.app/cli"
    exit 1
fi

# Login a Railway
echo "🔐 Conectando a Railway..."
railway login

# Seleccionar proyecto (si tienes varios)
echo "📦 Selecciona tu proyecto en Railway..."
railway link

# Mostrar el estado del proyecto
echo "📊 Estado del proyecto:"
railway status

# Desplegar
echo "⬆️  Desplegando..."
git push railway main

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "📝 Pasos siguientes:"
echo "1. Verifica los logs: railway logs"
echo "2. Obtén la URL de tu backend: railway variables"
echo "3. Actualiza VITE_API_URL en tu frontend con la URL de Railway"
echo ""
echo "Para ver más información:"
echo "  - Logs en vivo: railway logs -f"
echo "  - Variables: railway variables"
echo "  - Abrir dashboard: railway open"
