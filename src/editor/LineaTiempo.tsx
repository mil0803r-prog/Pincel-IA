import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, ImageIcon, Type, VolumeX } from "lucide-react";
import type { Motor } from "./motor";
import { compactarPrincipal, durClip, finClip, PISTAS, tiempo, type Clip, type Medio, type PistaId, type Proyecto } from "./tipos";

const ALTO: Record<PistaId, number> = { texto: 34, superposicion: 50, principal: 66, audio1: 46, audio2: 46 };
const ETIQUETA = 132;

type Arrastre = {
  modo: "mover" | "izq" | "der";
  id: string;
  x0: number;
  y0: number;
  original: Clip;
  antes: Proyecto;
  movio: boolean;
};

/** Forma de onda (área espejada) en un viewBox de 0..N × 0..100. */
function caminoOnda(picos: number[]): string {
  if (!picos.length) return "";
  let d = `M0 50`;
  picos.forEach((p, i) => { d += ` L${i} ${50 - p * 46}`; });
  for (let i = picos.length - 1; i >= 0; i--) d += ` L${i} ${50 + picos[i] * 46}`;
  return d + " Z";
}

function Cabezal({ motor, pps }: { motor: Motor; pps: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mover = (t: number) => {
      if (!ref.current) return;
      ref.current.style.transform = `translateX(${t * pps}px)`;
      const caja = ref.current.closest(".lt-scroll") as HTMLElement | null;
      if (caja && motor.reproduciendo) {
        const x = t * pps;
        if (x > caja.scrollLeft + caja.clientWidth - 80) caja.scrollLeft = x - 120;
      }
    };
    mover(motor.t);
    return motor.suscribir(mover);
  }, [motor, pps]);
  return <div className="lt-cabezal" ref={ref}><span /></div>;
}

export default function LineaTiempo({
  proyecto, motor, pps, iman, seleccion, onSeleccion, onCambio, onConfirmar, onSoltarMedio,
}: {
  proyecto: Proyecto;
  motor: Motor;
  pps: number;
  iman: boolean;
  seleccion: string | null;
  onSeleccion: (id: string | null) => void;
  onCambio: (p: Proyecto) => void; // cambio en vivo (sin historial)
  onConfirmar: (antes: Proyecto) => void; // guarda en el historial el estado previo
  onSoltarMedio: (medioId: string, pista: PistaId, t: number) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const pistasRef = useRef<HTMLDivElement>(null);
  const [arr, setArr] = useState<Arrastre | null>(null);
  const [guia, setGuia] = useState<number | null>(null);
  const [ancho, setAncho] = useState(800);
  const medios = useMemo(() => new Map(proyecto.medios.map((m) => [m.id, m])), [proyecto.medios]);
  const ondas = useMemo(() => new Map(proyecto.medios.map((m) => [m.id, caminoOnda(m.picos)])), [proyecto.medios]);

  const dur = Math.max(...proyecto.clips.map(finClip), 0);
  const total = Math.max(dur + 10, ancho / pps);

  useEffect(() => {
    if (!scroll.current) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(scroll.current);
    return () => ro.disconnect();
  }, []);

  // regla: marcas que se adaptan al zoom
  const paso = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s * pps >= 70) ?? 120;
  const marcas = Array.from({ length: Math.ceil(total / paso) + 1 }, (_, i) => i * paso);

  const tEnX = (clientX: number) => {
    const r = scroll.current!.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + scroll.current!.scrollLeft) / pps);
  };
  const pistaEnY = (clientY: number): PistaId | null => {
    const r = pistasRef.current!.getBoundingClientRect();
    let y = clientY - r.top;
    for (const p of PISTAS) {
      if (y < ALTO[p.id]) return p.id;
      y -= ALTO[p.id];
    }
    return null;
  };

  function puntosIman(excluir: string): number[] {
    const pts = [0, motor.t];
    proyecto.clips.forEach((c) => { if (c.id !== excluir) pts.push(c.pos, finClip(c)); });
    return pts;
  }
  function imantar(valores: number[], excluir: string): { delta: number; en: number | null } {
    if (!iman) return { delta: 0, en: null };
    const tope = 9 / pps;
    let mejor = { delta: 0, en: null as number | null, dist: tope };
    for (const p of puntosIman(excluir)) for (const v of valores) {
      const d = Math.abs(p - v);
      if (d < mejor.dist) mejor = { delta: p - v, en: p, dist: d };
    }
    return { delta: mejor.delta, en: mejor.en };
  }

  function empezar(e: React.PointerEvent, c: Clip, modo: Arrastre["modo"]) {
    e.stopPropagation();
    if (e.button !== 0) return;
    onSeleccion(c.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setArr({ modo, id: c.id, x0: e.clientX, y0: e.clientY, original: c, antes: proyecto, movio: false });
  }

  function mover(e: React.PointerEvent) {
    if (!arr) return;
    const dx = (e.clientX - arr.x0) / pps;
    if (!arr.movio && Math.abs(e.clientX - arr.x0) < 3 && Math.abs(e.clientY - arr.y0) < 3) return;
    const o = arr.original;
    const medio = o.medioId ? medios.get(o.medioId) : undefined;
    let c: Clip = { ...o };
    if (arr.modo === "mover") {
      let pos = Math.max(0, o.pos + dx);
      const im = imantar([pos, pos + durClip(o)], o.id);
      pos = Math.max(0, pos + im.delta);
      setGuia(im.en);
      const destino = pistaEnY(e.clientY);
      const pista = destino && PISTAS.find((p) => p.id === destino)!.acepta.includes(o.tipo) ? destino : o.pista;
      c = { ...o, pos, pista };
    } else {
      const v = o.tipo === "video" || o.tipo === "audio" ? o.velocidad : 1;
      const tope = medio && (o.tipo === "video" || o.tipo === "audio") ? medio.duracion : Infinity;
      if (arr.modo === "izq") {
        let nuevoPos = o.pos + dx;
        const im = imantar([nuevoPos], o.id);
        nuevoPos += im.delta;
        setGuia(im.en);
        let entrada = o.entrada + (nuevoPos - o.pos) * v;
        entrada = Math.max(0, Math.min(entrada, o.salida - 0.1));
        nuevoPos = o.pos + (entrada - o.entrada) / v;
        c = { ...o, entrada, pos: o.pista === "principal" ? o.pos : Math.max(0, nuevoPos) };
      } else {
        let fin = finClip(o) + dx;
        const im = imantar([fin], o.id);
        fin += im.delta;
        setGuia(im.en);
        const salida = Math.max(o.entrada + 0.1, Math.min(tope, o.entrada + (fin - o.pos) * v));
        c = { ...o, salida };
      }
    }
    let clips = proyecto.clips.map((x) => (x.id === c.id ? c : x));
    if (arr.modo !== "mover" && c.pista === "principal") clips = compactarPrincipal(clips);
    onCambio({ ...proyecto, clips });
    if (!arr.movio) setArr({ ...arr, movio: true });
  }

  function soltar() {
    if (!arr) return;
    if (arr.movio) {
      onCambio({ ...proyecto, clips: compactarPrincipal(proyecto.clips) });
      onConfirmar(arr.antes);
    }
    setArr(null);
    setGuia(null);
  }

  function arrastrarCabezal(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    motor.pause();
    motor.seek(tEnX(e.clientX));
    const mov = (ev: PointerEvent) => motor.seek(tEnX(ev.clientX));
    const fin = () => { window.removeEventListener("pointermove", mov); window.removeEventListener("pointerup", fin); };
    window.addEventListener("pointermove", mov);
    window.addEventListener("pointerup", fin);
  }

  return (
    <div className="lt">
      <div className="lt-etiquetas" style={{ width: ETIQUETA }}>
        <div className="lt-esquina">{tiempo(dur)}</div>
        {PISTAS.map((p) => (
          <div key={p.id} className="lt-etiqueta" style={{ height: ALTO[p.id] }}>
            {p.id === "texto" ? <Type size={13} /> : p.id.startsWith("audio") ? <AudioLines size={13} /> : <ImageIcon size={13} />}
            <span>{p.nombre}</span>
          </div>
        ))}
      </div>
      <div
        className="lt-scroll"
        ref={scroll}
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); } }}
      >
        <div className="lt-lienzo" style={{ width: total * pps }}>
          <div className="lt-regla" onPointerDown={arrastrarCabezal}>
            {marcas.map((m) => (
              <div key={m} className="lt-marca" style={{ left: m * pps }}><span>{tiempo(m)}</span></div>
            ))}
          </div>
          <div
            className="lt-pistas"
            ref={pistasRef}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("lt-pista")) { onSeleccion(null); motor.pause(); motor.seek(tEnX(e.clientX)); } }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("text/medio")) e.preventDefault(); }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/medio");
              const pista = pistaEnY(e.clientY);
              if (id && pista) { e.preventDefault(); onSoltarMedio(id, pista, tEnX(e.clientX)); }
            }}
          >
            {PISTAS.map((p) => (
              <div key={p.id} className={`lt-pista lt-${p.id}`} style={{ height: ALTO[p.id] }}>
                {proyecto.clips.filter((c) => c.pista === p.id).map((c) => (
                  <ClipVisual key={c.id} c={c} medio={c.medioId ? medios.get(c.medioId) : undefined} onda={c.medioId ? ondas.get(c.medioId) : ""} pps={pps} sel={seleccion === c.id} arrastrando={arr?.id === c.id && arr.movio} onEmpezar={empezar} />
                ))}
              </div>
            ))}
          </div>
          {guia !== null && <div className="lt-guia" style={{ left: guia * pps }} />}
          <Cabezal motor={motor} pps={pps} />
        </div>
      </div>
    </div>
  );
}

function ClipVisual({ c, medio, onda, pps, sel, arrastrando, onEmpezar }: {
  c: Clip; medio?: Medio; onda?: string; pps: number; sel: boolean; arrastrando: boolean;
  onEmpezar: (e: React.PointerEvent, c: Clip, modo: "mover" | "izq" | "der") => void;
}) {
  const ancho = Math.max(6, durClip(c) * pps);
  const v = c.tipo === "video" || c.tipo === "audio" ? c.velocidad : 1;
  const anchoMedio = medio ? (medio.duracion / v) * pps : ancho;
  const desfase = -(c.entrada / v) * pps;
  return (
    <div
      className={`lt-clip lt-clip-${c.tipo} ${sel ? "sel" : ""} ${arrastrando ? "arrastrando" : ""}`}
      style={{ left: c.pos * pps, width: ancho }}
      onPointerDown={(e) => onEmpezar(e, c, "mover")}
      title={medio?.nombre ?? c.texto?.contenido ?? ""}
    >
      <div className="lt-contenido">
        {c.tipo === "video" && medio && (
          <div className="lt-tira" style={{ width: anchoMedio, transform: `translateX(${desfase}px)` }}>
            {medio.tira.map((src, i) => <img key={i} src={src} alt="" draggable={false} style={{ width: anchoMedio / medio.tira.length }} />)}
          </div>
        )}
        {c.tipo === "imagen" && medio && <div className="lt-imagen" style={{ backgroundImage: `url(${medio.miniatura})` }} />}
        {c.tipo === "audio" && medio && onda && (
          <svg className="lt-onda" style={{ width: anchoMedio, transform: `translateX(${desfase}px)` }} viewBox={`0 0 ${Math.max(1, medio.picos.length)} 100`} preserveAspectRatio="none">
            <path d={onda} />
          </svg>
        )}
        <span className="lt-nombre">
          {c.silenciado && c.tipo === "video" && <VolumeX size={11} />}
          {c.tipo === "texto" ? c.texto?.contenido.split("\n")[0] : medio?.nombre}
          {c.velocidad !== 1 && (c.tipo === "video" || c.tipo === "audio") && <b> {c.velocidad}x</b>}
        </span>
      </div>
      <div className="lt-asa izq" onPointerDown={(e) => onEmpezar(e, c, "izq")} />
      <div className="lt-asa der" onPointerDown={(e) => onEmpezar(e, c, "der")} />
    </div>
  );
}
