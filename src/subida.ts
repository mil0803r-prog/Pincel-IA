/**
 * Preparación de archivos para subir.
 *
 * Algunos hostings (Vercel) rechazan peticiones de más de ~4,5 MB. Cuando el servidor informa un límite,
 * las imágenes pesadas se reducen en el navegador y se reparten en tandas que caben en ese límite.
 */
import { zipSync } from "fflate";
import type { Campana } from "./api";

let limite = 0;
export const fijarLimiteSubida = (bytes: number) => { limite = bytes || 0; };
export const limiteSubida = () => limite;

/** Reduce una imagen (WebP) hasta que pese menos que el límite. Si ya cabe, la devuelve igual. */
export async function ajustar(f: File): Promise<File> {
  if (!limite || f.size <= limite) return f;
  const bmp = await createImageBitmap(f);
  let escala = 1;
  for (let i = 0; i < 7; i++) {
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    for (const calidad of [0.92, 0.82]) {
      const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/webp", calidad));
      if (blob && blob.size <= limite) {
        return new File([blob], f.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
      }
    }
    escala *= 0.8;
  }
  bmp.close();
  throw new Error(`${f.name} es demasiado pesada`);
}

/** Ajusta cada archivo y los agrupa en tandas cuyo peso total cabe en el límite (o de a 8 si no hay límite). */
export async function prepararTandas(files: File[], alAjustar?: (hechas: number) => void): Promise<{ tandas: File[][]; fallos: { archivo: string; error: string }[] }> {
  const listos: File[] = [];
  const fallos: { archivo: string; error: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      listos.push(await ajustar(files[i]));
    } catch (e) {
      fallos.push({ archivo: files[i].name, error: (e as Error).message });
    }
    alAjustar?.(i + 1);
  }
  const tandas: File[][] = [];
  if (!limite) {
    for (let i = 0; i < listos.length; i += 8) tandas.push(listos.slice(i, i + 8));
    return { tandas, fallos };
  }
  const tope = limite * 0.9; // margen para el encabezado del formulario
  let actual: File[] = [];
  let peso = 0;
  for (const f of listos) {
    if (actual.length && peso + f.size > tope) {
      tandas.push(actual);
      actual = [];
      peso = 0;
    }
    actual.push(f);
    peso += f.size;
  }
  if (actual.length) tandas.push(actual);
  return { tandas, fallos };
}

/**
 * Descarga una campaña en ZIP armado en el navegador (el servidor no puede devolver archivos grandes en Vercel).
 */
export async function descargarZip(c: Campana, progreso?: (hechas: number, total: number) => void): Promise<void> {
  const hechas = c.prompts.filter((p) => p.imagen);
  const archivos: Record<string, Uint8Array> = {};
  let i = 0;
  for (const p of hechas) {
    const r = await fetch(p.imagen!.ruta);
    if (!r.ok) throw new Error(`No se pudo descargar la imagen ${p.n}`);
    const ext = p.imagen!.ruta.split(".").pop() || "png";
    archivos[`${String(p.n).padStart(2, "0")}.${ext}`] = new Uint8Array(await r.arrayBuffer());
    progreso?.(++i, hechas.length);
  }
  archivos["prompts.txt"] = new TextEncoder().encode(c.prompts.map((p) => `#${p.n}\n${p.texto}`).join("\n\n"));
  const zip = zipSync(archivos, { level: 0 });
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.nombre.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "campana"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
