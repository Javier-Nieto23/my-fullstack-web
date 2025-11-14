# 🚀 Guía Paso a Paso: Desplegar en Railway

## 📋 Checklist pre-despliegue

- [ ] Tienes una cuenta en [railway.app](https://railway.app)
- [ ] Tu repositorio está en GitHub y conectado a Railway
- [ ] El código está actualizado y los cambios están pusheados a `main`

---

## 1️⃣ Crear el proyecto en Railway

### Opción A: Desde el Dashboard de Railway (Recomendado)

1. Abre [railway.app](https://railway.app)
2. Haz clic en **"New Project"** o **"+ New"**
3. Selecciona **"Deploy from GitHub"**
4. Autentica con GitHub
5. Selecciona tu repositorio: `Javier-Nieto23/my-fullstack.web`
6. Railway detectará automáticamente tu proyecto

### Opción B: Usando Railway CLI

```bash
# Instalar Railway CLI (si aún no lo has hecho)
npm install -g @railway/cli

# O en macOS con Homebrew
brew install railway

# Login a Railway
railway login

# Crear un nuevo proyecto
railway init

# Vincularlo a tu repositorio
railway link
```

---

## 2️⃣ Desplegar PostgreSQL

1. En tu proyecto Railway, haz clic en **"+ Add Service"** o **"New"**
2. Selecciona **"Database"** → **"PostgreSQL"**
3. Railway creará la instancia automáticamente
4. **Anota la URL de conexión** que aparece en las variables de entorno

> Las credenciales estarán disponibles bajo `DATABASE_URL` en la sección de variables

---

## 3️⃣ Desplegar el Backend

Railway debería detectar automáticamente tu backend. Si no:

### Opción A: Push automático desde GitHub

1. Confirma que tu código está en `main` branch:

   ```bash
   git push origin main
   ```

2. Railway ejecutará automáticamente:
   - Instalará dependencias
   - Ejecutará migraciones (gracias al `Procfile`)
   - Iniciará el servidor

### Opción B: Agregar servicio manualmente

1. En Railway, haz clic en **"+ New Service"**
2. Selecciona **"GitHub Repo"**
3. Elige tu repositorio
4. Configura lo siguiente:

#### Configuración del servicio backend:

- **Root Directory**: `backend` (si Railway no lo detecta)
- **Build Command**: `npm install` (por defecto)
- **Start Command**: `npm start`

#### Variables de entorno:

En la pestaña **"Variables"**, añade:

```
PORT=3000
JWT_SECRET=tu-clave-secreta-segura-aqui
NODE_ENV=production
FRONTEND_URL=https://tu-frontend-url.vercel.app
```

> 💡 **Nota**: `DATABASE_URL` se inyecta automáticamente desde PostgreSQL

---

## 4️⃣ Configurar el Procfile (Importante)

El archivo `Procfile` en la raíz del proyecto asegura que las migraciones se ejecuten:

```
release: cd backend && npx prisma migrate deploy
web: cd backend && npm start
```

Esto ya está incluido en tu proyecto. Railway lo leerá automáticamente.

---

## 5️⃣ Verificar el despliegue

### Ver logs del backend

```bash
railway logs
```

O desde el dashboard de Railway:

1. Abre tu servicio backend
2. Ve a la pestaña **"Logs"**

### Verificar que el backend está funcionando

1. Abre tu servicio backend en Railway
2. Ve a **"Settings"** o **"Deploy"**
3. Copia la URL pública (ej: `https://myapp-production.railway.app`)
4. Prueba en el navegador: `https://myapp-production.railway.app/items`
   - Deberías ver: `[{"id":1,"name":"Juego Zelda"},...]`

### Verificar que la base de datos está conectada

En los logs deberías ver:

```
Servidor backend escuchando en puerto 3000
Base de datos conectada
```

Si hay error de conexión, verifica que `DATABASE_URL` esté en las variables.

---

## 6️⃣ Obtener la URL del backend

Una vez que el backend está desplegado:

1. En Railway, abre tu servicio backend
2. Ve a **"Settings"** o a la sección de **"Domain"**
3. Copia la URL pública (ej: `https://my-backend-railway.up.railway.app`)

---

## 7️⃣ Actualizar el Frontend

Ahora tu frontend necesita conectarse a la URL de Railway.

### Opción A: Variable de entorno en Vercel (o tu hosting)

Si estás usando Vercel, Netlify, etc.:

1. Ve a tu proyecto de hosting
2. En **Settings** → **Environment Variables**
3. Añade:
   ```
   VITE_API_URL=https://my-backend-railway.up.railway.app
   ```

### Opción B: Variable de entorno local

Actualiza `frontend/.env.local`:

```env
VITE_API_URL=https://my-backend-railway.up.railway.app
```

Luego, reconstruye y despliega tu frontend.

---

## 8️⃣ Pruebas finales

1. **Abre tu frontend** (en Vercel, Netlify, localhost, etc.)
2. **Intenta registrarte**:
   - Deberías poder crear una cuenta
   - Se guardará en PostgreSQL (Railway)
3. **Intenta iniciar sesión**:
   - Deberías recibir un token JWT
   - Deberías acceder a `/verificacion`
4. **Intenta logout**:
   - Deberías ser redirigido a login

---

## 🐛 Solución de problemas

### El backend no inicia

**Problema**: Ves errores en los logs de Railway

**Solución**:

1. Ve a **Logs** del servicio backend
2. Busca el error específico
3. Causas comunes:
   - Falta `DATABASE_URL` → Verifica que PostgreSQL está desplegada
   - Falta `JWT_SECRET` → Añádelo en Variables
   - Error de Prisma → Las migraciones no corrieron correctamente

**Comando para diagnosticar localmente**:

```bash
cd backend
npx prisma migrate status
npx prisma migrate deploy
```

### Las migraciones no corren

**Solución**:

1. Verifica que `Procfile` existe en la raíz del proyecto
2. El contenido debe ser exactamente:
   ```
   release: cd backend && npx prisma migrate deploy
   web: cd backend && npm start
   ```
3. Si lo actualizaste, haz un nuevo push a `main`

### PostgreSQL no conecta

**Solución**:

1. En Railway, abre el servicio PostgreSQL
2. Ve a **Variables** y copia el valor completo de `DATABASE_URL`
3. En el servicio backend, verifica que tiene esa variable
4. Los logs deberían mostrar `Base de datos conectada`

### CORS error (frontend no puede llamar al backend)

**Problema**: El navegador dice "Cross-Origin Request Blocked"

**Solución**:

1. En Railway, abre el servicio backend
2. Ve a **Variables**
3. Añade o actualiza `FRONTEND_URL` con la URL de tu frontend en Vercel/Netlify
4. Redespliega

Ejemplo:

```
FRONTEND_URL=https://my-frontend.vercel.app
```

### El frontend apunta a la URL equivocada

**Problema**: El frontend sigue apuntando a `localhost:3000`

**Solución**:

1. Verifica `frontend/src/components/Login.jsx` o dondequiera que definas `VITE_API_URL`
2. Debe estar usando:
   ```javascript
   const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
   ```
3. Asegúrate de que la variable de entorno está configurada en tu hosting (Vercel, Netlify, etc.)

---

## 📝 Notas de producción

### Generar JWT_SECRET seguro

En tu terminal, corre:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado y úsalo como `JWT_SECRET` en Railway.

### Backup de la base de datos

Railway proporciona backups automáticos. Para ver backups:

1. Abre tu servicio PostgreSQL en Railway
2. Ve a la pestaña **"Backups"**
3. Puedes restaurar desde cualquier backup anterior

### Monitoreo

Railway muestra en tiempo real:

- Uso de CPU
- Uso de memoria
- Solicitudes por segundo
- Errores

Accede desde el dashboard de cada servicio.

---

## ✅ ¡Listo!

Tu aplicación está ahora desplegada en Railway con:

- ✅ PostgreSQL en la nube
- ✅ Backend corriendo en Railway
- ✅ Frontend conectado a la API
- ✅ Migraciones ejecutándose automáticamente
- ✅ Base de datos sincronizada

Si necesitas hacer cambios:

1. Modifica el código localmente
2. Haz commit y push a `main`
3. Railway redespliega automáticamente

---

## 🆘 Ayuda adicional

- [Documentación de Railway](https://docs.railway.app/)
- [Comunidad de Railway en Discord](https://discord.gg/railway)
- Abre un issue en tu repositorio si tienes problemas
