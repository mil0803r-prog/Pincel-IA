import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  FolderPlus,
  ImagePlus,
  ListPlus,
  Plug,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, fecha, type Aviso, type Avisos } from "../api";

/* ---------------- datos en vivo ---------------- */
const firma = (a: Aviso) => `${a.cantidad}|${a.creado}`;
const PREF_NAVEGADOR = "pincel-avisos-navegador";

export const avisosDelNavegadorActivos = () => {
  try {
    return localStorage.getItem(PREF_NAVEGADOR) === "1" && "Notification" in window && Notification.permission === "granted";
  } catch {
    return false;
  }
};

/**
 * Consulta los avisos cada pocos segundos (más despacio si la pestaña está oculta) y avisa de los nuevos.
 * Lo que ya existía al abrir la app no se anuncia: solo lo que llega después.
 */
export function useAvisos(onNuevo: (a: Aviso) => void) {
  const [datos, setDatos] = useState<Avisos>({ no_leidas: 0, items: [] });
  const vistos = useRef<Map<string, string> | null>(null);
  const alNuevo = useRef(onNuevo);
  alNuevo.current = onNuevo;

  const aplicar = useCallback((r: Avisos, anunciar: boolean) => {
    if (vistos.current === null) vistos.current = new Map();
    for (const a of r.items) {
      const f = firma(a);
      if (anunciar && !a.leida && vistos.current.get(a.id) !== f) alNuevo.current(a);
      vistos.current.set(a.id, f);
    }
    setDatos(r);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await api.notificaciones();
      aplicar(r, vistos.current !== null);
    } catch {
      /* sin conexión: se reintenta en el siguiente ciclo */
    }
  }, [aplicar]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let vivo = true;
    const ciclo = () => {
      t = setTimeout(async () => {
        if (!vivo) return;
        await cargar();
        ciclo();
      }, document.hidden ? 30000 : 7000);
    };
    cargar();
    ciclo();
    const alVolver = () => { if (!document.hidden) cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  const leer = useCallback(async (ids?: string[]) => {
    try {
      aplicar(await api.leerNotificaciones(ids), false);
    } catch {
      /* se reintentará al abrir otra vez */
    }
  }, [aplicar]);

  return { ...datos, leer };
}

/* ---------------- campanita ---------------- */
export function Campanita({ noLeidas, abierto, onClick, className = "icon-btn" }: { noLeidas: number; abierto: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      className={`${className} bell ${abierto ? "on" : ""}`}
      onClick={onClick}
      aria-label={noLeidas ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
      title="Notificaciones"
      aria-expanded={abierto}
    >
      {noLeidas > 0 ? <BellRing size={16} /> : <Bell size={16} />}
      {noLeidas > 0 && <span className="bell-dot">{noLeidas > 9 ? "9+" : noLeidas}</span>}
    </button>
  );
}

/* ---------------- panel ---------------- */
const ICONOS: Record<string, { icono: LucideIcon; clase: string }> = {
  conectado: { icono: Plug, clase: "ok" },
  imagenes: { icono: ImagePlus, clase: "gpt" },
  trabajando: { icono: Sparkles, clase: "gpt" },
  campana_creada: { icono: FolderPlus, clase: "claude" },
  prompts: { icono: ListPlus, clase: "claude" },
  completa: { icono: CheckCircle2, clase: "ok" },
  error: { icono: AlertTriangle, clase: "err" },
};

export function PanelAvisos({
  items,
  noLeidas,
  onLeer,
  onAbrir,
  onCerrar,
}: {
  items: Aviso[];
  noLeidas: number;
  onLeer: (ids?: string[]) => void;
  onAbrir: (a: Aviso) => void;
  onCerrar: () => void;
}) {
  const [navegador, setNavegador] = useState(avisosDelNavegadorActivos());
  const soporta = typeof window !== "undefined" && "Notification" in window;
  const bloqueado = soporta && Notification.permission === "denied";

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);

  async function alternarNavegador() {
    try {
      if (navegador) {
        localStorage.setItem(PREF_NAVEGADOR, "0");
        setNavegador(false);
        return;
      }
      const permiso = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permiso === "granted") {
        localStorage.setItem(PREF_NAVEGADOR, "1");
        setNavegador(true);
        new Notification("Pincel IA", { body: "Listo: te avisaremos cuando lleguen imágenes.", icon: "/favicon.svg" });
      }
    } catch {
      /* el navegador no lo permite */
    }
  }

  return (
    <>
      <div className="avisos-fondo" onClick={onCerrar} />
      <section className="avisos glass" role="dialog" aria-label="Notificaciones">
        <header className="avisos-cab">
          <div className="stack">
            <h2>Notificaciones</h2>
            <span className="subtle small">{noLeidas ? `${noLeidas} sin leer` : "Todo al día"}</span>
          </div>
          <div className="row gap-4">
            {noLeidas > 0 && (
              <button className="btn ghost sm" onClick={() => onLeer()}>
                <CheckCheck size={14} /> Marcar todo
              </button>
            )}
            <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
          </div>
        </header>
        <div className="avisos-lista">
          {items.length === 0 ? (
            <div className="avisos-vacio">
              <span className="empty-icon" style={{ width: 48, height: 48, borderRadius: 14 }}><Bell size={20} /></span>
              <p className="muted small">Aquí verás cuándo Claude crea una campaña y cuándo ChatGPT envía imágenes.</p>
            </div>
          ) : (
            items.map((a) => {
              const { icono: Icono, clase } = ICONOS[a.tipo] ?? { icono: Bell, clase: "" };
              return (
                <button key={a.id} className={`aviso ${a.leida ? "" : "nuevo"}`} onClick={() => onAbrir(a)}>
                  <span className={`aviso-ico ${clase}`}><Icono size={16} /></span>
                  <span className="stack grow gap-4" style={{ textAlign: "left" }}>
                    <b>{a.titulo}</b>
                    {a.detalle && <span className="muted small ellipsis">{a.detalle}</span>}
                    <span className="subtle tiny">{fecha(a.creado)}</span>
                  </span>
                  {!a.leida && <span className="aviso-punto" aria-label="Sin leer" />}
                </button>
              );
            })
          )}
        </div>
        {soporta && (
          <footer className="avisos-pie">
            <div className="stack grow">
              <span className="small" style={{ fontWeight: 500 }}>Avisos del navegador</span>
              <span className="subtle tiny">
                {bloqueado ? "Bloqueados en este navegador. Actívalos desde el candado de la barra de direcciones." : "Un aviso aunque tengas otra pestaña abierta."}
              </span>
            </div>
            <button className={`interruptor ${navegador ? "on" : ""}`} onClick={alternarNavegador} disabled={bloqueado} role="switch" aria-checked={navegador} aria-label="Avisos del navegador">
              <span />
            </button>
          </footer>
        )}
      </section>
    </>
  );
}
