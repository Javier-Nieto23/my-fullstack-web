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

  if (checking) return null // or a spinner
  if (!allowed) return <Navigate to="/" replace />
  return children
}

export default PrivateRoute
