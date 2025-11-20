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
  
  // Estado para controlar qué vista mostrar
  const [activeTab, setActiveTab] = useState('upload') // 'upload' o 'documents'

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
    setSelectedFiles(files)
    if (files.length > 0) {
      showUploadConfirmation(files)
    }
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf')
    setSelectedFiles(files)
    if (files.length > 0) {
      showUploadConfirmation(files)
    }
  }

  const showUploadConfirmation = async (files) => {
    const result = await Swal.fire({
      title: 'Procesar Archivos',
      text: `Se procesarán ${files.length} archivo(s) PDF con validaciones Ghostscript`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Procesar con Backend',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd'
    })

    if (result.isConfirmed) {
      await uploadFilesToBackend(files)
    }
  }




  // ===========================================
  // UPLOAD AL BACKEND (Tu implementación moderna)
  // ===========================================
  
  const uploadFilesToBackend = async (files) => {
    setUploading(true)
    const token = localStorage.getItem('token')
    const processingIds = []

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
            errorMessage = error.response?.data?.error || error.message
          }
          
          Swal.fire('Error', errorMessage, 'error')
        }
      }

      if (processingIds.length > 0) {
        Swal.fire({
          title: '¡Completado!',
          text: 'Archivos procesados exitosamente',
          icon: 'success',
          timer: 2000
        })
      }

    } catch (error) {
      console.error('Error uploading files:', error)
      Swal.fire('Error', 'Error inesperado al subir archivos', 'error')
    } finally {
      setUploading(false)
      setSelectedFiles([])
    }
  }

  // ===========================================
  // FUNCIONES AUXILIARES
  // ===========================================
  
  const validateFile = (file) => {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'Solo se permiten archivos PDF' }
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      return { valid: false, error: 'Archivo demasiado grande (máx. 5MB)' }
    }
    return { valid: true }
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

  if (checking) return null
  
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

      {/* Navegación por tabs */}
      <div className="container-fluid" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div className="card mb-4">
          <div className="card-header p-0">
            <ul className="nav nav-tabs card-header-tabs">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setActiveTab('upload')}
                  style={{
                    border: 'none',
                    background: activeTab === 'upload' ? '#fff' : 'transparent',
                    color: activeTab === 'upload' ? '#0b2d50' : '#666'
                  }}
                >
                  <i className="bi bi-cloud-arrow-up me-2"></i>
                  Subir Documentos
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setActiveTab('documents')}
                  style={{
                    border: 'none',
                    background: activeTab === 'documents' ? '#fff' : 'transparent',
                    color: activeTab === 'documents' ? '#0b2d50' : '#666'
                  }}
                >
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Documentos Procesados
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contenido condicional según tab activo */}
      {activeTab === 'upload' && (
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
                  transition: "all 0.3s ease"
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <div style={{ fontSize: "2.5rem", color: "#17a2b8", marginBottom: "10px" }}>
                  <i className={`bi ${isDragging ? 'bi-cloud-arrow-down-fill' : 'bi-cloud-arrow-down'}`}></i>
                </div>
                <p className="mb-2">{isDragging ? 'Suelta los archivos aquí' : 'Arrastra PDF aquí'}</p>
                <small className="text-muted">o haz clic para seleccionar múltiples PDF</small>
                <div style={{ marginTop: "10px" }}>
                  <small className="text-muted">
                    {selectedFiles.length === 0
                      ? "Tamaño máximo: 5MB por archivo"
                      : `${selectedFiles.length} archivo(s) seleccionado(s)`}
                  </small>
                </div>
              </div>

              <input
                type="file"
                id="fileInput"
                multiple
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Botones de acción */}
              <div className="row mt-3 g-2">
                <div className="col-6">
                  <button 
                    className="btn btn-primary w-100" 
                    disabled={uploading || selectedFiles.length === 0}
                    onClick={() => document.getElementById('fileInput').click()}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cloud-upload me-2"></i>
                        Seleccionar
                      </>
                    )}
                  </button>
                </div>
                <div className="col-6">
                  <button 
                    className="btn btn-success w-100" 
                    disabled={selectedFiles.length === 0}
                    onClick={() => showUploadConfirmation(selectedFiles)}
                  >
                    <i className="bi bi-gear me-2"></i>
                    Procesar
                  </button>
                </div>
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
            <h6 className="mb-0">Requerimientos de Documentos</h6>
          </div>
          <div className="card-body">
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
              <li>
                <strong>Tamaño máximo:</strong> 5 MB por archivo.
              </li>
              <li>
                <strong>Contenido:</strong> Sin formularios ni contraseñas.
              </li>
            </ul>
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
      )}
      
      {/* Tab de Documentos Procesados */}
      {activeTab === 'documents' && (
        <div className="container-fluid" style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <DocumentosProcesados />
        </div>
      )}

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