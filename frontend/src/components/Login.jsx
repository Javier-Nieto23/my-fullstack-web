import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../css/login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [alertMsg, setAlertMsg] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const handleSubmit = async (e) => {
    e.preventDefault();

    setAlertMsg(null);

    if (!email || !pwd) {
      setAlertMsg({
        type: "danger",
        text: "Por favor, complete todos los campos.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: pwd,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAlertMsg({
          type: "danger",
          text: data.error || "Error al iniciar sesión",
        });
        setLoading(false);
        return;
      }

      // Guardar token en localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setAlertMsg({
        type: "success",
        text: "Inicio de sesión exitoso. Redirigiendo...",
      });

      setTimeout(() => {
        navigate("/verificacion");
      }, 1500);
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
        <img src="/LOGONegro.png" alt="CAAST" className="logo" />
        <h1 className="welcome-title">Bienvenido de vuelta</h1>
        <p className="welcome-subtitle">Accede a tu centro de cumplimiento fiscal</p>
      </div>

      <div className="login-card login-card--register">
        {/* Tabs de Iniciar Sesión / Registrarse */}
        <div className="login-tabs">
          <button className="tab-btn active" type="button">
            Iniciar Sesión
          </button>
          <button 
            className="tab-btn"
            type="button"
            onClick={() => navigate("/registro")}
          >
            Registrarse
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Correo electrónico
            </label>
            <input
              type="email"
              className="form-control"
              id="email"
              placeholder="tu@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="pwd" className="form-label">
              Contraseña
            </label>
            <div className="pwd-wrapper">
              <input
                type={showPwd ? "text" : "password"}
                className="form-control"
                id="pwd"
                placeholder="••••••••"
                autoComplete="current-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
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

          {alertMsg && (
            <div className={`alert alert-${alertMsg.type} mt-3`} role="alert">
              {alertMsg.text}
            </div>
          )}

          <button type="submit" className="btn btn-create w-100" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Iniciando sesión...
              </>
            ) : (
              <>
                <i className="bi bi-lightning-charge"></i> Iniciar Sesión
              </>
            )}
          </button>

          <button
            type="button"
            className="forgot-pwd-link"
            onClick={() => navigate("/recuperar-contrasena")}
            disabled={loading}
          >
            ¿Olvidaste tu contraseña?
          </button>
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
              <i className="bi bi-shield-check"></i>
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

export default Login;
