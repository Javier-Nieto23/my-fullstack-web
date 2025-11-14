# 📊 Estructura de Base de Datos

## Modelo: User

Tabla que almacena la información de los usuarios del sistema.

### Campos

| Campo       | Tipo     | Restricciones      | Descripción                          |
| ----------- | -------- | ------------------ | ------------------------------------ |
| `id`        | Integer  | PK, Auto-increment | Identificador único del usuario      |
| `email`     | String   | Unique, Not Null   | Correo electrónico del usuario       |
| `rfc`       | String   | Unique, Not Null   | RFC mexicano del usuario             |
| `nombre`    | String   | Not Null           | Nombre completo del usuario          |
| `password`  | String   | Not Null           | Contraseña hasheada con bcrypt       |
| `createdAt` | DateTime | Auto, Not Null     | Fecha y hora de creación             |
| `updatedAt` | DateTime | Auto, Not Null     | Fecha y hora de última actualización |

### Índices

- **Primaria**: `id`
- **Única**: `email`
- **Única**: `rfc`

### Validaciones de Prisma

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  rfc       String   @unique
  nombre    String
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Ejemplo de datos

```json
{
  "id": 1,
  "email": "usuario@example.com",
  "rfc": "RFC1234567890",
  "nombre": "Juan Pérez García",
  "password": "$2b$10$...",
  "createdAt": "2024-11-13T10:30:00.000Z",
  "updatedAt": "2024-11-13T10:30:00.000Z"
}
```

## Futuras Tablas (Para implementar)

### Company

```prisma
model Company {
  id        Int      @id @default(autoincrement())
  name      String
  rfc       String   @unique
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

### Document

```prisma
model Document {
  id        Int      @id @default(autoincrement())
  fileName  String
  fileType  String
  status    String   // PROCESADO, ENVIADO, NO_CUMPLIDO
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

## Migraciones

### Crear primera migración (después de cambiar schema)

```bash
npx prisma migrate dev --name init
```

### Ver estado de migraciones

```bash
npx prisma migrate status
```

### Revertir última migración

```bash
npx prisma migrate resolve --rolled-back 001_init
```

### Resetear BD (cuidado: borra todo)

```bash
npx prisma migrate reset
```

## Prisma Studio

Para ver visualmente los datos:

```bash
npx prisma studio
```

Se abrirá en http://localhost:5555

---

**Última actualización**: 13 de noviembre de 2024
