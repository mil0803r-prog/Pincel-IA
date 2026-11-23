import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Info, ShieldCheck } from "lucide-react";
import { api, fecha, type Contacto } from "../api";
import { Cabecera, Logo, useCopiar } from "../components/ui";

const FRASES = [
  { donde: "Claude", texto: "Este es el mockup de mi producto. Crea los prompts de imagen para la campaña y guárdalos en Pincel IA como «nombre de la campaña»." },
  { donde: "ChatGPT", texto: "Trae la campaña «nombre de la campaña» de Pincel IA y crea las imágenes." },
  { donde: "ChatGPT", texto: "Enviar a la plataforma." },
  { donde: "ChatGPT", texto: "Trae el siguiente lote de la campaña y continúa hasta terminar todas, enviando cada lote a la plataforma." },
  { donde: "Claude", texto: "Agrega estos prompts nuevos a la campaña «nombre de la campaña» en Pincel IA." },
  { donde: "Claude", texto: "Trae los links de las imágenes de la campaña «nombre de la campaña»." },
];

export default function Conexiones() {
  const [url, setUrl] = useState("");
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [ver, setVer] = useState(false);
  const [tab, setTab] = useState<"chatgpt" | "claude">("chatgpt");
  const copiar = useCopiar();

  useEffect(() => {
    const cargar = () => api.conexion().then((d) => { setUrl(d.url_mcp); setContacto(d.ultimo_contacto); }).catch(() => {});
    cargar();
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, []);

  const oculta = url.replace(/\/([^/]+)\/mcp$/, (_, t: string) => `/${"•".repeat(Math.min(t.length, 18))}/mcp`);
  const comandoClaude = `claude mcp add --transport http pincel-ia ${url}`;

  return (
    <>
      <Cabecera titulo={<>Conexiones</>} subtitulo="Conecta ChatGPT y Claude con tu estudio" />

      <section className="glass conn-hero">
        <div className="row between wrap gap-16">
          <div className="stack gap-6">
            <span className="eyebrow">Conector MCP</span>
            <h2 style={{ fontSize: 22 }}>Una dirección, <em>dos asistentes</em></h2>
            <p className="muted small">La misma URL sirve para ChatGPT y para Claude.</p>
          </div>
          <div className="logos" aria-hidden>
            <span className="logo-chip">GPT</span>
            <span className="link-line" />
            <Logo size={46} />
            <span className="link-line" />
            <span className="logo-chip">Claude</span>
          </div>
        </div>
        <div className="copybox">
          <code>{url ? (ver ? url : oculta) : "Cargando…"}</code>
          <button className="icon-btn" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar" : "Mostrar"} title={ver ? "Ocultar" : "Mostrar"}>
            {ver ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="btn primary sm" disabled={!url} onClick={() => copiar(url, "URL copiada")}>
            <Copy size={14} /> Copiar
          </button>
        </div>
        <div className="row gap-8 small muted">
          <ShieldCheck size={15} style={{ color: "var(--success)", flexShrink: 0 }} />
          Incluye tu clave secreta: quien tenga esta URL puede usar el conector. No la compartas.
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4">
            <span className="eyebrow">Estado</span>
            <h2>¿Están <em>conectados</em>?</h2>
          </div>
        </div>
        <div className="estado-conexion">
          {([["ChatGPT", contacto?.chatgpt], ["Claude", contacto?.claude]] as const).map(([nombre, ultimo]) => (
            <div className="estado-item glass" key={nombre}>
              <span className={`punto-estado ${ultimo ? "vivo" : ""}`} />
              <div className="stack grow">
                <b>{nombre}</b>
                <span className="muted small">{ultimo ? `Última actividad ${fecha(ultimo)}` : "Todavía no se ha conectado"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="two-col section">
        <section className="glass">
          <div className="card-head">
            <h2>Cómo <em>conectar</em></h2>
            <div className="tabs" role="tablist">
              <button className={`tab ${tab === "chatgpt" ? "active" : ""}`} onClick={() => setTab("chatgpt")} role="tab" aria-selected={tab === "chatgpt"}>ChatGPT</button>
              <button className={`tab ${tab === "claude" ? "active" : ""}`} onClick={() => setTab("claude")} role="tab" aria-selected={tab === "claude"}>Claude</button>
            </div>
          </div>
          <div className="pad">
            {tab === "chatgpt" ? (
              <ol className="steps">
                <li><span>En ChatGPT abre <b>Configuración → Aplicaciones y conectores → Configuración avanzada</b> y activa el <b>Modo desarrollador</b>. Requiere plan Plus, Pro o Business.</span></li>
                <li><span>Pulsa <b>Crear</b> conector. Nombre: <b>Pincel IA</b>. URL: la de arriba. En <b>Autenticación</b> elige <b>Sin autenticación</b> (no OAuth).</span></li>
                <li><span>En un chat nuevo pulsa <b>+</b>, elige <b>Modo desarrollador</b> y activa <b>Pincel IA</b>.</span></li>
                <li><span>Escribe: “Trae la campaña … de Pincel IA y crea las imágenes”.</span></li>
              </ol>
            ) : (
              <ol className="steps">
                <li><span><b>claude.ai o Claude Desktop:</b> Configuración → Conectores → <b>Agregar conector personalizado</b> y pega la URL de arriba.</span></li>
                <li>
                  <div className="stack gap-8 grow" style={{ minWidth: 0 }}>
                    <span><b>Claude Code:</b> ejecuta en la terminal:</span>
                    <div className="copybox">
                      <code>{ver ? comandoClaude : comandoClaude.replace(url, oculta)}</code>
                      <button className="icon-btn" disabled={!url} onClick={() => copiar(comandoClaude, "Comando copiado")} aria-label="Copiar comando"><Copy size={15} /></button>
                    </div>
                  </div>
                </li>
                <li><span>Pide a tu skill de ventas que guarde los prompts en Pincel IA.</span></li>
              </ol>
            )}
          </div>
        </section>

        <section className="glass">
          <div className="card-head"><h2>Frases <em>útiles</em></h2></div>
          <div className="pad stack gap-8">
            {FRASES.map((f) => (
              <div className="phrase" key={f.texto}>
                <div className="stack gap-6 grow">
                  <span className={`badge ${f.donde === "ChatGPT" ? "success" : "accent"}`} style={{ alignSelf: "flex-start" }}><span className="dot" />{f.donde}</span>
                  <span className="small">{f.texto}</span>
                </div>
                <button className="icon-btn" onClick={() => copiar(f.texto)} aria-label="Copiar frase"><Copy size={15} /></button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="callout info section">
        <Info size={18} />
        <div className="stack gap-4 small">
          <b>Si ChatGPT no logra enviar las imágenes</b>
          <span className="muted">
            ChatGPT crea las imágenes una por una. Si al decir “Enviar a la plataforma” no puede adjuntarlas, te dará el link de la campaña:
            descárgalas de ChatGPT y arrástralas todas juntas. Se acomodan solas en orden.
          </span>
        </div>
      </div>
    </>
  );
}
