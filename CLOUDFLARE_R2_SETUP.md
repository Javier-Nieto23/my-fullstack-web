# 🌩️ Configuración Cloudflare R2

## 📋 **Pasos para configurar Cloudflare R2:**

### 1. **Crear cuenta en Cloudflare Dashboard**

- Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
- Navega a **R2 Object Storage** en el menú lateral

### 2. **Crear bucket**

```bash
# Nombre sugerido: pdf-storage
# Región: Automática (Cloudflare optimiza)
# Configuración: Default
```

### 3. **Obtener credenciales API**

#### **Token API R2:**

1. Ve a **Manage R2 API tokens**
2. Clic en **Create API token**
3. **Template**: Custom token
4. **Permissions**:
   - `Object:Edit` para el bucket
   - `Object:Read` para el bucket
5. **Resources**: Include specific bucket → selecciona tu bucket
6. Copia el **Token ID**, **Access Key ID** y **Secret Access Key**

#### **Account ID:**

1. En el dashboard principal de Cloudflare
2. En la sidebar derecha verás tu **Account ID**

### 4. **Variables de entorno para Railway**

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=tu_account_id_aqui
R2_ACCESS_KEY_ID=tu_access_key_aqui
R2_SECRET_ACCESS_KEY=tu_secret_key_aqui
R2_BUCKET_NAME=pdf-storage
R2_ENDPOINT=https://tu_account_id.r2.cloudflarestorage.com

# Opcional: Dominio personalizado (si lo configuras)
R2_CUSTOM_DOMAIN=tu-dominio.com
```

### 5. **Configuración en Railway**

1. Ve a tu proyecto Railway
2. **Variables** tab
3. Agrega cada variable de R2:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_ENDPOINT`

### 6. **Dominio personalizado (Opcional)**

Para URLs públicas sin firma:

1. En R2, ve a **Settings** → **Custom Domains**
2. Agrega tu dominio (ej: `cdn.tu-sitio.com`)
3. Configura DNS CNAME en Cloudflare
4. Agrega `R2_CUSTOM_DOMAIN=cdn.tu-sitio.com`

## 🚀 **Ventajas implementadas:**

### **✅ Almacenamiento escalable**

- Sin límites de Railway (volumen local)
- Backup automático y redundancia global
- CDN integrado de Cloudflare

### **✅ URLs firmadas**

- Acceso seguro y temporal (1 hora)
- No requiere proxy del backend
- Descarga directa desde Cloudflare

### **✅ Económico**

- Sin costos de egress (transferencia)
- Precio competitivo vs AWS S3
- Perfecto para Railway + Vercel

### **✅ Integración perfecta**

```javascript
// Upload (backend)
const result = await r2Service.uploadFile(buffer, filename);

// View URL (segura)
const viewUrl = await r2Service.getSignedViewUrl(document.filePath);

// Download URL (directa)
const downloadUrl = await r2Service.getSignedDownloadUrl(
  document.filePath,
  filename
);
```

## 🔧 **Testing local**

Para probar localmente, crea `.env` en backend:

```bash
# Copiar desde Cloudflare Dashboard
R2_ACCOUNT_ID=tu_account_id_real
R2_ACCESS_KEY_ID=tu_key_real
R2_SECRET_ACCESS_KEY=tu_secret_real
R2_BUCKET_NAME=pdf-storage
```

## 🎯 **Endpoints actualizados**

- `POST /documents/upload` → Sube a R2 automáticamente
- `GET /api/documents/:id/view` → Redirige a URL firmada R2
- `GET /api/documents/:id/download` → Descarga directa R2
- `GET /health` → Incluye status de R2

## 🎊 **¡Todo listo para producción!**

Con esta configuración tendrás:

- ✅ **Almacenamiento ilimitado** en Cloudflare R2
- ✅ **URLs seguras** con firma temporal
- ✅ **CDN global** automático
- ✅ **Costos optimizados** vs otras soluciones
- ✅ **Backup automático** y redundancia

**¡Railway + Cloudflare R2 = Combinación perfecta!** 🚀
