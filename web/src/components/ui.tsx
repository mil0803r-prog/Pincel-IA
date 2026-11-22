import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, X, AlertTriangle } from "lucide-react";

/* ---------------- logo ---------------- */
export function Logo({ size = 32 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ flexShrink: 0, filter: "drop-shadow(0 6px 16px rgba(236,72,153,.45))" }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset=".55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#g${id})`} />
      <rect width="64" height="64" rx="18" fill={`url(#h${id})`} />
      <path d="M41.2 14.2a5.9 5.9 0 0 1 8.4 8.4L34.4 37.8l-8.4-8.4 15.2-15.2z" fill="#fff" />
      <path d="M23.6 31.9l8.4 8.4c-1.4 6.6-6.6 10.3-15.6 10.1 1.8-2.2 1.9-4.5 1.8-6.6-.2-4.8 1.8-9.9 5.4-11.9z" fill="#fff" opacity=".82" />
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
    setLista((l) => [...l.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((t) => t.id !== id)), tipo === "error" ? 4500 : 2400);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {lista.map((t) => (
          <div key={t.id} className={`toast ${t.tipo === "error" ? "error" : ""}`}>
            <span className="ti">{t.tipo === "error" ? <AlertTriangle size={13} /> : <Check size={13} strokeWidth={3} />}</span>
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
  titulo: ReactNode;
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
      <div className="modal" role="dialog" aria-modal="true" style={ancho ? { maxWidth: ancho } : undefined}>
        <div className="modal-head">
          <div className="stack gap-6">
            <h2>{titulo}</h2>
            {descripcion && <p className="muted small">{descripcion}</p>}
          </div>
          <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar">
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

/** Anillo de progreso con degradado de marca. */
export function Anillo({ hechas, total, size = 44, grosor = 4, texto }: { hechas: number; total: number; size?: number; grosor?: number; texto?: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const r = (size - grosor) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? hechas / total : 0;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${hechas} de ${total} imágenes`}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset=".6" stopColor="#ec4899" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={grosor} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#r${id})`}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <span className="val" style={{ fontSize: size * 0.27 }}>{texto ?? `${Math.round(pct * 100)}%`}</span>
    </div>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono: ReactNode; titulo: ReactNode; texto: string; children?: ReactNode }) {
  return (
    <div className="glass empty">
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

export function Estado({ hechas, total, sobreImagen }: { hechas: number; total: number; sobreImagen?: boolean }) {
  const extra = sobreImagen ? " onimg" : "";
  if (total > 0 && hechas === total) return <span className={`badge success${extra}`}><span className="dot" style={sobreImagen ? { color: "#34d399" } : undefined} /> Completa</span>;
  if (hechas === 0) return <span className={`badge warning${extra}`}><span className="dot" style={sobreImagen ? { color: "#fbbf24" } : undefined} /> Pendiente</span>;
  return <span className={`badge accent${extra}`}><span className="dot" style={sobreImagen ? { color: "#c4b5fd" } : undefined} /> En progreso</span>;
}

export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w));
  return ((p[0]?.[0] || nombre[0] || "P") + (p[1]?.[0] || "")).toUpperCase();
}
