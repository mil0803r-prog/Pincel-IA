/** Importar archivos al editor: medidas, miniaturas, tira de fotogramas, forma de onda y audio decodificado. */
import { uid, type Medio, type TipoMedio } from "./tipos";

let ctxDecodificar: AudioContext | null = null;
const contexto = () => (ctxDecodificar ??= new AudioContext());

/** Audio decodificado por medio (se reutiliza para la forma de onda, la mezcla y la extracción). */
const buffers = new Map<string, Promise<AudioBuffer | null>>();
export function bufferDe(m: Medio): Promise<AudioBuffer | null> {
  if (m.tipo === "imagen") return Promise.resolve(null);
  let p = buffers.get(m.id);
  if (!p) {
    p = fetch(m.url)
      .then((r) => r.arrayBuffer())
      .then((ab) => contexto().decodeAudioData(ab))
      .catch(() => null);
    buffers.set(m.id, p);
  }
  return p;
}
export const olvidarBuffer = (id: string) => buffers.delete(id);

function tipoDe(f: File): TipoMedio | null {
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("audio/")) return "audio";
  if (f.type.startsWith("image/")) return "imagen";
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "opus", "flac"].includes(ext)) return "audio";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "imagen";
  return null;
}

const esperar = (el: HTMLMediaElement, evento: string, ms = 15000) =>
  new Promise<void>((ok, mal) => {
    const t = setTimeout(() => mal(new Error("El archivo tardó demasiado en cargar.")), ms);
    el.addEventListener(evento, () => { clearTimeout(t); ok(); }, { once: true });
    el.addEventListener("error", () => { clearTimeout(t); mal(new Error("El navegador no puede leer este archivo.")); }, { once: true });
  });

/** Algunos videos grabados en el navegador no traen la duración: se fuerza buscando al final. */
async function duracionReal(v: HTMLVideoElement | HTMLAudioElement): Promise<number> {
  if (isFinite(v.duration) && v.duration > 0) return v.duration;
  await new Promise<void>((ok) => {
    const listo = () => { if (isFinite(v.duration)) { v.removeEventListener("durationchange", listo); ok(); } };
    v.addEventListener("durationchange", listo);
    v.currentTime = 1e7;
    setTimeout(ok, 4000);
  });
  const d = isFinite(v.duration) ? v.duration : 0;
  v.currentTime = 0;
  return d;
}

async function fotograma(v: HTMLVideoElement, t: number, ancho: number): Promise<string> {
  v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05));
  await esperar(v, "seeked", 8000).catch(() => {});
  const c = document.createElement("canvas");
  const r = v.videoWidth && v.videoHeight ? v.videoHeight / v.videoWidth : 9 / 16;
  c.width = ancho;
  c.height = Math.max(1, Math.round(ancho * r));
  c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

export function picosDe(b: AudioBuffer, n = 800): number[] {
  const canales = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
  const tam = Math.max(1, Math.floor(b.length / n));
  const picos: number[] = [];
  let max = 0;
  for (let i = 0; i < n; i++) {
    let p = 0;
    const ini = i * tam;
    for (let j = ini; j < Math.min(ini + tam, b.length); j += 16) for (const c of canales) p = Math.max(p, Math.abs(c[j]));
    picos.push(p);
    max = Math.max(max, p);
  }
  return max > 0 ? picos.map((p) => p / max) : picos;
}

export async function importarArchivo(f: File): Promise<Medio> {
  const tipo = tipoDe(f);
  if (!tipo) throw new Error(`${f.name}: formato no admitido (usa video, audio o imagen).`);
  const url = URL.createObjectURL(f);
  const medio: Medio = { id: uid(), nombre: f.name, tipo, url, duracion: 0, ancho: 0, alto: 0, tieneAudio: false, miniatura: "", tira: [], picos: [], peso: f.size };
  try {
    if (tipo === "imagen") {
      const img = new Image();
      img.src = url;
      await img.decode();
      medio.ancho = img.naturalWidth;
      medio.alto = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = 240;
      c.height = Math.max(1, Math.round((240 * img.naturalHeight) / img.naturalWidth));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      medio.miniatura = c.toDataURL("image/jpeg", 0.75);
      medio.tira = [medio.miniatura];
      return medio;
    }
    if (tipo === "video") {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.playsInline = true;
      v.src = url;
      await esperar(v, "loadedmetadata");
      medio.duracion = await duracionReal(v);
      medio.ancho = v.videoWidth;
      medio.alto = v.videoHeight;
      medio.miniatura = await fotograma(v, Math.min(0.5, medio.duracion / 3), 240);
      const n = Math.min(12, Math.max(3, Math.round(medio.duracion / 2)));
      for (let i = 0; i < n; i++) medio.tira.push(await fotograma(v, (medio.duracion * (i + 0.5)) / n, 120));
      v.removeAttribute("src");
      v.load();
    } else {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.src = url;
      await esperar(a, "loadedmetadata").catch(() => {});
      medio.duracion = await duracionReal(a);
    }
    const b = await bufferDe(medio);
    if (b) {
      medio.picos = picosDe(b);
      medio.tieneAudio = medio.picos.some((p) => p > 0.01);
      if (!medio.duracion) medio.duracion = b.duration;
    }
    if (!medio.duracion) throw new Error(`${f.name}: no se pudo leer la duración.`);
    return medio;
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** Codifica audio como WAV (PCM de 16 bits): calidad sin pérdidas, lo abre cualquier programa. */
export function wavDe(b: AudioBuffer): Blob {
  const canales = Math.min(2, b.numberOfChannels);
  const muestras = b.length;
  const datos = new DataView(new ArrayBuffer(44 + muestras * canales * 2));
  const txt = (o: number, s: string) => [...s].forEach((ch, i) => datos.setUint8(o + i, ch.charCodeAt(0)));
  txt(0, "RIFF"); datos.setUint32(4, 36 + muestras * canales * 2, true); txt(8, "WAVE"); txt(12, "fmt ");
  datos.setUint32(16, 16, true); datos.setUint16(20, 1, true); datos.setUint16(22, canales, true);
  datos.setUint32(24, b.sampleRate, true); datos.setUint32(28, b.sampleRate * canales * 2, true);
  datos.setUint16(32, canales * 2, true); datos.setUint16(34, 16, true); txt(36, "data"); datos.setUint32(40, muestras * canales * 2, true);
  const ch = Array.from({ length: canales }, (_, i) => b.getChannelData(i));
  let o = 44;
  for (let i = 0; i < muestras; i++) {
    for (let c = 0; c < canales; c++) {
      const s = Math.max(-1, Math.min(1, ch[c][i]));
      datos.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([datos.buffer], { type: "audio/wav" });
}

/** Extrae el audio de un video (o de un audio) como WAV. */
export async function extraerAudio(m: Medio): Promise<Blob> {
  const b = await bufferDe(m);
  if (!b || !m.tieneAudio) throw new Error("Este archivo no tiene audio, o el navegador no puede leerlo.");
  return wavDe(b);
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export const sinExtension = (n: string) => n.replace(/\.[^.]+$/, "");
