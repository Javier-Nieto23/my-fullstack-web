import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Verificacion from "./components/Verificacion";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/verificacion" element={<Verificacion />} />
      </Routes>
    </Router>
  );
}

export default App;

