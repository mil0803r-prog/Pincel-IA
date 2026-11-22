import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Info, ShieldAlert } from "lucide-react";
import { api } from "../api";
import { Cabecera, useCopiar } from "../components/ui";

const FRASES = [
  { donde: "Claude", texto: "Genera los prompts de imagen de la campaña y guárdalos en Pincel IA como «nombre de la campaña»." },
  { donde: "ChatGPT", texto: "Trae la campaña «nombre de la campaña» de Pincel IA y crea las imágenes." },
  { donde: "ChatGPT", texto: "Enviar a la plataforma." },
  { donde: "Claude", texto: "Trae los links de las imágenes de la campaña «nombre de la campaña»." },
];

export default function Conexiones() {
  const [url, setUrl] = useState("");
  const [ver, setVer] = useState(false);
  const [tab, setTab] = useState<"chatgpt" | "claude">("chatgpt");
  const copiar = useCopiar();

  useEffect(() => {
    api.conexion().then((d) => setUrl(d.url_mcp)).catch(() => {});
  }, []);

  const oculta = url.replace(/\/([^/]+)\/mcp$/, (_, t: string) => `/${"•".repeat(Math.min(t.length, 16))}/mcp`);
  const comandoClaude = `claude mcp add --transport http pincel-ia ${url}`;

  return (
    <>
      <Cabecera titulo="Conexiones" subtitulo="Conecta ChatGPT y Claude con Pincel IA" />

      <div className="card">
        <div className="card-head">
          <div className="stack gap-4">
            <h2>URL del conector</h2>
            <p className="muted small">La misma dirección sirve para ChatGPT y para Claude.</p>
          </div>
        </div>
        <div className="card-pad stack gap-12">
          <div className="copybox">
            <code>{url ? (ver ? url : oculta) : "Cargando…"}</code>
            <button className="btn ghost icon sm" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar" : "Mostrar"}>
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button className="btn sm" disabled={!url} onClick={() => copiar(url, "URL copiada")}>
              <Copy size={14} /> Copiar
            </button>
          </div>
          <div className="callout">
            <ShieldAlert size={18} />
            <p className="small">
              Esta URL incluye tu clave secreta: quien la tenga puede usar el conector. No la compartas ni la publiques.
            </p>
          </div>
        </div>
      </div>

      <div className="two-col section">
        <div className="card">
          <div className="card-head">
            <h2>Cómo conectar</h2>
            <div className="tabs" role="tablist">
              <button className={`tab ${tab === "chatgpt" ? "active" : ""}`} onClick={() => setTab("chatgpt")} role="tab" aria-selected={tab === "chatgpt"}>ChatGPT</button>
              <button className={`tab ${tab === "claude" ? "active" : ""}`} onClick={() => setTab("claude")} role="tab" aria-selected={tab === "claude"}>Claude</button>
            </div>
          </div>
          <div className="card-pad">
            {tab === "chatgpt" ? (
              <ol className="steps">
                <li><span>En ChatGPT abre <b>Configuración → Aplicaciones y conectores → Configuración avanzada</b> y activa el <b>Modo desarrollador</b>. Requiere plan Plus, Pro o Business.</span></li>
                <li><span>Pulsa <b>Crear</b> conector. Nombre: <b>Pincel IA</b>. URL: la de arriba. Autenticación: <b>Sin autenticación</b>.</span></li>
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
                      <button className="btn sm" disabled={!url} onClick={() => copiar(comandoClaude, "Comando copiado")}><Copy size={14} /></button>
                    </div>
                  </div>
                </li>
                <li><span>Pide a tu skill de ventas que guarde los prompts en Pincel IA.</span></li>
              </ol>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Frases útiles</h2></div>
          <div className="card-pad stack gap-8">
            {FRASES.map((f) => (
              <div className="phrase" key={f.texto}>
                <div className="stack gap-4 grow">
                  <span className={`badge ${f.donde === "ChatGPT" ? "success" : "accent"}`} style={{ alignSelf: "flex-start" }}>{f.donde}</span>
                  <span className="small">{f.texto}</span>
                </div>
                <button className="btn ghost icon sm" onClick={() => copiar(f.texto)} aria-label="Copiar frase"><Copy size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="callout info section">
        <Info size={18} />
        <div className="stack gap-4 small">
          <b>Si ChatGPT no logra enviar las imágenes</b>
          <span>
            ChatGPT crea las imágenes una por una. Si al decir “Enviar a la plataforma” no puede adjuntarlas, te dará el link de la campaña:
            descárgalas de ChatGPT y arrástralas todas juntas en la campaña. Se acomodan solas en orden.
          </span>
        </div>
      </div>
    </>
  );
}
