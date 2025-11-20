# 🚀 GUÍA COMPLETA: MIGRACIÓN A PRODUCCIÓN

## 📋 RESUMEN DE CAMBIOS IMPLEMENTADOS

### ✅ **Backend (Railway)**

- **✅ Dockerfile actualizado** con todas las herramientas PDF:
  - Ghostscript (conversión PDF)
  - Poppler-utils (pdfinfo, pdfimages, pdftotext)
  - MuPDF-tools (mutool)
  - ImageMagick (procesamiento de imágenes)
- **✅ Endpoints restaurados** para Cloudflare R2
- **✅ Autenticación mejorada** (soporta tokens en headers y query params)
- **✅ Railway.json configurado** con todas las variables necesarias

### ✅ **Frontend (Vercel)**

- **✅ Componente DocumentosProcesados** creado
- **✅ Estilos CSS** profesionales para la tabla
- **✅ Sistema de tabs** (Subir Documentos / Documentos Procesados)
- **✅ Visualización y descarga** de PDFs procesados

### ✅ **Scripts de Deploy**

- **✅ deploy-railway-pdf.sh** - Deploy backend con herramientas PDF
- **✅ deploy-vercel-frontend.sh** - Deploy frontend con variables

---

## 🎯 PASOS PARA MIGRAR A PRODUCCIÓN

### 1️⃣ **CONFIGURAR RAILWAY (Backend)**

```bash
# 1. Ejecutar script de deploy
./deploy-railway-pdf.sh

# 2. Configurar variables manualmente en railway.app
# - DATABASE_URL (PostgreSQL)
# - CLOUDFLARE_ACCOUNT_ID
# - CLOUDFLARE_ACCESS_KEY_ID
# - CLOUDFLARE_SECRET_ACCESS_KEY
# - CLOUDFLARE_BUCKET_NAME
# - CLOUDFLARE_BUCKET_URL
```

**Variables necesarias en Railway:**

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret-key
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_BUCKET_NAME=your-bucket-name
CLOUDFLARE_BUCKET_URL=your-bucket-url
```

### 2️⃣ **CONFIGURAR VERCEL (Frontend)**

```bash
# 1. Ejecutar script de deploy
./deploy-vercel-frontend.sh

# 2. Ingresar URL de Railway cuando se solicite
```

**Variables necesarias en Vercel:**

```
VITE_API_URL=https://your-railway-app.railway.app
```

### 3️⃣ **CONFIGURAR CLOUDFLARE R2**

1. **Crear bucket** en Cloudflare R2
2. **Configurar CORS** para el bucket:

```json
[
  {
    "AllowedOrigins": ["https://your-frontend.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. **Obtener credenciales** (Account ID, Access Key, Secret Key)

### 4️⃣ **CONFIGURAR POSTGRESQL**

1. **Usar PostgreSQL de Railway** o servicio externo
2. **La migración automática** se ejecutará al iniciar el backend

---

## 🧪 **VERIFICAR FUNCIONAMIENTO**

### **Herramientas PDF en Railway:**

```bash
# Verificar logs de Railway para confirmar:
railway logs

# Deberías ver:
# ✅ Ghostscript OK
# ✅ Poppler-utils OK
# ✅ MuPDF OK
# ✅ ImageMagick OK
```

### **Flujo completo:**

1. **Subir PDF** → Se valida y convierte con Ghostscript
2. **Almacenar** → Se guarda en Cloudflare R2
3. **Base de datos** → Se registra en PostgreSQL
4. **Visualizar** → Aparece en tabla "Documentos Procesados"
5. **Ver/Descargar** → Funciona desde la tabla

---

## 📊 **NUEVAS FUNCIONALIDADES**

### **🎯 Sistema de Tabs**

- **Tab 1: Subir Documentos** - Upload y procesamiento
- **Tab 2: Documentos Procesados** - Tabla con todos los PDFs

### **📄 Tabla de Documentos**

```
┌─────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Nombre          │ Estado  │ Tamaño  │ Empresa │ Fecha   │ Acciones│
├─────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ processed_doc   │✅Proces │ 64.92KB │ Demo    │ 20/11   │👁️📥    │
│ original.pdf    │  ado    │         │         │ 15:30   │         │
└─────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

### **⚡ Acciones disponibles:**

- **👁️ Ver** - Abre PDF en nueva pestaña
- **📥 Descargar** - Descarga directa desde Cloudflare R2
- **🔄 Actualizar** - Refresca la lista

### **🎨 Indicadores de estado:**

- **✅ Procesado** - PDF convertido exitosamente
- **⏳ Pendiente** - En proceso
- **❌ Error** - Falló el procesamiento

---

## 🛠️ **ARQUITECTURA DE PRODUCCIÓN**

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   VERCEL    │───▶│   RAILWAY   │───▶│ CLOUDFLARE  │
│  (Frontend) │    │  (Backend)  │    │     R2      │
│             │    │             │    │  (Storage)  │
│ React App   │    │ Node.js API │    │ PDF Storage │
│ Vite Build  │    │ + PDF Tools │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │ POSTGRESQL  │
                   │ (Database)  │
                   │  Metadata   │
                   └─────────────┘
```

### **🔧 Herramientas PDF en Railway:**

- **Ghostscript 10.02+** - Conversión a escala de grises 300 DPI
- **Poppler-utils** - Análisis de estructura PDF
- **MuPDF-tools** - Validación profesional
- **ImageMagick** - Procesamiento de imágenes

---

## 🔍 **MONITOREO Y DEBUG**

### **Logs de Railway:**

```bash
railway logs --tail
```

### **Variables de Railway:**

```bash
railway variables
```

### **Estado de salud:**

```bash
curl https://your-app.railway.app/health
```

---

## 📞 **SOPORTE POST-DEPLOY**

### **Problemas comunes:**

1. **Error de herramientas PDF**

   - Verificar logs de build en Railway
   - Confirmar que Alpine Linux instaló todas las dependencias

2. **Error de CORS**

   - Verificar configuración de Cloudflare R2
   - Actualizar URLs de origen

3. **Tokens de autenticación**

   - Verificar JWT_SECRET en Railway
   - Confirmar que frontend envía token correctamente

4. **Base de datos**
   - Verificar DATABASE_URL en Railway
   - Confirmar que migraciones se ejecutaron

---

## ✅ **CHECKLIST FINAL**

- [ ] Railway backend deployado con herramientas PDF
- [ ] Vercel frontend deployado
- [ ] Variables de entorno configuradas
- [ ] Cloudflare R2 funcionando
- [ ] PostgreSQL conectado
- [ ] Tabla "Documentos Procesados" funcional
- [ ] Upload, conversión y almacenamiento working
- [ ] Visualización y descarga functioning

¡Tu sistema está listo para producción! 🎉
