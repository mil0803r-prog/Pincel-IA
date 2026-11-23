/**
 * Modo demo: la misma app funcionando 100% en el navegador, con datos de ejemplo
 * en memoria (sin servidor). Se activa al compilar con `npm run build:demo`.
 */
import type { Aviso, Avisos, Herramienta, Campana, CampanaResumen, EstadoImagen, Imagen, ImagenLanding, Landing, LandingResumen, Mercado, Pendiente, Prompt, Referencia, Resumen, TipoLanding } from "./api";

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

/* ---------------- avisos ---------------- */
const avisos: Aviso[] = [];
const nuevoAviso = (a: Omit<Aviso, "id" | "creado" | "leida">) => avisos.unshift({ ...a, id: uid(), creado: new Date().toISOString(), leida: false });
const tituloAviso = (tipo: string, origen: string, n: number) => {
  const quien = origen === "chatgpt" ? "ChatGPT" : "Claude";
  return tipo === "imagenes" ? `${quien} envió ${n} ${n === 1 ? "imagen" : "imágenes"}` : tipo === "completa" ? "Campaña completa" : `${quien} creó una campaña`;
};
nuevoAviso({ tipo: "campana_creada", origen: "claude", titulo: tituloAviso("campana_creada", "claude", 1), detalle: `${campanas[0].nombre} · ${campanas[0].prompts.length} prompts`, cantidad: 1, campana_id: campanas[0].id, campana_nombre: campanas[0].nombre });
avisos[0].creado = haceDias(0, 2);

/* ---------------- sección Landing (demo) ---------------- */
type FinalD = { src: string; ancho: number; alto: number; estado: "ok" | "dimension"; nota: string };
type ImgD = { id: string; n: number; src: string; ancho: number; alto: number; bytes: number; formato: string; rol: "banner" | "carrusel"; accion: "intacta" | "editar" | null; instruccion: string; hallazgos: string; final: FinalD | null };
type LandD = { id: string; nombre: string; url: string; tipo: TipoLanding | null; precios_decision: "conservar" | "cambiar" | null; precios_nuevos: string; precios_encontrados: string; transportadoras_ok: string; notas: string; creado: string; imagenes: ImgD[] };

const mercadoD: Record<string, string | null> = { pais: "Colombia", moneda: "COP", idioma: "español", tienda: "Mi tienda", transportadoras: null, medios_pago: "Pago contra entrega", condiciones_envio: null, garantia: "conservar" };
const mercadoOut = (): Mercado => {
  const faltan = ["pais", "moneda", "idioma"].filter((c) => !(mercadoD[c] || "").trim());
  return { ...(mercadoD as unknown as Mercado), garantia: mercadoD.garantia || "conservar", actualizado: new Date().toISOString(), faltan, configurado: faltan.length === 0 };
};

function svgBanner(w: number, h: number, hue: number, titulo: string, precio: string): string {
  const a = `hsl(${hue} 70% 88%)`, b = `hsl(${(hue + 30) % 360} 65% 62%)`, c = `hsl(${hue} 55% 28%)`;
  return aDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="0" y="${h * 0.06}" width="${w}" height="${h * 0.09}" fill="#d62839"/>
    <text x="${w / 2}" y="${h * 0.125}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${w * 0.07}" fill="#fff" text-anchor="middle">SÚPER OFERTA</text>
    <text x="${w / 2}" y="${h * 0.38}" font-family="Georgia,serif" font-style="italic" font-size="${w * 0.1}" fill="${c}" text-anchor="middle">${titulo}</text>
    <rect x="${w * 0.2}" y="${h * 0.5}" width="${w * 0.6}" height="${h * 0.22}" rx="${w * 0.03}" fill="#fff"/>
    <text x="${w / 2}" y="${h * 0.65}" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${w * 0.1}" fill="${c}" text-anchor="middle">${precio}</text>
    <rect x="${w * 0.08}" y="${h * 0.86}" width="${w * 0.1}" height="${w * 0.065}" fill="#fcd116"/><rect x="${w * 0.08}" y="${h * 0.86 + w * 0.0325}" width="${w * 0.1}" height="${w * 0.0163}" fill="#003893"/><rect x="${w * 0.08}" y="${h * 0.86 + w * 0.049}" width="${w * 0.1}" height="${w * 0.0163}" fill="#ce1126"/>
    <text x="${w * 0.22}" y="${h * 0.86 + w * 0.045}" font-family="Arial,sans-serif" font-size="${w * 0.04}" fill="${c}">Envío a todo el país</text>
  </svg>`);
}

const mkImg = (n: number, w: number, h: number, hue: number, titulo: string, precio: string): ImgD => ({
  id: uid(), n, src: svgBanner(w, h, hue, titulo, precio), ancho: w, alto: h, bytes: 150000 + Math.round(azar() * 400000), formato: "png",
  rol: "banner", accion: null, instruccion: "", hallazgos: "", final: null,
});

const landings: LandD[] = [(() => {
  const imagenes = [
    mkImg(1, 1080, 1800, 320, "Crema Glow", "$119.900"),
    mkImg(2, 1080, 1200, 200, "Piel radiante", "2 x $150.000"),
    mkImg(3, 1080, 1500, 40, "Ingredientes", "$89.900"),
    mkImg(4, 1080, 900, 150, "Resultados", "-25%"),
    mkImg(5, 1080, 1350, 270, "Testimonios", "$89.900"),
    mkImg(6, 1080, 600, 10, "Pide la tuya hoy", "$89.900"),
  ];
  imagenes[0].accion = "editar"; imagenes[0].instruccion = "Cambiar el precio por $89.900 COP y la bandera de México por la de Colombia"; imagenes[0].hallazgos = "Precio $119.900 MXN. Bandera de México.";
  imagenes[0].final = { src: svgBanner(1080, 1800, 320, "Crema Glow", "$89.900"), ancho: 1080, alto: 1800, estado: "ok", nota: "Mismas dimensiones que el original." };
  imagenes[1].accion = "editar"; imagenes[1].instruccion = "Cambiar el precio del paquete por $129.900 COP";
  imagenes[2].accion = "intacta"; imagenes[3].accion = "intacta"; imagenes[5].accion = "intacta"; imagenes[5].rol = "carrusel";
  return { id: uid(), nombre: "Crema Glow · Colombia", url: "https://ejemplo.com/crema-glow", tipo: "imagenes", precios_decision: null, precios_nuevos: "", precios_encontrados: "$119.900 MXN\n2 x $150.000 MXN\nAhorra $29.800", transportadoras_ok: "", notas: "Adaptar de México a Colombia", creado: haceDias(1), imagenes } as LandD;
})()];

const estadoD = (i: ImgD): EstadoImagen => (!i.accion ? "sin_decidir" : i.accion === "intacta" ? "intacta" : !i.final ? "por_editar" : i.final.estado === "ok" ? "editada" : "dimension");
const imgOut = (i: ImgD): ImagenLanding => ({
  id: i.id, n: i.n, origen_url: "", ruta: i.src, ruta_miniatura: i.src, url: i.src, ancho: i.ancho, alto: i.alto, bytes: i.bytes, formato: i.formato,
  rol: i.rol, accion: i.accion, instruccion: i.instruccion, hallazgos: i.hallazgos, estado: estadoD(i),
  final: i.final ? { ruta: i.final.src, ruta_miniatura: i.final.src, url: i.final.src, ancho: i.final.ancho, alto: i.final.alto, bytes: 200000, estado: i.final.estado, nota: i.final.nota } : null,
});
const resumenL = (l: LandD): LandingResumen => {
  const est = l.imagenes.map(estadoD);
  return {
    id: l.id, nombre: l.nombre, url: l.url, tipo: l.tipo, precios_decision: l.precios_decision, creado: l.creado, actualizado: haceDias(0),
    total: l.imagenes.length, listas: est.filter((e) => e === "intacta" || e === "editada").length, a_editar: l.imagenes.filter((i) => i.accion === "editar").length,
    sin_decidir: est.filter((e) => e === "sin_decidir").length, portada: l.imagenes[0]?.src ?? null, miniaturas: l.imagenes.slice(0, 4).map((i) => i.src),
  };
};
const landingOut = (l: LandD): Landing => {
  const base = resumenL(l);
  const imgs = l.imagenes.map(imgOut);
  const m = mercadoOut();
  const p: Pendiente[] = [];
  if (!imgs.length) p.push({ clave: "imagenes", texto: "Traer las imágenes de la landing, en orden." });
  if (!m.configurado) p.push({ clave: "mercado", texto: `Configurar el mercado: ${m.faltan.join(", ")}.` });
  if (!l.tipo) p.push({ clave: "tipo", texto: "Clasificar la landing (imágenes, ficha de producto o híbrida)." });
  if (!l.precios_decision) p.push({ clave: "precios", texto: "Decidir si conservas o cambias los precios (se pregunta en cada landing)." });
  else if (l.precios_decision === "cambiar" && !l.precios_nuevos.trim()) p.push({ clave: "precios_importes", texto: "Escribir los importes nuevos: elegiste cambiar los precios." });
  const cuenta = (f: (i: ImagenLanding) => boolean) => imgs.filter(f).length;
  const sin = cuenta((i) => i.estado === "sin_decidir"), sinIns = cuenta((i) => i.accion === "editar" && !i.instruccion.trim());
  const por = cuenta((i) => i.estado === "por_editar"), dim = cuenta((i) => i.estado === "dimension");
  if (sin) p.push({ clave: "sin_decidir", texto: `${sin} ${sin === 1 ? "imagen" : "imágenes"} sin decidir (intacta o editar).` });
  if (sinIns) p.push({ clave: "sin_instruccion", texto: `${sinIns} para editar sin indicar qué cambiar.` });
  if (por) p.push({ clave: "por_editar", texto: `${por} ${por === 1 ? "edición pendiente" : "ediciones pendientes"}.` });
  if (dim) p.push({ clave: "dimension", texto: `${dim} con medidas distintas al original: hay que rehacerlas con la medida exacta.` });
  return { ...base, precios_nuevos: l.precios_nuevos, precios_encontrados: l.precios_encontrados, transportadoras_ok: l.transportadoras_ok, notas: l.notas, imagenes: imgs, mercado: m, pendientes: p, lista: p.length === 0 };
};
const buscarL = (id: string) => {
  const l = landings.find((x) => x.id === id);
  if (!l) throw new Error("No existe la landing.");
  return l;
};

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
    conexion: async () => ({ url_mcp: "https://tu-app.vercel.app/TU-CLAVE-SECRETA/mcp", url_publica: "https://tu-app.vercel.app", ultimo_contacto: { chatgpt: avisos.find((a) => a.origen === "chatgpt")?.creado ?? null, claude: avisos.find((a) => a.origen === "claude")?.creado ?? null } }),
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
    habilidades: async () => {
      const h = (nombre: string, seccion: string, para: Herramienta["para"], solo_lectura: boolean, descripcion: string, parametros: [string, boolean][]): Herramienta => ({ nombre, seccion, para, solo_lectura, descripcion, parametros: parametros.map(([n, o]) => ({ nombre: n, obligatorio: o })) });
      const herramientas: Herramienta[] = [
        h("crear_campana", "Campañas", "claude", false, "Guarda en Pincel IA una campaña con sus prompts de imagen para crearlos luego en ChatGPT.", [["nombre", true], ["prompts", true], ["notas_estilo", false], ["referencias_url", false]]),
        h("agregar_prompts", "Campañas", "claude", false, "Agrega más prompts al final de una campaña existente (no hay límite de cantidad).", [["campana", true], ["prompts", true]]),
        h("listar_campanas", "Campañas", "claude", true, "Lista las campañas más recientes de Pincel IA y cuántas imágenes tiene cada una.", [["limite", false]]),
        h("obtener_imagenes", "Campañas", "claude", true, "Devuelve los links públicos de las imágenes de una campaña (por nombre o id; vacío = la última).", [["campana", false]]),
        h("obtener_prompts", "Campañas", "chatgpt", true, "Trae el siguiente lote de prompts sin imagen de una campaña para crearlos. Se repite hasta terminar.", [["campana", false], ["cantidad", false]]),
        h("subir_imagen", "Campañas", "chatgpt", false, "Envía a Pincel IA una imagen creada en esta conversación al puesto de su prompt.", [["campana", true], ["numero", true], ["imagen", true]]),
        h("subir_referencia", "Campañas", "ambos", false, "Guarda una imagen de referencia del producto (mockup, foto real o logo) en una campaña.", [["campana", true], ["imagen", true]]),
        h("obtener_mercado", "Landing", "claude", true, "Devuelve el mercado de venta configurado: país, moneda, idioma, tienda, transportadoras, pagos, envío y garantía.", []),
        h("crear_landing", "Landing", "claude", false, "Crea una landing en Pincel IA para adaptarla al mercado.", [["nombre", true], ["url", false], ["notas", false]]),
        h("importar_landing", "Landing", "claude", false, "Trae las imágenes de la página fuente en su orden real y mide los archivos originales.", [["landing", true], ["url", false], ["reemplazar", false]]),
        h("registrar_auditoria", "Landing", "claude", false, "Registra el resultado de revisar la landing: clasificación, precios y qué hacer con cada imagen.", [["landing", true], ["tipo", false], ["precios_encontrados", false], ["precios_decision", false], ["precios_nuevos", false], ["notas", false], ["imagenes", false]]),
        h("estado_landing", "Landing", "claude", true, "Estado de una landing: qué falta para entregarla y el detalle de cada imagen.", [["landing", false]]),
        h("obtener_ediciones", "Landing", "chatgpt", true, "Trae las siguientes imágenes de una landing que hay que editar, con su instrucción y la imagen original.", [["landing", false], ["cantidad", false]]),
        h("subir_edicion", "Landing", "chatgpt", false, "Envía la imagen editada de una posición de la landing; la plataforma compara su ancho y alto con el original.", [["landing", true], ["numero", true], ["imagen", true]]),
      ];
      return { herramientas, total: herramientas.length };
    },
    notificaciones: async (): Promise<Avisos> => ({ no_leidas: avisos.filter((a) => !a.leida).length, items: copia(avisos).slice(0, 30) }),
    leerNotificaciones: async (ids?: string[]): Promise<Avisos> => {
      avisos.forEach((a) => { if (!ids || ids.includes(a.id)) a.leida = true; });
      return { no_leidas: avisos.filter((a) => !a.leida).length, items: copia(avisos).slice(0, 30) };
    },
    mercado: async () => mercadoOut(),
    guardarMercado: async (c: Record<string, string | null>) => { Object.entries(c).forEach(([k, v]) => { mercadoD[k] = (v || "").trim() || (k === "garantia" ? "conservar" : null); }); return mercadoOut(); },
    landings: async () => { await espera(80); return landings.map(resumenL); },
    crearLanding: async (nombre: string, url: string, notas: string) => {
      if (!nombre.trim()) throw new Error("La landing necesita un nombre.");
      const l: LandD = { id: uid(), nombre: nombre.trim(), url: url.trim(), tipo: null, precios_decision: null, precios_nuevos: "", precios_encontrados: "", transportadoras_ok: "", notas, creado: new Date().toISOString(), imagenes: [] };
      landings.unshift(l);
      return landingOut(l);
    },
    landing: async (id: string) => { await espera(80); return landingOut(buscarL(id)); },
    editarLanding: async (id: string, c: Record<string, string | null>) => { Object.assign(buscarL(id), c); return landingOut(buscarL(id)); },
    eliminarLanding: async (id: string) => { landings.splice(landings.indexOf(buscarL(id)), 1); return { ok: true }; },
    importarLanding: async (id: string, url: string, reemplazar: boolean) => {
      const l = buscarL(id);
      if (l.imagenes.length && !reemplazar) throw new Error("Esta landing ya tiene imágenes. Confirma que quieres reemplazarlas para volver a importar.");
      await espera(900);
      l.url = url || l.url || "https://ejemplo.com/landing";
      l.imagenes = [mkImg(1, 1080, 1800, 100, "Producto estrella", "$69.900"), mkImg(2, 1080, 1200, 20, "Beneficios", "2 x $120.000"), mkImg(3, 1080, 1500, 220, "Cómo se usa", "$69.900"), mkImg(4, 1080, 900, 300, "Garantía", "-30%"), mkImg(5, 1080, 600, 60, "Compra hoy", "$69.900")];
      l.precios_encontrados = "$69.900 COP\n2 x $120.000 COP\nAhorra $19.800";
      return { importadas: 5, omitidas: [{ url: "https://ejemplo.com/icono.png", motivo: "muy pequeña (40×40): parece un ícono" }], precios_texto: ["$69.900 COP", "2 x $120.000 COP", "$19.800"], tipo_sugerido: "imagenes" as TipoLanding, landing: landingOut(l) };
    },
    subirOriginales: async (id: string, archivos: File[]) => {
      const l = buscarL(id);
      let importadas = 0;
      const errores: { origen: string; error: string }[] = [];
      for (const f of archivos) {
        try {
          const info = await leerArchivo(f);
          l.imagenes.push({ id: uid(), n: l.imagenes.length + 1, src: info.url, ancho: info.ancho, alto: info.alto, bytes: f.size, formato: (f.name.split(".").pop() || "png").toLowerCase(), rol: "banner", accion: null, instruccion: "", hallazgos: "", final: null });
          importadas++;
        } catch (e) { errores.push({ origen: f.name, error: (e as Error).message }); }
      }
      return { importadas, errores };
    },
    editarImagenLanding: async (id: string, n: number, c: Record<string, string | null>) => { Object.assign(buscarL(id).imagenes.find((i) => i.n === n)!, c); return landingOut(buscarL(id)); },
    quitarImagenLanding: async (id: string, n: number) => { const l = buscarL(id); l.imagenes = l.imagenes.filter((i) => i.n !== n).map((i, k) => ({ ...i, n: k + 1 })); return landingOut(l); },
    subirFinal: async (id: string, n: number, archivo: File) => {
      const l = buscarL(id);
      const o = l.imagenes.find((i) => i.n === n)!;
      const info = await leerArchivo(archivo);
      if (!o.accion) o.accion = "editar";
      if (info.ancho === o.ancho && info.alto === o.alto) o.final = { src: info.url, ancho: o.ancho, alto: o.alto, estado: "ok", nota: "Mismas dimensiones que el original." };
      else if (Math.abs(info.ancho / info.alto / (o.ancho / o.alto) - 1) <= 0.005) o.final = { src: info.url, ancho: o.ancho, alto: o.alto, estado: "ok", nota: `Reescalada de ${info.ancho}×${info.alto} a ${o.ancho}×${o.alto} px (misma proporción, sin deformar).` };
      else o.final = { src: info.url, ancho: info.ancho, alto: info.alto, estado: "dimension", nota: `Llegó con ${info.ancho}×${info.alto} px y el original mide ${o.ancho}×${o.alto} px: la proporción no coincide. Pídele que la rehaga con la medida exacta ${o.ancho}×${o.alto} px.` };
      return landingOut(l);
    },
    quitarFinal: async (id: string, n: number) => { buscarL(id).imagenes.find((i) => i.n === n)!.final = null; return landingOut(buscarL(id)); },
    paquete: async (id: string) => { const l = landingOut(buscarL(id)); return { nombre: "landing", archivos: [], textos: {}, completa: l.lista }; },
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
      const hechas = c.prompts.filter((x) => x.imagen).length;
      const previo = avisos.find((a) => a.tipo === "imagenes" && a.campana_id === c.id && !a.leida);
      if (previo) { previo.cantidad += 1; previo.titulo = tituloAviso("imagenes", "chatgpt", previo.cantidad); previo.detalle = `${c.nombre} · ${hechas}/${c.prompts.length}`; previo.creado = new Date().toISOString(); }
      else nuevoAviso({ tipo: "imagenes", origen: "chatgpt", titulo: tituloAviso("imagenes", "chatgpt", 1), detalle: `${c.nombre} · ${hechas}/${c.prompts.length}`, cantidad: 1, campana_id: c.id, campana_nombre: c.nombre });
      if (hechas === c.prompts.length) nuevoAviso({ tipo: "completa", origen: "chatgpt", titulo: "Campaña completa", detalle: `${c.nombre} · ${hechas} imágenes listas`, cantidad: hechas, campana_id: c.id, campana_nombre: c.nombre });
      return true;
    },
  };
}
