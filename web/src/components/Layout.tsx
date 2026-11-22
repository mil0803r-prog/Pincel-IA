import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { FolderKanban, Images, LayoutDashboard, LogOut, Menu as MenuIcon, Moon, Plug, Search, Sun, type LucideIcon } from "lucide-react";
import { Logo } from "./ui";
import Paleta from "./Paleta";
import NuevaCampana from "./NuevaCampana";

/**
 * Módulos de la app. Para añadir una sección nueva: crea la página en /pages,
 * añádela aquí y registra su ruta en App.tsx.
 */
type Modulo = { ruta: string; nombre: string; icono: LucideIcon };
const GRUPOS: { titulo: string; modulos: Modulo[] }[] = [
  {
    titulo: "Estudio",
    modulos: [
      { ruta: "/", nombre: "Inicio", icono: LayoutDashboard },
      { ruta: "/campanas", nombre: "Campañas", icono: FolderKanban },
      { ruta: "/biblioteca", nombre: "Biblioteca", icono: Images },
    ],
  },
  { titulo: "Integraciones", modulos: [{ ruta: "/conexiones", nombre: "Conexiones", icono: Plug }] },
];

type Tema = "light" | "dark";
function temaInicial(): Tema {
  try {
    const t = localStorage.getItem("pincel-tema");
    if (t === "light" || t === "dark") return t;
  } catch { /* sin almacenamiento */ }
  return "dark";
}

/** Acciones globales disponibles para cualquier página. */
const AppCtx = createContext<{ nuevaCampana: () => void }>({ nuevaCampana: () => {} });
export const useApp = () => useContext(AppCtx);

export function Fondo() {
  return (
    <>
      <div className="aurora" aria-hidden><i /><i /><i /></div>
      <div className="grain" aria-hidden />
    </>
  );
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("pincel-tema", t); } catch { /* sin almacenamiento */ }
}

export default function Layout({ onSalir }: { onSalir: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [tema, setTema] = useState<Tema>(temaInicial);
  const loc = useLocation();
  const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => setAbierto(false), [loc.pathname]);
  useEffect(() => aplicarTema(tema), [tema]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta((p) => !p);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const cambiarTema = useCallback(() => setTema((t) => (t === "dark" ? "light" : "dark")), []);
  const nuevaCampana = useCallback(() => setNueva(true), []);

  return (
    <AppCtx.Provider value={{ nuevaCampana }}>
      <Fondo />
      <div className="shell">
        <div className={`scrim ${abierto ? "open" : ""}`} onClick={() => setAbierto(false)} />
        <aside className={`sidebar ${abierto ? "open" : ""}`}>
          <div className="brand">
            <Logo size={36} />
            <div className="stack">
              <span className="brand-name">Pincel <em>IA</em></span>
              <span className="brand-tag">Estudio creativo</span>
            </div>
          </div>
          <button className="searchbtn" onClick={() => setPaleta(true)}>
            <Search size={15} />
            <span>Buscar…</span>
            <span className="kbd">{esMac ? "⌘" : "Ctrl"} K</span>
          </button>
          <nav>
            {GRUPOS.map((g) => (
              <div key={g.titulo}>
                <div className="nav-label">{g.titulo}</div>
                <div className="stack gap-4">
                  {g.modulos.map((m) => (
                    <NavLink key={m.ruta} to={m.ruta} end={m.ruta === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                      <m.icono size={17} />
                      {m.nombre}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="promo">
              <b>Crea con <em>ChatGPT</em></b>
              <span className="muted small">Tus prompts de Claude, convertidos en imágenes listas para vender.</span>
            </div>
            <div className="me">
              <span className="avatar">P</span>
              <div className="stack grow">
                <span className="small" style={{ fontWeight: 600 }}>Mi estudio</span>
                <span className="subtle" style={{ fontSize: 11.5 }}>Administrador</span>
              </div>
              <button className="icon-btn" onClick={cambiarTema} aria-label={tema === "dark" ? "Modo claro" : "Modo oscuro"} title={tema === "dark" ? "Modo claro" : "Modo oscuro"}>
                {tema === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button className="icon-btn" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <button className="icon-btn" onClick={() => setAbierto(true)} aria-label="Abrir menú">
              <MenuIcon size={20} />
            </button>
            <Logo size={26} />
            <span className="brand-name grow">Pincel <em>IA</em></span>
            <button className="icon-btn" onClick={() => setPaleta(true)} aria-label="Buscar">
              <Search size={18} />
            </button>
          </header>
          <main className="content">
            <div className="page" key={loc.pathname}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      {paleta && <Paleta onCerrar={() => setPaleta(false)} onNueva={nuevaCampana} tema={tema} onTema={cambiarTema} />}
      {nueva && <NuevaCampana onCerrar={() => setNueva(false)} />}
    </AppCtx.Provider>
  );
}
