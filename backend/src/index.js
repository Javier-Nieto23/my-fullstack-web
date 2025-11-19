import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

const app = express()

const prisma = new PrismaClient()

app.use(express.json())

// Configurar CORS para soportar Railway y desarrollo local
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://my-fullstack-web-seven.vercel.app']
    : ['http://localhost:5173', 'http://localhost:3000', 'https://my-fullstack-web-seven.vercel.app'],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

// Configurar multer para manejo de archivos
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos PDF'))
    }
  }
})

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

// ===========================================
// ENDPOINTS DE DOCUMENTOS PDF
// ===========================================

// POST /documents/upload - Subir y procesar PDF
app.post('/documents/upload', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo PDF' })
    }

    const { originalname, buffer, size } = req.file
    const userId = req.user.id

    // Validaciones
    if (size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo (5MB)' })
    }

    // Simular procesamiento con servicio Python (opcional)
    let processedStatus = 'processed'
    let complianceCheck = Math.random() > 0.3 // 70% probabilidad de cumplir

    if (!complianceCheck) {
      processedStatus = 'non_compliant'
    }

    // Guardar información del documento en base de datos
    const document = await prisma.document.create({
      data: {
        name: originalname,
        originalName: originalname,
        size: size,
        status: processedStatus,
        userId: userId,
        company: 'Empresa Demo', // Por ahora valor fijo
        uploadDate: new Date(),
        processedAt: processedStatus === 'processed' ? new Date() : null
      }
    })

    res.status(201).json({
      message: 'Documento procesado exitosamente',
      document: {
        id: document.id,
        name: document.name,
        status: document.status,
        size: document.size,
        uploadDate: document.uploadDate,
        company: document.company
      }
    })

  } catch (error) {
    console.error('Error procesando documento:', error)
    res.status(500).json({ error: 'Error al procesar documento' })
  }
})

// GET /documents - Obtener documentos del usuario
app.get('/documents', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id

    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { uploadDate: 'desc' },
      select: {
        id: true,
        name: true,
        originalName: true,
        size: true,
        status: true,
        company: true,
        uploadDate: true,
        processedAt: true
      }
    })

    res.status(200).json(documents)
  } catch (error) {
    console.error('Error obteniendo documentos:', error)
    res.status(500).json({ error: 'Error al obtener documentos' })
  }
})

// DELETE /documents/:id - Eliminar documento
app.delete('/documents/:id', verifyToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id)
    const userId = req.user.id

    // Verificar que el documento pertenezca al usuario
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: userId
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' })
    }

    await prisma.document.delete({
      where: { id: documentId }
    })

    res.status(200).json({ message: 'Documento eliminado exitosamente' })
  } catch (error) {
    console.error('Error eliminando documento:', error)
    res.status(500).json({ error: 'Error al eliminar documento' })
  }
})

// GET /documents/:id - Obtener documento específico
app.get('/documents/:id', verifyToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id)
    const userId = req.user.id

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: userId
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' })
    }

    res.status(200).json(document)
  } catch (error) {
    console.error('Error obteniendo documento:', error)
    res.status(500).json({ error: 'Error al obtener documento' })
  }
})

// GET /documents/stats - Obtener estadísticas de documentos
app.get('/documents/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id

    const stats = await prisma.document.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        status: true
      }
    })

    const result = {
      procesados: 0,
      enviados: 0,
      noCumplidos: 0,
      total: 0
    }

    stats.forEach(stat => {
      result.total += stat._count.status
      switch (stat.status) {
        case 'processed':
          result.procesados = stat._count.status
          break
        case 'sent':
          result.enviados = stat._count.status
          break
        case 'non_compliant':
          result.noCumplidos = stat._count.status
          break
      }
    })

    // Contar empresas únicas
    const companies = await prisma.document.findMany({
      where: { userId },
      select: { company: true },
      distinct: ['company']
    })

    result.misEmpresas = companies.length

    res.status(200).json(result)
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    res.status(500).json({ error: 'Error al obtener estadísticas' })
  }
})

// ===========================================
// ENDPOINTS DE AUTENTICACIÓN
// ===========================================

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
