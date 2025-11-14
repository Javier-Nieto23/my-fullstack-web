# 🚀 Despliegue en Railway - Guía Rápida

## 5 minutos para desplegar

### 1. Crear proyecto en Railway

```bash
npm install -g @railway/cli
railway login
railway init
```

O ve a [railway.app](https://railway.app) y conecta tu repositorio de GitHub.

### 2. Desplegar PostgreSQL

En el dashboard de Railway:

1. **+ Add** → **Database** → **PostgreSQL**
2. ¡Listo! Railway asigna automáticamente `DATABASE_URL`

### 3. Desplegar Backend

El backend se despliega automáticamente cuando pusheas a `main`:

```bash
git push origin main
```

Railway ejecutará:

- `npm install` en backend
- `npx prisma migrate deploy` (gracias al Procfile)
- `npm start`

### 4. Configurar variables

En Railway, en las **Variables** del servicio backend, añade:

```env
PORT=3000
JWT_SECRET=your-secure-key-here
NODE_ENV=production
FRONTEND_URL=https://tu-frontend.vercel.app
```

> `DATABASE_URL` se inyecta automáticamente

### 5. Obtener URL del backend

En Railway → Backend → Settings → **Domain**

Ejemplo: `https://my-backend-railway.up.railway.app`

### 6. Actualizar Frontend

En tu hosting (Vercel, Netlify, etc.), añade variable de entorno:

```env
VITE_API_URL=https://my-backend-railway.up.railway.app
```

### ✅ ¡Listo!

Tu stack completo está en la nube:

- PostgreSQL ✅
- Backend (Node/Express) ✅
- Frontend (React) ✅

---

## 📖 Documentación completa

Ver [RAILWAY_PASO_A_PASO.md](./RAILWAY_PASO_A_PASO.md) para una guía detallada paso a paso.

---

## 🆘 Ayuda rápida

| Problema                   | Solución                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| Backend no inicia          | Ve a **Logs**, busca el error. Verifica `DATABASE_URL` y `JWT_SECRET` |
| Las migraciones no corren  | Verifica que `Procfile` existe en la raíz                             |
| CORS error                 | Añade `FRONTEND_URL` en variables del backend                         |
| Frontend llama a localhost | Actualiza `VITE_API_URL` en tu hosting                                |

---

## 💡 Comandos útiles

```bash
# Ver logs en vivo
railway logs -f

# Ver variables de entorno
railway variables

# Abrir dashboard
railway open

# Listar servicios
railway list
```

---

**¡Próximo paso?** Ve a [railway.app](https://railway.app) y conecta tu repositorio. 🎉
