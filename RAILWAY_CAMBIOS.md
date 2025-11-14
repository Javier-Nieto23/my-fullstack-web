# 📦 Cambios realizados para conectar Railway

## Archivos creados/modificados

### 📄 Nuevos archivos

| Archivo                  | Propósito                                                       |
| ------------------------ | --------------------------------------------------------------- |
| `Procfile`               | Configuración de Railway: ejecuta migraciones + inicia servidor |
| `railway.json`           | Configuración opcional de Railway (build + deploy)              |
| `.env.railway`           | Variables de entorno ejemplo para Railway                       |
| `RAILWAY_SETUP.md`       | Documentación técnica detallada                                 |
| `RAILWAY_PASO_A_PASO.md` | Guía paso a paso en español (recomendado leer)                  |
| `RAILWAY_QUICK_START.md` | Guía rápida 5 minutos                                           |
| `deploy-railway.sh`      | Script bash para desplegar con Railway CLI                      |

### ✏️ Archivos modificados

| Archivo                | Cambio                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `backend/Dockerfile`   | Ahora ejecuta `npx prisma migrate deploy` antes de iniciar servidor |
| `backend/src/index.js` | Mejorado CORS, variables de entorno, y binding a `0.0.0.0`          |
| `.env.example`         | Actualizado con variables para desarrollo y producción              |

---

## 🎯 Flujo de despliegue en Railway

```
tu-repositorio/main
        ↓
  Railway detecta push
        ↓
  Instala dependencias (npm install)
        ↓
  Genera cliente Prisma (npx prisma generate)
        ↓
  Ejecuta migraciones (npx prisma migrate deploy)
        ↓
  Inicia servidor (npm start)
        ↓
  Backend disponible en https://tu-app-railway.up.railway.app
```

---

## 🔧 Configuración requerida en Railway

### Servicios a desplegar

1. **PostgreSQL** (automático)

   - Railway lo inyecta como `DATABASE_URL`

2. **Backend** (desde GitHub)
   - Root directory: `backend`
   - Start command: `npm start` (en package.json)
   - Build: `npm install`

### Variables de entorno necesarias

En el dashboard de Railway, en **Variables** del backend:

```
PORT=3000
JWT_SECRET=<tu-clave-secura>
NODE_ENV=production
FRONTEND_URL=<url-de-tu-frontend>
```

> `DATABASE_URL` se inyecta automáticamente desde PostgreSQL

---

## 📋 Checklist de despliegue

- [ ] Tienes cuenta en railway.app
- [ ] Conectaste GitHub a Railway
- [ ] Hiciste push de los cambios a `main`
- [ ] Creaste PostgreSQL en Railway
- [ ] Configuraste las variables de entorno del backend
- [ ] El backend está corriendo (verificar Logs)
- [ ] Obtuviste la URL pública del backend
- [ ] Actualizaste `VITE_API_URL` en tu frontend/hosting
- [ ] Probaste login/registro en el frontend

---

## 🚀 Próximos pasos

### 1. Desplegar en Railway

```bash
# Opción A: Desde GitHub (automático)
git push origin main
# Railway redespliega automáticamente

# Opción B: Usando Railway CLI
railway login
railway link
railway deploy
```

### 2. Verificar despliegue

- Abre tu backend en Railway
- Ve a **Logs** → verifica "Base de datos conectada"
- Abre en navegador: `https://tu-backend-railway.app/items`

### 3. Actualizar Frontend

Si usas Vercel, Netlify, etc:

```env
VITE_API_URL=https://tu-backend-railway.up.railway.app
```

---

## 💡 Puntos clave

✅ **Procfile**: Railway ejecuta migraciones automáticamente antes de iniciar

✅ **CORS mejorado**: Backend acepta orígenes de desarrollo y producción

✅ **Docker mejorado**: Genera cliente Prisma y ejecuta migraciones

✅ **Variables de entorno**: Diferentes para desarrollo (Docker) y producción (Railway)

✅ **Graceful shutdown**: El backend desconecta Prisma correctamente

---

## 📖 Documentación

Para guías más detalladas:

- **Quick Start**: Ver `RAILWAY_QUICK_START.md`
- **Paso a Paso**: Ver `RAILWAY_PASO_A_PASO.md`
- **Técnico**: Ver `RAILWAY_SETUP.md`

---

## 🆘 Problemas comunes

| Síntoma                 | Causa                          | Solución                                          |
| ----------------------- | ------------------------------ | ------------------------------------------------- |
| Backend no inicia       | Variables de entorno faltantes | Verifica `DATABASE_URL` y `JWT_SECRET` en Railway |
| Migraciones no corren   | `Procfile` no encontrado       | Verifica que está en la raíz del proyecto         |
| CORS error en frontend  | `FRONTEND_URL` no configurado  | Añade variable en Railway                         |
| 503 Service Unavailable | Base de datos no conecta       | Verifica logs, revisa `DATABASE_URL`              |

---

## 📝 Notas de seguridad

1. **JWT_SECRET**: Genera uno seguro

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **No commitees `.env`**: Usa Railway dashboard para variables

3. **HTTPS**: Railway usa HTTPS automáticamente

4. **Backups**: Railway mantiene backups automáticos de PostgreSQL

---

**¡Tu aplicación está lista para Railway! 🎉**

Comienza en: [railway.app](https://railway.app)
