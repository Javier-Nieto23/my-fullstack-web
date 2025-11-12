import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ Mover aquí
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../css/login.css";

const Login = () => {
  const [rfc, setRfc] = useState("");
  const [pwd, setPwd] = useState("");
  const [alertMsg, setAlertMsg] = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  const navigate = useNavigate(); // ✅ Se declara aquí, no dentro del setTimeout

  const handleSubmit = (e) => {
    e.preventDefault();

    setAlertMsg(null);

    if (!rfc || !pwd) {
      setAlertMsg({
        type: "danger",
        text: "Por favor, complete todos los campos.",
      });
      return;
    }

    if (rfc === "caast" && pwd === "123") {
      setAlertMsg({
        type: "success",
        text: "Inicio de sesión exitoso. Redirigiendo...",
      });

      setTimeout(() => {
        navigate("/verificacion"); // ✅ Redirección correcta
      }, 1500);
    } else if (rfc !== "caast" && pwd !== "123") {
      setAlertMsg({
        type: "danger",
        text: "RFC o contraseña incorrectos.",
      });
    } else if (rfc !== "caast") {
      setAlertMsg({
        type: "danger",
        text: "El RFC es incorrecto.",
      });
    } else if (pwd !== "123") {
      setAlertMsg({
        type: "danger",
        text: "La contraseña es incorrecta.",
      });
    }
  };

  return (
    <div className="login-container row g-0">
      {/* Lado izquierdo */}
      <div className="col-md-6 brand-side">
        <img src="img/LOGONegro.png" alt="SEER Tráfico S.C." />
        <h1 className="brand-title">CAAST</h1>
        <p className="brand-subtitle">Portal de Carga de Información</p>
      </div>

      {/* Lado derecho */}
      <div className="col-md-6 form-side">
        <h2>Inicio de sesión</h2>
        <p>
          Acceso de proveedor IMMEX al portal <strong>/CDE</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="rfc" className="form-label">
            RFC
          </label>
          <input
            type="text"
            className="form-control"
            id="rfc"
            placeholder="RFC"
            autoComplete="username"
            value={rfc}
            onChange={(e) => setRfc(e.target.value)}
          />

          <label htmlFor="pwd" className="form-label mt-3">
            Contraseña
          </label>
          <div className="pwd-wrapper mb-2">
            <input
              type={showPwd ? "text" : "password"}
              className="form-control"
              id="pwd"
              placeholder="••••••••"
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
            <button
              type="button"
              id="togglePwd"
              onClick={() => setShowPwd(!showPwd)}
              className="btn btn-link p-0"
              tabIndex="-1"
            >
              <i
                id="eyeIcon"
                className={`bi ${showPwd ? "bi-eye-slash" : "bi-eye"}`}
              ></i>
            </button>
          </div>

          {alertMsg && (
            <div className={`alert alert-${alertMsg.type} mt-3`} role="alert">
              {alertMsg.text}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-100 mt-3">
            Ingresar
          </button>
        </form>

        <div className="footer mt-4">
          Portal SEER Tráfico S.C. — versión demo
        </div>
      </div>
    </div>
  );
};

export default Login;
