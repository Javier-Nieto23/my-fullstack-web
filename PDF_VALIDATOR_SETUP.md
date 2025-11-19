# 🔍 PDF Validator - Funciones de Joel Adaptadas para Railway

## 📋 **Especificaciones PDF Implementadas**

### ✅ **Validaciones Aplicadas:**

#### **1. Tipo de Archivo:**

- ✅ **Solo PDF** válidos (verificación MIME)
- ❌ Rechaza: Otros formatos, archivos corruptos

#### **2. Tamaño:**

- ✅ **Máximo 3 MB**
- ❌ Rechaza: Archivos mayores a 3MB

#### **3. Formato de Imagen:**

- ✅ **Escala de grises a 8 bits** de profundidad
- ❌ Rechaza: Imágenes a color, otros bits de profundidad

#### **4. Resolución:**

- ✅ **300 DPI mínimo** (puntos por pulgada)
- ❌ Rechaza: Resoluciones menores a 300 DPI

#### **5. Contenido Prohibido:**

- ❌ **Sin formularios** (AcroForm)
- ❌ **Sin objetos incrustados**
- ❌ **Sin código JavaScript**
- ❌ **Sin contraseñas** ni cifrado

#### **6. Procesamiento:**

- ✅ **Sin hojas en blanco**
- ✅ **Sin OCR aplicado** requerido
- ⚠️ Detecta documentos escaneados sin texto

---

## 🔧 **Funciones Migradas de PHP → Node.js**

### **📂 Mapping de Archivos:**

| **Función PHP Original** | **Método Node.js**     | **Propósito**                  |
| ------------------------ | ---------------------- | ------------------------------ |
| `tipo.php`               | `validateFileType()`   | Verificar tipo MIME PDF        |
| `tamano.php`             | `validateFileSize()`   | Verificar tamaño máx 3MB       |
| `escala_gris.php`        | `validateImages()`     | Verificar escala grises 8-bit  |
| `resolucion.php`         | `validateImages()`     | Verificar 300 DPI mínimo       |
| `contenido.php`          | `validateContent()`    | Verificar contenido prohibido  |
| `procesamiento.php`      | `validateProcessing()` | Detectar páginas en blanco/OCR |

---

## 🛠️ **Herramientas Requeridas en Railway**

### **Dependencies Linux (Alpine):**

```bash
# En Dockerfile
RUN apk add --no-cache \
    poppler-utils \    # pdfinfo, pdfimages, pdftotext
    mupdf-tools \      # mutool
    openssl
```

### **NPM Dependencies:**

```bash
npm install file-type    # Detectar tipo MIME real
```

---

## 📊 **API Response Format**

### **✅ PDF Válido:**

```json
{
  "success": true,
  "message": "✅ PDF validado y almacenado exitosamente",
  "document": {
    "id": 123,
    "name": "documento.pdf",
    "status": "processed"
  },
  "validation": {
    "summary": "✅ PDF válido - Cumple todas las especificaciones",
    "warnings": [],
    "details": {
      "fileType": { "valid": true, "detectedType": "application/pdf" },
      "fileSize": { "valid": true, "actualSize": 2048000 },
      "images": { "totalImages": 3, "validImages": 3 },
      "content": { "valid": true }
    }
  },
  "storage": {
    "provider": "Cloudflare R2",
    "stored": true
  }
}
```

### **❌ PDF Rechazado:**

```json
{
  "error": "PDF no cumple con las especificaciones requeridas",
  "details": {
    "summary": "❌ PDF rechazado - 2 errores encontrados",
    "errors": [
      "❌ 1 imágenes con resolución menor a 300 DPI",
      "❌ Contiene código JavaScript"
    ],
    "warnings": ["⚠️ PDF no contiene texto (posible escaneo sin OCR)"]
  }
}
```

---

## 🎯 **Flujo de Validación**

```
📄 PDF Upload
    ↓
🔍 validateFileType() → MIME check
    ↓
📏 validateFileSize() → 3MB limit
    ↓
🛡️ validateContent() → Prohibited content
    ↓
🖼️ validateImages() → DPI + Grayscale
    ↓
📋 validateProcessing() → Blank pages + OCR
    ↓
✅ APPROVED → Upload to Cloudflare R2
    ↓
💾 Save to PostgreSQL
```

---

## 🚀 **Endpoint de Validación**

### **POST /documents/upload**

**Request:**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@documento.pdf" \
  https://pdf-converter-backend-production-674e.up.railway.app/documents/upload
```

**Validations Applied:**

1. ✅ JWT Authentication
2. ✅ File type (PDF only)
3. ✅ File size (3MB max)
4. ✅ Image format (grayscale 8-bit)
5. ✅ Resolution (300 DPI min)
6. ✅ Content restrictions
7. ✅ Processing quality

---

## 📋 **Health Check con Tools**

### **GET /health**

**Response:**

```json
{
  "status": "healthy",
  "database": "connected",
  "cloudflareR2": "configured",
  "pdfValidation": {
    "service": "enabled",
    "tools": {
      "pdfinfo": "available",
      "pdfimages": "available",
      "mutool": "available"
    },
    "specifications": {
      "maxSize": "3 MB",
      "requiredDPI": "300",
      "colorMode": "grayscale 8-bit",
      "contentRestrictions": [
        "no-password",
        "no-forms",
        "no-javascript",
        "no-embedded"
      ]
    }
  }
}
```

---

## 🏆 **Ventajas sobre PHP Original**

### **✅ Modernización:**

- ✅ **Async/Await** → Sin bloqueo de servidor
- ✅ **Error handling** → Manejo robusto de errores
- ✅ **Logging detallado** → Debugging mejorado
- ✅ **Validación estructurada** → Reportes claros

### **✅ Integración Railway:**

- ✅ **Docker optimizado** → Herramientas PDF incluidas
- ✅ **Variables ambiente** → Configuración flexible
- ✅ **Health checks** → Monitoreo automático
- ✅ **Escalabilidad** → Preparado para carga

### **✅ Funcionalidad:**

- ✅ **Validación antes upload** → Evita almacenar archivos inválidos
- ✅ **Reportes detallados** → Debugging y UX mejorados
- ✅ **Cloudflare R2** → Storage escalable y CDN

---

## 🎊 **¡Todo Listo para Producción!**

Las funciones de Joel han sido **completamente migradas y mejoradas** para Railway:

- 🔧 **Herramientas PDF** instaladas en Docker
- 🔍 **Validaciones completas** implementadas
- 📊 **Respuestas estructuradas** con detalles
- 🌩️ **Cloudflare R2** integrado
- 🚀 **Listo para deploy** en Railway

**¡Railway + Cloudflare R2 + Validación PDF = Sistema completo y profesional!** ✨
