/** Exportar: mezcla de audio (exacta, fuera de tiempo real), video MP4/WebM y audio WAV. */
import { bufferDe, wavDe } from "./medios";
import { Motor } from "./motor";
import { duracionProyecto, finClip, FORMATOS, type Proyecto } from "./tipos";

/** Mezcla todas las pistas con audio (videos sin silenciar y audios) respetando volumen, fundidos, velocidad y recortes. */
export async function mezclarAudio(p: Proyecto, sr = 48000): Promise<AudioBuffer | null> {
  const dur = duracionProyecto(p);
  if (dur <= 0) return null;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  let algo = false;
  for (const c of p.clips) {
    if (c.tipo !== "video" && c.tipo !== "audio") continue;
    if (c.silenciado || c.volumen <= 0) continue;
    const m = p.medios.find((x) => x.id === c.medioId);
    if (!m || !m.tieneAudio) continue;
    const b = await bufferDe(m);
    if (!b) continue;
    const fin = finClip(c);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = c.velocidad;
    const g = ctx.createGain();
    const v = c.volumen;
    if (c.fadeIn > 0) {
      g.gain.setValueAtTime(0, c.pos);
      g.gain.linearRampToValueAtTime(v, c.pos + c.fadeIn);
    } else {
      g.gain.setValueAtTime(v, c.pos);
    }
    if (c.fadeOut > 0) {
      g.gain.setValueAtTime(v, Math.max(c.pos, fin - c.fadeOut));
      g.gain.linearRampToValueAtTime(0, fin);
    }
    src.connect(g).connect(ctx.destination);
    src.start(c.pos, c.entrada, Math.max(0.01, c.salida - c.entrada));
    algo = true;
  }
  if (!algo) return null;
  return ctx.startRendering();
}

export async function exportarAudio(p: Proyecto): Promise<Blob> {
  const b = await mezclarAudio(p);
  if (!b) throw new Error("El proyecto no tiene audio para exportar.");
  return wavDe(b);
}

export type Calidad = 720 | 1080;
const TIPOS_VIDEO = [
  { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
  { mime: "video/mp4;codecs=avc1,mp4a.40.2", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
];
export const formatoSalida = () => TIPOS_VIDEO.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t.mime)) ?? null;

export function medidasSalida(p: Proyecto, calidad: Calidad) {
  const f = FORMATOS[p.formato];
  const k = calidad / Math.min(f.ancho, f.alto);
  const par = (n: number) => Math.round((n * k) / 2) * 2; // los códecs piden medidas pares
  return { ancho: par(f.ancho), alto: par(f.alto) };
}

/**
 * Graba el proyecto completo reproduciéndolo en un lienzo oculto (tarda lo mismo que dura el video).
 * El audio va mezclado aparte y se reproduce sincronizado con la grabación.
 */
export async function exportarVideo(
  p: Proyecto,
  calidad: Calidad,
  onProgreso: (fraccion: number) => void,
  senal: AbortSignal,
): Promise<{ blob: Blob; ext: string }> {
  const salida = formatoSalida();
  if (!salida) throw new Error("Este navegador no puede exportar video. Usa Chrome o Edge en una computadora.");
  const dur = duracionProyecto(p);
  if (dur <= 0) throw new Error("La línea de tiempo está vacía.");
  const { ancho, alto } = medidasSalida(p, calidad);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const motor = new Motor(lienzo, { silencio: true });
  motor.setProyecto(p);
  await motor.precargar();
  motor.seek(0);

  const mezcla = await mezclarAudio(p);
  const ac = new AudioContext();
  await ac.resume().catch(() => {});
  const destino = ac.createMediaStreamDestination();
  const fps = 30;
  const stream = lienzo.captureStream(fps);
  let fuente: AudioBufferSourceNode | null = null;
  if (mezcla) {
    fuente = ac.createBufferSource();
    fuente.buffer = mezcla;
    fuente.connect(destino);
    destino.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const rec = new MediaRecorder(stream, {
    mimeType: salida.mime,
    videoBitsPerSecond: calidad >= 1080 ? 10_000_000 : 6_000_000,
    audioBitsPerSecond: 192_000,
  });
  const trozos: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
  const terminado = new Promise<void>((ok) => { rec.onstop = () => ok(); });

  const limpiar = () => {
    quitar();
    motor.destruir();
    stream.getTracks().forEach((t) => t.stop());
    ac.close().catch(() => {});
  };
  const quitar = motor.suscribir((t) => onProgreso(Math.min(1, t / dur)));
  const abortar = () => { motor.pause(); if (rec.state !== "inactive") rec.stop(); };
  senal.addEventListener("abort", abortar, { once: true });
  motor.onFin = () => { setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 250); };

  rec.start(250);
  fuente?.start();
  motor.play();
  await terminado;
  senal.removeEventListener("abort", abortar);
  limpiar();
  if (senal.aborted) throw new DOMException("Exportación cancelada", "AbortError");
  onProgreso(1);
  return { blob: new Blob(trozos, { type: salida.mime.split(";")[0] }), ext: salida.ext };
}
