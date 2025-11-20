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
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import r2Service from './services/cloudflareR2.js'
import { pdfValidator } from './services/pdfValidator.js'
import PDFProcessor from './services/pdfProcessor.js'

const execAsync = promisify(exec)

const app = express()

const prisma = new PrismaClient()

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Crear directorio uploads si no existe
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Servir archivos estáticos desde uploads
app.use('/uploads', express.static(uploadsDir))

app.use(express.json())

// Configurar CORS para soportar Railway y desarrollo local
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL || 'https://my-fullstack-web-seven.vercel.app',
        'https://my-fullstack-web-seven.vercel.app',
        'https://my-fullstack-web.vercel.app',
        // Permitir cualquier subdominio de vercel.app para tu proyecto
        /.*\.vercel\.app$/
      ]
    : ['http://localhost:5173', 'http://localhost:3000', 'https://my-fullstack-web-seven.vercel.app'],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

// Configurar multer para manejo de archivos (memoria para R2)
const storage = multer.memoryStorage()

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para R2
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

// ===========================================
// HEALTH CHECK Y DEBUG ENDPOINTS
// ===========================================

// GET / - Health check básico
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PDF Converter Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// GET /health - Health check detallado
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a base de datos
    await prisma.$queryRaw`SELECT 1`
    
    // Verificar configuración de Cloudflare R2 con detalles
    const r2Config = {
      configured: r2Service.isConfigured(),
      accountId: !!process.env.R2_ACCOUNT_ID,
      accessKey: !!process.env.R2_ACCESS_KEY_ID,
      secretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      bucketName: !!process.env.R2_BUCKET_NAME,
      bucketNameValue: process.env.R2_BUCKET_NAME
    }
    
    console.log('🔍 R2 Configuration Check:', r2Config)
    
    // Verificar herramientas de validación PDF (pdfinfo, pdfimages, mutool)
    const toolsStatus = {
      pdfinfo: 'checking...',
      pdfimages: 'checking...',
      mutool: 'checking...'
    }
    
    try {
      await execAsync('pdfinfo -v')
      toolsStatus.pdfinfo = 'available'
    } catch {
      toolsStatus.pdfinfo = 'missing'
    }
    
    try {
      await execAsync('pdfimages -help')
      toolsStatus.pdfimages = 'available'
    } catch {
      toolsStatus.pdfimages = 'missing'
    }
    
    try {
      await execAsync('mutool -v')
      toolsStatus.mutool = 'available'
    } catch {
      toolsStatus.mutool = 'missing'
    }

    try {
      await execAsync('gs --version')
      toolsStatus.ghostscript = 'available'
    } catch {
      toolsStatus.ghostscript = 'missing'
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      cloudflareR2: r2Config,
      pdfValidation: {
        service: 'enabled',
        tools: toolsStatus,
        specifications: {
          maxSize: '3 MB',
          requiredDPI: '300',
          colorMode: 'grayscale 8-bit',
          contentRestrictions: ['no-password', 'no-forms', 'no-javascript', 'no-embedded']
        }
      },
      pdfProcessing: {
        service: 'enabled',
        autoConversion: 'active',
        features: ['grayscale-conversion', 'dpi-optimization', 'compression', 'size-reduction']
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      cloudflareR2: 'unknown',
      pdfValidation: 'error',
      error: error.message,
      environment: process.env.NODE_ENV || 'development'
    })
  }
})

// GET /api/test - Endpoint de prueba para verificar CORS
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown'
  })
})

// Middleware para verificar token
const verifyToken = (req, res, next) => {
  // Buscar token en header Authorization o query param
  let token = req.headers.authorization?.split(' ')[1] || req.query.token
  
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

// POST /documents/upload - Subir y procesar PDF con Cloudflare R2
app.post('/documents/upload', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó archivo PDF' })
    }

    // Verificar que R2 esté configurado
    if (!r2Service.isConfigured()) {
      return res.status(500).json({ 
        error: 'Servicio de almacenamiento no configurado. Contacta al administrador.' 
      })
    }

    const { originalname, buffer, size, mimetype } = req.file
    const userId = req.user.id

    // 🔍 OBTENER INFORMACIÓN DEL USUARIO
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nombre: true, email: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    console.log(`👤 Usuario: ${user.nombre} (${user.email})`)

    // Instanciar procesador de PDF
    const pdfProcessor = new PDFProcessor();

    console.log('🔍 Iniciando validación y procesamiento PDF:', originalname)

    // 1️⃣ VALIDACIÓN CON DETECCIÓN DE OCR
    const initialValidation = await pdfValidator.validatePDF(buffer, originalname)
    
    console.log('📋 Resultado validación:')
    console.log(pdfValidator.generateDetailedReport(initialValidation))

    // 2️⃣ VERIFICAR SI ES PROCESABLE (rechazar definitivamente si tiene OCR)
    if (!initialValidation.isProcessable) {
      return res.status(400).json({
        error: initialValidation.hasOCR 
          ? 'PDF RECHAZADO: Contiene texto OCR escaneado (no procesable)'
          : 'PDF RECHAZADO: Contiene elementos prohibidos (no procesable)',
        definitive: true, // Rechazo definitivo
        details: {
          summary: initialValidation.summary,
          errors: initialValidation.errors,
          warnings: initialValidation.warnings,
          checks: initialValidation.checks,
          hasOCR: initialValidation.hasOCR
        }
      })
    }
    
    let finalBuffer = buffer;
    let wasProcessed = false;
    let processingReport = '';

    // 3️⃣ PROCESAMIENTO AUTOMÁTICO (solo si no cumple pero ES procesable)
    if (!initialValidation.valid && initialValidation.isProcessable) {
      console.log('🔄 PDF procesable pero no cumple especificaciones. Iniciando conversión automática...');
      
      try {
        const processingResult = await pdfProcessor.processPDF(buffer, originalname);
        finalBuffer = processingResult.processedBuffer;
        wasProcessed = true;
        processingReport = processingResult.optimizations.join(', ');
        console.log('✅ PDF procesado exitosamente');
      } catch (error) {
        console.error('❌ Error procesando PDF:', error);
        return res.status(400).json({
          error: 'PDF no cumple especificaciones y no pudo ser procesado',
          originalIssues: initialValidation.errors,
          processingError: error.message
        });
      }
    } else if (initialValidation.valid) {
      console.log('✅ PDF cumple especificaciones originalmente');
    }

    // 3️⃣ VALIDACIÓN FINAL (del PDF original o procesado)
    console.log('🔍 Iniciando validación final del PDF...')
    const validationResult = await pdfValidator.validatePDF(finalBuffer, originalname)
    
    console.log('🔍 Resultado de validación final:')
    console.log(pdfValidator.generateDetailedReport(validationResult))
    console.log(`📊 Estado actual: wasProcessed=${wasProcessed}, validationResult.valid=${validationResult.valid}`)

    // ✅ Si el PDF fue procesado exitosamente, considerarlo válido
    // La conversión automática ya garantiza cumplimiento de especificaciones
    if (wasProcessed) {
      console.log('✅ PDF procesado automáticamente - considerado válido para almacenamiento')
      validationResult.valid = true
      validationResult.summary = 'PDF procesado y convertido exitosamente'
      console.log('✅ Validación final actualizada: valid=true')
    }

    console.log(`📋 Estado final antes de verificaciones: wasProcessed=${wasProcessed}, valid=${validationResult.valid}`)

    // Si aún no pasa validación final Y no fue procesado, rechazar
    if (!validationResult.valid && !wasProcessed) {
      console.log('❌ PDF rechazado: no válido y no procesado')
      return res.status(400).json({
        error: 'PDF no cumple con las especificaciones requeridas y no puede ser procesado automáticamente',
        wasProcessed: wasProcessed,
        details: {
          summary: validationResult.summary,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          checks: validationResult.checks
        }
      })
    }

    console.log('✅ PDF aprobado para almacenamiento')

    // 4️⃣ SUBIR A CLOUDFLARE R2 (PDF final)
    const fileName = wasProcessed ? `processed_${originalname}` : originalname;
    console.log(`🌩️ Subiendo a Cloudflare R2: ${fileName}`)
    console.log(`📊 Estado: wasProcessed=${wasProcessed}, valid=${validationResult.valid}`)
    
    // Verificar nuevamente que R2 esté configurado antes de subir
    if (!r2Service.isConfigured()) {
      console.error('❌ R2 no configurado - verificar variables de entorno')
      throw new Error('Servicio de almacenamiento Cloudflare R2 no está configurado')
    }
    
    console.log('🔧 R2 configurado correctamente, iniciando subida...')
    const uploadResult = await r2Service.uploadFile(finalBuffer, fileName, mimetype)
    console.log(`✅ Archivo subido exitosamente a R2: ${uploadResult.key}`)

    // 5️⃣ GUARDAR EN BASE DE DATOS CON INFORMACIÓN DE USUARIO
    const document = await prisma.document.create({
      data: {
        name: fileName,
        originalName: originalname,
        size: finalBuffer.length, // Tamaño del archivo final
        status: 'processed',
        userId: userId,
        company: user.nombre, // ✅ USAR NOMBRE DEL USUARIO EN LUGAR DE "Empresa Demo"
        uploadDate: new Date(),
        processedAt: new Date(),
        filePath: uploadResult.key
      }
    })

    console.log(`✅ Documento guardado en BD: ${document.id} para usuario: ${user.nombre}`)

    res.status(201).json({
      success: true,
      message: wasProcessed ? '🔄 PDF procesado y almacenado exitosamente' : '✅ PDF validado y almacenado exitosamente',
      document: {
        id: document.id,
        name: document.name,
        originalName: document.originalName,
        status: document.status,
        size: document.size,
        uploadDate: document.uploadDate,
        company: document.company,
        fileUrl: `/api/documents/${document.id}/view`
      },
      processing: {
        wasProcessed: wasProcessed,
        originalSize: size,
        finalSize: finalBuffer.length,
        compressionRatio: wasProcessed ? ((1 - finalBuffer.length / size) * 100).toFixed(1) + '%' : '0%',
        report: processingReport
      },
      validation: {
        summary: validationResult.summary,
        warnings: validationResult.warnings,
        details: validationResult.checks
      },
      storage: {
        provider: 'Cloudflare R2',
        key: uploadResult.key,
        stored: true
      }
    })

  } catch (error) {
    console.error('Error procesando documento:', error)
    res.status(500).json({ error: 'Error al procesar documento: ' + error.message })
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
        processedAt: true,
        filePath: true
      }
    })

    // Agregar URLs de visualización y descarga
    const documentsWithUrls = documents.map(doc => ({
      ...doc,
      fileUrl: `/api/documents/${doc.id}/view`,
      downloadUrl: `/api/documents/${doc.id}/download`
    }))

    res.status(200).json(documentsWithUrls)
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

// GET /api/documents/:id/view - Visualizar PDF desde almacenamiento (R2 o local)
app.get('/api/documents/:id/view', verifyToken, async (req, res) => {
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

    if (!document.filePath) {
      return res.status(404).json({ error: 'Archivo no encontrado en el almacenamiento' })
    }

    // Determinar si usar R2 o almacenamiento local
    if (r2Service.isConfigured()) {
      // Usar Cloudflare R2
      try {
        const signedUrl = await r2Service.getSignedViewUrl(document.filePath, 3600)
        
        console.log('🔗 URL firmada generada:', signedUrl)
        
        const response = await fetch(signedUrl)
        
        if (!response.ok) {
          throw new Error(`Error obteniendo archivo: ${response.status} ${response.statusText}`)
        }
        
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.originalName}"`,
          'Cache-Control': 'public, max-age=3600',
          'Accept-Ranges': 'bytes'
        });
        
        console.log(`📄 Sirviendo PDF desde R2: ${document.filePath}`);
        
        const pdfBuffer = await response.buffer();
        res.send(pdfBuffer);
        
      } catch (r2Error) {
        console.error('Error obteniendo archivo de R2:', r2Error);
        res.status(500).json({ error: 'Error al acceder al archivo: ' + r2Error.message });
      }
    } else {
      // Usar almacenamiento local
      const localFilePath = path.join(uploadsDir, document.filePath);
      
      try {
        await fs.promises.access(localFilePath, fs.constants.F_OK);
        
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.originalName}"`,
          'Cache-Control': 'public, max-age=3600',
          'Accept-Ranges': 'bytes'
        });
        
        console.log(`📄 Sirviendo PDF local: ${document.filePath}`);
        
        const pdfBuffer = await fs.promises.readFile(localFilePath);
        res.send(pdfBuffer);
        
      } catch (fileError) {
        console.error('Error accediendo archivo local:', fileError);
        res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
      }
    }

  } catch (error) {
    console.error('Error sirviendo PDF:', error)
    res.status(500).json({ error: 'Error al mostrar documento' })
  }
})

// GET /api/documents/:id/download - Descargar PDF desde Cloudflare R2
app.get('/api/documents/:id/download', verifyToken, async (req, res) => {
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

    if (!document.filePath) {
      return res.status(404).json({ error: 'Archivo no encontrado en el almacenamiento' })
    }

    // Determinar si usar R2 o almacenamiento local
    if (r2Service.isConfigured()) {
      // Usar Cloudflare R2
      try {
        const downloadUrl = await r2Service.getSignedDownloadUrl(
          document.filePath, 
          document.originalName, 
          3600
        )
        
        res.redirect(downloadUrl)
      } catch (r2Error) {
        console.error('Error generando URL de descarga R2:', r2Error)
        res.status(500).json({ error: 'Error al generar enlace de descarga' })
      }
    } else {
      // Usar almacenamiento local
      const localFilePath = path.join(uploadsDir, document.filePath);
      
      try {
        await fs.promises.access(localFilePath, fs.constants.F_OK);
        
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${document.originalName}"`,
          'Cache-Control': 'no-cache'
        });
        
        console.log(`📥 Descargando PDF local: ${document.filePath}`);
        
        res.sendFile(localFilePath);
        
      } catch (fileError) {
        console.error('Error accediendo archivo local para descarga:', fileError);
        res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
      }
    }

  } catch (error) {
    console.error('Error descargando PDF:', error)
    res.status(500).json({ error: 'Error al descargar documento' })
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

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  console.error('Error global:', error)
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo excede el tamaño máximo permitido (5MB)' })
  }
  
  if (error.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ error: 'Solo se permiten archivos PDF' })
  }
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  })
})

// Middleware para manejar rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  })
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Cerrando servidor gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Recibido SIGTERM, cerrando servidor...')
  await prisma.$disconnect()
  process.exit(0)
})

// Start server with 0.0.0.0 para que Railway pueda acceder
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor backend escuchando en puerto ${PORT}`)
  console.log(`🗄️ Base de datos configurada`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🔗 CORS configurado para: ${corsOptions.origin}`)
  console.log(`⏰ Servidor iniciado: ${new Date().toISOString()}`)
})

server.on('error', (error) => {
  console.error('Error del servidor:', error)
  if (error.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ya está en uso`)
  }
})

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection en:', promise, 'razón:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})
