import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../css/pag_verificacion.css";
import "../css/login.css";
import axios from 'axios';
import Swal from 'sweetalert2';

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

  // Estados para conversión PDF (funcionalidad de Joel integrada)
  const [viewingPdf, setViewingPdf] = useState(null)
  const [convertedPdfs, setConvertedPdfs] = useState([]) // PDFs convertidos localmente
  
  // Estados adicionales para el viewer mejorado
  const [showAdvancedViewer, setShowAdvancedViewer] = useState(false)
  const [currentViewingDoc, setCurrentViewingDoc] = useState(null)

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
      text: `Se han seleccionado ${files.length} archivo(s) PDF`,
      icon: 'info',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Subir al Backend',
      denyButtonText: 'Convertir Localmente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
      denyButtonColor: '#6f42c1'
    })

    if (result.isConfirmed) {
      await uploadFilesToBackend(files)
    } else if (result.isDenied) {
      await convertFilesLocally(files)
    }
  }

  // ===========================================
  // CONVERSIÓN LOCAL DE PDFS (Funcionalidad de Joel)
  // ===========================================
  
  const convertFilesLocally = async (files) => {
    setUploading(true)
    
    for (let file of files) {
      const validation = validateFile(file)
      if (!validation.valid) {
        Swal.fire('Error', validation.error, 'error')
        continue
      }

      const tempId = Date.now() + Math.random()
      setProcessing(prev => [...prev, { id: tempId, name: file.name, progress: 0 }])

      try {
        await convertSinglePDF(file, tempId)
      } catch (error) {
        console.error('Error en conversión local:', error)
        setProcessing(prev => prev.filter(p => p.id !== tempId))
        Swal.fire('Error', `Error al convertir ${file.name}`, 'error')
      }
    }

    setUploading(false)
    setSelectedFiles([])
  }

  const convertSinglePDF = async (file, tempId) => {
    const swalLoading = Swal.fire({
      title: "Convirtiendo PDF...",
      text: `Procesando ${file.name} con IA`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
      showConfirmButton: false,
    });

    const formData = new FormData();
    formData.append("file", file);

    // Simular progreso
    const progressInterval = setInterval(() => {
      setProcessing(prev => 
        prev.map(p => p.id === tempId ? { ...p, progress: Math.min(p.progress + 15, 90) } : p)
      )
    }, 500)

    try {
      const response = await axios.post(`${PYTHON_SERVICE_URL}/convertir_pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
        timeout: 60000 // 60 segundos para conversión
      });

      clearInterval(progressInterval)
      const convertedPdfBlob = response.data;
      const url = URL.createObjectURL(convertedPdfBlob);

      const newConvertedDoc = {
        id: tempId,
        url: url,
        fecha: new Date().toLocaleString("es-MX"),
        nombre: file.name,
        tipo: 'convertido_local',
        size: file.size,
        originalFile: file
      };

      setConvertedPdfs(prev => [newConvertedDoc, ...prev])
      setProcessing(prev => 
        prev.map(p => p.id === tempId ? { ...p, progress: 100 } : p)
      )

      swalLoading.close();
      
      Swal.fire({
        icon: "success",
        title: "¡Conversión exitosa!",
        text: `${file.name} ha sido convertido exitosamente.`,
        showConfirmButton: true,
        confirmButtonText: "Ver PDF"
      });

      setTimeout(() => {
        setProcessing(prev => prev.filter(p => p.id !== tempId))
      }, 2000)

    } catch (error) {
      clearInterval(progressInterval)
      swalLoading.close();
      throw error;
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

  const viewConvertedPdf = (doc) => {
    setCurrentViewingDoc(doc)
    setShowAdvancedViewer(true)
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
                  <h5 className="mb-0">Subir & Convertir PDF</h5>
                  <small className="text-muted">Backend Storage + Conversión Local con IA</small>
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
                    className="btn btn-info w-100" 
                    disabled={selectedFiles.length === 0}
                    onClick={() => showUploadConfirmation(selectedFiles)}
                  >
                    <i className="bi bi-magic me-2"></i>
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
              {/* PDFs Convertidos Localmente */}
              <div className="col-12">
                <div className="card p-3" style={{ borderLeft: "4px solid #e83e8c" }}>
                  <div className="d-flex align-items-center">
                    <div style={{ fontSize: "1.8rem", color: "#e83e8c", marginRight: "15px" }}>
                      <i className="bi bi-magic"></i>
                    </div>
                    <div>
                      <small className="text-muted d-block">CONVERTIDOS LOCAL</small>
                      <h4 className="mb-0">{convertedPdfs.length}</h4>
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

        {/* Section 3: Documentos del Backend */}
        <div className="card mb-4">
          <div className="card-header" style={{ background: "linear-gradient(90deg, #17a2b8 0%, #20c997 100%)", color: "white" }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-cloud-check" style={{ fontSize: "1.5rem" }}></i>
              <div>
                <h6 className="mb-0">Documentos del Backend ({documents.length})</h6>
                <small>Almacenados en el servidor</small>
              </div>
            </div>
          </div>
          <div className="card-body">
            {documents.length === 0 ? (
              <div className="text-center py-4">
                <div style={{ fontSize: "2.5rem", color: "#ccc", marginBottom: "15px" }}>
                  <i className="bi bi-cloud"></i>
                </div>
                <p className="text-muted mb-1">No hay documentos en el backend</p>
                <small className="text-muted">Los archivos se mostrarán aquí después de subirlos</small>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Estado</th>
                      <th>Empresa</th>
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
                        <td>{doc.company}</td>
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

        {/* Section 4: PDFs Convertidos Localmente */}
        {convertedPdfs.length > 0 && (
          <div className="card">
            <div className="card-header" style={{ background: "linear-gradient(90deg, #6f42c1 0%, #e83e8c 100%)", color: "white" }}>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-magic" style={{ fontSize: "1.5rem" }}></i>
                <div>
                  <h6 className="mb-0">PDFs Convertidos Localmente ({convertedPdfs.length})</h6>
                  <small>Procesados con IA local</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-3">
                {convertedPdfs.map(doc => (
                  <div key={doc.id} className="col-md-6 col-lg-4">
                    <div className="card h-100 border-0 shadow-sm">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex align-items-center mb-3">
                          <div className="bg-gradient p-2 rounded me-3" style={{background: 'linear-gradient(45deg, #6f42c1, #e83e8c)'}}>
                            <i className="bi bi-file-pdf text-white" style={{fontSize: '1.5rem'}}></i>
                          </div>
                          <div className="flex-grow-1">
                            <h6 className="card-title mb-1 text-truncate">{doc.nombre}</h6>
                            <small className="text-muted">{doc.fecha}</small>
                          </div>
                        </div>
                        
                        <div className="mt-auto">
                          <div className="d-flex gap-2">
                            <button 
                              className="btn btn-primary btn-sm flex-fill"
                              onClick={() => viewConvertedPdf(doc)}
                            >
                              <i className="bi bi-eye me-1"></i>Ver
                            </button>
                            <button 
                              className="btn btn-success btn-sm flex-fill"
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = doc.url
                                link.download = doc.nombre
                                link.click()
                              }}
                            >
                              <i className="bi bi-download me-1"></i>Descargar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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

      {/* Modal PDF Viewer Avanzado - Converted Documents */}
      {showAdvancedViewer && currentViewingDoc && (
        <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.8)'}} onClick={() => setShowAdvancedViewer(false)}>
          <div className="modal-dialog modal-fullscreen" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title">
                  <i className="bi bi-magic text-warning me-2"></i>
                  {currentViewingDoc.nombre} - Convertido con IA
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAdvancedViewer(false)}></button>
              </div>
              <div className="modal-body p-0">
                <iframe
                  src={currentViewingDoc.url}
                  style={{width: '100%', height: '90vh', border: 'none'}}
                  title="PDF Convertido"
                />
              </div>
              <div className="modal-footer bg-dark">
                <button className="btn btn-secondary" onClick={() => setShowAdvancedViewer(false)}>
                  Cerrar
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = currentViewingDoc.url
                    link.download = currentViewingDoc.nombre
                    link.click()
                  }}
                >
                  <i className="bi bi-download me-1"></i>Descargar PDF Convertido
                </button>
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