import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../css/login.css";

const Registro = () => {
  const [formData, setFormData] = useState({
    rfc: "",
    nombre: "",
    email: "",
    pwd: "",
    confirmPwd: "",
  });
  const [alertMsg, setAlertMsg] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Función para validar formato del RFC
  const validateRFC = (rfc) => {
    // Debe tener exactamente 12 caracteres
    if (rfc.length !== 12) {
      return {
        valid: false,
        message: "El RFC debe tener exactamente 12 caracteres (4 letras + 8 números)."
      };
    }
    
    // Verificar que los primeros 4 caracteres sean letras
    const letters = rfc.substring(0, 4);
    if (!/^[A-Z]{4}$/.test(letters)) {
      return {
        valid: false,
        message: "Los primeros 4 caracteres del RFC deben ser letras."
      };
    }
    
    // Verificar que los siguientes 8 caracteres sean números
    const numbers = rfc.substring(4);
    if (!/^[0-9]{8}$/.test(numbers)) {
      return {
        valid: false,
        message: "Los últimos 8 caracteres del RFC deben ser números."
      };
    }
    
    return { valid: true, message: "" };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Validación especial para RFC
    if (name === "rfc") {
      // Convertir a mayúsculas y filtrar solo letras y números
      let rfcValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      
      // Limitar a 12 caracteres máximo
      if (rfcValue.length > 12) {
        rfcValue = rfcValue.substring(0, 12);
      }
      
      // Validar formato: primeras 4 posiciones solo letras, siguientes 8 solo números
      let formattedRfc = "";
      for (let i = 0; i < rfcValue.length; i++) {
        const char = rfcValue[i];
        if (i < 4) {
          // Primeras 4 posiciones: solo letras
          if (/[A-Z]/.test(char)) {
            formattedRfc += char;
          }
        } else {
          // Siguientes 8 posiciones: solo números
          if (/[0-9]/.test(char)) {
            formattedRfc += char;
          }
        }
      }
      
      setFormData({
        ...formData,
        [name]: formattedRfc,
      });
      return;
    }
    
    // Para otros campos, comportamiento normal
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlertMsg(null);

    if (!formData.rfc || !formData.nombre || !formData.email || !formData.pwd || !formData.confirmPwd) {
      setAlertMsg({
        type: "danger",
        text: "Por favor, completa todos los campos requeridos.",
      });
      return;
    }

    if (formData.rfc.length < 12) {
      setAlertMsg({
        type: "danger",
        text: "El RFC debe tener al menos 12 caracteres.",
      });
      return;
    }

    // Validar formato específico del RFC
    const rfcValidation = validateRFC(formData.rfc);
    if (!rfcValidation.valid) {
      setAlertMsg({
        type: "danger",
        text: rfcValidation.message,
      });
      return;
    }

    if (!formData.email.includes("@")) {
      setAlertMsg({
        type: "danger",
        text: "Por favor, ingresa un email válido.",
      });
      return;
    }

    if (formData.pwd.length < 8) {
      setAlertMsg({
        type: "danger",
        text: "La contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }

    if (formData.pwd !== formData.confirmPwd) {
      setAlertMsg({
        type: "danger",
        text: "Las contraseñas no coinciden.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          rfc: formData.rfc,
          nombre: formData.nombre,
          password: formData.pwd,
          passwordConfirm: formData.confirmPwd,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Detectar error de rate limiting (429)
        if (response.status === 429) {
          setAlertMsg({
            type: "danger",
            text: data.error || "Demasiados intentos. Espera unos minutos antes de intentar de nuevo.",
          });
        } else {
          setAlertMsg({
            type: "danger",
            text: data.error || "Error al registrar usuario",
          });
        }
        setLoading(false);
        return;
      }

      // Guardar token en localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setAlertMsg({
        type: "success",
        text: "¡Registro completado exitosamente! Redirigiendo...",
      });

      setTimeout(() => {
        navigate("/verificacion");
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      setAlertMsg({
        type: "danger",
        text: "Error de conexión. Intenta nuevamente.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-header" style={{ textAlign: "center", marginBottom: 14 }}>
        <img src="/LOGONegro.png" alt="Logo" className="logo" />
        <h2 className="welcome-title">Únete a nosotros</h2>
        <p className="welcome-subtitle">Crea tu cuenta y comienza a procesar documentos</p>
      </div>

      <div className="login-card login-card--register">
        {/* Tabs */}
        <div className="login-tabs" role="tablist">
          <button className="tab-btn" type="button" onClick={() => navigate("/")}>Iniciar Sesión</button>
          <button className="tab-btn active" type="button">Registrarse</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="row gx-2">
            <div className="col-6">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="col-6">
              <label className="form-label">RFC</label>
              <input
                type="text"
                name="rfc"
                className="form-control"
                placeholder="AAAA12345678"
                value={formData.rfc}
                onChange={handleChange}
                autoComplete="off"
                disabled={loading}
                maxLength="12"
              />
              <small className="form-text text-muted">
                
                {formData.rfc && (
                  <span className={`ms-2 badge ${formData.rfc.length === 12 ? 'bg-success' : 'bg-secondary'}`}>
                    {formData.rfc.length}/12
                  </span>
                )}
              </small>
            </div>
          </div>

          <div className="mt-3">
            <label className="form-label">Nombre Completo</label>
            <input
              type="text"
              name="nombre"
              className="form-control"
              placeholder="Tu nombre completo"
              value={formData.nombre}
              onChange={handleChange}
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div className="row gx-2 mt-3">
            <div className="col-6">
              <label className="form-label">Contraseña</label>
              <div className="pwd-wrapper">
                <input
                  type={showPwd ? "text" : "password"}
                  name="pwd"
                  className="form-control"
                  placeholder="••••••••"
                  value={formData.pwd}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-pwd"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex="-1"
                  disabled={loading}
                >
                  <i className={`bi ${showPwd ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>
            <div className="col-6">
              <label className="form-label">Confirmar contraseña</label>
              <div className="pwd-wrapper">
                <input
                  type={showConfirmPwd ? "text" : "password"}
                  name="confirmPwd"
                  className="form-control"
                  placeholder="••••••••"
                  value={formData.confirmPwd}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-pwd"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  tabIndex="-1"
                  disabled={loading}
                >
                  <i className={`bi ${showConfirmPwd ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>
          </div>

          {alertMsg && (
            <div className={`alert alert-${alertMsg.type} mt-3`} role="alert">
              {alertMsg.text}
            </div>
          )}

          <div className="mt-4">
            <button type="submit" className="btn btn-create w-100" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Registrando...
                </>
              ) : (
                <>
                  <i className="bi bi-sparkles"></i> Crear Cuenta
                </>
              )}
            </button>
          </div>

          <div className="mt-3">
            <button type="button" className="btn btn-outline-pink w-100" disabled={loading}>Registrar Empresa</button>
          </div>

        </form>
      </div>

      <div className="login-footer mt-3 text-center">
        <h3 className="features-heading">Características Incluidas</h3>
        <div className="features-list mt-2">
          <div className="feature-item">
            <div className="feature-icon feature-icon--pink">
              <i className="bi bi-lightning-fill"></i>
            </div>
            <div className="feature-label">Procesamiento IA</div>
          </div>

          <div className="feature-item">
            <div className="feature-icon feature-icon--orange">
              <i className="bi bi-shield-lock"></i>
            </div>
            <div className="feature-label">Cumplimiento Fiscal</div>
          </div>

          <div className="feature-item">
            <div className="feature-icon feature-icon--green">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="feature-label">Verificación Automática</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registro;
