import { useEffect, useMemo, useState } from "react";
import { Bot, Clock, Copy, Eye, FolderKanban, PanelsTopLeft, Pencil, Search, Send, Sparkles, type LucideIcon } from "lucide-react";
import { api, type Herramienta } from "../api";
import { Cabecera, useCopiar } from "../components/ui";

/** Flujos listos: cada uno es un mensaje que se copia (o se abre en ChatGPT) para usar una habilidad del conector. */
type Flujo = { titulo: string; para: "claude" | "chatgpt"; texto: string; mensaje: string; icono: LucideIcon; herramientas: string[] };
const FLUJOS: Flujo[] = [
  {
    titulo: "Crear una campaña de imágenes", para: "claude", icono: FolderKanban, herramientas: ["crear_campana", "agregar_prompts"],
    texto: "Claude escribe los prompts de tu producto y los guarda como campaña.",
    mensaje: "Crea una campaña de imágenes en Pincel IA llamada «nombre de la campaña» con los prompts de este producto. Si te envié un mockup, descríbelo con detalle en cada prompt para que el producto salga idéntico.",
  },
  {
    titulo: "Crear las imágenes de una campaña", para: "chatgpt", icono: Send, herramientas: ["obtener_prompts", "subir_imagen"],
    texto: "ChatGPT trae los prompts pendientes, crea cada imagen y la sube sola.",
    mensaje: "Usa el conector Pincel IA. Trae la campaña «nombre de la campaña» y crea las imágenes de los prompts pendientes, lote tras lote. Cada vez que termines una imagen, súbela de inmediato con subir_imagen a su número, sin esperar a que yo te lo pida. Al final dime cuántas quedaron cargadas.",
  },
  {
    titulo: "Traer los links de las imágenes", para: "claude", icono: Eye, herramientas: ["obtener_imagenes", "listar_campanas"],
    texto: "Claude te da los links públicos para usarlos en Chatea Pro o WhatsApp.",
    mensaje: "Trae los links de las imágenes de la campaña «nombre de la campaña» de Pincel IA.",
  },
  {
    titulo: "Configurar el mercado", para: "claude", icono: PanelsTopLeft, herramientas: ["obtener_mercado"],
    texto: "Claude revisa tu mercado y te pregunta lo que falte.",
    mensaje: "Consulta mi mercado en Pincel IA con obtener_mercado. Si faltan el país, la moneda o el idioma, pregúntamelos uno por uno.",
  },
  {
    titulo: "Revisar una landing", para: "claude", icono: Search, herramientas: ["importar_landing", "registrar_auditoria"],
    texto: "Claude revisa las imágenes, anota precios y banderas, y registra qué editar.",
    mensaje: "Revisa la landing «nombre de la landing» de Pincel IA. Obtén el mercado con obtener_mercado; si faltan imágenes, impórtalas con importar_landing. Revísalas una por una (precios, paquetes, banderas, transportadoras, moneda, idioma, garantía), clasifica la landing y registra la revisión con registrar_auditoria, marcando para editar solo lo que lo necesite. Antes de decidir los precios, muéstrame todos los que encuentres y pregúntame si los conservo o los cambio.",
  },
  {
    titulo: "Editar las imágenes de una landing", para: "chatgpt", icono: Pencil, herramientas: ["obtener_ediciones", "subir_edicion"],
    texto: "ChatGPT edita las imágenes marcadas, con su medida exacta, y las sube.",
    mensaje: "Usa el conector Pincel IA. Trae las ediciones pendientes de la landing «nombre de la landing» con obtener_ediciones. Edita cada imagen según su instrucción, conservando exactamente su ancho y alto y todos los cintillos de oferta, y súbela de inmediato con subir_edicion sin esperar a que te lo pida. Repite hasta que no falte ninguna y dime cuántas quedaron cargadas.",
  },
  {
    titulo: "Ver qué falta de una landing", para: "claude", icono: Clock, herramientas: ["estado_landing"],
    texto: "Claude resume qué falta para poder entregarla.",
    mensaje: "Dime qué falta para entregar la landing «nombre de la landing» de Pincel IA, usando estado_landing.",
  },
];

const OTROS = ["Chatea Pro", "WhatsApp Business", "Dropi", "Google Drive"];
const QUIEN = { claude: "Claude", chatgpt: "ChatGPT", ambos: "Claude y ChatGPT" } as const;

export default function Habilidades() {
  const [lista, setLista] = useState<Herramienta[] | null>(null);
  const [q, setQ] = useState("");
  const copiar = useCopiar();

  useEffect(() => { api.habilidades().then((r) => setLista(r.herramientas)).catch(() => setLista([])); }, []);

  const grupos = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtradas = (lista ?? []).filter((h) => !t || h.nombre.includes(t) || h.descripcion.toLowerCase().includes(t));
    const por: Record<string, Herramienta[]> = {};
    filtradas.forEach((h) => (por[h.seccion] ||= []).push(h));
    return Object.entries(por);
  }, [lista, q]);
  const cuenta = (p: Herramienta["para"]) => (lista ?? []).filter((h) => h.para === p || h.para === "ambos").length;

  return (
    <>
      <Cabecera titulo={<>Habilidades</>} subtitulo="Todo lo que Claude y ChatGPT pueden hacer con Pincel IA, leído directamente del conector" />

      <div className="stats3">
        <div className="glass tile"><div className="tile-top">Herramientas del conector<span className="tile-icon"><Bot size={16} /></span></div><span className="big">{lista ? lista.length : "—"}</span><span className="tile-foot">ChatGPT debe mostrar este mismo número</span></div>
        <div className="glass tile"><div className="tile-top">Para Claude<span className="tile-icon"><Sparkles size={16} /></span></div><span className="big">{lista ? cuenta("claude") : "—"}</span><span className="tile-foot">escribe, revisa y organiza</span></div>
        <div className="glass tile"><div className="tile-top">Para ChatGPT<span className="tile-icon"><Send size={16} /></span></div><span className="big">{lista ? cuenta("chatgpt") : "—"}</span><span className="tile-foot">crea y sube las imágenes</span></div>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4"><span className="eyebrow">Para usar ya</span><h2>Flujos <em>listos</em></h2></div>
        </div>
        <div className="flujos stagger">
          {FLUJOS.map((f) => (
            <article key={f.titulo} className="glass flujo">
              <div className="row between gap-8">
                <span className="tile-icon"><f.icono size={16} /></span>
                <span className={`badge ${f.para === "chatgpt" ? "success" : "accent"}`}><span className="dot" />{QUIEN[f.para]}</span>
              </div>
              <h3>{f.titulo}</h3>
              <p className="muted small grow">{f.texto}</p>
              <div className="row gap-4 wrap">{f.herramientas.map((h) => <code key={h} className="chip-code">{h}</code>)}</div>
              <div className="row gap-8 wrap">
                <button className="btn sm" onClick={() => copiar(f.mensaje, `Mensaje copiado: pégalo en ${QUIEN[f.para]}`)}><Copy size={14} /> Copiar mensaje</button>
                {f.para === "chatgpt" && (
                  <a className="btn sm glow" href={`https://chatgpt.com/?q=${encodeURIComponent(f.mensaje)}`} target="_blank" rel="noopener noreferrer" onClick={() => copiar(f.mensaje, "Mensaje copiado. Cambia «nombre» por el tuyo y activa Pincel IA (+ → Pincel IA)")}><Send size={14} /> Abrir en ChatGPT</a>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="subtle small" style={{ marginTop: 10 }}>Cambia lo que va entre « » por el nombre de tu campaña o landing antes de enviarlo.</p>
      </section>

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4"><span className="eyebrow">Lo que ofrece el conector</span><h2>Herramientas <em>disponibles</em></h2></div>
          <div className="search"><Search size={16} /><input className="input" placeholder="Buscar herramienta…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar herramienta" /></div>
        </div>
        {!lista ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : grupos.length === 0 ? (
          <div className="glass empty" style={{ padding: 36 }}><p className="muted">Ninguna herramienta coincide con “{q}”.</p></div>
        ) : (
          <div className="stack gap-16">
            {grupos.map(([seccion, hs]) => (
              <div key={seccion} className="glass">
                <div className="card-head"><h2>{seccion}</h2><span className="subtle small">{hs.length} {hs.length === 1 ? "herramienta" : "herramientas"}</span></div>
                <ul className="herramientas">
                  {hs.map((h) => (
                    <li key={h.nombre}>
                      <div className="stack gap-6 grow">
                        <div className="row gap-8 wrap"><code className="mono" style={{ fontWeight: 600 }}>{h.nombre}</code>
                          <span className={`badge ${h.para === "chatgpt" ? "success" : h.para === "ambos" ? "" : "accent"}`}>{QUIEN[h.para]}</span>
                          <span className="badge">{h.solo_lectura ? "Solo consulta" : "Guarda datos"}</span>
                        </div>
                        <p className="muted small">{h.descripcion}</p>
                        {h.parametros.length > 0 && (
                          <div className="row gap-4 wrap">{h.parametros.map((p) => <code key={p.nombre} className="chip-code" title={p.obligatorio ? "Obligatorio" : "Opcional"}>{p.nombre}{p.obligatorio ? " *" : ""}</code>)}</div>
                        )}
                      </div>
                      <button className="icon-btn" onClick={() => copiar(h.nombre, "Nombre copiado")} aria-label={`Copiar ${h.nombre}`}><Copy size={15} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4"><span className="eyebrow">Hoja de ruta</span><h2>Otros conectores <em>por llegar</em></h2></div>
        </div>
        <div className="flujos">
          {OTROS.map((o) => (
            <div key={o} className="glass flujo" style={{ opacity: 0.85 }}>
              <div className="row between gap-8"><b>{o}</b><span className="badge"><Clock size={12} /> Próximamente</span></div>
              <p className="muted small">Aún no está disponible. Para conectarlo hace falta su API y una clave de acceso.</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
