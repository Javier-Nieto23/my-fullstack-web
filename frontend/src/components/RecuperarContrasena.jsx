import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../css/login.css";

const RecuperarContrasena = () => {
  const [rfc, setRfc] = useState("");
  const [email, setEmail] = useState("");
  const [alertMsg, setAlertMsg] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const handleStep1 = async (e) => {
    e.preventDefault();
    setAlertMsg(null);

    if (!rfc) {
      setAlertMsg({
        type: "danger",
        text: "Por favor, ingresa tu RFC.",
      });
      return;
    }

    setLoading(true);

    try {
      // Verificar RFC en la base de datos
      // Esta es una llamada de ejemplo - necesitarías implementar este endpoint
      setAlertMsg({
        type: "info",
        text: "RFC verificado. Ingresa tu email para continuar.",
      });
      setStep(2);
    } catch (error) {
      console.error("Error:", error);
      setAlertMsg({
        type: "danger",
        text: "Error al verificar RFC. Intenta nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setAlertMsg(null);

    if (!email) {
      setAlertMsg({
        type: "danger",
        text: "Por favor, ingresa tu email.",
      });
      return;
    }

    setLoading(true);

    try {
      // Aquí iría la llamada a un endpoint de reset de contraseña
      // Por ahora solo mostramos un mensaje
      setAlertMsg({
        type: "success",
        text: "Se ha enviado un enlace de recuperación a tu email. Por favor, revisa tu bandeja de entrada.",
      });

      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error) {
      console.error("Error:", error);
      setAlertMsg({
        type: "danger",
        text: "Error al enviar enlace de recuperación. Intenta nuevamente.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-header" style={{ textAlign: "center", marginBottom: 14 }}>
        <img src="/LOGONegro.png" alt="CAAST" className="logo" />
        <h1 className="welcome-title">Recuperar Contraseña</h1>
        <p className="welcome-subtitle">Restablece el acceso a tu cuenta</p>
      </div>

      <div className="login-card login-card--register">
        {/* Tabs */}
        <div className="login-tabs" role="tablist">
          <button className="tab-btn" type="button" onClick={() => navigate('/')}>Iniciar Sesión</button>
          <button className="tab-btn active" type="button">Recuperar</button>
        </div>

        {/* Paso 1 o Paso 2 */}
        {step === 1 ? (
          <>
            <form onSubmit={handleStep1} className="login-form">
              <div className="form-group">
                <label htmlFor="rfc" className="form-label">
                  RFC
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="rfc"
                  placeholder="Ingresa tu RFC"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value)}
                  autoComplete="off"
                  disabled={loading}
                />
              </div>

              {alertMsg && (
                <div
                  className={`alert alert-${alertMsg.type} mt-3`}
                  role="alert"
                >
                  {alertMsg.text}
                </div>
              )}

              <button type="submit" className="btn btn-create w-100" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Verificando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-right"></i> Continuar
                  </>
                )}
              </button>

              <button
                type="button"
                className="forgot-pwd-link"
                onClick={() => navigate("/")}
                disabled={loading}
              >
                ← Volver a Inicio de Sesión
              </button>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handleStep2} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              {alertMsg && (
                <div
                  className={`alert alert-${alertMsg.type} mt-3`}
                  role="alert"
                >
                  {alertMsg.text}
                </div>
              )}

              <button type="submit" className="btn btn-create w-100" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Enviando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-envelope-check"></i> Enviar Enlace
                  </>
                )}
              </button>

              <button
                type="button"
                className="forgot-pwd-link"
                onClick={() => {
                  setStep(1);
                  setRfc("");
                  setEmail("");
                  setAlertMsg(null);
                }}
                disabled={loading}
              >
                ← Volver al paso anterior
              </button>
            </form>
          </>
        )}

      </div>

      <div className="login-footer mt-3 text-center">
        <h3 className="features-heading">Características Incluidas</h3>
        <div className="features-list mt-2">
          <div className="feature-item">
            <div className="feature-icon feature-icon--orange">
              <i className="bi bi-shield-check"></i>
            </div>
            <div className="feature-label">Seguro</div>
          </div>

          <div className="feature-item">
            <div className="feature-icon feature-icon--pink">
              <i className="bi bi-clock-history"></i>
            </div>
            <div className="feature-label">Rápido</div>
          </div>

          <div className="feature-item">
            <div className="feature-icon feature-icon--green">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="feature-label">Verificado</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecuperarContrasena;
