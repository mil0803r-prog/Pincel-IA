import { crearApiDemo } from "./demo";
import { ajustar, fijarLimiteSubida } from "./subida";

export type Imagen = {
  id: string;
  campana_id: string;
  n: number;
  url: string;
  miniatura: string;
  ruta: string;
  ruta_miniatura: string;
  ancho: number;
  alto: number;
  bytes: number;
  origen: "chatgpt" | "app" | string;
  creado: string;
  campana_nombre?: string;
  prompt?: string;
};

export type CampanaResumen = {
  id: string;
  nombre: string;
  notas: string;
  origen: "claude" | "app" | string;
  creado: string;
  actualizado: string;
  total: number;
  hechas: number;
  portada: Imagen | null;
  miniaturas: string[];
};

export type Prompt = { n: number; texto: string; imagen: Imagen | null };
export type Referencia = { id: string; url: string; ruta: string; ruta_miniatura: string; ancho: number; alto: number };
export type Campana = CampanaResumen & { prompts: Prompt[]; referencias: Referencia[] };

export type Resumen = {
  campanas: number;
  imagenes: number;
  pendientes: number;
  imagenes_semana: number;
  bytes: number;
  recientes: CampanaResumen[];
  actividad: { dia: string; imagenes: number }[];
  ultimas: Imagen[];
};

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const r = await fetch(url, { credentials: "same-origin", ...init, headers: { ...headers, ...(init.headers || {}) } });
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith("/login")) window.dispatchEvent(new Event("pincel:salir"));
  if (!r.ok) throw new ApiError(datos.error || `Error ${r.status}`, r.status);
  return datos as T;
}

const json = (body: unknown) => JSON.stringify(body);

const apiReal = {
  sesion: async () => {
    const s = await pedir<{ autenticado: boolean; limite_subida?: number }>("/api/sesion");
    fijarLimiteSubida(s.limite_subida || 0);
    return s;
  },
  login: (clave: string) => pedir("/api/login", { method: "POST", body: json({ clave }) }),
  logout: () => pedir("/api/logout", { method: "POST" }),
  resumen: () => pedir<Resumen>("/api/resumen"),
  conexion: () => pedir<{ url_mcp: string; url_publica: string }>("/api/conexion"),
  campanas: (q = "") => pedir<CampanaResumen[]>(`/api/campanas${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  campana: (id: string) => pedir<Campana>(`/api/campanas/${id}`),
  crearCampana: (nombre: string, prompts: string, notas: string) =>
    pedir<Campana>("/api/campanas", { method: "POST", body: json({ nombre, prompts, notas }) }),
  editarCampana: (id: string, cambios: { nombre?: string; notas?: string }) =>
    pedir<Campana>(`/api/campanas/${id}`, { method: "PATCH", body: json(cambios) }),
  eliminarCampana: (id: string) => pedir(`/api/campanas/${id}`, { method: "DELETE" }),
  agregarPrompts: (id: string, prompts: string) =>
    pedir<Campana>(`/api/campanas/${id}/prompts`, { method: "POST", body: json({ prompts }) }),
  editarPrompt: (id: string, n: number, texto: string) =>
    pedir<Campana>(`/api/campanas/${id}/prompts/${n}`, { method: "PATCH", body: json({ texto }) }),
  /** Cada referencia va en su propia petición: así nunca se pasa del límite de tamaño del servidor. */
  subirReferencias: async (id: string, archivos: File[]) => {
    let c!: Campana;
    for (const f of archivos) {
      const fd = new FormData();
      fd.append("archivo", await ajustar(f));
      c = await pedir<Campana>(`/api/campanas/${id}/referencias`, { method: "POST", body: fd });
    }
    return c;
  },
  quitarReferencia: (id: string, rid: string) => pedir<Campana>(`/api/campanas/${id}/referencias/${rid}`, { method: "DELETE" }),
  quitarImagen: (id: string, n: number) => pedir<Campana>(`/api/campanas/${id}/prompts/${n}/imagen`, { method: "DELETE" }),
  subirImagenes: (id: string, archivos: File[], n?: number) => {
    const fd = new FormData();
    if (n) fd.append("n", String(n));
    archivos.forEach((f) => fd.append("archivo", f));
    return pedir<{ subidas: number; errores: { archivo: string; error: string }[] }>(`/api/campanas/${id}/imagenes`, {
      method: "POST",
      body: fd,
    });
  },
  imagenes: (campana?: string, desde = 0, limite = 60) => {
    const q = new URLSearchParams({ desde: String(desde), limite: String(limite) });
    if (campana) q.set("campana", campana);
    return pedir<{ imagenes: Imagen[]; total: number; siguiente: number | null }>(`/api/imagenes?${q}`);
  },
};

/** Separa un bloque de texto en prompts (igual que el servidor): por líneas en blanco o líneas numeradas. */
export function separarPrompts(texto: string): string[] {
  const t = texto.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  let bloques = t.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (bloques.length === 1) {
    const lineas = t.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lineas.length > 1) bloques = lineas;
  }
  return bloques
    .map((b) => b.replace(/^\s*(?:prompt\s*)?(?:imagen\s*)?#?\d+\s*[.):\-–]\s*/i, ""))
    .filter(Boolean);
}

export const urlPublica = (ruta: string) => `${window.location.origin}${ruta}`;

export function fecha(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export function peso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** Modo demo (compilado con `npm run build:demo`): todo funciona en el navegador con datos de ejemplo. */
export const DEMO = Boolean(import.meta.env.VITE_DEMO);

type Api = typeof apiReal & { simularChatGPT?: (id: string) => Promise<boolean> };
export const api: Api = DEMO ? (crearApiDemo(separarPrompts) as unknown as Api) : apiReal;
