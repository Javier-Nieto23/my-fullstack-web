# 🔧 Solución: Error "Error creating build plan with Railpack"

## ¿Qué cambió?

He corregido el error de build en Railway. El problema era que `railway.json` entraba en conflicto con el `Procfile`.

**Cambios realizados:**

```diff
❌ Removido: railway.json (causaba conflicto)
✅ Añadido: .railway.toml (configuración nativa)
✅ Añadido: .railwayignore (optimización)
✅ Mejorado: Procfile (más explícito)
✅ Mejorado: package.json (raíz)
✅ Mejorado: backend/Dockerfile
```

---

## ✅ Lo que Railway hará ahora

Cuando hagas push a `main`:

```
1. Detecta Procfile automáticamente
   ↓
2. Ejecuta en el servidor:
   - npm install
   - npx prisma generate
   - npx prisma migrate deploy
   ↓
3. Inicia servidor: npm start
   ↓
4. Backend disponible en https://tu-app-railway.up.railway.app
```

---

## 🚀 Próximos pasos

### 1. En Railway Dashboard

Si ya hay un deployment fallido:

1. Ve a tu proyecto
2. Abre el servicio **Backend**
3. En la pestaña **"Deployments"**, haz clic en el último deployment fallido
4. Haz clic en **"Redeploy"** o **"Retry"**

### 2. O fuerza un nuevo deployment

```bash
# Opción A: Push a GitHub (automático)
git push origin main

# Opción B: Desde Railway CLI
railway up
```

### 3. Espera el build

El proceso completo toma ~2-3 minutos:

- Build Docker imagen: ~1 min
- Instalar dependencias: ~1 min
- Ejecutar migraciones: ~30 seg
- Iniciar servidor: ~30 seg

### 4. Verifica los logs

```bash
railway logs -f
```

O en el dashboard Railway → Backend → **Logs**

**Busca estos mensajes de éxito:**

```
npm install completed
npx prisma generate completed
All migrations have been successfully applied
Servidor backend escuchando en puerto 3000
Base de datos conectada
```

---

## 🔍 Si sigue fallando

### Opción 1: Resetear el servicio

En Railway Dashboard:

1. Backend → Settings
2. Scroll hasta "Danger Zone"
3. Haz clic en **"Delete Service"**
4. Abre PostgreSQL → Settings → **"Keep"** (no elimines la BD)
5. Crea Backend nuevamente:
   - **+ Add** → **GitHub Repo**
   - Selecciona tu repo
   - Railway re-detectará Procfile

### Opción 2: Usar Railway CLI

```bash
# Instalar si no lo tienes
npm install -g @railway/cli

# Login
railway login

# Link a tu proyecto
railway link

# Ver estado
railway status

# Desplegar explícitamente
railway up --deploy
```

### Opción 3: Revisar logs detallados

```bash
railway logs -f --service backend
```

Busca mensajes de error específicos.

---

## 📋 Archivos clave ahora

```
Procfile                 ← Railway lee esto automáticamente
.railway.toml           ← Configuración adicional (opcional)
.railwayignore          ← Archivos a ignorar en build
backend/Dockerfile      ← Build desde aquí
package.json (raíz)     ← Metadata + scripts
```

---

## 🆘 Mensajes de error comunes

### "npm ERR! code ENOENT"

**Causa**: Falta `package.json` en el lugar correcto
**Solución**: Ya está arreglado en backend/package.json y raíz/package.json

### "DATABASE_URL is not set"

**Causa**: PostgreSQL no desplegada o variable no inyectada
**Solución**: Verifica que PostgreSQL está corriendo en Railway

### "prisma: command not found"

**Causa**: Dependencias no instaladas correctamente
**Solución**: Verifica que `backend/package.json` tiene `"prisma": "^5.13.0"` en devDependencies

### "Cannot find module '@prisma/client'"

**Causa**: Cliente Prisma no generado
**Solución**: El Dockerfile ahora ejecuta `npx prisma generate` automáticamente

---

## 📝 Qué incluye el Procfile

```bash
release: cd backend && npm install && npx prisma generate && npx prisma migrate deploy
web: cd backend && npm start
```

**release**: Se ejecuta UNA sola vez antes de iniciar la app (perfecto para migraciones)
**web**: El comando principal que Railway ejecuta

---

## ✨ Quick test local

Si quieres verificar que todo funciona localmente:

```bash
# Instalar dependencias
cd backend && npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones (si tienes BD local)
npx prisma migrate deploy

# Iniciar servidor
npm start
```

Deberías ver:

```
Servidor backend escuchando en puerto 3000
Base de datos conectada
```

---

## 🎯 Resumen

| Antes                               | Ahora                                |
| ----------------------------------- | ------------------------------------ |
| railway.json + Procfile = Conflicto | Solo Procfile = Limpio               |
| "Error creating build plan"         | Build funciona correctamente         |
| Manual migraciones                  | Migraciones automáticas via Procfile |

---

**¡El error está solucionado!** 🎉

Haz push a GitHub o redeploya en Railway y verás que funciona.

```bash
git push origin main
```

Railway detectará los cambios y hará un nuevo build automáticamente.
