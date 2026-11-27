/** Guarda los proyectos de video en este navegador (IndexedDB): el proyecto y los archivos originales. */
import type { Medio, Proyecto } from "./tipos";

const BD = "pincel-video";
let bd: Promise<IDBDatabase> | null = null;
const memoria = { proyectos: new Map<string, Proyecto>(), archivos: new Map<string, Blob>() }; // si IndexedDB no está disponible

function abrir(): Promise<IDBDatabase> {
  if (!bd) {
    bd = new Promise((ok, mal) => {
      try {
        const r = indexedDB.open(BD, 1);
        r.onupgradeneeded = () => {
          r.result.createObjectStore("proyectos", { keyPath: "id" });
          r.result.createObjectStore("archivos");
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      } catch (e) {
        mal(e);
      }
    });
  }
  return bd;
}

function op<T>(almacen: string, modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((ok, mal) => {
        const r = f(db.transaction(almacen, modo).objectStore(almacen));
        r.onsuccess = () => ok(r.result as T);
        r.onerror = () => mal(r.error);
      }),
  );
}

const sinUrls = (p: Proyecto): Proyecto => ({ ...p, medios: p.medios.map((m) => ({ ...m, url: "" })) });

export async function guardarProyecto(p: Proyecto): Promise<void> {
  const limpio = sinUrls({ ...p, actualizado: new Date().toISOString() });
  try {
    await op("proyectos", "readwrite", (s) => s.put(limpio));
  } catch {
    memoria.proyectos.set(p.id, limpio);
  }
}

export async function guardarArchivo(id: string, blob: Blob): Promise<void> {
  try {
    await op("archivos", "readwrite", (s) => s.put(blob, id));
  } catch {
    memoria.archivos.set(id, blob);
  }
}

export async function listarProyectos(): Promise<Proyecto[]> {
  let lista: Proyecto[];
  try {
    lista = await op<Proyecto[]>("proyectos", "readonly", (s) => s.getAll());
  } catch {
    lista = [...memoria.proyectos.values()];
  }
  return lista.sort((a, b) => (a.actualizado < b.actualizado ? 1 : -1));
}

/** Abre un proyecto y vuelve a crear los enlaces a sus archivos. Los medios cuyo archivo falte se descartan. */
export async function cargarProyecto(id: string): Promise<Proyecto | null> {
  let p: Proyecto | undefined;
  try {
    p = await op<Proyecto | undefined>("proyectos", "readonly", (s) => s.get(id));
  } catch {
    p = memoria.proyectos.get(id);
  }
  if (!p) return null;
  const medios: Medio[] = [];
  for (const m of p.medios) {
    let blob: Blob | undefined;
    try {
      blob = await op<Blob | undefined>("archivos", "readonly", (s) => s.get(m.id));
    } catch {
      blob = memoria.archivos.get(m.id);
    }
    if (blob) medios.push({ ...m, url: URL.createObjectURL(blob) });
  }
  const ids = new Set(medios.map((m) => m.id));
  return { ...p, medios, clips: p.clips.filter((c) => !c.medioId || ids.has(c.medioId)) };
}

export async function borrarProyecto(p: Proyecto): Promise<void> {
  try {
    await op("proyectos", "readwrite", (s) => s.delete(p.id));
    for (const m of p.medios) await op("archivos", "readwrite", (s) => s.delete(m.id));
  } catch {
    memoria.proyectos.delete(p.id);
    p.medios.forEach((m) => memoria.archivos.delete(m.id));
  }
}

export async function borrarArchivo(id: string): Promise<void> {
  try {
    await op("archivos", "readwrite", (s) => s.delete(id));
  } catch {
    memoria.archivos.delete(id);
  }
}
