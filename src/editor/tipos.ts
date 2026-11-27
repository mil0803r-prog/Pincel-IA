/** Modelo del editor de video: proyecto, medios, pistas y clips. Todo vive en el navegador. */

export type TipoMedio = "video" | "audio" | "imagen";
export type Medio = {
  id: string;
  nombre: string;
  tipo: TipoMedio;
  url: string; // blob: del archivo (no se guarda; se recrea al abrir)
  duracion: number; // segundos (imágenes: 0)
  ancho: number;
  alto: number;
  tieneAudio: boolean;
  miniatura: string; // dataURL pequeña
  tira: string[]; // fotogramas para la línea de tiempo (video)
  picos: number[]; // forma de onda normalizada 0..1 (audio y video con audio)
  peso: number;
};

export type PistaId = "texto" | "superposicion" | "principal" | "audio1" | "audio2";
export const PISTAS: { id: PistaId; nombre: string; acepta: TipoClip[] }[] = [
  { id: "texto", nombre: "Texto", acepta: ["texto"] },
  { id: "superposicion", nombre: "Superposición", acepta: ["video", "imagen"] },
  { id: "principal", nombre: "Video principal", acepta: ["video", "imagen"] },
  { id: "audio1", nombre: "Audio 1", acepta: ["audio"] },
  { id: "audio2", nombre: "Audio 2", acepta: ["audio"] },
];

export type TipoClip = "video" | "audio" | "imagen" | "texto";
export type Animacion = "ninguna" | "fundido" | "subir" | "zoom";
export type Filtros = { brillo: number; contraste: number; saturacion: number; desenfoque: number; tono: number };
export type EstiloTexto = {
  contenido: string;
  fuente: string;
  tamano: number; // en % del alto del lienzo
  color: string;
  fondo: string; // "" = sin fondo
  contorno: string; // "" = sin contorno
  negrita: boolean;
  alineacion: "left" | "center" | "right";
};

export type Clip = {
  id: string;
  pista: PistaId;
  tipo: TipoClip;
  medioId: string | null;
  pos: number; // inicio en la línea de tiempo (s)
  entrada: number; // inicio dentro del archivo (s)
  salida: number; // fin dentro del archivo (s); imágenes y texto: entrada + duración
  velocidad: number;
  volumen: number; // 0..2
  silenciado: boolean;
  fadeIn: number; // s
  fadeOut: number; // s
  opacidad: number; // 0..1
  escala: number; // 1 = encaje
  x: number; // desplazamiento del centro, fracción del ancho (-1..1)
  y: number;
  rotacion: number; // grados
  encaje: "ajustar" | "llenar";
  filtros: Filtros;
  animEntrada: Animacion;
  animSalida: Animacion;
  texto: EstiloTexto | null;
};

export type Formato = "9:16" | "16:9" | "1:1" | "4:5";
export const FORMATOS: Record<Formato, { ancho: number; alto: number; nombre: string }> = {
  "9:16": { ancho: 1080, alto: 1920, nombre: "Vertical 9:16 · Estados, TikTok, Reels" },
  "16:9": { ancho: 1920, alto: 1080, nombre: "Horizontal 16:9 · YouTube" },
  "1:1": { ancho: 1080, alto: 1080, nombre: "Cuadrado 1:1 · Feed" },
  "4:5": { ancho: 1080, alto: 1350, nombre: "Retrato 4:5 · Instagram" },
};

export type Proyecto = {
  id: string;
  nombre: string;
  formato: Formato;
  fondo: string;
  medios: Medio[];
  clips: Clip[];
  creado: string;
  actualizado: string;
};

export const FILTROS_BASE: Filtros = { brillo: 1, contraste: 1, saturacion: 1, desenfoque: 0, tono: 0 };
export const PRESETS_FILTRO: { nombre: string; f: Filtros }[] = [
  { nombre: "Original", f: FILTROS_BASE },
  { nombre: "Vívido", f: { brillo: 1.05, contraste: 1.15, saturacion: 1.4, desenfoque: 0, tono: 0 } },
  { nombre: "Cálido", f: { brillo: 1.05, contraste: 1.05, saturacion: 1.15, desenfoque: 0, tono: -12 } },
  { nombre: "Frío", f: { brillo: 1, contraste: 1.05, saturacion: 0.95, desenfoque: 0, tono: 18 } },
  { nombre: "B/N", f: { brillo: 1.05, contraste: 1.2, saturacion: 0, desenfoque: 0, tono: 0 } },
  { nombre: "Suave", f: { brillo: 1.08, contraste: 0.9, saturacion: 0.9, desenfoque: 0, tono: 0 } },
  { nombre: "Drama", f: { brillo: 0.95, contraste: 1.35, saturacion: 1.1, desenfoque: 0, tono: 0 } },
];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Duración del clip en la línea de tiempo (la velocidad acorta o alarga). */
export const durClip = (c: Clip) => (c.salida - c.entrada) / (c.tipo === "video" || c.tipo === "audio" ? c.velocidad : 1);
export const finClip = (c: Clip) => c.pos + durClip(c);
export const duracionProyecto = (p: Proyecto) => p.clips.reduce((m, c) => Math.max(m, finClip(c)), 0);

export function nuevoClip(tipo: TipoClip, pista: PistaId, pos: number, medio?: Medio, duracion = 4): Clip {
  const base = tipo === "video" || tipo === "audio" ? medio?.duracion ?? duracion : duracion;
  return {
    id: uid(), pista, tipo, medioId: medio?.id ?? null, pos, entrada: 0, salida: base, velocidad: 1, volumen: 1, silenciado: false,
    fadeIn: 0, fadeOut: 0, opacidad: 1, escala: 1, x: 0, y: 0, rotacion: 0, encaje: pista === "principal" ? "llenar" : "ajustar",
    filtros: { ...FILTROS_BASE }, animEntrada: tipo === "texto" ? "fundido" : "ninguna", animSalida: "ninguna", texto: null,
  };
}

export const TEXTO_BASE: EstiloTexto = {
  contenido: "Tu texto aquí", fuente: "Geist", tamano: 6, color: "#ffffff", fondo: "", contorno: "#000000", negrita: true, alineacion: "center",
};

/** La pista principal es "magnética" (como en CapCut): sus clips van seguidos, sin huecos, en orden. */
export function compactarPrincipal(clips: Clip[]): Clip[] {
  const principales = clips.filter((c) => c.pista === "principal").sort((a, b) => a.pos - b.pos);
  let t = 0;
  const nuevos = new Map<string, number>();
  for (const c of principales) {
    nuevos.set(c.id, t);
    t += durClip(c);
  }
  return clips.map((c) => (nuevos.has(c.id) ? { ...c, pos: nuevos.get(c.id)! } : c));
}

export function tiempo(s: number, conFrames = false): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const seg = Math.floor(s % 60);
  const base = `${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
  return conFrames ? `${base}.${String(Math.floor((s % 1) * 30)).padStart(2, "0")}` : base;
}

export const filtroCss = (f: Filtros) =>
  `brightness(${f.brillo}) contrast(${f.contraste}) saturate(${f.saturacion}) hue-rotate(${f.tono}deg)${f.desenfoque ? ` blur(${f.desenfoque}px)` : ""}`;
