import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

// PrivateRoute: checks for token in localStorage. If present, allow access, otherwise redirect to '/'
const PrivateRoute = ({ children }) => {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setAllowed(false)
      setChecking(false)
      return
    }

    // Optionally, you could validate token by calling /auth/me here.
    // For a quick client-side guard we'll accept presence of token.
    setAllowed(true)
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '2rem', height: '2rem' }}>
            <span className="visually-hidden">Verificando...</span>
          </div>
          <div className="mt-2">
            <small className="text-muted">Verificando acceso...</small>
          </div>
        </div>
      </div>
    )
  }
  if (!allowed) return <Navigate to="/" replace />
  return children
}

export default PrivateRoute
