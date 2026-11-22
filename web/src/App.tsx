import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, DEMO } from "./api";

const Router = DEMO ? MemoryRouter : BrowserRouter;
import Layout from "./components/Layout";
import { ToastProvider } from "./components/ui";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import Campanas from "./pages/Campanas";
import Campana from "./pages/Campana";
import Biblioteca from "./pages/Biblioteca";
import Conexiones from "./pages/Conexiones";

export default function App() {
  const [sesion, setSesion] = useState<boolean | null>(null);

  useEffect(() => {
    api.sesion().then((s) => setSesion(s.autenticado)).catch(() => setSesion(false));
    const salir = () => setSesion(false);
    window.addEventListener("pincel:salir", salir);
    return () => window.removeEventListener("pincel:salir", salir);
  }, []);

  const cerrar = useCallback(async () => {
    await api.logout().catch(() => {});
    setSesion(false);
  }, []);

  if (sesion === null) {
    return (
      <div className="loading">
        <Loader2 className="spin" size={26} />
      </div>
    );
  }

  return (
    <ToastProvider>
      {!sesion ? (
        <Login onEntrar={() => setSesion(true)} />
      ) : (
        <Router>
          <Routes>
            <Route element={<Layout onSalir={cerrar} />}>
              <Route index element={<Inicio />} />
              <Route path="campanas" element={<Campanas />} />
              <Route path="campanas/:id" element={<Campana />} />
              <Route path="biblioteca" element={<Biblioteca />} />
              <Route path="conexiones" element={<Conexiones />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Router>
      )}
    </ToastProvider>
  );
}
