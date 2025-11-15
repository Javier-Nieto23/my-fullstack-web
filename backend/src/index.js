import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const app = express()

const prisma = new PrismaClient()

app.use(express.json())

// Configurar CORS para soportar Railway y desarrollo local
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'http://localhost:5173']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const SALT_ROUNDS = 10

// Middleware para verificar token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// POST /auth/register - Registrar nuevo usuario
app.post('/auth/register', async (req, res) => {
  try {
    const { email, rfc, nombre, password, passwordConfirm } = req.body

    // Validaciones
    if (!email || !rfc || !nombre || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' })
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' })
    }

    if (rfc.length < 12) {
      return res.status(400).json({ error: 'RFC debe tener al menos 12 caracteres' })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { rfc: rfc.toUpperCase() }
        ]
      }
    })

    if (existingUser) {
      return res.status(400).json({ error: 'El email o RFC ya está registrado' })
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        rfc: rfc.toUpperCase(),
        nombre,
        password: hashedPassword
      }
    })

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rfc: user.rfc
      }
    })
  } catch (error) {
    console.error('Error en registro:', error)
    res.status(500).json({ error: 'Error al registrar usuario' })
  }
})

// POST /auth/login - Iniciar sesión
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(200).json({
      message: 'Sesión iniciada exitosamente',
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rfc: user.rfc
      }
    })
  } catch (error) {
    console.error('Error en login:', error)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

// POST /auth/logout - Cerrar sesión (opcional, principalmente para limpiar frontend)
app.post('/auth/logout', verifyToken, (req, res) => {
  res.status(200).json({ message: 'Sesión cerrada exitosamente' })
})

// GET /auth/me - Obtener datos del usuario actual
app.get('/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        nombre: true,
        rfc: true,
        createdAt: true
      }
    })

    res.status(200).json(user)
  } catch (error) {
    console.error('Error al obtener usuario:', error)
    res.status(500).json({ error: 'Error al obtener datos del usuario' })
  }
})

// GET /items (endpoint existente para pruebas)
app.get('/items', (req, res) => {
  res.json([
    { id: 1, name: 'Juego Zelda' },
    { id: 2, name: 'Consola Switch' },
  ])
})

// GET /debug/database - Endpoint temporal para verificar la base de datos
app.get('/debug/database', async (req, res) => {
  try {
    // Verificar conexión
    await prisma.$connect()
    
    // Contar usuarios
    const userCount = await prisma.user.count()
    
    // Obtener algunos usuarios de ejemplo
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        nombre: true,
        createdAt: true
      }
    })

    res.json({
      status: 'success',
      database: 'connected',
      userCount,
      users,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
    })
  }
})

const PORT = process.env.PORT || 3000

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

// Start server with 0.0.0.0 para que Railway pueda acceder
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`)
  console.log(`Base de datos conectada`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})
