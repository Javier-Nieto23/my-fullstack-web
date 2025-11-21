import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../css/pag_verificacion.css";
import "../css/login.css";
import "../css/documentos.css";
import axios from 'axios';
import Swal from 'sweetalert2';
import DocumentosProcesados from './DocumentosProcesados';

const Verificacion = () => {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  
  // URLs de APIs
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"
  const PYTHON_SERVICE_URL = process.env.NODE_ENV === 'production' 
    ? `${API_URL}/python-service` 
    : "http://localhost:5000"

  // Estados para gestión de documentos (tu implementación moderna)
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState([])
  const [metrics, setMetrics] = useState({
    procesados: 0,
    enviados: 0,
    noCumplidos: 0,
    misEmpresas: 0
  })

  // Estados para visualización de PDF
  const [viewingPdf, setViewingPdf] = useState(null)

  // ===========================================
  // AUTENTICACIÓN Y INICIALIZACIÓN
  // ===========================================
  
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/', { replace: true })
      return
    }

    // Validate token with backend
    ;(async () => {
      try {
        console.log('Validando token con:', `${API_URL}/auth/me`)
        
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        })
        
        if (!res.ok) {
          console.log('Token inválido, status:', res.status)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/', { replace: true })
          return
        }
        
        console.log('Token válido, cargando documentos...')
        await loadDocuments()
        
      } catch (err) {
        console.error('Error de conexión:', err)
        
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          Swal.fire({
            title: 'Error de conexión',
            text: 'No se pudo conectar al servidor. Por favor, verifica tu conexión a internet.',
            icon: 'error',
            confirmButtonText: 'Reintentar',
            allowOutsideClick: false
          }).then(() => {
            window.location.reload()
          })
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/', { replace: true })
        }
        return
      } finally {
        setChecking(false)
      }
    })()
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/', { replace: true })
  }

  // ===========================================
  // GESTIÓN DE DOCUMENTOS (Backend Integration)
  // ===========================================
  
  const loadDocuments = async () => {
    try {
      const token = localStorage.getItem('token')
      console.log('Cargando documentos desde:', `${API_URL}/documents`)
      
      const response = await axios.get(`${API_URL}/documents`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      
      console.log('Documentos cargados:', response.data)
      setDocuments(response.data)
      updateMetrics(response.data)
    } catch (error) {
      console.error('Error loading documents:', error)
      
      if (error.code === 'ECONNABORTED') {
        Swal.fire('Error', 'Timeout de conexión. El servidor tardó demasiado en responder.', 'error')
      } else if (error.response?.status === 401) {
        Swal.fire('Sesión expirada', 'Por favor, inicia sesión nuevamente', 'warning')
        handleLogout()
      } else if (!error.response) {
        Swal.fire('Error de conexión', `No se pudo conectar al servidor. Verifica tu conexión a internet.\n\nAPI URL: ${API_URL}`, 'error')
      } else {
        Swal.fire('Error', `Error del servidor: ${error.response?.data?.error || error.message}`, 'error')
      }
    }
  }

  const updateMetrics = (docs) => {
    const procesados = docs.filter(doc => doc.status === 'processed').length
    const enviados = docs.filter(doc => doc.status === 'sent').length
    const noCumplidos = docs.filter(doc => doc.status === 'non_compliant').length
    const empresas = [...new Set(docs.map(doc => doc.company))].length

    setMetrics({
      procesados,
      enviados,
      noCumplidos,
      misEmpresas: empresas
    })
  }

  // ===========================================
  // DRAG & DROP Y SELECCIÓN DE ARCHIVOS
  // ===========================================
  
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf')
    addFilesToSelection(files)
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf')
    addFilesToSelection(files)
  }

  // ===========================================
  // NUEVAS FUNCIONES PARA MANEJO MEJORADO DE ARCHIVOS
  // ===========================================
  
  const addFilesToSelection = (newFiles) => {
    if (newFiles.length === 0) return
    
    // Agregar archivos únicos (evitar duplicados por nombre)
    const existingNames = selectedFiles.map(f => f.name)
    const uniqueFiles = newFiles.filter(file => !existingNames.includes(file.name))
    
    if (uniqueFiles.length === 0) {
      Swal.fire('Información', 'Los archivos ya están seleccionados', 'info')
      return
    }
    
    const combinedFiles = [...selectedFiles, ...uniqueFiles]
    
    // Validar tamaño total
    const totalSize = combinedFiles.reduce((sum, file) => sum + file.size, 0)
    const totalMB = (totalSize / 1024 / 1024).toFixed(2)
    
    if (totalSize > 5 * 1024 * 1024) { // 5MB máximo
      Swal.fire({
        title: 'Límite excedido',
        html: `
          <p>El tamaño total de los archivos excede el límite de 5MB.</p>
          <p><strong>Tamaño total:</strong> ${totalMB} MB</p>
          <p>Por favor, selecciona menos archivos o archivos más pequeños.</p>
        `,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      })
      return
    }
    
    setSelectedFiles(combinedFiles)
    
    // Mostrar confirmación de archivos agregados
    if (uniqueFiles.length > 0) {
      const message = uniqueFiles.length === 1 
        ? `Archivo "${uniqueFiles[0].name}" agregado`
        : `${uniqueFiles.length} archivos agregados`
      
      Swal.fire({
        title: 'Archivos agregados',
        html: `
          <p>${message}</p>
          <p><strong>Total de archivos:</strong> ${combinedFiles.length}</p>
          <p><strong>Tamaño total:</strong> ${totalMB} MB / 5 MB</p>
        `,
        icon: 'success',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false
      })
    }
  }

  const removeFileFromSelection = (indexToRemove) => {
    const newFiles = selectedFiles.filter((_, index) => index !== indexToRemove)
    setSelectedFiles(newFiles)
    
    Swal.fire({
      title: 'Archivo eliminado',
      text: 'El archivo ha sido removido de la selección',
      icon: 'info',
      timer: 1500,
      showConfirmButton: false
    })
  }

  const clearAllFiles = () => {
    setSelectedFiles([])
    Swal.fire({
      title: 'Selección limpiada',
      text: 'Todos los archivos han sido removidos',
      icon: 'info',
      timer: 1500,
      showConfirmButton: false
    })
  }

  const processSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      Swal.fire('Error', 'No hay archivos seleccionados para procesar', 'error')
      return
    }

    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0)
    const totalMB = (totalSize / 1024 / 1024).toFixed(2)

    const result = await Swal.fire({
      title: 'Procesar Archivos',
      html: `
        <p>Se procesarán <strong>${selectedFiles.length}</strong> archivo(s) PDF</p>
        <p><strong>Tamaño total:</strong> ${totalMB} MB</p>
        <p><strong>Método:</strong> Validación y conversión con Ghostscript</p>
        <hr>
        <small class="text-muted">Este proceso puede tomar algunos minutos dependiendo del tamaño de los archivos</small>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Procesar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d'
    })

    if (result.isConfirmed) {
      await uploadFilesToBackend(selectedFiles)
      // Limpiar selección después del procesamiento exitoso
      setSelectedFiles([])
    }
  }




  // ===========================================
  // UPLOAD AL BACKEND (Tu implementación moderna)
  // ===========================================
  
  const uploadFilesToBackend = async (files) => {
    setUploading(true)
    const token = localStorage.getItem('token')
    const processingIds = []

    // Validar tamaño total antes de procesar
    const totalValidation = validateTotalSize(files)
    if (!totalValidation.valid) {
      Swal.fire('Error', totalValidation.error, 'error')
      setUploading(false)
      return
    }

    try {
      for (let file of files) {
        const validation = validateFile(file)
        if (!validation.valid) {
          Swal.fire('Error', validation.error, 'error')
          continue
        }

        const tempId = Date.now() + Math.random()
        processingIds.push(tempId)
        setProcessing(prev => [...prev, { id: tempId, name: file.name, progress: 0 }])

        const formData = new FormData()
        formData.append('pdf', file)

        try {
          console.log('Subiendo archivo a:', `${API_URL}/documents/upload`)
          
          const response = await axios.post(`${API_URL}/documents/upload`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            },
            timeout: 30000,
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              setProcessing(prev => 
                prev.map(p => p.id === tempId ? { ...p, progress: percentCompleted } : p)
              )
            }
          })

          console.log('Archivo subido exitosamente:', response.data)

          const newDoc = response.data.document
          setDocuments(prev => [newDoc, ...prev])
          updateMetrics([newDoc, ...documents])

          setTimeout(() => {
            setProcessing(prev => prev.filter(p => p.id !== tempId))
          }, 1000)

        } catch (error) {
          setProcessing(prev => prev.filter(p => p.id !== tempId))
          console.error('Upload error:', error)
          
          let errorMessage = 'Error al procesar el archivo'
          
          if (error.code === 'ECONNABORTED') {
            errorMessage = 'Timeout de conexión. El archivo tardó demasiado en subirse.'
          } else if (error.response?.status === 401) {
            errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.'
            handleLogout()
            return
          } else if (error.response?.status === 413) {
            errorMessage = 'El archivo es demasiado grande. Máximo permitido: 5MB.'
          } else if (!error.response) {
            errorMessage = `Error de conexión: ${error.message}. API URL: ${API_URL}`
          } else {
            // Manejar errores específicos del validador PDF
            const responseError = error.response?.data?.error || error.message
            const errorDetails = error.response?.data?.details

            if (responseError.includes('PDF en blanco') || errorDetails?.errors?.some(err => err.includes('PDF en blanco'))) {
              errorMessage = 'No se permite PDF en blanco. Por favor, selecciona un documento con contenido.'
            } else if (responseError.includes('OCR escaneado')) {
              errorMessage = 'PDF rechazado: Contiene texto escaneado (OCR) que no es procesable.'
            } else if (responseError.includes('elementos prohibidos')) {
              errorMessage = 'PDF rechazado: El documento contiene elementos que no pueden ser procesados.'
            } else {
              errorMessage = responseError
            }
          }
          
          Swal.fire('Error', errorMessage, 'error')
        }
      }

      if (processingIds.length > 0) {
        Swal.fire({
          title: '¡Procesamiento completado!',
          html: `
            <p><i class="bi bi-check-circle-fill text-success"></i> ${processingIds.length} archivo(s) procesado(s) exitosamente</p>
            <p><strong>Total procesado:</strong> ${totalValidation.totalMB} MB</p>
            <small class="text-muted">Los documentos aparecen ahora en tu lista</small>
          `,
          icon: 'success',
          timer: 3000,
          timerProgressBar: true
        })
      }

    } catch (error) {
      console.error('Error uploading files:', error)
      Swal.fire('Error', 'Error inesperado al subir archivos', 'error')
    } finally {
      setUploading(false)
      // No limpiar selectedFiles aquí, se limpia en processSelectedFiles tras éxito
    }
  }

  // ===========================================
  // FUNCIONES AUXILIARES
  // ===========================================
  
  const validateFile = (file) => {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'Solo se permiten archivos PDF' }
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB por archivo individual
      return { valid: false, error: 'Archivo individual demasiado grande (máx. 5MB)' }
    }
    if (file.size < 1024) { // Menos de 1KB probablemente está vacío
      return { valid: false, error: 'El archivo parece estar vacío o es demasiado pequeño' }
    }
    return { valid: true }
  }

  const validateTotalSize = (files) => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > 5 * 1024 * 1024) {
      const totalMB = (totalSize / 1024 / 1024).toFixed(2)
      return { 
        valid: false, 
        error: `Tamaño total excede el límite (${totalMB} MB / 5 MB)`,
        totalMB 
      }
    }
    return { valid: true, totalMB: (totalSize / 1024 / 1024).toFixed(2) }
  }

  const deleteDocument = async (docId) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token')
        await axios.delete(`${API_URL}/documents/${docId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        setDocuments(prev => prev.filter(doc => doc.id !== docId))
        updateMetrics(documents.filter(doc => doc.id !== docId))
        Swal.fire('Eliminado', 'Documento eliminado exitosamente', 'success')
      } catch (error) {
        Swal.fire('Error', 'Error al eliminar documento', 'error')
      }
    }
  }

  const viewPdf = async (doc) => {
    try {
      if (!doc.fileUrl) {
        Swal.fire('Error', 'No se puede mostrar el documento. Archivo no disponible.', 'error')
        return
      }

      // Mostrar loading
      Swal.fire({
        title: 'Cargando PDF...',
        html: 'Obteniendo documento desde el servidor',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        }
      })

      // Obtener el PDF desde el backend
      const token = localStorage.getItem('token')
      const fullUrl = `${API_URL}${doc.fileUrl}`
      
      const response = await axios.get(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob' // Importante: obtener como blob
      })

      // Crear URL temporal para el blob
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' })
      const pdfUrl = URL.createObjectURL(pdfBlob)

      // Cerrar loading y mostrar el PDF
      Swal.close()
      setViewingPdf({ 
        ...doc, 
        fullUrl: pdfUrl,
        isBlob: true // Marcamos que es un blob para limpieza posterior
      })

    } catch (error) {
      console.error('Error obteniendo PDF:', error)
      Swal.close()
      
      if (error.response?.status === 404) {
        Swal.fire('Error', 'Documento no encontrado en el servidor.', 'error')
      } else if (error.response?.status === 403) {
        Swal.fire('Error', 'No tienes permisos para ver este documento.', 'error')
      } else {
        Swal.fire('Error', 'Error al cargar el documento. Intenta nuevamente.', 'error')
      }
    }
  }

  const closePdfViewer = () => {
    // Limpiar URL del blob si existe para evitar memory leaks
    if (viewingPdf?.isBlob && viewingPdf?.fullUrl) {
      URL.revokeObjectURL(viewingPdf.fullUrl)
    }
    setViewingPdf(null)
  }

  if (checking) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Cargando...</span>
          </div>
          <div className="mt-3">
            <h5 className="text-muted">Verificando sesión...</h5>
            <p className="text-muted mb-0">Por favor, espera un momento</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div>
      {/* Header blanco */}
      <div className="brandbar" style={{ background: "white", borderBottom: "1px solid #e1e7ef" }}>
        <div className="container-fluid py-2">
          <div className="row align-items-center">
            <div
              className="col-auto d-flex align-items-center gap-2"
              style={{ marginLeft: "15px" }}
            >
              <img
                className="navbar-brand"
                src="/LOGONegro.png"
                alt="SEER Tráfico S.C."
                style={{ height: "46px" }}
              />
              <h1 className="brand-title mb-0" style={{ color: "#0b2d50" }}>
                Centro de Cumplimiento Fiscal
              </h1>
            </div>
            <div className="col text-end" style={{ marginRight: "15px" }}>
              <button className="btn btn-Cerrar" onClick={handleLogout}>Cerrar Sesión</button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal - Documentos Procesados */}
      <div className="container-fluid" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <DocumentosProcesados />
      </div>

      {/* Modal PDF Viewer - Backend Documents */}
      {viewingPdf && (
        <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} onClick={() => closePdfViewer()}>
          <div className="modal-dialog modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-file-pdf text-danger me-2"></i>
                  {viewingPdf.name}
                </h5>
                <button type="button" className="btn-close" onClick={() => closePdfViewer()}></button>
              </div>
              <div className="modal-body p-0">
                <iframe
                  src={viewingPdf.fullUrl}
                  style={{width: '100%', height: '70vh', border: 'none'}}
                  title={`PDF: ${viewingPdf.name}`}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => closePdfViewer()}>
                  Cerrar
                </button>
                {viewingPdf.downloadUrl && (
                  <button 
                    className="btn btn-success"
                    onClick={() => {
                      const downloadUrl = `${API_URL}${viewingPdf.downloadUrl}`
                      window.open(downloadUrl, '_blank')
                    }}
                  >
                    <i className="bi bi-download me-1"></i>Descargar PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      <footer className="text-center py-3">
        © 2025 SEER Tráfico S.C. — Portal de Carga de Información
      </footer>

      {/* Estilos adicionales */}
      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .bg-gradient {
          background: linear-gradient(45deg, #6f42c1, #e83e8c) !important;
        }
      `}</style>
    </div>
  );
};

export default Verificacion;