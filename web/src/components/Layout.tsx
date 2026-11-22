import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FolderKanban,
  Images,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Plug,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./ui";

/**
 * Módulos de la app. Para añadir una sección nueva: crea la página en /pages,
 * añádela aquí y registra su ruta en App.tsx.
 */
type Modulo = { ruta: string; nombre: string; icono: LucideIcon; pronto?: boolean };
const GRUPOS: { titulo: string; modulos: Modulo[] }[] = [
  {
    titulo: "Estudio",
    modulos: [
      { ruta: "/", nombre: "Inicio", icono: LayoutDashboard },
      { ruta: "/campanas", nombre: "Campañas", icono: FolderKanban },
      { ruta: "/biblioteca", nombre: "Biblioteca", icono: Images },
    ],
  },
  {
    titulo: "Integraciones",
    modulos: [{ ruta: "/conexiones", nombre: "Conexiones", icono: Plug }],
  },
];

type Tema = "light" | "dark";
function temaInicial(): Tema {
  try {
    const t = localStorage.getItem("pincel-tema");
    if (t === "light" || t === "dark") return t;
  } catch { /* sin almacenamiento */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Layout({ onSalir }: { onSalir: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState<Tema>(temaInicial);
  const loc = useLocation();

  useEffect(() => setAbierto(false), [loc.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem("pincel-tema", tema); } catch { /* sin almacenamiento */ }
  }, [tema]);

  return (
    <div className="shell">
      <div className={`scrim ${abierto ? "open" : ""}`} onClick={() => setAbierto(false)} />
      <aside className={`sidebar ${abierto ? "open" : ""}`}>
        <div className="brand">
          <Logo size={34} />
          <div className="stack">
            <span className="brand-name">Pincel IA</span>
            <span className="brand-tag">Estudio de imágenes</span>
          </div>
        </div>
        <nav>
          {GRUPOS.map((g) => (
            <div className="nav-group" key={g.titulo}>
              <div className="nav-label">{g.titulo}</div>
              {g.modulos.map((m) => (
                <Item key={m.ruta} {...m} />
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="nav-item nav-btn" onClick={() => setTema(tema === "dark" ? "light" : "dark")}>
            {tema === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {tema === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
          <button className="nav-item nav-btn" onClick={onSalir}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <MenuIcon size={20} />
          </button>
          <Logo size={26} />
          <span className="brand-name">Pincel IA</span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Item({ ruta, nombre, icono: Icono, pronto }: Modulo): ReactNode {
  return (
    <NavLink to={ruta} end={ruta === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
      <Icono size={18} />
      {nombre}
      {pronto && <span className="soon">Pronto</span>}
    </NavLink>
  );
}
