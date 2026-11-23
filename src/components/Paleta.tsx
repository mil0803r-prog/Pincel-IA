import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Globe, Images, LayoutDashboard, Moon, PanelsTopLeft, Plug, Plus, Puzzle, Search, Sun } from "lucide-react";
import { api, type CampanaResumen } from "../api";

type Accion = { id: string; grupo: string; texto: string; icono: React.ReactNode; hacer: () => void; extra?: string };

/** Buscador de comandos (⌘K / Ctrl+K): navegar, crear y abrir campañas desde el teclado. */
export default function Paleta({
  onCerrar,
  onNueva,
  tema,
  onTema,
}: {
  onCerrar: () => void;
  onNueva: () => void;
  tema: "light" | "dark";
  onTema: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
  const nav = useNavigate();
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.campanas().then(setCampanas).catch(() => {});
  }, []);

  const ir = (ruta: string) => () => { nav(ruta); onCerrar(); };
  const acciones: Accion[] = useMemo(() => {
    const base: Accion[] = [
      { id: "nueva", grupo: "Acciones", texto: "Nueva campaña", icono: <Plus size={15} />, hacer: () => { onCerrar(); onNueva(); } },
      { id: "tema", grupo: "Acciones", texto: tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro", icono: tema === "dark" ? <Sun size={15} /> : <Moon size={15} />, hacer: () => { onTema(); onCerrar(); } },
      { id: "inicio", grupo: "Ir a", texto: "Inicio", icono: <LayoutDashboard size={15} />, hacer: ir("/") },
      { id: "campanas", grupo: "Ir a", texto: "Campañas", icono: <FolderKanban size={15} />, hacer: ir("/campanas") },
      { id: "biblioteca", grupo: "Ir a", texto: "Biblioteca", icono: <Images size={15} />, hacer: ir("/biblioteca") },
      { id: "landing", grupo: "Ir a", texto: "Landing", icono: <PanelsTopLeft size={15} />, hacer: ir("/landing") },
      { id: "mercado", grupo: "Ir a", texto: "Mercado", icono: <Globe size={15} />, hacer: ir("/mercado") },
      { id: "habilidades", grupo: "Ir a", texto: "Habilidades", icono: <Puzzle size={15} />, hacer: ir("/habilidades") },
      { id: "conexiones", grupo: "Ir a", texto: "Conexiones", icono: <Plug size={15} />, hacer: ir("/conexiones") },
    ];
    const camps: Accion[] = campanas.map((c) => ({
      id: c.id,
      grupo: "Campañas",
      texto: c.nombre,
      extra: `${c.hechas}/${c.total}`,
      icono: c.miniaturas[0] ? <img src={c.miniaturas[0]} alt="" /> : <FolderKanban size={15} />,
      hacer: ir(`/campanas/${c.id}`),
    }));
    const t = q.trim().toLowerCase();
    return [...base, ...camps].filter((a) => !t || a.texto.toLowerCase().includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, campanas, tema]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    lista.current?.querySelector(".palette-item.on")?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, acciones.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); acciones[sel]?.hacer(); }
    if (e.key === "Escape") onCerrar();
  }

  let grupo = "";
  return (
    <div className="modal-back palette-back" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal palette" role="dialog" aria-modal="true" aria-label="Buscador">
        <div className="palette-input">
          <Search size={18} />
          <input autoFocus placeholder="Busca una campaña o escribe un comando…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={teclas} aria-label="Buscar" />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list" ref={lista}>
          {acciones.length === 0 && <p className="muted small" style={{ padding: 16 }}>Sin resultados para “{q}”.</p>}
          {acciones.map((a, i) => {
            const cabecera = a.grupo !== grupo ? <div className="palette-group">{a.grupo}</div> : null;
            grupo = a.grupo;
            return (
              <div key={a.id}>
                {cabecera}
                <button className={`palette-item ${i === sel ? "on" : ""}`} onMouseEnter={() => setSel(i)} onClick={a.hacer}>
                  <span className="pi">{a.icono}</span>
                  <span className="grow ellipsis">{a.texto}</span>
                  {a.extra && <span className="subtle small">{a.extra}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span><span className="kbd">↑↓</span>moverse</span>
          <span><span className="kbd">↵</span>abrir</span>
          <span><span className="kbd">esc</span>cerrar</span>
        </div>
      </div>
    </div>
  );
}
