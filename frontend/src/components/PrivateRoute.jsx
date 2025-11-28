import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// PrivateRoute: valida sesión y luego renderiza children
const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/", { replace: true });
          return;
        }
        // Guardar datos mínimos de usuario para consumo del frontend
        try {
          const user = await res.json();
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("userEmail", user?.email || "");
        } catch {}
        setValid(true);
      } catch (err) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/", { replace: true });
      } finally {
        setChecking(false);
      }
    })();
  }, [API_URL, navigate]);

  if (checking) return null;
  if (!valid) return null;
  return children;
};

export default PrivateRoute;
