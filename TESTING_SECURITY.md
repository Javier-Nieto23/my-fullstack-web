# 🧪 Guía de Testing Manual de Seguridad

## Cómo Probar las Protecciones Implementadas

### 📋 Instrucciones Generales
Copia y pega estos valores directamente en los formularios de tu aplicación para verificar que las validaciones funcionen correctamente.

---

## 1️⃣ TEST: SQL Injection Protection

### ❌ Estos valores DEBEN SER RECHAZADOS

**En el campo "Correo electrónico" del Login:**

```
admin' OR '1'='1
```

```
admin'; DROP TABLE users--
```

```
' OR 1=1--
```

```
admin' UNION SELECT * FROM users--
```

```
test@test.com'; DELETE FROM users WHERE '1'='1
```

**✅ Resultado Esperado:**
- Mensaje: "Email inválido" o error de validación
- El sistema NO debe permitir el login
- NO debe ejecutar ninguna query SQL maliciosa

---

## 2️⃣ TEST: XSS (Cross-Site Scripting) Protection

### ❌ Estos valores DEBEN SER SANITIZADOS

**En el campo "Nombre" del Registro:**

```
<script>alert("XSS")</script>
```

```
<img src=x onerror=alert("Hack")>
```

```
<svg onload=alert("XSS Attack")>
```

```
javascript:alert("XSS")
```

```
<iframe src="javascript:alert('XSS')">
```

**En el campo "Correo" o "RFC":**

```
test<script>alert(1)</script>@test.com
```

```
<svg/onload=alert(document.cookie)>
```

**✅ Resultado Esperado:**
- Los tags HTML/JavaScript son removidos o escapados
- El texto se guarda sin los caracteres peligrosos `< > `
- NO se ejecuta ningún código JavaScript

---

## 3️⃣ TEST: Validación de RFC Mexicano

### ❌ RFCs INVÁLIDOS (deben ser rechazados)

**En el campo "RFC" del Registro:**

```
ABC
```
*Razón: Muy corto*

```
123456789012
```
*Razón: Solo números*

```
ABCD123456XYZ
```
*Razón: Formato incorrecto*

```
invalid-rfc-test
```
*Razón: Caracteres inválidos*

```
TEST01010100
```
*Razón: Fecha inválida (mes 01, día 01)*

### ✅ RFCs VÁLIDOS (deben ser aceptados)

```
XAXX010101000
```

```
VECJ880326XXX
```

```
GODE540515XXX
```

```
OAGS920708HM1
```

**✅ Resultado Esperado:**
- RFCs inválidos: Error "RFC inválido"
- RFCs válidos: Se acepta el registro

---

## 4️⃣ TEST: Validación de Contraseña Fuerte

### ❌ Contraseñas DÉBILES (deben ser rechazadas)

**En el campo "Contraseña" del Registro:**

```
123456
```
*Razón: Solo números, muy corta*

```
password
```
*Razón: Solo minúsculas, sin números*

```
PASSWORD
```
*Razón: Solo mayúsculas, sin números*

```
Pass123
```
*Razón: Menos de 8 caracteres*

```
Passw0rd
```
*Razón: Válida (acepta si tiene 8+ chars, mayúscula, minúscula, número)*

```
test
```
*Razón: Muy corta*

### ✅ Contraseñas FUERTES (deben ser aceptadas)

```
Password123
```

```
Test1234
```

```
Segur0Web
```

```
MiClave2025
```

**✅ Resultado Esperado:**
- Contraseñas débiles: Error "Contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"
- Contraseñas fuertes: Se acepta

---

## 5️⃣ TEST: Rate Limiting (Límite de Intentos)

### 🔄 Cómo Probar

1. **Prueba de Login:**
   - Intenta hacer login **11 veces seguidas** con credenciales incorrectas
   - Usa cualquier email y contraseña

2. **Email de prueba:**
   ```
   test@test.com
   ```

3. **Contraseña de prueba:**
   ```
   wrongpassword
   ```

4. **Proceso:**
   - Click en "Iniciar Sesión" → Error
   - Repite 10 veces más rápidamente
   - En el intento 11, deberías ver un mensaje diferente

**✅ Resultado Esperado:**
- Intentos 1-10: "Email o contraseña incorrectos"
- Intento 11+: "Demasiados intentos de inicio de sesión, intenta más tarde"
- Espera 15 minutos para poder intentar de nuevo

---

## 6️⃣ TEST: Path Traversal Protection (Nombres de Archivo)

### ❌ Nombres MALICIOSOS (deben ser sanitizados)

**Al subir un PDF, renómbralo primero con estos nombres:**

```
../../etc/passwd.pdf
```

```
../../../windows/system32/config.pdf
```

```
..\..\..\..\boot.ini.pdf
```

```
<script>hack</script>.pdf
```

**✅ Resultado Esperado:**
- El nombre del archivo se sanitiza automáticamente
- Se eliminan caracteres peligrosos: `../`, `..\\`, `<`, `>`
- El archivo se guarda con un nombre seguro

---

## 7️⃣ TEST: Email Validation

### ❌ Emails INVÁLIDOS (deben ser rechazados)

```
notanemail
```

```
@test.com
```

```
test@
```

```
test..double@test.com
```

```
test@test
```

### ✅ Emails VÁLIDOS (deben ser aceptados)

```
usuario@ejemplo.com
```

```
test.user@domain.co.mx
```

```
admin+tag@sitio.com
```

---

## 📊 Checklist de Pruebas

### Para Login:
- [ ] Intentar SQL Injection en email
- [ ] Probar con emails inválidos
- [ ] Hacer 11+ intentos seguidos (rate limit)
- [ ] Login exitoso con credenciales correctas

### Para Registro:
- [ ] XSS en campo nombre
- [ ] RFCs inválidos
- [ ] Contraseñas débiles
- [ ] Email con XSS
- [ ] Registro exitoso con datos válidos

### Para Upload de PDF:
- [ ] Archivo con nombre malicioso
- [ ] Archivo muy grande (>10MB)
- [ ] Archivo que no es PDF
- [ ] PDF válido

---

## 🎯 Ejemplos de Datos Válidos para Testing

### Usuario de Prueba Completo:

**Correo:**
```
testing@caast.com.mx
```

**RFC:**
```
XAXX010101000
```

**Nombre:**
```
Usuario de Prueba
```

**Contraseña:**
```
Testing2025
```

**Confirmar Contraseña:**
```
Testing2025
```

---

## 🚀 Cómo Usar Esta Guía

1. **Abre tu aplicación** en el navegador
2. **Ve al formulario** (Login o Registro)
3. **Copia y pega** los valores de esta guía
4. **Observa el resultado**:
   - ✅ Verde/Aceptado = Dato válido
   - ❌ Rojo/Rechazado = Dato inválido (esto es bueno!)
5. **Verifica** que los mensajes de error sean claros

---

## 📝 Notas Importantes

- **Los errores son buenos:** Si ves "Email inválido" o "RFC inválido", significa que la seguridad está funcionando
- **No uses datos reales:** Esta es solo para testing, usa datos ficticios
- **Documenta resultados:** Anota qué funciona y qué no
- **Reinicia el servidor:** Si haces muchas pruebas de rate limiting, reinicia el backend

---

## 🛡️ Protecciones Verificadas

Si todas las pruebas pasan correctamente, tu aplicación está protegida contra:

✅ SQL Injection  
✅ XSS (Cross-Site Scripting)  
✅ Ataques de fuerza bruta (Rate Limiting)  
✅ Contraseñas débiles  
✅ RFCs inválidos  
✅ Path Traversal  
✅ Emails maliciosos  

---

## 📞 Soporte

Si alguna protección NO funciona:
1. Verifica que el backend esté ejecutándose
2. Revisa la consola del navegador (F12)
3. Revisa los logs del backend
4. Verifica que las librerías estén instaladas: `express-validator`, `validator`, `helmet`, `express-rate-limit`

