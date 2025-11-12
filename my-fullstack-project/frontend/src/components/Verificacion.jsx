import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../css/pag_verificacion.css";
import Swal from "sweetalert2";

const Verificacion = () => {
  const [files, setFiles] = useState([]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleClear = () => {
    setFiles([]);
    document.getElementById("pdfFiles").value = "";
  };

  const handleReject = () => {
    const validFiles = files.filter((f) => f.size < 3 * 1024 * 1024); // menos de 3MB
    Swal.fire({
      title: "Archivos no válidos eliminados",
      text: `Se eliminaron ${files.length - validFiles.length} archivo(s) que excedían el límite.`,
      icon: "info",
    });
    setFiles(validFiles);
  };

  const handleUpload = () => {
    Swal.fire({
      title: "Subiendo archivos...",
      text: "Esto puede tardar unos segundos.",
      icon: "info",
      timer: 2000,
      showConfirmButton: false,
    });
  };

  return (
    <div>
      {/* Barra superior */}
      <div className="brandbar">
        <div className="container-fluid py-2">
          <div className="row align-items-center">
            <div className="col-auto d-flex align-items-center gap-2" style={{ marginLeft: "15px" }}>
              <img className="navbar-brand" src="/img/LOGONegro.png" alt="SEER Tráfico S.C." style={{ height: "46px" }} />
              <h1 className="brand-title mb-0">CAAST</h1>
            </div>
            <div className="col text-center">
              <h1 className="mb-0">Portal de Carga de Información</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="wrap">
        <div className="card p-4">
          <h2>Verificación de Documentos</h2>
          <p>
            Antes de cargar los archivos, asegúrate de que cumplan con los
            requerimientos oficiales de VUCEM para evitar rechazos o errores durante
            la validación.
          </p>

          <ul className="reqs">
            <li><strong>Tipo de archivo:</strong> Solo PDF.</li>
            <li><strong>Formato:</strong> Escala de grises a 8 bits.</li>
            <li><strong>Resolución:</strong> 300 DPI.</li>
            <li><strong>Tamaño máximo:</strong> 3 MB por archivo.</li>
            <li><strong>Contenido:</strong> Sin formularios ni contraseñas.</li>
          </ul>

          {/* Subida de archivos */}
          <form id="pdfUploadForm" className="mb-4">
            <label htmlFor="pdfFiles" className="form-label">
              Selecciona uno o más archivos PDF:
            </label>
            <input
              className="form-control"
              type="file"
              id="pdfFiles"
              accept="application/pdf"
              multiple
              onChange={handleFileChange}
            />
          </form>

          <div className="actions d-flex gap-2 mb-3">
            <button className="btn btn-success" onClick={handleClear}>
              Limpiar lista
            </button>
            <button className="btn btn-danger" onClick={handleReject}>
              Eliminar no válidos
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={files.length === 0}
            >
              Seguir / Cargar
            </button>
          </div>

          {/* Tabla de archivos */}
          <table className="table table-bordered table-striped align-middle">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Tamaño</th>
                <th>Revisión técnica</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => (
                <tr key={i}>
                  <td>{file.name}</td>
                  <td>{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                  <td>
                    {file.size > 3 * 1024 * 1024 ? (
                      <span className="badge bg-danger">Inválido</span>
                    ) : (
                      <span className="badge bg-success">Válido</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center text-muted">
                    No hay archivos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="text-center py-3">
        © 2025 SEER Tráfico S.C. — Portal de Carga de Información
      </footer>
    </div>
  );
};

export default Verificacion;
