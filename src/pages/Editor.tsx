import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, AudioLines, Check, Copy, Download, Film, ImageIcon, Loader2, Magnet, Music, Pause, Play, Plus, Redo2,
  Scissors, SkipBack, Trash2, Type, Undo2, Upload, Volume2, VolumeX, ZoomIn, ZoomOut,
} from "lucide-react";
import { Modal, useToast } from "../components/ui";
import { Fondo } from "../components/Layout";
import { DEMO } from "../api";
import LineaTiempo from "../editor/LineaTiempo";
import { Motor } from "../editor/motor";
import { descargar, extraerAudio, importarArchivo, olvidarBuffer, sinExtension } from "../editor/medios";
import { borrarArchivo, cargarProyecto, guardarArchivo, guardarProyecto } from "../editor/almacen";
import { exportarAudio, exportarVideo, formatoSalida, medidasSalida, type Calidad } from "../editor/exportar";
import {
  compactarPrincipal, durClip, duracionProyecto, FILTROS_BASE, finClip, FORMATOS, nuevoClip, PISTAS, PRESETS_FILTRO, TEXTO_BASE, tiempo, uid,
  type Animacion, type Clip, type EstiloTexto, type Formato, type Medio, type PistaId, type Proyecto,
} from "../editor/tipos";

const FUENTES = ["Geist", "Instrument Serif", "Arial Black", "Georgia", "Impact", "Courier New"];
const VELOCIDADES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const ANIMACIONES: { id: Animacion; nombre: string }[] = [
  { id: "ninguna", nombre: "Ninguna" }, { id: "fundido", nombre: "Fundido" }, { id: "subir", nombre: "Subir" }, { id: "zoom", nombre: "Zoom" },
];
const PLANTILLAS_TEXTO: { nombre: string; estilo: Partial<EstiloTexto>; y: number }[] = [
  { nombre: "Título", estilo: { contenido: "Título llamativo", tamano: 7, negrita: true, contorno: "#000000" }, y: -0.3 },
  { nombre: "Subtítulo", estilo: { contenido: "Escribe tu subtítulo", tamano: 4, negrita: false, fondo: "rgba(0,0,0,0.55)", contorno: "" }, y: 0.3 },
  { nombre: "Precio / oferta", estilo: { contenido: "OFERTA\n$49.900", tamano: 7.5, color: "#111111", fondo: "#facc15", contorno: "", fuente: "Arial Black" }, y: 0.12 },
  { nombre: "Llamado a la acción", estilo: { contenido: "Escríbenos por WhatsApp 👇", tamano: 4.5, color: "#ffffff", fondo: "#16a34a", contorno: "" }, y: 0.38 },
  { nombre: "Elegante", estilo: { contenido: "Nueva colección", tamano: 8, fuente: "Instrument Serif", negrita: false, contorno: "" }, y: -0.1 },
];

const esMedia = (c: Clip) => c.tipo === "video" || c.tipo === "audio";

/* ------------------------- controles pequeños ------------------------- */
function Deslizador({ etiqueta, valor, min, max, paso = 0.01, formato, onCambio, onSoltar }: {
  etiqueta: string; valor: number; min: number; max: number; paso?: number; formato?: (v: number) => string;
  onCambio: (v: number) => void; onSoltar: () => void;
}) {
  return (
    <label className="ed-desl">
      <span className="row between"><span>{etiqueta}</span><b>{formato ? formato(valor) : valor.toFixed(2)}</b></span>
      <input type="range" min={min} max={max} step={paso} value={valor}
        onChange={(e) => onCambio(Number(e.target.value))} onPointerUp={onSoltar} onKeyUp={onSoltar} onBlur={onSoltar} />
    </label>
  );
}
function Segmentos<T extends string | number>({ opciones, valor, onCambio }: { opciones: { id: T; nombre: string }[]; valor: T; onCambio: (v: T) => void }) {
  return (
    <div className="ed-seg">
      {opciones.map((o) => <button key={String(o.id)} className={o.id === valor ? "on" : ""} onClick={() => onCambio(o.id)}>{o.nombre}</button>)}
    </div>
  );
}
const pct = (v: number) => `${Math.round(v * 100)}%`;
const seg = (v: number) => `${v.toFixed(1)} s`;

/* ------------------------- exportar ------------------------- */
function Exportar({ proyecto, onCerrar }: { proyecto: Proyecto; onCerrar: () => void }) {
  const toast = useToast();
  const [calidad, setCalidad] = useState<Calidad>(1080);
  const [estado, setEstado] = useState<"listo" | "video" | "audio" | "hecho">("listo");
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<{ url: string; blob: Blob; nombre: string } | null>(null);
  const control = useRef<AbortController | null>(null);
  const salida = formatoSalida();
  const m = medidasSalida(proyecto, calidad);
  const dur = duracionProyecto(proyecto);
  const tieneAudio = proyecto.clips.some((c) => esMedia(c) && !c.silenciado && proyecto.medios.find((x) => x.id === c.medioId)?.tieneAudio);

  useEffect(() => () => { control.current?.abort(); if (resultado) URL.revokeObjectURL(resultado.url); }, [resultado]);

  const video = async () => {
    control.current = new AbortController();
    setEstado("video");
    setProgreso(0);
    try {
      const { blob, ext } = await exportarVideo(proyecto, calidad, setProgreso, control.current.signal);
      setResultado({ url: URL.createObjectURL(blob), blob, nombre: `${proyecto.nombre}.${ext}` });
      setEstado("hecho");
    } catch (e) {
      setEstado("listo");
      if ((e as Error).name !== "AbortError") toast((e as Error).message, "error");
    }
  };
  const audio = async () => {
    setEstado("audio");
    try {
      const blob = await exportarAudio(proyecto);
      setResultado({ url: URL.createObjectURL(blob), blob, nombre: `${proyecto.nombre} (audio).wav` });
      setEstado("hecho");
    } catch (e) {
      setEstado("listo");
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal titulo="Exportar" descripcion={`${tiempo(dur)} · ${proyecto.formato}`} onCerrar={() => { control.current?.abort(); onCerrar(); }} ancho={520}>
      {estado === "hecho" && resultado ? (
        <div className="stack gap-12">
          {resultado.blob.type.startsWith("video") ? (
            <video className="ed-resultado" src={resultado.url} controls playsInline />
          ) : (
            <audio src={resultado.url} controls style={{ width: "100%" }} />
          )}
          <div className="row between wrap gap-8">
            <span className="subtle small">{resultado.nombre} · {(resultado.blob.size / 1048576).toFixed(1)} MB</span>
            <div className="row gap-8">
              <button className="btn sm" onClick={() => { setEstado("listo"); setResultado(null); }}>Volver</button>
              <button className="btn sm glow" onClick={() => descargar(resultado.blob, resultado.nombre)}><Download size={15} /> Descargar</button>
            </div>
          </div>
          {DEMO && <p className="subtle small">En la demo la descarga puede estar bloqueada; en tu app funciona normal.</p>}
        </div>
      ) : estado === "video" || estado === "audio" ? (
        <div className="stack gap-12">
          <div className="row gap-8"><Loader2 size={16} className="spin" /><b>{estado === "video" ? "Grabando tu video…" : "Mezclando el audio…"}</b></div>
          {estado === "video" && (
            <>
              <div className="ed-barra"><i style={{ width: pct(progreso) }} /></div>
              <p className="subtle small">{pct(progreso)} · tarda lo mismo que dura el video. No cambies de pestaña mientras se graba.</p>
              <button className="btn sm" onClick={() => control.current?.abort()}>Cancelar</button>
            </>
          )}
        </div>
      ) : (
        <div className="stack gap-16">
          <div className="field">
            <label>Calidad</label>
            <Segmentos opciones={[{ id: 720 as Calidad, nombre: "720p · más liviano" }, { id: 1080 as Calidad, nombre: "1080p · máxima" }]} valor={calidad} onCambio={setCalidad} />
            <span className="hint">{m.ancho} × {m.alto} px · {salida ? salida.ext.toUpperCase() : "no disponible en este navegador"}</span>
          </div>
          <button className="btn glow lg block" disabled={!salida || dur <= 0} onClick={video}><Film size={17} /> Exportar video</button>
          <button className="btn block" disabled={!tieneAudio} onClick={audio}><AudioLines size={16} /> Exportar solo el audio (WAV)</button>
          {!salida && <p className="small" style={{ color: "var(--danger)" }}>Usa Chrome o Edge en una computadora para exportar video.</p>}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------- editor ------------------------- */
export default function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [p, setP] = useState<Proyecto | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [panel, setPanel] = useState<"medios" | "texto">("medios");
  const [filtro, setFiltro] = useState<"todo" | "video" | "audio" | "imagen">("todo");
  const [pps, setPps] = useState(60);
  const [iman, setIman] = useState(true);
  const [importando, setImportando] = useState(0);
  const [exportar, setExportar] = useState(false);
  const [guardado, setGuardado] = useState(true);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [tActual, setTActual] = useState(0);
  const [, refrescar] = useState(0);
  const historia = useRef<{ atras: Proyecto[]; adelante: Proyecto[] }>({ atras: [], adelante: [] });
  const antesDeslizar = useRef<Proyecto | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const pRef = useRef<Proyecto | null>(null);
  pRef.current = p;

  /* cargar */
  useEffect(() => {
    if (!id) return;
    cargarProyecto(id).then((x) => (x ? setP(x) : setNoExiste(true))).catch(() => setNoExiste(true));
  }, [id]);

  /* motor */
  const formato = p?.formato;
  useEffect(() => {
    if (!lienzo.current || !formato) return;
    const f = FORMATOS[formato];
    lienzo.current.width = f.ancho / 2;
    lienzo.current.height = f.alto / 2;
    const m = new Motor(lienzo.current, { guias: true });
    motor.current = m;
    if (pRef.current) m.setProyecto(pRef.current);
    let ultimo = 0;
    const quitar = m.suscribir((t) => {
      const ahora = performance.now();
      if (!m.reproduciendo || ahora - ultimo > 120) { ultimo = ahora; setTActual(t); }
      setReproduciendo(m.reproduciendo);
    });
    m.onFin = () => setReproduciendo(false);
    refrescar((n) => n + 1);
    return () => { quitar(); m.destruir(); motor.current = null; };
  }, [formato]);
  useEffect(() => { if (p) motor.current?.setProyecto(p); }, [p]);
  useEffect(() => {
    if (!motor.current) return;
    motor.current.seleccion = sel;
    if (!motor.current.reproduciendo) motor.current.dibujar();
  }, [sel, p]);

  /* guardado automático */
  useEffect(() => {
    if (!p) return;
    setGuardado(false);
    const t = setTimeout(() => guardarProyecto(p).then(() => setGuardado(true)).catch(() => {}), 700);
    return () => clearTimeout(t);
  }, [p]);

  /* historial */
  const confirmar = useCallback((antes: Proyecto) => {
    const h = historia.current;
    h.atras.push(antes);
    if (h.atras.length > 100) h.atras.shift();
    h.adelante = [];
    refrescar((n) => n + 1);
  }, []);
  const aplicar = useCallback((f: (x: Proyecto) => Proyecto) => {
    const actual = pRef.current;
    if (!actual) return;
    confirmar(actual);
    setP(f(actual));
  }, [confirmar]);
  const deshacer = useCallback(() => {
    const h = historia.current;
    const actual = pRef.current;
    const prev = h.atras.pop();
    if (!prev || !actual) return;
    h.adelante.push(actual);
    setP({ ...prev, medios: actual.medios }); // la biblioteca de medios no se deshace, solo la edición
  }, []);
  const rehacer = useCallback(() => {
    const h = historia.current;
    const actual = pRef.current;
    const sig = h.adelante.pop();
    if (!sig || !actual) return;
    h.atras.push(actual);
    setP({ ...sig, medios: actual.medios });
  }, []);

  const clip = p?.clips.find((c) => c.id === sel) ?? null;
  const medioDe = useCallback((c: Clip | null) => (c?.medioId ? pRef.current?.medios.find((m) => m.id === c.medioId) : undefined), []);

  /** Cambia el clip seleccionado. `vivo` = mientras se arrastra un deslizador (el historial se guarda al soltar). */
  const cambiarClip = useCallback((cambios: Partial<Clip>, vivo = false) => {
    const actual = pRef.current;
    if (!actual || !sel) return;
    if (vivo) {
      if (!antesDeslizar.current) antesDeslizar.current = actual;
    } else if (!antesDeslizar.current) {
      confirmar(actual);
    }
    let clips = actual.clips.map((c) => (c.id === sel ? { ...c, ...cambios } : c));
    if ("velocidad" in cambios || "salida" in cambios || "entrada" in cambios) clips = compactarPrincipal(clips);
    setP({ ...actual, clips });
  }, [sel, confirmar]);
  const soltarDeslizador = useCallback(() => {
    if (antesDeslizar.current) { confirmar(antesDeslizar.current); antesDeslizar.current = null; }
  }, [confirmar]);
  const cambiarTexto = (c: Partial<EstiloTexto>, vivo = false) => clip?.texto && cambiarClip({ texto: { ...clip.texto, ...c } }, vivo);

  /* importar */
  const importar = useCallback(async (files: FileList | File[]) => {
    const lista = [...files];
    if (!lista.length) return;
    setImportando((n) => n + lista.length);
    for (const f of lista) {
      try {
        const m = await importarArchivo(f);
        await guardarArchivo(m.id, f);
        setP((x) => (x ? { ...x, medios: [...x.medios, m] } : x));
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setImportando((n) => n - 1);
      }
    }
  }, [toast]);

  /** Añade un medio a la línea de tiempo: en la pista indicada o en la que le corresponde. */
  const agregarMedio = useCallback((m: Medio, pista?: PistaId, t?: number) => {
    aplicar((x) => {
      const destino: PistaId = pista ?? (m.tipo === "audio" ? "audio1" : "principal");
      const acepta = PISTAS.find((q) => q.id === destino)!.acepta.includes(m.tipo);
      const pistaFinal: PistaId = acepta ? destino : m.tipo === "audio" ? "audio1" : "superposicion";
      const finPista = Math.max(0, ...x.clips.filter((c) => c.pista === pistaFinal).map(finClip));
      const pos = pistaFinal === "principal" ? (t ?? finPista) - 0.001 : t ?? (pistaFinal === "superposicion" ? motor.current?.t ?? 0 : finPista);
      const c = nuevoClip(m.tipo, pistaFinal, Math.max(0, pos), m, m.tipo === "imagen" ? 3 : 4);
      if (pistaFinal === "superposicion") { c.escala = 0.5; c.encaje = "ajustar"; }
      if (m.tipo === "imagen" && pistaFinal === "principal") c.encaje = "ajustar";
      setSel(c.id);
      return { ...x, clips: compactarPrincipal([...x.clips, c]) };
    });
  }, [aplicar]);

  const agregarTexto = (plantilla: (typeof PLANTILLAS_TEXTO)[number]) => {
    aplicar((x) => {
      const c = nuevoClip("texto", "texto", motor.current?.t ?? 0, undefined, 3);
      c.texto = { ...TEXTO_BASE, ...plantilla.estilo };
      c.y = plantilla.y;
      setSel(c.id);
      return { ...x, clips: [...x.clips, c] };
    });
  };

  /* acciones de edición */
  const dividir = useCallback(() => {
    const x = pRef.current;
    const m = motor.current;
    if (!x || !m) return;
    const t = m.t;
    // el seleccionado si está bajo el cabezal; si no, todos los clips bajo el cabezal
    const bajo = x.clips.filter((c) => t > c.pos + 0.05 && t < finClip(c) - 0.05);
    const objetivo = bajo.filter((c) => (sel ? c.id === sel : true));
    const lista = objetivo.length ? objetivo : bajo;
    if (!lista.length) { toast("Pon el cabezal sobre un clip para dividirlo", "error"); return; }
    aplicar((p0) => {
      let clips = [...p0.clips];
      for (const c of lista) {
        const v = esMedia(c) ? c.velocidad : 1;
        const corte = c.entrada + (t - c.pos) * v;
        const a: Clip = { ...c, salida: corte, fadeOut: 0, animSalida: "ninguna" };
        const b: Clip = { ...c, id: uid(), pos: t, entrada: corte, fadeIn: 0, animEntrada: "ninguna" };
        clips = clips.flatMap((y) => (y.id === c.id ? [a, b] : [y]));
        if (c.id === sel) setSel(b.id);
      }
      return { ...p0, clips: compactarPrincipal(clips) };
    });
  }, [sel, aplicar, toast]);

  const borrar = useCallback(() => {
    if (!sel) return;
    aplicar((x) => ({ ...x, clips: compactarPrincipal(x.clips.filter((c) => c.id !== sel)) }));
    setSel(null);
  }, [sel, aplicar]);

  const duplicar = useCallback(() => {
    const c = pRef.current?.clips.find((y) => y.id === sel);
    if (!c) return;
    const nuevo: Clip = { ...c, id: uid(), pos: finClip(c) };
    aplicar((x) => {
      const i = x.clips.findIndex((y) => y.id === c.id);
      const clips = [...x.clips];
      clips.splice(i + 1, 0, c.pista === "principal" ? { ...nuevo, pos: c.pos + 0.0005 } : nuevo);
      return { ...x, clips: compactarPrincipal(clips) };
    });
    setSel(nuevo.id);
  }, [sel, aplicar]);

  /** Como en CapCut: el audio del video pasa a su propia pista y el video queda en silencio. */
  const separarAudio = useCallback(() => {
    const c = pRef.current?.clips.find((y) => y.id === sel);
    const m = medioDe(c ?? null);
    if (!c || c.tipo !== "video" || !m) return;
    if (!m.tieneAudio) { toast("Este video no tiene audio", "error"); return; }
    aplicar((x) => {
      const libre = (["audio1", "audio2"] as PistaId[]).find((pi) => !x.clips.some((y) => y.pista === pi && y.pos < finClip(c) && finClip(y) > c.pos)) ?? "audio2";
      const a: Clip = { ...nuevoClip("audio", libre, c.pos, m), entrada: c.entrada, salida: c.salida, velocidad: c.velocidad, volumen: c.volumen, fadeIn: c.fadeIn, fadeOut: c.fadeOut };
      return { ...x, clips: [...x.clips.map((y) => (y.id === c.id ? { ...y, silenciado: true } : y)), a] };
    });
    toast("Audio separado en su propia pista");
  }, [sel, aplicar, medioDe, toast]);

  const extraer = async (m: Medio) => {
    try {
      const b = await extraerAudio(m);
      descargar(b, `${sinExtension(m.nombre)}.wav`);
      toast("Audio extraído (WAV)");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const extraerABiblioteca = async (m: Medio) => {
    try {
      const b = await extraerAudio(m);
      const f = new File([b], `${sinExtension(m.nombre)} (audio).wav`, { type: "audio/wav" });
      await importar([f]);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const quitarMedio = (m: Medio) => {
    aplicar((x) => ({ ...x, medios: x.medios.filter((y) => y.id !== m.id), clips: compactarPrincipal(x.clips.filter((c) => c.medioId !== m.id)) }));
    historia.current = { atras: [], adelante: [] }; // el archivo se borra: no se puede deshacer
    borrarArchivo(m.id);
    olvidarBuffer(m.id);
    setSel(null);
  };

  /* atajos de teclado */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]") || document.querySelector(".modal-back")) return;
      const m = motor.current;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space") { e.preventDefault(); m?.alternar(); }
      else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); deshacer(); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); rehacer(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicar(); }
      else if (!mod && e.key.toLowerCase() === "s") { e.preventDefault(); dividir(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); borrar(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!m) return;
        m.pause();
        m.seek(m.t + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30));
      } else if (e.key === "Home") { m?.seek(0); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [deshacer, rehacer, duplicar, dividir, borrar]);

  /* mover en la vista previa */
  const arrastreLienzo = useRef<{ id: string; x0: number; y0: number; cx: number; cy: number; antes: Proyecto; movio: boolean } | null>(null);
  const puntoLienzo = (e: React.PointerEvent) => {
    const c = lienzo.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const bajarLienzo = (e: React.PointerEvent) => {
    const m = motor.current;
    if (!m || !p) return;
    const { x, y } = puntoLienzo(e);
    const idClip = m.clipEn(x, y);
    setSel(idClip);
    const c = p.clips.find((q) => q.id === idClip);
    if (!c) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastreLienzo.current = { id: c.id, x0: x, y0: y, cx: c.x, cy: c.y, antes: p, movio: false };
  };
  const moverLienzo = (e: React.PointerEvent) => {
    const a = arrastreLienzo.current;
    const x = pRef.current;
    if (!a || !x || !lienzo.current) return;
    const pt = puntoLienzo(e);
    let nx = a.cx + (pt.x - a.x0) / lienzo.current.width;
    let ny = a.cy + (pt.y - a.y0) / lienzo.current.height;
    if (Math.abs(nx) < 0.015) nx = 0; // se imanta al centro
    if (Math.abs(ny) < 0.015) ny = 0;
    a.movio = true;
    setP({ ...x, clips: x.clips.map((c) => (c.id === a.id ? { ...c, x: nx, y: ny } : c)) });
  };
  const subirLienzo = () => {
    const a = arrastreLienzo.current;
    if (a?.movio) confirmar(a.antes);
    arrastreLienzo.current = null;
  };

  /* ajuste de la vista previa al espacio disponible */
  const caja = useRef<HTMLDivElement>(null);
  const [tamVista, setTamVista] = useState({ w: 300, h: 500 });
  useEffect(() => {
    if (!caja.current) return;
    const ro = new ResizeObserver(([e]) => setTamVista({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, [p === null]);
  const vista = useMemo(() => {
    if (!p) return { w: 0, h: 0 };
    const f = FORMATOS[p.formato];
    const k = Math.min(tamVista.w / f.ancho, tamVista.h / f.alto);
    return { w: Math.floor(f.ancho * k), h: Math.floor(f.alto * k) };
  }, [p?.formato, tamVista]);

  if (noExiste) {
    return (
      <div className="ed-vacio">
        <Fondo />
        <div className="glass" style={{ padding: 28, textAlign: "center", maxWidth: 420 }}>
          <h2>Proyecto no encontrado</h2>
          <p className="muted small" style={{ margin: "8px 0 16px" }}>Puede que se haya borrado o que esté guardado en otro navegador.</p>
          <button className="btn primary" onClick={() => nav("/video")}>Ver mis videos</button>
        </div>
      </div>
    );
  }
  if (!p) return <div className="loading"><Loader2 className="spin" size={26} /></div>;

  const dur = duracionProyecto(p);
  const medios = p.medios.filter((m) => filtro === "todo" || m.tipo === filtro);
  const medioSel = medioDe(clip);
  const h = historia.current;
  const m = motor.current;

  return (
    <div className="editor">
      <Fondo />
      {/* barra superior */}
      <header className="ed-top">
        <button className="icon-btn" onClick={() => nav("/video")} aria-label="Volver"><ArrowLeft size={18} /></button>
        <input className="ed-nombre" value={p.nombre} aria-label="Nombre del proyecto" onChange={(e) => setP({ ...p, nombre: e.target.value })} />
        <span className="subtle small ed-guardado">{guardado ? <><Check size={12} /> Guardado</> : "Guardando…"}</span>
        <div className="grow" />
        <button className="icon-btn" disabled={!h.atras.length} onClick={deshacer} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><Undo2 size={17} /></button>
        <button className="icon-btn" disabled={!h.adelante.length} onClick={rehacer} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer"><Redo2 size={17} /></button>
        <select className="select ed-formato" value={p.formato} onChange={(e) => aplicar((x) => ({ ...x, formato: e.target.value as Formato }))} aria-label="Formato">
          {(Object.keys(FORMATOS) as Formato[]).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn glow sm" onClick={() => { m?.pause(); setExportar(true); }} disabled={dur <= 0}><Download size={15} /> Exportar</button>
      </header>

      <div className="ed-cuerpo">
        {/* medios y textos */}
        <aside className="ed-panel ed-izq glass">
          <div className="tabs ed-tabs">
            <button className={panel === "medios" ? "on" : ""} onClick={() => setPanel("medios")}><Film size={14} /> Medios</button>
            <button className={panel === "texto" ? "on" : ""} onClick={() => setPanel("texto")}><Type size={14} /> Texto</button>
          </div>
          {panel === "medios" ? (
            <>
              <button className="ed-soltar" onClick={() => archivo.current?.click()}
                onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.currentTarget.classList.add("sobre"); } }}
                onDragLeave={(e) => e.currentTarget.classList.remove("sobre")}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("sobre"); importar(e.dataTransfer.files); }}>
                {importando ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                <b>{importando ? `Importando ${importando}…` : "Importar"}</b>
                <span className="subtle small">Videos, fotos y música · o arrástralos aquí</span>
              </button>
              <input ref={archivo} type="file" hidden multiple accept="video/*,audio/*,image/*" onChange={(e) => { if (e.target.files) importar(e.target.files); e.target.value = ""; }} />
              <div className="ed-filtros">
                {(["todo", "video", "audio", "imagen"] as const).map((f) => (
                  <button key={f} className={`chip ${filtro === f ? "on" : ""}`} onClick={() => setFiltro(f)}>{f === "todo" ? "Todo" : f === "video" ? "Video" : f === "audio" ? "Audio" : "Fotos"}</button>
                ))}
              </div>
              <div className="ed-medios">
                {medios.map((md) => (
                  <div key={md.id} className="ed-medio" draggable onDragStart={(e) => { e.dataTransfer.setData("text/medio", md.id); e.dataTransfer.effectAllowed = "copy"; }}>
                    <div className="ed-medio-img" onDoubleClick={() => agregarMedio(md)}>
                      {md.tipo === "audio" ? <Music size={22} /> : <img src={md.miniatura} alt="" draggable={false} />}
                      {md.tipo !== "imagen" && <span className="ed-medio-dur">{tiempo(md.duracion)}</span>}
                      <button className="ed-medio-mas" onClick={() => agregarMedio(md)} title="Añadir a la línea de tiempo" aria-label="Añadir"><Plus size={14} /></button>
                    </div>
                    <div className="row between gap-4">
                      <span className="ellipsis small" title={md.nombre}>{md.nombre}</span>
                      <div className="row">
                        {md.tieneAudio && <button className="icon-btn xs" title="Extraer audio (WAV)" aria-label="Extraer audio" onClick={() => extraer(md)}><AudioLines size={13} /></button>}
                        <button className="icon-btn xs" title="Quitar del proyecto" aria-label="Quitar" onClick={() => quitarMedio(md)}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!p.medios.length && <p className="subtle small" style={{ textAlign: "center", marginTop: 8 }}>Todo se procesa en tu navegador. Nada se sube.</p>}
            </>
          ) : (
            <div className="stack gap-8">
              {PLANTILLAS_TEXTO.map((t) => (
                <button key={t.nombre} className="ed-plantilla" onClick={() => agregarTexto(t)}>
                  <span style={{ fontFamily: `"${t.estilo.fuente ?? "Geist"}"`, fontWeight: t.estilo.negrita === false ? 500 : 800, color: t.estilo.color ?? "#fff", background: t.estilo.fondo || "transparent", WebkitTextStroke: t.estilo.contorno ? "0.6px #000" : undefined }}>
                    {(t.estilo.contenido ?? "").split("\n")[0]}
                  </span>
                  <small className="subtle">{t.nombre}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* vista previa */}
        <section className="ed-centro">
          <div className="ed-vista" ref={caja}>
            <canvas ref={lienzo} className="ed-lienzo" style={{ width: vista.w, height: vista.h }}
              onPointerDown={bajarLienzo} onPointerMove={moverLienzo} onPointerUp={subirLienzo} onPointerCancel={subirLienzo} />
            {!p.clips.length && (
              <div className="ed-pista-vacia" style={{ width: vista.w, height: vista.h }}>
                <Film size={26} />
                <span className="small">Importa medios y pulsa <b>+</b> para empezar</span>
              </div>
            )}
          </div>
          <div className="ed-controles">
            <span className="mono small ed-tiempo">{tiempo(tActual, true)} <span className="subtle">/ {tiempo(dur, true)}</span></span>
            <div className="row gap-6">
              <button className="icon-btn" onClick={() => m?.seek(0)} aria-label="Al inicio"><SkipBack size={16} /></button>
              <button className="ed-play" onClick={() => m?.alternar()} aria-label={reproduciendo ? "Pausar" : "Reproducir"}>{reproduciendo ? <Pause size={18} /> : <Play size={18} />}</button>
            </div>
            <span className="subtle small ed-atajos">Espacio · S dividir · Supr borrar</span>
          </div>
        </section>

        {/* inspector */}
        <aside className="ed-panel ed-der glass">
          {!clip ? (
            <div className="stack gap-14">
              <h3 className="ed-h">Proyecto</h3>
              <div className="field"><label>Formato</label>
                <select className="select" value={p.formato} onChange={(e) => aplicar((x) => ({ ...x, formato: e.target.value as Formato }))}>
                  {(Object.keys(FORMATOS) as Formato[]).map((f) => <option key={f} value={f}>{FORMATOS[f].nombre}</option>)}
                </select>
              </div>
              <div className="field"><label>Color de fondo</label>
                <div className="row gap-8">
                  {["#000000", "#ffffff", "#7c3aed", "#ec4899", "#0ea5e9", "#16a34a", "#facc15"].map((c) => (
                    <button key={c} className={`ed-color ${p.fondo === c ? "on" : ""}`} style={{ background: c }} onClick={() => aplicar((x) => ({ ...x, fondo: c }))} aria-label={c} />
                  ))}
                  <input type="color" value={p.fondo} onChange={(e) => setP({ ...p, fondo: e.target.value })} aria-label="Otro color" />
                </div>
              </div>
              <div className="ed-ayuda subtle small">
                <p><b>Consejos</b></p>
                <p>Arrastra medios a cualquier pista. La pista principal es magnética: los clips quedan seguidos.</p>
                <p>Selecciona un clip para cortarlo, cambiar su velocidad, volumen, filtros o animación.</p>
                <p>Arrastra en la vista previa para mover textos y superposiciones.</p>
              </div>
            </div>
          ) : (
            <Inspector clip={clip} medio={medioSel} cambiar={cambiarClip} soltar={soltarDeslizador} cambiarTexto={cambiarTexto}
              separarAudio={separarAudio} extraerABiblioteca={extraerABiblioteca} />
          )}
        </aside>
      </div>

      {/* línea de tiempo */}
      <section className="ed-linea glass">
        <div className="ed-herr">
          <button className="btn sm ghost" onClick={dividir} title="Dividir en el cabezal (S)"><Scissors size={15} /> Dividir</button>
          <button className="btn sm ghost" onClick={borrar} disabled={!sel} title="Borrar (Supr)"><Trash2 size={15} /> Borrar</button>
          <button className="btn sm ghost" onClick={duplicar} disabled={!sel} title="Duplicar (Ctrl+D)"><Copy size={15} /> Duplicar</button>
          <button className="btn sm ghost" onClick={separarAudio} disabled={clip?.tipo !== "video"} title="Separar el audio del video"><AudioLines size={15} /> Separar audio</button>
          {clip && esMedia(clip) && (
            <button className="btn sm ghost" onClick={() => cambiarClip({ silenciado: !clip.silenciado })}>{clip.silenciado ? <VolumeX size={15} /> : <Volume2 size={15} />} {clip.silenciado ? "Activar sonido" : "Silenciar"}</button>
          )}
          <div className="grow" />
          <button className={`icon-btn ${iman ? "on" : ""}`} onClick={() => setIman(!iman)} title="Imán: pega los clips a los bordes y al cabezal" aria-label="Imán"><Magnet size={16} /></button>
          <button className="icon-btn" onClick={() => setPps((v) => Math.max(8, v / 1.4))} aria-label="Alejar"><ZoomOut size={16} /></button>
          <input type="range" className="ed-zoom" min={8} max={300} value={pps} onChange={(e) => setPps(Number(e.target.value))} aria-label="Zoom" />
          <button className="icon-btn" onClick={() => setPps((v) => Math.min(300, v * 1.4))} aria-label="Acercar"><ZoomIn size={16} /></button>
        </div>
        {m && (
          <LineaTiempo proyecto={p} motor={m} pps={pps} iman={iman} seleccion={sel} onSeleccion={setSel}
            onCambio={setP} onConfirmar={confirmar}
            onSoltarMedio={(mid, pista, t) => { const md = p.medios.find((x) => x.id === mid); if (md) agregarMedio(md, pista, t); }} />
        )}
      </section>

      {exportar && <Exportar proyecto={p} onCerrar={() => setExportar(false)} />}
    </div>
  );
}

/* ------------------------- inspector del clip ------------------------- */
function Inspector({ clip, medio, cambiar, soltar, cambiarTexto, separarAudio, extraerABiblioteca }: {
  clip: Clip; medio?: Medio;
  cambiar: (c: Partial<Clip>, vivo?: boolean) => void; soltar: () => void;
  cambiarTexto: (c: Partial<EstiloTexto>, vivo?: boolean) => void;
  separarAudio: () => void; extraerABiblioteca: (m: Medio) => void;
}) {
  const visual = clip.tipo !== "audio";
  const tabs = [
    ...(clip.tipo === "texto" ? [{ id: "texto", nombre: "Texto" }] : []),
    ...(visual ? [{ id: "ajustes", nombre: "Ajustes" }] : []),
    ...(esMedia(clip) ? [{ id: "audio", nombre: "Audio" }, { id: "velocidad", nombre: "Velocidad" }] : []),
    ...(clip.tipo === "video" || clip.tipo === "imagen" ? [{ id: "filtros", nombre: "Filtros" }] : []),
    ...(visual ? [{ id: "animacion", nombre: "Animación" }] : []),
  ];
  const [tab, setTab] = useState(tabs[0].id);
  useEffect(() => { if (!tabs.some((t) => t.id === tab)) setTab(tabs[0].id); }, [clip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const actual = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const v = (k: keyof Clip) => (val: number) => cambiar({ [k]: val } as Partial<Clip>, true);
  const icono = clip.tipo === "texto" ? <Type size={14} /> : clip.tipo === "audio" ? <Music size={14} /> : clip.tipo === "imagen" ? <ImageIcon size={14} /> : <Film size={14} />;

  return (
    <div className="stack gap-12">
      <div className="row gap-8 ed-insp-cab">
        <span className="tile-icon sm">{icono}</span>
        <div className="stack grow" style={{ minWidth: 0 }}>
          <b className="ellipsis small">{clip.tipo === "texto" ? "Texto" : medio?.nombre}</b>
          <span className="subtle small">{tiempo(clip.pos, true)} · dura {durClip(clip).toFixed(1)} s</span>
        </div>
      </div>
      <div className="ed-insp-tabs">
        {tabs.map((t) => <button key={t.id} className={actual === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.nombre}</button>)}
      </div>

      {actual === "texto" && clip.texto && (
        <div className="stack gap-12">
          <textarea className="textarea" style={{ minHeight: 80 }} value={clip.texto.contenido} onChange={(e) => cambiarTexto({ contenido: e.target.value }, true)} onBlur={soltar} />
          <div className="field"><label>Fuente</label>
            <select className="select" value={clip.texto.fuente} onChange={(e) => cambiarTexto({ fuente: e.target.value })}>
              {FUENTES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
          </div>
          <Deslizador etiqueta="Tamaño" valor={clip.texto.tamano} min={1.5} max={16} paso={0.1} formato={(x) => x.toFixed(1)} onCambio={(x) => cambiarTexto({ tamano: x }, true)} onSoltar={soltar} />
          <div className="ed-colores">
            <label>Color<input type="color" value={clip.texto.color} onChange={(e) => cambiarTexto({ color: e.target.value }, true)} onBlur={soltar} /></label>
            <label>Fondo<input type="color" value={clip.texto.fondo.startsWith("#") ? clip.texto.fondo : "#000000"} onChange={(e) => cambiarTexto({ fondo: e.target.value }, true)} onBlur={soltar} />
              <input type="checkbox" checked={!!clip.texto.fondo} onChange={(e) => cambiarTexto({ fondo: e.target.checked ? "#000000" : "" })} aria-label="Con fondo" /></label>
            <label>Contorno<input type="color" value={clip.texto.contorno || "#000000"} onChange={(e) => cambiarTexto({ contorno: e.target.value }, true)} onBlur={soltar} />
              <input type="checkbox" checked={!!clip.texto.contorno} onChange={(e) => cambiarTexto({ contorno: e.target.checked ? "#000000" : "" })} aria-label="Con contorno" /></label>
          </div>
          <div className="row gap-8">
            <button className={`btn sm ${clip.texto.negrita ? "primary" : ""}`} onClick={() => cambiarTexto({ negrita: !clip.texto!.negrita })}><b>N</b></button>
            <Segmentos opciones={[{ id: "left" as const, nombre: "Izq." }, { id: "center" as const, nombre: "Centro" }, { id: "right" as const, nombre: "Der." }]} valor={clip.texto.alineacion} onCambio={(a) => cambiarTexto({ alineacion: a })} />
          </div>
          <Deslizador etiqueta="Duración" valor={durClip(clip)} min={0.5} max={30} paso={0.1} formato={seg} onCambio={(x) => cambiar({ salida: clip.entrada + x }, true)} onSoltar={soltar} />
        </div>
      )}

      {actual === "ajustes" && (
        <div className="stack gap-12">
          {clip.tipo !== "texto" && (
            <Segmentos opciones={[{ id: "llenar" as const, nombre: "Llenar" }, { id: "ajustar" as const, nombre: "Ajustar" }]} valor={clip.encaje} onCambio={(e) => cambiar({ encaje: e })} />
          )}
          <Deslizador etiqueta="Escala" valor={clip.escala} min={0.1} max={3} formato={pct} onCambio={v("escala")} onSoltar={soltar} />
          <Deslizador etiqueta="Posición X" valor={clip.x} min={-1} max={1} formato={pct} onCambio={v("x")} onSoltar={soltar} />
          <Deslizador etiqueta="Posición Y" valor={clip.y} min={-1} max={1} formato={pct} onCambio={v("y")} onSoltar={soltar} />
          <Deslizador etiqueta="Rotación" valor={clip.rotacion} min={-180} max={180} paso={1} formato={(x) => `${Math.round(x)}°`} onCambio={v("rotacion")} onSoltar={soltar} />
          <Deslizador etiqueta="Opacidad" valor={clip.opacidad} min={0} max={1} formato={pct} onCambio={v("opacidad")} onSoltar={soltar} />
          {clip.tipo === "imagen" && (
            <Deslizador etiqueta="Duración" valor={durClip(clip)} min={0.5} max={60} paso={0.1} formato={seg} onCambio={(x) => cambiar({ salida: clip.entrada + x }, true)} onSoltar={soltar} />
          )}
          <button className="btn sm" onClick={() => cambiar({ escala: 1, x: 0, y: 0, rotacion: 0, opacidad: 1 })}>Restablecer</button>
        </div>
      )}

      {actual === "audio" && (
        <div className="stack gap-12">
          <Deslizador etiqueta="Volumen" valor={clip.volumen} min={0} max={2} formato={pct} onCambio={v("volumen")} onSoltar={soltar} />
          <label className="row gap-8 small"><input type="checkbox" checked={clip.silenciado} onChange={(e) => cambiar({ silenciado: e.target.checked })} /> Silenciar este clip</label>
          <Deslizador etiqueta="Aparecer (fade in)" valor={clip.fadeIn} min={0} max={Math.min(10, durClip(clip) / 2)} paso={0.1} formato={seg} onCambio={v("fadeIn")} onSoltar={soltar} />
          <Deslizador etiqueta="Desaparecer (fade out)" valor={clip.fadeOut} min={0} max={Math.min(10, durClip(clip) / 2)} paso={0.1} formato={seg} onCambio={v("fadeOut")} onSoltar={soltar} />
          {clip.tipo === "video" && medio?.tieneAudio && (
            <>
              <button className="btn sm" onClick={separarAudio}><AudioLines size={14} /> Separar audio a su pista</button>
              <button className="btn sm" onClick={() => extraerABiblioteca(medio)}><Music size={14} /> Extraer audio a la biblioteca</button>
            </>
          )}
          {medio && !medio.tieneAudio && <p className="subtle small">Este archivo no tiene sonido.</p>}
        </div>
      )}

      {actual === "velocidad" && (
        <div className="stack gap-12">
          <div className="ed-velocidades">
            {VELOCIDADES.map((x) => <button key={x} className={clip.velocidad === x ? "on" : ""} onClick={() => cambiar({ velocidad: x })}>{x}x</button>)}
          </div>
          <Deslizador etiqueta="Velocidad" valor={clip.velocidad} min={0.1} max={8} paso={0.05} formato={(x) => `${x.toFixed(2)}x`} onCambio={v("velocidad")} onSoltar={soltar} />
          <p className="subtle small">Duración resultante: {durClip(clip).toFixed(1)} s. El tono del audio cambia con la velocidad, como en cámara rápida.</p>
        </div>
      )}

      {actual === "filtros" && (
        <div className="stack gap-12">
          <div className="ed-presets">
            {PRESETS_FILTRO.map((f) => (
              <button key={f.nombre} onClick={() => cambiar({ filtros: { ...f.f } })} className={JSON.stringify(f.f) === JSON.stringify(clip.filtros) ? "on" : ""}>
                <span style={{ backgroundImage: medio?.miniatura ? `url(${medio.miniatura})` : undefined, filter: `brightness(${f.f.brillo}) contrast(${f.f.contraste}) saturate(${f.f.saturacion}) hue-rotate(${f.f.tono}deg)` }} />
                <small>{f.nombre}</small>
              </button>
            ))}
          </div>
          <Deslizador etiqueta="Brillo" valor={clip.filtros.brillo} min={0.3} max={1.8} formato={pct} onCambio={(x) => cambiar({ filtros: { ...clip.filtros, brillo: x } }, true)} onSoltar={soltar} />
          <Deslizador etiqueta="Contraste" valor={clip.filtros.contraste} min={0.3} max={2} formato={pct} onCambio={(x) => cambiar({ filtros: { ...clip.filtros, contraste: x } }, true)} onSoltar={soltar} />
          <Deslizador etiqueta="Saturación" valor={clip.filtros.saturacion} min={0} max={2.5} formato={pct} onCambio={(x) => cambiar({ filtros: { ...clip.filtros, saturacion: x } }, true)} onSoltar={soltar} />
          <Deslizador etiqueta="Tono" valor={clip.filtros.tono} min={-180} max={180} paso={1} formato={(x) => `${Math.round(x)}°`} onCambio={(x) => cambiar({ filtros: { ...clip.filtros, tono: x } }, true)} onSoltar={soltar} />
          <Deslizador etiqueta="Desenfoque" valor={clip.filtros.desenfoque} min={0} max={20} paso={0.5} formato={(x) => `${x} px`} onCambio={(x) => cambiar({ filtros: { ...clip.filtros, desenfoque: x } }, true)} onSoltar={soltar} />
          <button className="btn sm" onClick={() => cambiar({ filtros: { ...FILTROS_BASE } })}>Quitar filtros</button>
        </div>
      )}

      {actual === "animacion" && (
        <div className="stack gap-12">
          <div className="field"><label>Entrada</label><Segmentos opciones={ANIMACIONES} valor={clip.animEntrada} onCambio={(a) => cambiar({ animEntrada: a })} /></div>
          <div className="field"><label>Salida</label><Segmentos opciones={ANIMACIONES} valor={clip.animSalida} onCambio={(a) => cambiar({ animSalida: a })} /></div>
          {clip.tipo !== "texto" && (
            <>
              <Deslizador etiqueta="Fundido al entrar" valor={clip.fadeIn} min={0} max={Math.min(5, durClip(clip) / 2)} paso={0.1} formato={seg} onCambio={v("fadeIn")} onSoltar={soltar} />
              <Deslizador etiqueta="Fundido al salir" valor={clip.fadeOut} min={0} max={Math.min(5, durClip(clip) / 2)} paso={0.1} formato={seg} onCambio={v("fadeOut")} onSoltar={soltar} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
