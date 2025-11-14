# 🧪 Testing de Endpoints

## URLs Base

- **Local**: http://localhost:3000
- **Docker**: http://backend:3000

## 1. Registrar Usuario

**Endpoint**: `POST /auth/register`

### Request

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "rfc": "JGM960528ABC",
    "nombre": "Juan García Martínez",
    "password": "MiPassword123!",
    "passwordConfirm": "MiPassword123!"
  }'
```

### Response (201)

```json
{
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "juan@example.com",
    "nombre": "Juan García Martínez",
    "rfc": "JGM960528ABC"
  }
}
```

### Errores

- `400`: RFC corto, email inválido, contraseñas no coinciden
- `400`: Email o RFC ya registrado
- `500`: Error del servidor

---

## 2. Iniciar Sesión

**Endpoint**: `POST /auth/login`

### Request

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "MiPassword123!"
  }'
```

### Response (200)

```json
{
  "message": "Sesión iniciada exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "juan@example.com",
    "nombre": "Juan García Martínez",
    "rfc": "JGM960528ABC"
  }
}
```

### Errores

- `400`: Email o contraseña faltantes
- `401`: Email o contraseña incorrectos
- `500`: Error del servidor

---

## 3. Obtener Datos del Usuario

**Endpoint**: `GET /auth/me`

Requiere autenticación.

### Request

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200)

```json
{
  "id": 1,
  "email": "juan@example.com",
  "nombre": "Juan García Martínez",
  "rfc": "JGM960528ABC",
  "createdAt": "2024-11-13T10:30:00.000Z"
}
```

### Errores

- `401`: Token no proporcionado
- `401`: Token inválido o expirado
- `500`: Error del servidor

---

## 4. Cerrar Sesión

**Endpoint**: `POST /auth/logout`

Requiere autenticación.

### Request

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response (200)

```json
{
  "message": "Sesión cerrada exitosamente"
}
```

---

## Testing con Postman

### Importar esta colección:

```json
{
  "info": {
    "name": "Auth API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"juan@example.com\",\n  \"rfc\": \"JGM960528ABC\",\n  \"nombre\": \"Juan García Martínez\",\n  \"password\": \"MiPassword123!\",\n  \"passwordConfirm\": \"MiPassword123!\"\n}"
        },
        "url": {
          "raw": "{{api_url}}/auth/register",
          "host": ["{{api_url}}"],
          "path": ["auth", "register"]
        }
      }
    },
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"juan@example.com\",\n  \"password\": \"MiPassword123!\"\n}"
        },
        "url": {
          "raw": "{{api_url}}/auth/login",
          "host": ["{{api_url}}"],
          "path": ["auth", "login"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "api_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "token",
      "value": ""
    }
  ]
}
```

### Variables de Postman

Después de registrarte o iniciar sesión, copia el token en la variable:

```
pm.environment.set("token", pm.response.json().token);
```

---

## Testing en el Frontend

### Registro

```javascript
const response = await fetch("http://localhost:3000/auth/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "juan@example.com",
    rfc: "JGM960528ABC",
    nombre: "Juan García Martínez",
    password: "MiPassword123!",
    passwordConfirm: "MiPassword123!",
  }),
});

const data = await response.json();
localStorage.setItem("token", data.token);
```

### Login

```javascript
const response = await fetch("http://localhost:3000/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "juan@example.com",
    password: "MiPassword123!",
  }),
});

const data = await response.json();
localStorage.setItem("token", data.token);
```

### Obtener datos del usuario

```javascript
const token = localStorage.getItem("token");
const response = await fetch("http://localhost:3000/auth/me", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const user = await response.json();
console.log(user);
```

---

## Códigos de Error

| Código | Tipo         | Descripción                             |
| ------ | ------------ | --------------------------------------- |
| 200    | Success      | Operación exitosa                       |
| 201    | Created      | Recurso creado                          |
| 400    | Bad Request  | Datos inválidos                         |
| 401    | Unauthorized | No autenticado o credenciales inválidas |
| 500    | Server Error | Error interno del servidor              |

---

**Última actualización**: 13 de noviembre de 2024
