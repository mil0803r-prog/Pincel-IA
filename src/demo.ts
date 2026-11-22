/**
 * Modo demo: la misma app funcionando 100% en el navegador, con datos de ejemplo
 * en memoria (sin servidor). Se activa al compilar con `npm run build:demo`.
 */
import type { Campana, CampanaResumen, Imagen, Prompt, Referencia, Resumen } from "./api";

type Producto = "frasco" | "perfume" | "zapatilla" | "taza" | "regalo";

/* ---------------- ilustraciones de ejemplo (SVG) ---------------- */
function svgProducto(tipo: Producto, hue: number, variante: number, ancho = 800, alto = 1000): string {
  hue = (hue + ((variante * 37) % 70) - 35 + 360) % 360;
  const h2 = (hue + 28 + variante * 9) % 360;
  const fondo1 = `hsl(${hue} 70% ${84 - (variante % 3) * 6}%)`;
  const fondo2 = `hsl(${h2} 62% ${62 - (variante % 4) * 5}%)`;
  const marca = `hsl(${hue} 58% ${34 + (variante % 3) * 6}%)`;
  const cx = ancho / 2;
  const base = alto * 0.78;
  const luzX = 20 + (variante * 17) % 60;
  let figura = "";
  if (tipo === "frasco") {
    figura = `<rect x="${cx - 150}" y="${base - 330}" width="300" height="330" rx="46" fill="#fbfbfd"/>
      <rect x="${cx - 162}" y="${base - 420}" width="324" height="110" rx="30" fill="${marca}"/>
      <rect x="${cx - 150}" y="${base - 210}" width="300" height="86" fill="${marca}" opacity=".9"/>
      <text x="${cx}" y="${base - 156}" font-family="Georgia,serif" font-style="italic" font-size="44" fill="#fff" text-anchor="middle">Glow</text>
      <rect x="${cx - 120}" y="${base - 310}" width="34" height="270" rx="17" fill="#fff" opacity=".7"/>`;
  } else if (tipo === "perfume") {
    figura = `<rect x="${cx - 46}" y="${base - 470}" width="92" height="90" rx="14" fill="${marca}"/>
      <rect x="${cx - 30}" y="${base - 390}" width="60" height="40" fill="#e9e6f0"/>
      <path d="M${cx - 170} ${base - 350} h340 l30 300 q0 50 -50 50 h-280 q-50 0 -50 -50z" fill="rgba(255,255,255,.55)" stroke="#fff" stroke-width="6"/>
      <path d="M${cx - 150} ${base - 220} h300 l16 170 q0 30 -30 30 h-272 q-30 0 -30 -30z" fill="${marca}" opacity=".55"/>
      <text x="${cx}" y="${base - 260}" font-family="Georgia,serif" font-style="italic" font-size="50" fill="${marca}" text-anchor="middle">Amour</text>`;
  } else if (tipo === "zapatilla") {
    figura = `<path d="M${cx - 300} ${base - 40} q0 -120 90 -150 l120 -40 q40 60 120 50 l60 -10 q140 40 200 130 q20 40 -20 60 h-540 q-30 0 -30 -40z" fill="#fbfbfd"/>
      <path d="M${cx - 300} ${base - 40} h560 q30 0 30 -20 v30 q0 30 -30 30 h-540 q-20 0 -20 -40z" fill="${marca}"/>
      <path d="M${cx - 150} ${base - 150} q90 40 220 -20" stroke="${marca}" stroke-width="22" fill="none" stroke-linecap="round"/>
      <path d="M${cx - 120} ${base - 195} l40 30 M${cx - 80} ${base - 210} l40 30 M${cx - 40} ${base - 222} l40 30" stroke="${marca}" stroke-width="10" stroke-linecap="round"/>`;
  } else if (tipo === "taza") {
    figura = `<path d="M${cx - 170} ${base - 300} h300 v200 q0 100 -100 100 h-100 q-100 0 -100 -100z" fill="#fbfbfd"/>
      <path d="M${cx + 130} ${base - 250} q90 0 90 70 q0 70 -90 70" stroke="#fbfbfd" stroke-width="32" fill="none"/>
      <rect x="${cx - 170}" y="${base - 200}" width="300" height="56" fill="${marca}"/>
      <path d="M${cx - 80} ${base - 330} q-30 -50 0 -100 q30 -50 0 -100 M${cx + 10} ${base - 330} q-30 -50 0 -100 q30 -50 0 -100" stroke="#fff" stroke-width="14" fill="none" opacity=".7" stroke-linecap="round"/>`;
  } else {
    figura = `<rect x="${cx - 190}" y="${base - 300}" width="380" height="300" rx="14" fill="${marca}"/>
      <rect x="${cx - 210}" y="${base - 360}" width="420" height="80" rx="14" fill="${marca}" opacity=".85"/>
      <rect x="${cx - 26}" y="${base - 360}" width="52" height="360" fill="#fbfbfd"/>
      <path d="M${cx} ${base - 360} q-120 -110 -150 -40 q-20 50 150 40 q170 10 150 -40 q-30 -70 -150 40z" fill="#fbfbfd"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
    <defs>
      <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fondo1}"/><stop offset="1" stop-color="${fondo2}"/></linearGradient>
      <radialGradient id="l" cx="${luzX}%" cy="18%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#f)"/>
    <rect width="100%" height="100%" fill="url(#l)"/>
    <ellipse cx="${cx}" cy="${base + 20}" rx="300" ry="46" fill="rgba(20,10,30,.28)" filter="url(#s)"/>
    <ellipse cx="${cx}" cy="${base + 6}" rx="330" ry="40" fill="rgba(255,255,255,.35)"/>
    ${figura}
  </svg>`;
}

function svgMockup(tipo: Producto, hue: number): string {
  return svgProducto(tipo, hue, 0, 800, 800)
    .replace(/<rect width="100%" height="100%" fill="url\(#f\)"\/>/, '<rect width="100%" height="100%" fill="#f4f4f6"/>')
    .replace(/<rect width="100%" height="100%" fill="url\(#l\)"\/>/, "");
}

const aDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/* ---------------- datos en memoria ---------------- */
type ImgInterna = Imagen;
type PromptInterno = { n: number; texto: string; imagen: ImgInterna | null };
type CampInterna = Omit<CampanaResumen, "total" | "hechas" | "portada" | "miniaturas"> & { prompts: PromptInterno[]; producto: Producto; hue: number; referencias: Referencia[] };

let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const uid = () => Math.random().toString(36).slice(2, 12);
const haceDias = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

function crearImagen(c: CampInterna, n: number, origen: string, creado: string, url?: string, ancho = 800, alto = 1000): ImgInterna {
  const ruta = url ?? aDataUrl(svgProducto(c.producto, c.hue, n));
  return { id: uid(), campana_id: c.id, n, url: ruta, miniatura: ruta, ruta, ruta_miniatura: ruta, ancho, alto, bytes: 180000 + Math.round(azar() * 900000), origen, creado };
}

function nuevaCamp(nombre: string, notas: string, producto: Producto, hue: number, textos: string[], hechas: number, dias: number, origen = "claude"): CampInterna {
  const c: CampInterna = { id: uid(), nombre, notas, origen, creado: haceDias(dias, 3), actualizado: haceDias(0), producto, hue, prompts: [], referencias: [] };
  if (origen === "claude") {
    const url = aDataUrl(svgMockup(producto, hue));
    c.referencias.push({ id: uid(), url, ruta: url, ruta_miniatura: url, ancho: 800, alto: 800 });
  }
  c.prompts = textos.map((texto, i) => ({ n: i + 1, texto, imagen: null }));
  for (let i = 0; i < hechas; i++) {
    const d = Math.max(0, Math.round(azar() * Math.min(dias, 12)));
    c.prompts[i].imagen = crearImagen(c, i + 1, azar() > 0.25 ? "chatgpt" : "app", haceDias(d, Math.round(azar() * 8)));
  }
  return c;
}

const campanas: CampInterna[] = [
  nuevaCamp("Crema facial Black Friday", "Formato vertical 9:16, tonos rosa y dorado, estilo editorial de lujo", "frasco", 340, [
    "Fotografía de producto de un frasco de crema facial blanco con tapa rosa sobre mármol, luz suave de ventana, estilo editorial de lujo",
    "Mujer latina de 30 años aplicándose la crema frente al espejo del baño, piel luminosa, luz natural de mañana",
    "Flat lay de la crema rodeada de pétalos de rosa, gotas de agua y ácido hialurónico, fondo rosa pastel",
    "Antes y después de la piel en 28 días, composición dividida, iluminación de estudio",
    "Banner Black Friday con la crema al centro, texto 50% OFF en dorado, fondo negro elegante",
    "Testimonio: clienta sonriente sosteniendo la crema, estilo foto auténtica de WhatsApp",
    "Kit de regalo con crema, sérum y caja dorada con lazo rosa, fondo navideño suave",
  ], 5, 3),
  nuevaCamp("Zapatillas running verano", "Colores vivos, sensación de movimiento", "zapatilla", 200, [
    "Zapatillas deportivas azules en pista de atletismo al amanecer, luz dorada",
    "Corredor en la playa con las zapatillas, movimiento congelado, salpicaduras",
    "Detalle de la suela con tecnología de amortiguación, fondo blanco de estudio",
    "Zapatillas flotando sobre fondo degradado celeste, estilo publicitario",
    "Grupo de amigos corriendo en el parque al atardecer",
    "Caja abierta con las zapatillas nuevas y papel de seda, unboxing",
  ], 6, 9),
  nuevaCamp("Perfume San Valentín", "", "perfume", 280, [
    "Frasco de perfume rojo sobre terciopelo con pétalos, luz cálida",
    "Pareja abrazada con el perfume en primer plano desenfocado",
    "Perfume con caja de regalo y tarjeta escrita a mano",
    "Banner San Valentín 2x1 con el perfume y corazones dorados",
  ], 2, 1),
  nuevaCamp("Café de origen · Día de la Madre", "Cálido y hogareño", "taza", 28, [
    "Taza de café humeante con bolsa de café de origen sobre mesa de madera",
    "Madre e hija desayunando con café, luz cálida de mañana",
    "Granos de café tostados cayendo en cámara lenta, fondo oscuro",
    "Caja de regalo con café, taza y tarjeta 'Feliz día mamá'",
    "Barista sirviendo arte latte en forma de corazón",
  ], 0, 0, "app"),
  nuevaCamp("Catálogo Navidad", "Fondo navideño suave, luces bokeh", "regalo", 0,
    Array.from({ length: 40 }, (_, i) => `Producto ${i + 1} del catálogo en escena navideña, caja de regalo con lazo, luces bokeh, foto profesional`), 24, 12),
];
campanas.sort((a, b) => (a.creado < b.creado ? 1 : -1));

/* ---------------- utilidades ---------------- */
const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const buscar = (id: string) => {
  const c = campanas.find((x) => x.id === id);
  if (!c) throw new Error("No existe la campaña.");
  return c;
};

function resumen(c: CampInterna): CampanaResumen {
  const conImg = c.prompts.filter((p) => p.imagen);
  return {
    id: c.id, nombre: c.nombre, notas: c.notas, origen: c.origen, creado: c.creado, actualizado: c.actualizado,
    total: c.prompts.length, hechas: conImg.length, portada: conImg[0]?.imagen ?? null,
    miniaturas: conImg.slice(0, 4).map((p) => p.imagen!.ruta_miniatura),
  };
}
const completa = (c: CampInterna): Campana => ({ ...resumen(c), prompts: copia(c.prompts) as Prompt[], referencias: copia(c.referencias) });

function leerArchivo(f: File): Promise<{ url: string; ancho: number; alto: number }> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      const im = new Image();
      im.onload = () => ok({ url, ancho: im.naturalWidth, alto: im.naturalHeight });
      im.onerror = () => mal(new Error("El archivo no es una imagen válida."));
      im.src = url;
    };
    r.onerror = () => mal(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(f);
  });
}

/* ---------------- API simulada (misma forma que la real) ---------------- */
export function crearApiDemo(separarPrompts: (t: string) => string[]) {
  let sesion = true;
  return {
    sesion: async () => ({ autenticado: sesion }),
    login: async () => { await espera(400); sesion = true; return { ok: true }; },
    logout: async () => { sesion = false; return { ok: true }; },
    conexion: async () => ({ url_mcp: "https://tu-app.onrender.com/TU-CLAVE-SECRETA/mcp", url_publica: "https://tu-app.onrender.com" }),
    resumen: async (): Promise<Resumen> => {
      await espera();
      const imgs = campanas.flatMap((c) => c.prompts.filter((p) => p.imagen).map((p) => ({ img: p.imagen!, c, p })));
      imgs.sort((a, b) => (a.img.creado < b.img.creado ? 1 : -1));
      const actividad = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
        return { dia: d, imagenes: imgs.filter((x) => x.img.creado.slice(0, 10) === d).length };
      });
      const semana = imgs.filter((x) => Date.now() - new Date(x.img.creado).getTime() < 7 * 86400000).length;
      const total = campanas.reduce((a, c) => a + c.prompts.length, 0);
      return {
        campanas: campanas.length, imagenes: imgs.length, pendientes: total - imgs.length, imagenes_semana: semana,
        bytes: imgs.reduce((a, x) => a + x.img.bytes, 0),
        recientes: campanas.slice(0, 6).map(resumen),
        actividad,
        ultimas: imgs.slice(0, 10).map((x) => ({ ...copia(x.img), campana_nombre: x.c.nombre, prompt: x.p.texto })),
      };
    },
    campanas: async (q = "") => {
      await espera(80);
      return campanas.filter((c) => c.nombre.toLowerCase().includes(q.toLowerCase())).map(resumen);
    },
    campana: async (id: string) => { await espera(80); return completa(buscar(id)); },
    crearCampana: async (nombre: string, prompts: string, notas: string) => {
      const textos = separarPrompts(prompts);
      if (!nombre.trim()) throw new Error("La campaña necesita un nombre.");
      if (!textos.length) throw new Error("La campaña necesita al menos un prompt.");
      const productos: Producto[] = ["frasco", "perfume", "zapatilla", "taza", "regalo"];
      const c = nuevaCamp(nombre.trim(), notas.trim(), productos[Math.floor(azar() * 5)], Math.floor(azar() * 360), textos, 0, 0, "app");
      campanas.unshift(c);
      return completa(c);
    },
    editarCampana: async (id: string, cambios: { nombre?: string; notas?: string }) => {
      const c = buscar(id);
      if (cambios.nombre !== undefined) c.nombre = cambios.nombre.trim() || c.nombre;
      if (cambios.notas !== undefined) c.notas = cambios.notas.trim();
      return completa(c);
    },
    eliminarCampana: async (id: string) => { campanas.splice(campanas.indexOf(buscar(id)), 1); return { ok: true }; },
    agregarPrompts: async (id: string, prompts: string) => {
      const c = buscar(id);
      separarPrompts(prompts).forEach((t) => c.prompts.push({ n: c.prompts.length + 1, texto: t, imagen: null }));
      return completa(c);
    },
    editarPrompt: async (id: string, n: number, texto: string) => {
      const p = buscar(id).prompts.find((x) => x.n === n);
      if (p) p.texto = texto.trim();
      return completa(buscar(id));
    },
    subirReferencias: async (id: string, archivos: File[]) => {
      const c = buscar(id);
      for (const f of archivos.slice(0, 6 - c.referencias.length)) {
        const info = await leerArchivo(f);
        c.referencias.push({ id: uid(), url: info.url, ruta: info.url, ruta_miniatura: info.url, ancho: info.ancho, alto: info.alto });
      }
      return completa(c);
    },
    quitarReferencia: async (id: string, rid: string) => {
      const c = buscar(id);
      c.referencias = c.referencias.filter((r) => r.id !== rid);
      return completa(c);
    },
    quitarImagen: async (id: string, n: number) => {
      const p = buscar(id).prompts.find((x) => x.n === n);
      if (p) p.imagen = null;
      return completa(buscar(id));
    },
    subirImagenes: async (id: string, archivos: File[], n?: number) => {
      const c = buscar(id);
      let subidas = 0;
      const errores: { archivo: string; error: string }[] = [];
      for (let i = 0; i < archivos.length; i++) {
        try {
          const info = await leerArchivo(archivos[i]);
          const puesto = n ? c.prompts.find((p) => p.n === n + i) : c.prompts.find((p) => !p.imagen);
          if (!puesto) throw new Error("Todas las imágenes ya están cargadas.");
          puesto.imagen = crearImagen(c, puesto.n, "app", new Date().toISOString(), info.url, info.ancho, info.alto);
          puesto.imagen.bytes = archivos[i].size;
          subidas++;
        } catch (e) {
          errores.push({ archivo: archivos[i].name, error: (e as Error).message });
        }
      }
      return { subidas, errores };
    },
    imagenes: async (campana?: string, desde = 0, limite = 60) => {
      await espera(100);
      const todas = campanas
        .filter((c) => !campana || c.id === campana)
        .flatMap((c) => c.prompts.filter((p) => p.imagen).map((p) => ({ ...copia(p.imagen!), campana_nombre: c.nombre, prompt: p.texto })))
        .sort((a, b) => (a.creado < b.creado ? 1 : -1));
      const lista = todas.slice(desde, desde + limite);
      return { imagenes: lista, total: todas.length, siguiente: desde + lista.length < todas.length ? desde + lista.length : null };
    },
    /** Solo demo: ChatGPT "envía" la siguiente imagen pendiente. Devuelve false si no queda ninguna. */
    simularChatGPT: async (id: string) => {
      const c = buscar(id);
      const p = c.prompts.find((x) => !x.imagen);
      if (!p) return false;
      await espera(900);
      p.imagen = crearImagen(c, p.n, "chatgpt", new Date().toISOString());
      return true;
    },
  };
}
