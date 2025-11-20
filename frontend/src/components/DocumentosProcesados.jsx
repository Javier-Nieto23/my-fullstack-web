import { useState, useEffect } from 'react'
import axios from 'axios'

const DocumentosProcesados = () => {
  const [documentos, setDocumentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  useEffect(() => {
    cargarDocumentos()
  }, [])

  const cargarDocumentos = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      if (!token) {
        setError('No hay sesión activa')
        return
      }

      const response = await axios.get(`${API_BASE_URL}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      setDocumentos(response.data.documents)
      setError('')
    } catch (err) {
      console.error('Error cargando documentos:', err)
      setError('Error al cargar documentos')
    } finally {
      setLoading(false)
    }
  }

  const handleVisualizar = async (documentoId) => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      setError('No hay sesión activa')
      return
    }

    try {
      // Obtener la URL con autenticación
      const url = `${API_BASE_URL}/api/documents/${documentoId}/view?token=${token}`
      
      // Abrir en nueva ventana
      const newWindow = window.open('', '_blank')
      newWindow.location.href = url
      
    } catch (err) {
      console.error('Error al visualizar documento:', err)
      setError('Error al visualizar el documento')
    }
  }

  const handleDescargar = async (documentoId, originalName) => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      setError('No hay sesión activa')
      return
    }

    try {
      // Crear URL de descarga con autenticación
      const url = `${API_BASE_URL}/api/documents/${documentoId}/download?token=${token}`
      
      // Crear enlace temporal para descarga con nombre específico
      const link = document.createElement('a')
      link.href = url
      link.download = originalName || `documento_${documentoId}.pdf`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (err) {
      console.error('Error al descargar documento:', err)
      setError('Error al descargar el documento')
    }
  }

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatearTamaño = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="documentos-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando documentos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="documentos-container">
      <div className="documentos-header">
        <h2>📄 Documentos Procesados</h2>
        <button 
          className="btn-refresh"
          onClick={cargarDocumentos}
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {documentos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No hay documentos procesados</h3>
          <p>Los documentos que proceses aparecerán aquí</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="documentos-table">
            <thead>
              <tr>
                <th>📄 Nombre</th>
                <th>📊 Estado</th>
                <th>📏 Tamaño</th>
                <th>🏢 Empresa</th>
                <th>📅 Fecha</th>
                <th>⚡ Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => (
                <tr key={doc.id} className="documento-row">
                  <td className="nombre-column">
                    <div className="nombre-info">
                      <strong>{doc.name}</strong>
                      {doc.originalName !== doc.name && (
                        <small className="original-name">
                          Original: {doc.originalName}
                        </small>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${doc.status}`}>
                      {doc.status === 'processed' ? '✅ Procesado' : 
                       doc.status === 'pending' ? '⏳ Pendiente' : 
                       doc.status === 'error' ? '❌ Error' : doc.status}
                    </span>
                  </td>
                  <td className="size-column">
                    {formatearTamaño(doc.size)}
                  </td>
                  <td>{doc.company}</td>
                  <td className="fecha-column">
                    <div className="fecha-info">
                      <small>Subido: {formatearFecha(doc.uploadDate)}</small>
                      {doc.processedAt && (
                        <small>Procesado: {formatearFecha(doc.processedAt)}</small>
                      )}
                    </div>
                  </td>
                  <td className="acciones-column">
                    <div className="acciones-buttons">
                      <button
                        className="btn-action btn-view"
                        onClick={() => handleVisualizar(doc.id)}
                        title="Visualizar PDF"
                      >
                        👁️ Ver
                      </button>
                      <button
                        className="btn-action btn-download"
                        onClick={() => handleDescargar(doc.id, doc.originalName)}
                        title="Descargar PDF"
                      >
                        📥 Descargar
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
  )
}

export default DocumentosProcesados