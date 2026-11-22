import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, X } from "lucide-react";

/* ---------------- logo ---------------- */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="pincel-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#ff6a88" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#pincel-g)" />
      <path d="M40.5 13.5c2.4-2.4 6.3-2.4 8.7 0s2.4 6.3 0 8.7L33 38.4l-8.7-8.7 16.2-16.2z" fill="#fff" />
      <path d="M22.2 31.8l8.7 8.7c-1.3 6.6-6.4 10.5-15.4 10.5 1.6-2.3 1.5-4.6 1.4-6.6-.1-4.9 1.7-10.4 5.3-12.6z" fill="#fff" opacity=".85" />
    </svg>
  );
}

/* ---------------- toasts ---------------- */
type Toast = { id: number; texto: string; tipo: "ok" | "error" };
const ToastCtx = createContext<(texto: string, tipo?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([]);
  const mostrar = useCallback((texto: string, tipo: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setLista((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), tipo === "error" ? 4200 : 2200);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {lista.map((t) => (
          <div key={t.id} className={`toast ${t.tipo === "error" ? "error" : ""}`}>
            {t.tipo === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useCopiar() {
  const toast = useToast();
  return useCallback(
    async (texto: string, msg = "Copiado") => {
      try {
        await navigator.clipboard.writeText(texto);
        toast(msg);
      } catch {
        toast("No se pudo copiar", "error");
      }
    },
    [toast],
  );
}

/* ---------------- modal ---------------- */
export function Modal({
  titulo,
  descripcion,
  children,
  pie,
  onCerrar,
  ancho,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  pie?: ReactNode;
  onCerrar: () => void;
  ancho?: number;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={ancho ? { maxWidth: ancho } : undefined}>
        <div className="modal-head">
          <div className="stack gap-4">
            <h2>{titulo}</h2>
            {descripcion && <p className="muted small">{descripcion}</p>}
          </div>
          <button className="btn ghost icon sm" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {pie && <div className="modal-foot">{pie}</div>}
      </div>
    </div>
  );
}

export function Confirmar({
  titulo,
  texto,
  accion,
  onSi,
  onCerrar,
}: {
  titulo: string;
  texto: string;
  accion: string;
  onSi: () => Promise<void> | void;
  onCerrar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      ancho={440}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn danger"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              try { await onSi(); } finally { setOcupado(false); }
            }}
          >
            {accion}
          </button>
        </>
      }
    >
      <p className="muted">{texto}</p>
    </Modal>
  );
}

/* ---------------- menú desplegable ---------------- */
export function Menu({ boton, children }: { boton: (abrir: () => void) => ReactNode; children: (cerrar: () => void) => ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);
  return (
    <div className="menu-wrap" ref={ref}>
      {boton(() => setAbierto((a) => !a))}
      {abierto && <div className="menu" role="menu">{children(() => setAbierto(false))}</div>}
    </div>
  );
}

/* ---------------- piezas ---------------- */
export function Progreso({ hechas, total }: { hechas: number; total: number }) {
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono: ReactNode; titulo: string; texto: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <div className="empty-icon">{icono}</div>
      <h2>{titulo}</h2>
      <p className="muted">{texto}</p>
      {children && <div className="row wrap" style={{ justifyContent: "center", marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function Cabecera({ titulo, subtitulo, migas, children }: { titulo: ReactNode; subtitulo?: ReactNode; migas?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="titles">
        {migas && <div className="crumbs">{migas}</div>}
        <h1>{titulo}</h1>
        {subtitulo && <p className="muted">{subtitulo}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Estado({ hechas, total }: { hechas: number; total: number }) {
  if (total > 0 && hechas === total) return <span className="badge success"><Check size={12} /> Completa</span>;
  if (hechas === 0) return <span className="badge warning">Pendiente</span>;
  return <span className="badge accent">En progreso</span>;
}
