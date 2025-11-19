# 🌐 PDF-REST API Setup

## 📋 Descripción

PDF-REST es un servicio profesional de manipulación de PDFs que ofrece conversión de alta calidad, compresión inteligente y optimización avanzada. Se integra como método alternativo cuando Ghostscript falla.

## 🔑 Configuración de API Key

### 1. Obtener API Key

- Visita: https://pdf-rest.com/
- Regístrate para obtener tu API key
- Plan gratuito incluye conversiones limitadas
- Plan pro ofrece conversiones ilimitadas

### 2. Configurar Variable de Entorno

**Railway:**

```bash
# En Railway Dashboard > Variables
PDF_REST_API_KEY=tu_api_key_aqui
```

**Desarrollo Local:**

```bash
# En archivo .env
PDF_REST_API_KEY=tu_api_key_aqui
```

**Sin API Key:**

- El sistema usa 'demo' como fallback
- Funcionalidad limitada pero disponible para pruebas

## 🔄 Servicios Implementados

### 1. 🗜️ PDF Compress

```
Endpoint: https://api.pdf-rest.com/compress
Función: Compresión inteligente que mantiene calidad
Ideal para: Reducir tamaño sin perder resolución
```

### 2. 🎨 Convert to Grayscale

```
Endpoint: https://api.pdf-rest.com/convert-to-grayscale
Función: Conversión profesional a escala de grises
Ideal para: Convertir imágenes a escala grises 8-bit
```

### 3. ⚡ Optimize

```
Endpoint: https://api.pdf-rest.com/optimize
Función: Optimización completa con parámetros personalizados
Configuración: 300 DPI + escala grises + compresión alta
```

## 🚀 Flujo en el Sistema

```
🔄 Conversión Principal (Ghostscript)
   ↓ (si falla)
🔥 Conversión Extrema
   ↓ (si falla)
🔥🔥 Rasterización Completa
   ↓ (si falla)
🔧 Conversión Simple
   ↓ (si falla)
🌐 PDF-REST (NUEVO - método profesional)
   ↓ (si falla)
📐 Página por página → MuTool → QPDF → Ultra básica
```

## 💡 Ventajas de PDF-REST

✅ **Profesional**: APIs diseñadas específicamente para PDF
✅ **Confiable**: Infraestructura cloud robusta
✅ **Precisa**: Conversión de alta calidad
✅ **Rápida**: Procesamiento optimizado
✅ **Fallback**: No dependemos solo de Ghostscript local

## 📊 Configuración Implementada

```javascript
// Configuración automática para nuestros requerimientos
{
  imageQuality: 300,        // 300 DPI
  colorSpace: 'grayscale',  // Escala grises forzada
  compression: 'high'       // Máxima compresión
}
```

## 🔍 Logs de Seguimiento

El sistema registra qué servicio PDF-REST fue exitoso:

- `✅ PDF-REST Compress exitoso`
- `✅ PDF-REST Grayscale exitoso`
- `✅ PDF-REST Optimize exitoso`

## 🔧 Implementación Técnica

### Método Principal

```javascript
async pdfRestConversion(filePath) {
  // 1. Lee archivo local
  // 2. Llama API PDF-REST
  // 3. Escribe resultado optimizado
  // 4. Reporta éxito
}
```

### Estrategias Múltiples

```javascript
// Prueba 3 servicios en secuencia:
1. Compress (rápido, buena compresión)
2. Grayscale (específico para escala grises)
3. Optimize (configuración personalizada)
```

## 📈 Resultados Esperados

Con PDF-REST, los PDFs problemáticos que fallan con Ghostscript deberían:

🎯 **Convertirse exitosamente** a escala grises 8-bit
🎯 **Mantener 300 DPI** en todas las imágenes  
🎯 **Comprimirse eficientemente** bajo 3MB
🎯 **Procesar más rápido** que métodos locales
🎯 **Tener mayor compatibilidad** con PDFs complejos

## 🚀 Próximos Pasos

1. **Configurar API Key** en Railway
2. **Probar con PDF problemático**
3. **Verificar logs** para confirmar uso de PDF-REST
4. **Evaluar resultados** vs métodos locales

---

🌟 **PDF-REST nos da una alternativa profesional y confiable cuando los métodos locales fallan.**
