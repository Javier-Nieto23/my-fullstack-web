# 🚀 Solución: Configurar Root Directory en Railway

## Problema

Railway está buscando el código en:

```
./my-fullstack-project/
```

Pero debería estar en la raíz:

```
./
```

Esto sucede porque el repositorio clonado tiene una estructura de carpeta anidada.

---

## ✅ Solución: Configurar Root Directory

### En Railway Dashboard

1. Ve a tu proyecto en Railway
2. Abre el servicio **Backend**
3. Ve a la pestaña **"Settings"**
4. Busca **"Root Directory"** (o "Build Root")
5. Establece el valor a: `.`

   O si no funciona, intenta: `./`

6. Haz clic en **"Save"**
7. En **"Deployments"**, haz clic en **"Redeploy"** en el último deployment

---

## 📝 Alternativa: Crear railway.json

Si el Root Directory no funciona, Railway también detecta `railway.json`. Verifica que tienes este archivo en la raíz con:

```json
{
  "build": {
    "builder": "dockerfile",
    "dockerfile": "backend/Dockerfile"
  }
}
```

---

## 🔍 Verificación

Después de configurar, verifica los **Logs**:

- ✅ Si ves: "Building Docker image..."
- ✅ Si ves: "npm install..."
- ✅ Si ves: "Servidor backend escuchando en puerto 3000"

= **¡Éxito!**

---

## 🆘 Si sigue sin funcionar

### Opción 1: Usar Dockerfile directamente

En Railway → Backend → Settings → "Build Command":

```
docker build -f backend/Dockerfile -t app .
```

### Opción 2: Reconfigurar el servicio

1. Abre Backend → Settings → **"Delete Service"**
2. PostgreSQL → **"Keep"** (no borres la BD)
3. **+ Add** → **GitHub Repo**
4. Selecciona tu repo
5. En esta ocasión, establece explícitamente:
   - **Root Directory**: `.` o vacío
   - **Dockerfile**: `backend/Dockerfile`

### Opción 3: CLI de Railway

```bash
railway service create backend --dockerfile ./backend/Dockerfile
```

---

## 📋 Estructura esperada en GitHub

```
my-fullstack.web/          ← Tu repositorio en GitHub
├── backend/               ← Código del backend
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── frontend/              ← Código del frontend
│   ├── src/
│   └── package.json
├── prisma/                ← Migraciones y schema
│   ├── schema.prisma
│   └── migrations/
├── Procfile               ← ⭐ Railroad lee esto
├── package.json           ← Raíz
└── README.md
```

---

## ✨ Lo que Railway necesita ver

Cuando clona tu repositorio, debería ver:

```
(raíz del repo clonado)
├── backend/Dockerfile       ✅
├── backend/package.json     ✅
├── Procfile                 ✅
├── package.json (raíz)      ✅
└── prisma/                  ✅
```

**NO:**

```
my-fullstack-project/       ❌ (no debería estar aquí)
└── backend/
    └── Dockerfile
```

---

## 🎯 Resumen

1. Abre Railway Dashboard
2. Backend → Settings
3. Root Directory = `.` (punto/punto)
4. Haz clic en **Redeploy**
5. Espera 2-3 minutos
6. Verifica Logs

**¡Eso debería funcionar!** ✅

---

## 💡 Nota importante

Si tu estructura en GitHub realmente es:

```
my-fullstack.web/
  └── my-fullstack-project/
      └── backend/
```

Entonces necesitamos reorganizar el repositorio para que `backend/` esté en la raíz. Pero basándome en tu estructura local, esto no debería ser necesario.
