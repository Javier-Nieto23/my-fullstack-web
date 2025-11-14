# Despliegue en Railway

Este documento contiene los pasos para desplegar PostgreSQL y el Backend en Railway.

## Requisitos previos

- Cuenta en [Railway.app](https://railway.app)
- Proyecto creado en Railway
- GitHub conectado a Railway

## Paso 1: Desplegar PostgreSQL en Railway

1. Abre tu proyecto en Railway
2. Click en "New"
3. Selecciona "Database" → "PostgreSQL"
4. Railway creará automáticamente una instancia de PostgreSQL
5. Anota las credenciales que se muestran en las variables de entorno:
   - `DATABASE_URL`: La cadena de conexión completa

## Paso 2: Desplegar el Backend en Railway

### 2.1 Usar conectar GitHub

1. En tu proyecto Railway, haz click en "New"
2. Selecciona "GitHub Repo" o "Service from Git"
3. Autentica con GitHub
4. Selecciona tu repositorio: `Javier-Nieto23/my-fullstack.web`
5. Railway detectará automáticamente el backend y lo desplegará

### 2.2 Configurar variables de entorno

En la pestaña **"Variables"** del servicio backend en Railway, añade:

```
PORT=3000
JWT_SECRET=your-secure-secret-key-generate-one
NODE_ENV=production
```

> **Nota**: Railway inyectará automáticamente `DATABASE_URL` que viene de PostgreSQL

### 2.3 Configurar el Root Directory

Si Railway no detecta automáticamente el backend:

1. Ve a la pestaña **"Settings"** del servicio
2. Busca **"Root Directory"**
3. Cambia a: `backend`

### 2.4 Comando de inicio

Railway ejecutará automáticamente el comando en `backend/package.json`:

```json
"start": "node src/index.js"
```

## Paso 3: Ejecutar migraciones en Railway

Railway ejecutará migraciones automáticamente si añades este comando al Dockerfile o al build:

```bash
npx prisma migrate deploy
```

Dos opciones:

**Opción A: Mediante el Procfile (recomendado)**

Crea un archivo `Procfile` en la raíz del proyecto:

```
release: cd backend && npx prisma migrate deploy
web: cd backend && npm start
```

**Opción B: Mediante el Dockerfile**

Actualiza `backend/Dockerfile` para ejecutar migraciones antes de iniciar:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
```

## Paso 4: Actualizar Frontend

En `frontend/src/` o en el `.env`, cambia la variable de entorno para apuntar a Railway:

```env
VITE_API_URL=https://tu-app.railway.app
```

> Reemplaza `tu-app` con el nombre del dominio que Railway asigne a tu backend

Para encontrar la URL del backend en Railway:

1. Abre tu servicio backend en Railway
2. Ve a la pestaña **"Deploy"** o **"Settings"**
3. Copia la URL pública (ej: `https://myapp-production.railway.app`)

## Paso 5: Verificar el despliegue

1. **Backend**: Abre `https://tu-app.railway.app/items` en el navegador

   - Deberías ver: `[{"id": 1, "name": "Juego Zelda"}, ...]`

2. **Base de datos**: El backend se conectará automáticamente a PostgreSQL en Railway

   - Si hay error de conexión, verifica que `DATABASE_URL` esté correctamente inyectada

3. **Frontend**:
   - Actualiza con la nueva URL de API
   - Prueba login/registro

## Solución de problemas

### El backend no inicia

1. Ve a los **Logs** en Railway
2. Busca errores de:
   - Falta de variables de entorno: `DATABASE_URL`, `JWT_SECRET`
   - Errores de Prisma: asegúrate de que las migraciones se ejecutaron
   - Errores de puerto: Railway asigna automáticamente el puerto en `$PORT`

### Las migraciones no corren

1. Verifica que `Procfile` está en la **raíz del proyecto**
2. O actualiza el Dockerfile con el comando de migración

### Base de datos no conecta

1. Verifica que `DATABASE_URL` está en las variables de Railway
2. Prueba la conexión localmente con esa URL
3. Asegúrate de que PostgreSQL está running en Railway

## Estructura de proyecto esperada por Railway

```
my-fullstack-project/
├── backend/
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   └── package.json
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── Procfile          ← Recomendado para Railway
├── package.json      ← Puede ser necesario en raíz
└── .env.example
```

## Notas importantes

- **JWT_SECRET**: Genera una clave fuerte para producción

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **CORS**: El backend permite localhost, actualiza si es necesario en `backend/src/index.js`

  ```javascript
  app.use(
    cors({
      origin: ["http://localhost:5173", "https://tu-frontend.vercel.app"],
    })
  );
  ```

- **Base de datos**: Railway proporciona PostgreSQL con backup automático

---

**¡Listo!** Tu backend y base de datos estarán disponibles en Railway.
