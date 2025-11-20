#!/bin/bash

echo "🔍 VERIFICACIÓN DE CONFIGURACIÓN CLOUDFLARE R2"
echo "==============================================="

echo "📋 Variables de entorno necesarias:"
echo ""

# Verificar variables de entorno
check_var() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -n "$var_value" ]; then
        echo "✅ $var_name: configurado (${var_value:0:10}...)"
    else
        echo "❌ $var_name: NO CONFIGURADO"
        return 1
    fi
}

# Variables principales
echo "🔧 Configuración básica:"
check_var "R2_ACCOUNT_ID" || R2_ERRORS=1
check_var "R2_ACCESS_KEY_ID" || R2_ERRORS=1  
check_var "R2_SECRET_ACCESS_KEY" || R2_ERRORS=1
check_var "R2_BUCKET_NAME" || R2_ERRORS=1

echo ""
echo "🌐 Configuración opcional:"
check_var "R2_CUSTOM_DOMAIN"
check_var "R2_ENDPOINT"

echo ""
if [ "$R2_ERRORS" = "1" ]; then
    echo "❌ CONFIGURACIÓN INCOMPLETA"
    echo ""
    echo "📝 Variables faltantes - configura en Railway:"
    echo "   R2_ACCOUNT_ID=tu-account-id"
    echo "   R2_ACCESS_KEY_ID=tu-access-key"  
    echo "   R2_SECRET_ACCESS_KEY=tu-secret-key"
    echo "   R2_BUCKET_NAME=tu-bucket-name"
    echo ""
    echo "🔗 Obtén estas credenciales en:"
    echo "   https://dash.cloudflare.com > R2 Object Storage > Manage R2 API tokens"
    exit 1
else
    echo "✅ CONFIGURACIÓN COMPLETA"
    echo ""
    echo "🧪 Para probar la conexión, ejecuta:"
    echo "   curl http://localhost:3000/health"
fi