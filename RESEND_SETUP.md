# Configuración de Resend para Envío de Correos

Este documento explica cómo configurar el servicio de correo electrónico usando Resend para enviar documentos PDF por email.

## 📧 ¿Qué es Resend?

Resend es un servicio moderno de envío de correos electrónicos diseñado para desarrolladores. Ofrece:

- ✅ API simple y confiable
- ✅ Envío de adjuntos (hasta 40MB)
- ✅ Templates HTML personalizables
- ✅ Tracking de correos
- ✅ Plan gratuito: 100 emails/día, 3,000 emails/mes

## 🚀 Pasos para Configurar

### 1. Crear Cuenta en Resend

1. Ve a [resend.com](https://resend.com)
2. Crea una cuenta gratuita
3. Verifica tu correo electrónico

### 2. Obtener API Key

1. Inicia sesión en Resend
2. Ve a **API Keys** en el dashboard
3. Haz clic en **Create API Key**
4. Dale un nombre (ej: "PDF Portal Production")
5. Copia la API Key generada (empieza con `re_`)

⚠️ **Importante**: Guarda esta key de forma segura, solo se muestra una vez.

### 3. Configurar Dominio (Opcional pero Recomendado)

Para enviar desde tu propio dominio (ej: `noreply@tuempresa.com`):

1. Ve a **Domains** en Resend
2. Haz clic en **Add Domain**
3. Ingresa tu dominio (ej: `tuempresa.com`)
4. Sigue las instrucciones para agregar los registros DNS:
   - **SPF**: Registro TXT
   - **DKIM**: Registro TXT
   - **DMARC**: Registro TXT (opcional)
5. Espera la verificación (puede tomar hasta 72 horas)

### 4. Variables de Entorno

Agrega estas variables en Railway (o tu servicio de hosting):

```bash
RESEND_API_KEY=re_tu_api_key_aqui
RESEND_FROM_EMAIL=noreply@tudominio.com
```

#### En Railway:

1. Ve a tu proyecto en Railway
2. Haz clic en tu servicio (backend)
3. Ve a la pestaña **Variables**
4. Haz clic en **New Variable**
5. Agrega cada variable:
   - Name: `RESEND_API_KEY`
   - Value: Tu API key de Resend
6. Repite para `RESEND_FROM_EMAIL`
7. Haz un nuevo deploy para aplicar cambios

### 5. Email de Envío

**Si NO tienes dominio verificado:**

```bash
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Si tienes dominio verificado:**

```bash
RESEND_FROM_EMAIL=noreply@tudominio.com
# o cualquier email con tu dominio verificado
```

## 🧪 Probar el Servicio

### 1. Desde el Portal

1. Inicia sesión en el portal
2. Ve a la sección de documentos
3. Haz clic en el botón de sobre (📧) junto a un documento
4. Ingresa un correo electrónico
5. Haz clic en "Enviar"
6. Revisa la bandeja del correo

### 2. Verificar Logs

En Railway:

```bash
# Busca estos mensajes en los logs:
📧 [Email] Enviando PDF a: correo@ejemplo.com
📄 [Email] Documento: nombre.pdf
✅ [Email] Correo enviado exitosamente
📧 [Email] ID: mensaje_id
```

## 📊 Límites del Servicio

### Plan Gratuito

- 100 emails por día
- 3,000 emails por mes
- Adjuntos hasta 40MB

### Plan Pro ($20/mes)

- 50,000 emails por mes
- Adjuntos hasta 40MB
- Soporte prioritario

## 🔧 Solución de Problemas

### Error: "Servicio de correo no disponible"

**Causa**: Variables de entorno no configuradas

**Solución**:

```bash
# Verifica que las variables existen en Railway
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=xxx@xxx.com

# Redeploya el servicio después de agregarlas
```

### Error: "Email address is not verified"

**Causa**: Intentas enviar desde un email/dominio no verificado

**Solución**:

- Usa `onboarding@resend.dev` (solo testing)
- O verifica tu dominio en Resend

### Error: "Invalid API key"

**Causa**: API key incorrecta o expirada

**Solución**:

1. Ve a Resend dashboard
2. Verifica/genera una nueva API key
3. Actualiza la variable en Railway

### Los correos no llegan

**Posibles causas**:

1. **Revisa spam/correo no deseado**
2. **Email incorrecto**: Verifica el formato
3. **Dominio no verificado**: Usa `onboarding@resend.dev` para testing
4. **Límite alcanzado**: Revisa tu cuota en Resend

## 📝 Template del Correo

El correo enviado incluye:

- 📄 Encabezado con diseño profesional
- 👤 Saludo personalizado con nombre del usuario
- 📎 Información del documento (nombre, tamaño, fecha)
- 🔗 PDF adjunto
- 🏢 Footer con información de la empresa

## 🔒 Seguridad

- ✅ La API key nunca se expone al frontend
- ✅ Solo usuarios autenticados pueden enviar correos
- ✅ Los documentos están protegidos por autenticación JWT
- ✅ Se valida que el documento pertenezca al usuario

## 📚 Recursos Adicionales

- [Documentación de Resend](https://resend.com/docs)
- [Resend Dashboard](https://resend.com/dashboard)
- [Verificación de Dominios](https://resend.com/docs/dashboard/domains/introduction)

## 🆘 Soporte

Si tienes problemas:

1. Revisa los logs del backend en Railway
2. Verifica las variables de entorno
3. Consulta el dashboard de Resend
4. Contacta al equipo de desarrollo
