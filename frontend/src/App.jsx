import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Verificacion from "./components/Verificacion";
import RecuperarContrasena from "./components/RecuperarContrasena";
import Registro from "./components/Registro";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/verificacion"
          element={
            <PrivateRoute>
              <Verificacion />
            </PrivateRoute>
          }
        />
        <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
        <Route path="/registro" element={<Registro />} />
      </Routes>
    </Router>
  );
}

export default App;

