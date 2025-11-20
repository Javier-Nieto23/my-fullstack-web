#!/bin/bash

# Script para desarrollo local - no afecta Railway
echo "🚀 Iniciando entorno de desarrollo local..."

# Verificar que PostgreSQL esté corriendo
echo "📊 Verificando PostgreSQL..."
if ! docker compose ps postgres | grep -q "healthy"; then
    echo "⏳ Iniciando PostgreSQL..."
    docker compose up -d postgres
    sleep 5
fi

echo "✅ PostgreSQL listo"

# Configurar variables de entorno para desarrollo local
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydatabase"
export NODE_ENV=development
export JWT_SECRET=local-development-secret-key

echo "🔧 Variables de entorno configuradas para desarrollo local"
echo "📝 DATABASE_URL: $DATABASE_URL"
echo "🌍 NODE_ENV: $NODE_ENV"

# Crear .env temporal para frontend
cat > frontend/.env.local << EOF
VITE_API_URL=http://localhost:3000
EOF

echo "📱 Frontend configurado para usar backend local"

echo ""
echo "🎯 Para iniciar el desarrollo:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "🌐 URLs de desarrollo:"
echo "   Backend:  http://localhost:3000"
echo "   Frontend: http://localhost:5173"
echo "   Health:   http://localhost:3000/health"
echo ""
echo "💡 Esto NO afecta tu configuración de Railway en producción"