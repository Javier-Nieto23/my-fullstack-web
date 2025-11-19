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
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [viewingPdf, setViewingPdf] = useState(null)
  const [processing, setProcessing] = useState([])
  const [metrics, setMetrics] = useState({
    procesados: 0,
    enviados: 0,
    noCumplidos: 0,
    misEmpresas: 0
  })
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      // No token -> redirect to login
      navigate('/', { replace: true })
      return
    }

    // Validate token with backend /auth/me
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          // Invalid token
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/', { replace: true })
          return
        }
        // OK
        loadDocuments() // Cargar documentos después de validar
      } catch (err) {
        // network error -> treat as not authorized
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/', { replace: true })
        return
      } finally {
        setChecking(false)
      }
    })()
  }, [navigate])

  // Cargar documentos del usuario
  const loadDocuments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDocuments(response.data)
      updateMetrics(response.data)
    } catch (error) {
      console.error('Error loading documents:', error)
    }
  }

  // Actualizar métricas del dashboard
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

  // Manejo del drag & drop
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
      Swal.fire({
        title: 'Archivos seleccionados',
        text: `Se han seleccionado ${files.length} archivo(s) PDF`,
        icon: 'info',
        confirmButtonText: 'Procesar'
      }).then((result) => {
        if (result.isConfirmed) {
          uploadFiles(files)
        }
      })
    }
  }

  // Selección manual de archivos
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf')
    setSelectedFiles(files)
    if (files.length > 0) {
      uploadFiles(files)
    }
  }

  // Validar archivo antes de subir
  const validateFile = (file) => {
    if (file.type !== 'application/pdf') {
      return { valid: false, error: 'Solo se permiten archivos PDF' }
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      return { valid: false, error: 'Archivo demasiado grande (máx. 5MB)' }
    }
    return { valid: true }
  }

  // Subir y procesar archivos
  const uploadFiles = async (files) => {
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

        // Simular progreso
        const progressInterval = setInterval(() => {
          setProcessing(prev => 
            prev.map(p => p.id === tempId ? { ...p, progress: Math.min(p.progress + 10, 90) } : p)
          )
        }, 200)

        try {
          const response = await axios.post(`${API_URL}/documents/upload`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          })

          clearInterval(progressInterval)
          setProcessing(prev => 
            prev.map(p => p.id === tempId ? { ...p, progress: 100 } : p)
          )

          // Simular documento procesado (ya que no tienes backend completo)
          const newDoc = {
            id: Date.now() + Math.random(),
            name: file.name,
            status: Math.random() > 0.7 ? 'non_compliant' : 'processed',
            company: 'Empresa Demo',
            uploadDate: new Date().toISOString(),
            size: file.size
          }
          
          setDocuments(prev => [...prev, newDoc])
          updateMetrics([...documents, newDoc])

          setTimeout(() => {
            setProcessing(prev => prev.filter(p => p.id !== tempId))
          }, 1000)

        } catch (error) {
          clearInterval(progressInterval)
          setProcessing(prev => prev.filter(p => p.id !== tempId))
          console.error('Upload error:', error)
          Swal.fire('Error', 'Error al procesar el archivo', 'error')
        }
      }

      Swal.fire({
        title: '¡Completado!',
        text: 'Archivos procesados exitosamente',
        icon: 'success',
        timer: 2000
      })

    } catch (error) {
      console.error('Error uploading files:', error)
      Swal.fire('Error', 'Error al subir archivos', 'error')
    } finally {
      setUploading(false)
      setSelectedFiles([])
    }
  }

  // Eliminar documento
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
        setDocuments(prev => prev.filter(doc => doc.id !== docId))
        updateMetrics(documents.filter(doc => doc.id !== docId))
        Swal.fire('Eliminado', 'Documento eliminado exitosamente', 'success')
      } catch (error) {
        Swal.fire('Error', 'Error al eliminar documento', 'error')
      }
    }
  }

  // Ver PDF
  const viewPdf = (doc) => {
    setViewingPdf(doc)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/', { replace: true })
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
              <h1 className="brand-title mb-0" style={{ color: "#0b2d50" }}>Centro de Cumplimiento Fiscal</h1>
            </div>
            <div className="col text-end" style={{ marginRight: "15px" }}>
              <button className="btn btn-Cerrar" onClick={handleLogout}>Cerrar Sesión</button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container-fluid py-4" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Section 1: Upload + Status Cards */}
        <div className="row mb-4">
          {/* Upload section */}
          <div className="col-md-6">
            <div className="card p-4 h-100">
              <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{ fontSize: "2.5rem", color: "#17a2b8" }}>
                  <i className="bi bi-cloud-arrow-up"></i>
                </div>
                <div>
                  <h5 className="mb-0">Subir PDF</h5>
                  <small className="text-muted">Procesamiento automático con IA</small>
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
                  <small className="text-muted">Tamaño máximo: 5MB por archivo</small>
                </div>
              </div>

              <input
                type="file"
                id="fileInput"
                multiple
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              <button 
                className="btn btn-primary mt-3 w-100" 
                disabled={uploading || selectedFiles.length === 0}
                onClick={() => document.getElementById('fileInput').click()}
              >
                {uploading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Procesando...
                  </>
                ) : (
                  'Seleccionar Documento(s)'
                )}
              </button>

              {/* Progreso de archivos */}
              {processing.length > 0 && (
                <div className="mt-3">
                  <small className="text-muted d-block mb-2">Procesando archivos:</small>
                  {processing.map(file => (
                    <div key={file.id} className="mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="text-truncate" style={{maxWidth: '200px'}}>{file.name}</small>
                        <small>{file.progress}%</small>
                      </div>
                      <div className="progress" style={{height: '4px'}}>
                        <div 
                          className="progress-bar" 
                          style={{width: `${file.progress}%`}}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status cards */}
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
              {/* Mis empresas */}
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

        {/* Section 2: Requirements box (kept intact) */}
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
                <strong>Tamaño máximo:</strong> 3 MB por archivo.
              </li>
              <li>
                <strong>Contenido:</strong> Sin formularios ni contraseñas.
              </li>
            </ul>
          </div>
        </div>

        {/* Section 3: Document Management */}
        <div className="card">
          <div className="card-header" style={{ background: "linear-gradient(90deg, #17a2b8 0%, #20c997 100%)", color: "white" }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-check2-circle" style={{ fontSize: "1.5rem" }}></i>
              <div>
                <h6 className="mb-0">Gestión de Documentos ({documents.length})</h6>
                <small>Verificación de cumplimiento y administración</small>
              </div>
            </div>
          </div>
          <div className="card-body">
            {documents.length === 0 ? (
              <div className="text-center py-5">
                <div style={{ fontSize: "3rem", color: "#ccc", marginBottom: "15px" }}>
                  <i className="bi bi-file-earmark"></i>
                </div>
                <p className="text-muted mb-1">No hay documentos</p>
                <small className="text-muted">Aún no has subido ningún documento</small>
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
                              className="btn btn-outline-secondary"
                              title="Descargar"
                            >
                              <i className="bi bi-download"></i>
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

        {/* PDF Viewer Modal */}
        {viewingPdf && (
          <div className="modal fade show" style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}} onClick={() => setViewingPdf(null)}>
            <div className="modal-dialog modal-xl" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-file-pdf text-danger me-2"></i>
                    {viewingPdf.name}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setViewingPdf(null)}></button>
                </div>
                <div className="modal-body p-0">
                  <div style={{height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa'}}>
                    <div className="text-center">
                      <i className="bi bi-file-pdf text-danger" style={{fontSize: '4rem'}}></i>
                      <h4 className="mt-3">Vista Previa del PDF</h4>
                      <p className="text-muted">Aquí se mostraría el contenido del PDF</p>
                      <small className="text-muted">
                        En una implementación completa, aquí se integraría un visor de PDF como PDF.js
                      </small>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setViewingPdf(null)}>Cerrar</button>
                  <button className="btn btn-primary">
                    <i className="bi bi-download me-1"></i>Descargar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="text-center py-3">
        © 2025 SEER Tráfico S.C. — Portal de Carga de Información
      </footer>
    </div>
  );
};

export default Verificacion;
