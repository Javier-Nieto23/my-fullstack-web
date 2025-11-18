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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleRfcChange = (e) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Solo letras y números, convertir a mayúsculas
    
    // Aplicar formato RFC: 4 letras + 8 números
    let formattedValue = '';
    
    // Primeros 4 caracteres: solo letras
    for (let i = 0; i < Math.min(4, value.length); i++) {
      if (/[A-Z]/.test(value[i])) {
        formattedValue += value[i];
      }
    }
    
    // Siguientes 8 caracteres: solo números
    let numberPart = value.slice(4).replace(/[^0-9]/g, '');
    if (numberPart.length > 8) {
      numberPart = numberPart.slice(0, 8);
    }
    formattedValue += numberPart;
    
    // Limitar a 12 caracteres total
    if (formattedValue.length > 12) {
      formattedValue = formattedValue.slice(0, 12);
    }
    
    setFormData({
      ...formData,
      rfc: formattedValue,
    });
  };

  const validateRfc = (rfc) => {
    // Debe tener exactamente 12 caracteres
    if (rfc.length !== 12) return false;
    
    // Primeros 4 caracteres deben ser letras
    const letterPart = rfc.slice(0, 4);
    if (!/^[A-Z]{4}$/.test(letterPart)) return false;
    
    // Últimos 8 caracteres deben ser números
    const numberPart = rfc.slice(4);
    if (!/^[0-9]{8}$/.test(numberPart)) return false;
    
    return true;
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

    if (!validateRfc(formData.rfc)) {
      setAlertMsg({
        type: "danger",
        text: "El RFC debe tener exactamente 4 letras seguidas de 8 números (ej: ABCD12345678).",
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
        setAlertMsg({
          type: "danger",
          text: data.error || "Error al registrar usuario",
        });
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
        <img src="img/LOGONegro.png" alt="Logo" className="logo" />
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
                placeholder="ABCD12345678"
                value={formData.rfc}
                onChange={handleRfcChange}
                autoComplete="off"
                disabled={loading}
                maxLength="12"
              />
              <small className="form-text text-muted">
                4 letras seguidas de 8 números (ej: ABCD12345678)
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
