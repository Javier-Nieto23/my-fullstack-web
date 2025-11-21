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

  // Estado para visualización de PDF
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
          let errorTitle = 'Error'
          let errorIcon = 'error'
          
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
            // Verificar si es un error específico de páginas en blanco
            const errorData = error.response?.data
            if (errorData?.errorType === 'BLANK_PAGES' || 
                errorData?.error?.includes('páginas en blanco') ||
                errorData?.error?.includes('PDF en blanco')) {
              errorTitle = 'PDF con Páginas en Blanco'
              errorMessage = `ERROR: PDF con páginas en blanco\n\n${errorData?.message || errorData?.details?.blankReason || 'No se permite subir PDFs con páginas en blanco o contenido insuficiente.'}`
              errorIcon = 'warning'
            } else {
              errorMessage = errorData?.error || error.message
            }
          }
          
          Swal.fire({
            title: errorTitle,
            text: errorMessage,
            icon: errorIcon,
            confirmButtonText: 'Entendido',
            confirmButtonColor: errorIcon === 'warning' ? '#f39c12' : '#d33'
          })
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
    
    // Validación adicional: archivos muy pequeños podrían estar en blanco
    if (file.size < 1024) { // Menos de 1KB
      return { 
        valid: false, 
        error: 'ERROR: PDF con páginas en blanco - El archivo es demasiado pequeño y posiblemente esté vacío' 
      }
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

      {/* Contenido principal */}
      <div className="container-fluid py-4" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Section 1: Upload + Status Cards - FUSIÓN INTELIGENTE */}
        <div className="row mb-4">
          {/* Upload section */}
          <div className="col-md-6">
            <div className="card p-4 h-100">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{ fontSize: "2.5rem", color: "#17a2b8" }}>
                  <i className="bi bi-cloud-arrow-up"></i>
                </div>
                <div>
                  <h5 className="mb-0">Subir & Procesar PDF</h5>
                  <small className="text-muted">Validación y Conversión con Ghostscript</small>
                </div>
              </div>
              
              <div 
                style={{
                  border: isDragging ? "2px solid #17a2b8" : "2px dashed #17a2b8",
                  borderRadius: "8px",
                  padding: "40px 20px",
                  textAlign: "center",
                  backgroundColor: isDragging ? "#e6f3ff" : "#f0f8ff",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  position: "relative"
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <div style={{ fontSize: "2.5rem", color: "#17a2b8", marginBottom: "10px" }}>
                  <i className={`bi ${isDragging ? 'bi-cloud-arrow-down-fill' : selectedFiles.length > 0 ? 'bi-files' : 'bi-cloud-arrow-down'}`}></i>
                </div>
                
                {selectedFiles.length === 0 ? (
                  <>
                    <p className="mb-2">{isDragging ? 'Suelta los archivos aquí' : 'Arrastra PDF aquí'}</p>
                    <small className="text-muted">o haz clic para seleccionar múltiples PDF</small>
                    <div style={{ marginTop: "10px" }}>
                      <small className="text-muted">Tamaño máximo total: 5MB</small>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-2">
                      <strong>{selectedFiles.length} archivo{selectedFiles.length > 1 ? 's' : ''} seleccionado{selectedFiles.length > 1 ? 's' : ''}</strong>
                    </p>
                    <div className="mb-2">
                      <small className="text-muted">
                        Tamaño total: <strong>
                          {(selectedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB
                        </strong> / 5 MB
                      </small>
                    </div>
                    <small className="text-muted">Haz clic para agregar más PDFs</small>
                  </>
                )}
              </div>

              <input
                type="file"
                id="fileInput"
                multiple
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Lista de archivos seleccionados */}
              {selectedFiles.length > 0 && (
                <div className="mt-3" style={{maxHeight: "200px", overflowY: "auto"}}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="text-muted fw-bold">
                      <i className="bi bi-files me-1"></i>
                      Archivos a procesar:
                    </small>
                    <button 
                      className="btn btn-sm btn-outline-danger"
                      onClick={clearAllFiles}
                      title="Limpiar todos"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                  
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="d-flex align-items-center justify-content-between p-2 mb-1 bg-light rounded">
                      <div className="d-flex align-items-center flex-grow-1">
                        <i className="bi bi-file-pdf text-danger me-2"></i>
                        <div className="flex-grow-1">
                          <div className="text-truncate" style={{maxWidth: '200px'}} title={file.name}>
                            <small className="fw-medium">{file.name}</small>
                          </div>
                          <div>
                            <small className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                          </div>
                        </div>
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => removeFileFromSelection(index)}
                        title="Eliminar archivo"
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botón de procesar */}
              <div className="mt-3">
                <button 
                  className={`btn w-100 ${selectedFiles.length === 0 ? 'btn-secondary' : 'btn-success'}`}
                  disabled={uploading || selectedFiles.length === 0}
                  onClick={processSelectedFiles}
                  style={{
                    opacity: selectedFiles.length === 0 ? 0.5 : 1,
                    transition: "all 0.3s ease",
                    fontSize: "1.1rem",
                    padding: "12px 20px"
                  }}
                >
                  {uploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Procesando archivos...
                    </>
                  ) : selectedFiles.length === 0 ? (
                    <>
                      <i className="bi bi-gear me-2"></i>
                      Selecciona PDFs para procesar
                    </>
                  ) : (
                    <>
                      <i className="bi bi-gear me-2"></i>
                      Procesar {selectedFiles.length} archivo{selectedFiles.length > 1 ? 's' : ''}
                      <small className="d-block mt-1" style={{fontSize: "0.85rem", opacity: 0.9}}>
                        {(selectedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB total
                      </small>
                    </>
                  )}
                </button>
              </div>

              {/* Progreso de archivos */}
              {processing.length > 0 && (
                <div className="mt-3">
                  <small className="text-muted d-block mb-2">
                    <i className="bi bi-gear-fill me-1"></i>
                    Procesando archivos:
                  </small>
                  {processing.map(file => (
                    <div key={file.id} className="mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="text-truncate" style={{maxWidth: '200px'}}>{file.name}</small>
                        <small className="fw-bold text-primary">{file.progress}%</small>
                      </div>
                      <div className="progress" style={{height: '6px'}}>
                        <div 
                          className="progress-bar bg-gradient" 
                          style={{width: `${file.progress}%`}}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status cards - MÉTRICAS DINÁMICAS */}
          <div className="col-md-6">
            <div className="row g-2">
              {/* Procesados */}
              <div className="col-12">
                <div className="card p-3" style={{ borderLeft: "4px solid #17a2b8" }}>
                  <div className="d-flex align-items-center">
                    <div style={{ fontSize: "1.8rem", color: "#17a2b8", marginRight: "15px" }}>
                      <i className="bi bi-file-check"></i>
                    </div>
                    <div>
                      <small className="text-muted d-block">PROCESADOS</small>
                      <h4 className="mb-0">{metrics.procesados}</h4>
                    </div>
                  </div>
                </div>
              </div>
              {/* Enviados */}
              <div className="col-12">
                <div className="card p-3" style={{ borderLeft: "4px solid #6f42c1" }}>
                  <div className="d-flex align-items-center">
                    <div style={{ fontSize: "1.8rem", color: "#6f42c1", marginRight: "15px" }}>
                      <i className="bi bi-send"></i>
                    </div>
                    <div>
                      <small className="text-muted d-block">ENVIADOS</small>
                      <h4 className="mb-0">{metrics.enviados}</h4>
                    </div>
                  </div>
                </div>
              </div>
              {/* No cumplidos */}
              <div className="col-12">
                <div className="card p-3" style={{ borderLeft: "4px solid #dc3545" }}>
                  <div className="d-flex align-items-center">
                    <div style={{ fontSize: "1.8rem", color: "#dc3545", marginRight: "15px" }}>
                      <i className="bi bi-exclamation-circle"></i>
                    </div>
                    <div>
                      <small className="text-muted d-block">NO CUMPLIDOS</small>
                      <h4 className="mb-0">{metrics.noCumplidos}</h4>
                    </div>
                  </div>
                </div>
              </div>
              {/* Mis Empresas */}
              <div className="col-12">
                <div className="card p-3" style={{ borderLeft: "4px solid #e83e8c" }}>
                  <div className="d-flex align-items-center">
                    <div style={{ fontSize: "1.8rem", color: "#e83e8c", marginRight: "15px" }}>
                      <i className="bi bi-building"></i>
                    </div>
                    <div>
                      <small className="text-muted d-block">MIS EMPRESAS</small>
                      <h4 className="mb-0">{metrics.misEmpresas}</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Requirements box */}
        <div className="card mb-4">
          <div className="card-header" style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
            <h6 className="mb-0">
              <i className="bi bi-info-circle me-2"></i>
              Requerimientos de Documentos
            </h6>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <ul className="reqs mb-0">
                  <li>
                    <strong>Tipo de archivo:</strong> Solo PDF.
                  </li>
                  <li>
                    <strong>Formato:</strong> Escala de grises a 8 bits.
                  </li>
                  <li>
                    <strong>Resolución:</strong> 300 DPI.
                  </li>
                </ul>
              </div>
              <div className="col-md-6">
                <ul className="reqs mb-0">
                  <li>
                    <strong>Tamaño individual:</strong> Máximo 5 MB por archivo.
                  </li>
                  <li>
                    <strong>Tamaño total:</strong> Máximo 5 MB entre todos los archivos.
                  </li>
                  <li>
                    <strong>Contenido:</strong> Sin formularios ni contraseñas.
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="alert alert-info mt-3 mb-0" style={{background: "linear-gradient(90deg, #e3f2fd 0%, #f3e5f5 100%)", border: "1px solid #17a2b8"}}>
              <div className="row align-items-center">
                <div className="col-auto">
                  <i className="bi bi-lightbulb-fill text-primary" style={{fontSize: "1.5rem"}}></i>
                </div>
                <div className="col">
                  <strong>Nuevo flujo mejorado:</strong> Puedes seleccionar múltiples PDFs y acumularlos antes de procesarlos. 
                  El botón de procesar se habilitará automáticamente cuando tengas archivos seleccionados.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Documentos Procesados */}
        <div className="card mb-4">
          <div className="card-header" style={{ background: "linear-gradient(90deg, #17a2b8 0%, #20c997 100%)", color: "white" }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-files" style={{ fontSize: "1.5rem" }}></i>
              <div>
                <h6 className="mb-0">Documentos Procesados ({documents.length})</h6>
                <small>Validados y convertidos con Ghostscript</small>
              </div>
            </div>
          </div>
          <div className="card-body">
            {documents.length === 0 ? (
              <div className="text-center py-4">
                <div style={{ fontSize: "2.5rem", color: "#ccc", marginBottom: "15px" }}>
                  <i className="bi bi-files"></i>
                </div>
                <p className="text-muted mb-1">No hay documentos procesados</p>
                <small className="text-muted">Los archivos aparecerán aquí después de procesarlos con Ghostscript</small>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Estado</th>
                      <th>Tipo</th>
                      <th>Fecha</th>
                      <th>Tamaño</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <i className="bi bi-file-pdf text-danger me-2" style={{fontSize: '1.2rem'}}></i>
                            <div>
                              <div className="fw-medium text-truncate" style={{maxWidth: '200px'}}>
                                {doc.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {doc.status === 'processed' && (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle me-1"></i>Procesado
                            </span>
                          )}
                          {doc.status === 'sent' && (
                            <span className="badge bg-info">
                              <i className="bi bi-send me-1"></i>Enviado
                            </span>
                          )}
                          {doc.status === 'non_compliant' && (
                            <span className="badge bg-danger">
                              <i className="bi bi-exclamation-circle me-1"></i>No cumple
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-primary">
                            <i className="bi bi-gear me-1"></i>Ghostscript
                          </span>
                        </td>
                        <td>{new Date(doc.uploadDate).toLocaleDateString('es-ES')}</td>
                        <td>{(doc.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button 
                              className="btn btn-outline-primary"
                              onClick={() => viewPdf(doc)}
                              title="Ver PDF"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button 
                              className="btn btn-outline-danger"
                              onClick={() => deleteDocument(doc.id)}
                              title="Eliminar"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Estadísticas Rápidas */}
        {documents.length > 0 && (
          <div className="card">
            <div className="card-header" style={{ background: "linear-gradient(90deg, #6f42c1 0%, #e83e8c 100%)", color: "white" }}>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-graph-up" style={{ fontSize: "1.5rem" }}></i>
                <div>
                  <h6 className="mb-0">Resumen de Procesamiento</h6>
                  <small>Estadísticas de documentos procesados con Ghostscript</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="text-center p-3 bg-light rounded">
                    <div className="h4 text-primary mb-1">{documents.length}</div>
                    <small className="text-muted">Total Documentos</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-3 bg-light rounded">
                    <div className="h4 text-success mb-1">{documents.filter(d => d.status === 'processed').length}</div>
                    <small className="text-muted">Procesados</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-3 bg-light rounded">
                    <div className="h4 text-info mb-1">{documents.filter(d => d.status === 'sent').length}</div>
                    <small className="text-muted">Enviados</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center p-3 bg-light rounded">
                    <div className="h4 text-danger mb-1">{documents.filter(d => d.status === 'non_compliant').length}</div>
                    <small className="text-muted">No Cumplidos</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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