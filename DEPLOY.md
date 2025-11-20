# PDF Converter Full Stack Application

## 🚀 Deploy Configuration

### Railway (Backend)

El backend está configurado para desplegarse automáticamente en Railway con:

- **Base de datos**: PostgreSQL (Railway)
- **Almacenamiento**: Cloudflare R2
- **Procesamiento PDF**: Ghostscript + validaciones
- **Health Check**: `/health` endpoint

### Vercel (Frontend)

El frontend está configurado para desplegarse en Vercel con:

- **Framework**: React + Vite
- **Build Command**: `cd frontend && npm run build`
- **Output Directory**: `frontend/dist`

## 📁 Structure

```
/
├── backend/          # Express.js API
├── frontend/         # React App
├── prisma/          # Database schema
├── vercel.json      # Vercel config
├── railway.json     # Railway config
└── package.json     # Root config
```

## 🔧 Environment Variables

### Railway (Backend)

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NODE_ENV=production
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=...
```

### Vercel (Frontend)

```
VITE_API_URL=https://your-railway-backend.railway.app
```

## 🚢 Deploy Commands

```bash
# Commit changes
git add .
git commit -m "Deploy configuration updates"
git push origin main

# Railway will auto-deploy backend
# Vercel will auto-deploy frontend
```

## ✅ Health Check

Backend health: `https://your-railway-app.railway.app/health`
