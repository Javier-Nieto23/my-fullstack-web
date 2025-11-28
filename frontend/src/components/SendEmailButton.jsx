import React, { useState } from "react";
import Swal from "sweetalert2";

/**
 * SendEmailButton
 * - Envía el PDF por correo al email del usuario autenticado
 * - Requiere: `doc` con { id, name }
 * - Opcional: `onSent(email)` callback al completar
 */
const SendEmailButton = ({ doc, onSent }) => {
  const [sending, setSending] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const handleSend = async () => {
    if (!doc?.id) return;

    const token = localStorage.getItem("token");
    if (!token) {
      Swal.fire({
        title: "Sesión expirada",
        text: "Por favor, inicia sesión nuevamente.",
        icon: "warning",
        confirmButtonText: "Ir a Login",
      }).then(() => {
        window.location.href = "/";
      });
      return;
    }

    try {
      setSending(true);

      // Obtener email del usuario autenticado (de localStorage o /auth/me)
      let email = localStorage.getItem("userEmail");
      if (!email) {
        const meRes = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) throw new Error("No se pudo obtener el usuario");
        const user = await meRes.json();
        email = user?.email;
        if (email) localStorage.setItem("userEmail", email);
      }

      if (!email) {
        // Fallback: pedir email si no está disponible
        const { value } = await Swal.fire({
          title: "Enviar documento por correo",
          html: `Se enviará: <strong>${doc.name}</strong>`,
          input: "email",
          inputLabel: "Correo electrónico",
          inputPlaceholder: "correo@ejemplo.com",
          showCancelButton: true,
          confirmButtonText: "Enviar",
          inputValidator: (value) => {
            if (!value) return "Por favor ingresa un correo";
          },
        });
        if (!value) return; // cancelado
        email = value;
      }

      Swal.fire({
        title: "Enviando correo...",
        html: `Enviando <strong>${doc.name}</strong> a <strong>${email}</strong>`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await fetch(`${API_URL}/api/documents/${doc.id}/send-email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      Swal.close();

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al enviar el correo");
      }

      if (typeof onSent === "function") {
        onSent(email);
      } else {
        Swal.fire({
          title: "¡Correo enviado!",
          html: `
            <p><i class="bi bi-envelope-check text-success" style="font-size: 3rem;"></i></p>
            <p>El documento ha sido enviado a:</p>
            <p><strong>${email}</strong></p>
          `,
          icon: "success",
          timer: 2500,
          timerProgressBar: true,
        });
      }
    } catch (err) {
      console.error("Error enviando correo:", err);
      Swal.close();
      Swal.fire("Error", err.message || "No se pudo enviar el correo.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      className="btn btn-outline-success"
      onClick={handleSend}
      title="Enviar por correo"
      disabled={sending}
    >
      {sending ? (
        <>
          <span className="spinner-border spinner-border-sm me-1"></span>
          Enviando
        </>
      ) : (
        <i className="bi bi-envelope"></i>
      )}
    </button>
  );
};

export default SendEmailButton;
