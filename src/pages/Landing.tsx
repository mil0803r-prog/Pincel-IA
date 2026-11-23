import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { api, DEMO, fecha, peso, type EstadoImagen, type ImagenLanding, type Landing as TLanding, type ResultadoImportar, type TipoLanding } from "../api";
import { Anillo, Confirmar, Menu, Modal, useCopiar, useToast } from "../components/ui";
import { descargarPaquete, tandasExactas } from "../subida";

const TIPOS: { id: TipoLanding; nombre: string; texto: string }[] = [
  { id: "imagenes", nombre: "Landing de imágenes", texto: "Casi todo son imágenes apiladas" },
  { id: "ficha", nombre: "Ficha de producto", texto: "Mucho texto y pocas imágenes" },
  { id: "hibrida", nombre: "Híbrida", texto: "Mezcla de ambas" },
];
const CAMBIOS: [string, string][] = [
  ["Precio", "Cambiar el precio por "],
  ["Moneda", "Cambiar la moneda a "],
  ["Bandera", "Cambiar la bandera por la de "],
  ["Transportadora", "Cambiar el logo de la transportadora por "],
  ["Idioma", "Traducir el texto a "],
  ["Garantía", "Ajustar la garantía a "],
];
const ESTADO: Record<EstadoImagen, { texto: string; clase: string }> = {
  sin_decidir: { texto: "Sin decidir", clase: "" },
  intacta: { texto: "Intacta", clase: "accent" },
  por_editar: { texto: "Por editar", clase: "warning" },
  editada: { texto: "Edición lista", clase: "success" },
  dimension: { texto: "Medida distinta", clase: "warning" },
};

export default function Landing() {
  const { id = "" } = useParams();
  const [l, setL] = useState<TLanding | null>(null);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [importando, setImportando] = useState(false);
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportar | null>(null);
  const [dialogo, setDialogo] = useState<"editar" | "eliminar" | "reemplazar" | null>(null);
  const [armando, setArmando] = useState(false);
  const inputOriginales = useRef<HTMLInputElement>(null);
  const copiar = useCopiar();
  const toast = useToast();
  const nav = useNavigate();

  const cargar = useCallback(
    () => api.landing(id).then((x) => { setL(x); setUrl((u) => u || x.url); }).catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => { cargar(); }, [cargar]);

  // mientras haya ediciones por llegar (ChatGPT trabajando), la página se actualiza sola
  const porEditar = l ? l.imagenes.filter((i) => i.estado === "por_editar" || i.estado === "dimension").length : 0;
  useEffect(() => {
    if (!porEditar) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") api.landing(id).then(setL).catch(() => {}); }, 8000);
    return () => clearInterval(t);
  }, [porEditar, id]);

  async function importar(reemplazar = false) {
    if (!l) return;
    setImportando(true);
    try {
      const r = await api.importarLanding(l.id, url, reemplazar);
      setL(r.landing);
      setResultado(r);
      toast(`${r.importadas} ${r.importadas === 1 ? "imagen importada" : "imágenes importadas"}${r.omitidas.length ? ` · ${r.omitidas.length} omitidas` : ""}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setImportando(false);
    }
  }

  async function subirManual(files: File[]) {
    if (!l) return;
    const imgs = files.filter((f) => f.type.startsWith("image/")).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!imgs.length) return toast("Solo se aceptan imágenes", "error");
    let hechas = 0;
    let errores = 0;
    setSubiendo({ hechas: 0, total: imgs.length });
    try {
      for (const tanda of tandasExactas(imgs)) {
        try {
          const r = await api.subirOriginales(l.id, tanda);
          hechas += r.importadas;
          errores += r.errores.length;
        } catch (e) {
          errores += tanda.length;
          toast((e as Error).message, "error");
        }
        setSubiendo({ hechas: Math.min(hechas + errores, imgs.length), total: imgs.length });
      }
      toast(`${hechas} ${hechas === 1 ? "imagen cargada" : "imágenes cargadas"}${errores ? ` · ${errores} con error` : ""}`, errores && !hechas ? "error" : "ok");
      await cargar();
    } finally {
      setSubiendo(null);
    }
  }

  async function paquete() {
    if (!l) return;
    if (DEMO) return toast("El paquete se descarga en la versión publicada");
    setArmando(true);
    try {
      await descargarPaquete(await api.paquete(l.id), (h, t) => h === t || toast(`Preparando paquete… ${h} de ${t}`));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setArmando(false);
    }
  }

  if (error) {
    return (
      <div className="glass empty">
        <h2>No se pudo abrir la <em>landing</em></h2>
        <p className="muted">{error}</p>
        <Link to="/landing" className="btn">Volver a landings</Link>
      </div>
    );
  }
  if (!l) return <div className="skeleton" style={{ height: 420 }} />;

  const mensajeGPT = `Usa el conector Pincel IA. Trae las ediciones pendientes de la landing "${l.nombre}" (id ${l.id}) con obtener_ediciones. Edita cada imagen según su instrucción, conservando exactamente su ancho y alto y todos los cintillos de oferta, y súbela de inmediato con subir_edicion sin esperar a que te lo pida. Repite hasta que no falte ninguna y dime cuántas quedaron cargadas.`;
  const mensajeClaude = `Revisa la landing "${l.nombre}" de Pincel IA (id ${l.id}). Primero obtén el mercado con obtener_mercado; si faltan país, moneda o idioma, pregúntamelos. Si faltan imágenes, impórtalas con importar_landing. Revísalas una por una (precios, paquetes, precios anteriores, banderas, transportadoras, moneda, idioma, garantía), clasifica la landing y registra la revisión con registrar_auditoria, marcando para editar solo lo que lo necesite. Antes de decidir los precios, muéstrame todos los que encuentres y pregúntame si los conservo o los cambio.`;
  const urlChatGPT = `https://chatgpt.com/?q=${encodeURIComponent(mensajeGPT)}`;
  const sugerido = resultado?.tipo_sugerido && !l.tipo ? TIPOS.find((t) => t.id === resultado.tipo_sugerido) : null;

  return (
    <>
      <section className="cover">
        {l.portada && <div className="cover-bg" style={{ backgroundImage: `url(${l.portada})` }} />}
        <div className="cover-in">
          <div className="stack gap-12" style={{ minWidth: 0, flex: "1 1 360px" }}>
            <div className="crumbs"><Link to="/landing">Landing</Link><ChevronRight size={14} /><span className="ellipsis">{l.nombre}</span></div>
            <h1>{l.nombre}</h1>
            <div className="cover-meta">
              {l.lista ? <span className="badge success"><span className="dot" />Lista para entregar</span> : <span className="badge accent"><span className="dot" />En curso</span>}
              {l.tipo && <span>{TIPOS.find((t) => t.id === l.tipo)?.nombre}</span>}
              {l.url && <a className="row gap-6" href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Ver fuente</a>}
              <span className="subtle">Creada {fecha(l.creado)}</span>
            </div>
          </div>
          <div className="cover-right">
            <div className="row gap-12">
              <Anillo hechas={l.listas} total={l.total} size={64} grosor={5} />
              <div className="stack">
                <span className="big" style={{ fontSize: 28 }}>{l.listas}<span className="subtle" style={{ fontSize: 18 }}> / {l.total}</span></span>
                <span className="subtle small">imágenes listas</span>
              </div>
            </div>
            <div className="row gap-8 wrap">
              {porEditar > 0 && (
                <a className="btn glow" href={urlChatGPT} target="_blank" rel="noopener noreferrer" onClick={() => copiar(mensajeGPT, "Mensaje copiado. En ChatGPT activa el conector Pincel IA (+ → Pincel IA)")}>
                  <Send size={16} /> Enviar a ChatGPT
                </a>
              )}
              <button className="btn" onClick={() => copiar(mensajeClaude, "Mensaje copiado: pégalo en Claude")}>
                <Sparkles size={16} /> Revisión con Claude
              </button>
              <button className="btn icon" onClick={paquete} disabled={!l.total || armando} title="Descargar paquete de entrega" aria-label="Descargar paquete de entrega">
                {armando ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
              </button>
              <Menu boton={(abrir) => <button className="btn icon" onClick={abrir} aria-label="Más opciones"><MoreHorizontal size={18} /></button>}>
                {(cerrar) => (
                  <>
                    <button onClick={() => { cerrar(); setDialogo("editar"); }}><Pencil size={16} /> Editar nombre, fuente y notas</button>
                    <button onClick={() => { cerrar(); copiar(mensajeGPT, "Mensaje para ChatGPT copiado"); }}><Send size={16} /> Copiar mensaje para ChatGPT</button>
                    <hr />
                    <button className="danger" onClick={() => { cerrar(); setDialogo("eliminar"); }}><Trash2 size={16} /> Eliminar landing</button>
                  </>
                )}
              </Menu>
            </div>
          </div>
        </div>
      </section>

      {!l.mercado.configurado && (
        <div className="callout" style={{ marginBottom: 12 }}>
          <AlertTriangle size={18} />
          <div className="row between wrap gap-12 grow">
            <p className="small">Falta configurar el mercado de venta (<b>{l.mercado.faltan.join(", ")}</b>) para poder cerrar la entrega.</p>
            <Link className="btn sm primary" to="/mercado">Configurar mercado</Link>
          </div>
        </div>
      )}

      <section className="glass pad">
        <div className="row between wrap gap-12" style={{ marginBottom: l.pendientes.length ? 12 : 0 }}>
          <h2>Para cerrar la <em>entrega</em></h2>
          {l.lista && (
            <span className="row gap-8 wrap">
              <span className="badge success"><span className="dot" />Todo resuelto</span>
              <button className="btn sm primary" onClick={paquete} disabled={armando}><Download size={14} /> Descargar paquete</button>
            </span>
          )}
        </div>
        {l.pendientes.length > 0 ? (
          <ul className="pendientes">
            {l.pendientes.map((p) => <li key={p.clave}><Circle size={15} />{p.texto}</li>)}
          </ul>
        ) : (
          <p className="muted small" style={{ marginTop: 8 }}>No queda nada pendiente: el paquete incluye los banners numerados en su orden real, los complementos y los documentos.</p>
        )}
      </section>

      <div className="two-col section" style={{ marginTop: 16 }}>
        <section className="glass">
          <div className="card-head"><h2>Imágenes de la <em>página</em></h2></div>
          <div className="pad stack gap-12">
            <div className="field">
              <label htmlFor="l-url">Dirección de la landing</label>
              <div className="row gap-8">
                <input id="l-url" className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url.trim() && (l.total ? setDialogo("reemplazar") : importar())} />
                <button className="btn primary" disabled={!url.trim() || importando} onClick={() => (l.total ? setDialogo("reemplazar") : importar())}>
                  {importando ? <Loader2 size={16} className="spin" /> : <Link2 size={16} />} Importar
                </button>
              </div>
              <span className="hint">Trae las imágenes en el orden de la página, como se ve en el móvil, y mide cada archivo original.</span>
            </div>
            <div
              className="dropzone"
              role="button"
              tabIndex={0}
              onClick={() => inputOriginales.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && inputOriginales.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); subirManual([...e.dataTransfer.files]); }}
            >
              <span className="dropzone-icon">{subiendo ? <Loader2 size={20} className="spin" /> : <UploadCloud size={20} />}</span>
              <div className="stack gap-4 grow">
                <b>{subiendo ? `Subiendo ${subiendo.hechas} de ${subiendo.total}…` : "O arrastra aquí las imágenes en orden"}</b>
                <span className="muted small hide-sm">Si la página no deja importarlas (cargan con JavaScript), súbelas tú. Se numeran por nombre.</span>
              </div>
            </div>
            <input ref={inputOriginales} type="file" accept="image/*" multiple hidden onChange={(e) => { subirManual([...(e.target.files || [])]); e.target.value = ""; }} />
            {resultado && resultado.omitidas.length > 0 && (
              <details className="registro" style={{ margin: 0 }}>
                <summary>{resultado.omitidas.length} omitidas al importar</summary>
                <ul>{resultado.omitidas.slice(0, 12).map((o, i) => <li key={i} style={{ gridTemplateColumns: "1fr" }}><span className="muted small ellipsis" title={o.url}>{o.motivo} · {o.url}</span></li>)}</ul>
              </details>
            )}
          </div>
        </section>

        <section className="glass">
          <div className="card-head"><h2>Tipo y <em>precios</em></h2></div>
          <div className="pad stack gap-16">
            <div className="stack gap-8">
              <span className="small" style={{ fontWeight: 500 }}>Clasificación por contenido visible</span>
              <div className="chips" style={{ marginBottom: 0, flexWrap: "wrap" }}>
                {TIPOS.map((t) => (
                  <button key={t.id} className={`chip ${l.tipo === t.id ? "on" : ""}`} title={t.texto} onClick={() => api.editarLanding(l.id, { tipo: t.id }).then(setL).catch((e) => toast(e.message, "error"))}>{t.nombre}</button>
                ))}
              </div>
              {sugerido && <span className="hint">Pista de la importación: parece «{sugerido.nombre}». Confírmalo tú.</span>}
            </div>
            <div className="stack gap-8">
              <span className="small" style={{ fontWeight: 500 }}>¿Qué haces con los precios?</span>
              <div className="chips" style={{ marginBottom: 0 }}>
                <button className={`chip ${l.precios_decision === "conservar" ? "on" : ""}`} onClick={() => api.editarLanding(l.id, { precios_decision: "conservar" }).then(setL).catch((e) => toast(e.message, "error"))}>Conservar</button>
                <button className={`chip ${l.precios_decision === "cambiar" ? "on" : ""}`} onClick={() => api.editarLanding(l.id, { precios_decision: "cambiar" }).then(setL).catch((e) => toast(e.message, "error"))}>Cambiar</button>
              </div>
              {l.precios_decision === "cambiar" && (
                <CampoTexto id="l-nuevos" etiqueta="Importes nuevos" rows={3} valor={l.precios_nuevos} placeholder={`Ej. 1 unidad: $79.900 · 2 unidades: $129.900 (${l.mercado.moneda ?? "moneda"})`} onGuardar={(v) => api.editarLanding(l.id, { precios_nuevos: v }).then(setL)} />
              )}
              <span className="hint">Esta decisión se toma en cada landing. Si eliges cambiar, hacen falta los importes para poder cerrar la entrega.</span>
            </div>
            <CampoTexto id="l-hallados" etiqueta="Precios, paquetes y ahorros encontrados" rows={3} valor={l.precios_encontrados} placeholder="Uno por línea. Revisa también los que están dentro de las imágenes." onGuardar={(v) => api.editarLanding(l.id, { precios_encontrados: v }).then(setL)} />
            <CampoTexto id="l-transp" etiqueta="Transportadoras confirmadas en esta landing" rows={1} valor={l.transportadoras_ok} placeholder="Solo las confirmadas para esta tienda" onGuardar={(v) => api.editarLanding(l.id, { transportadoras_ok: v }).then(setL)} />
          </div>
        </section>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4">
            <span className="eyebrow">Secuencia real de la página</span>
            <h2>Imágenes <em>({l.total})</em></h2>
          </div>
          {l.total > 0 && (
            <span className="row gap-8 wrap small muted">
              <span>{l.sin_decidir} sin decidir</span><span className="subtle">·</span><span>{l.a_editar} a editar</span><span className="subtle">·</span><span>{l.listas} listas</span>
            </span>
          )}
        </div>
        {l.total === 0 ? (
          <div className="glass empty" style={{ padding: 40 }}>
            <div className="empty-icon"><Globe size={24} /></div>
            <p className="muted">Todavía no hay imágenes. Importa la dirección de la landing o arrástralas arriba.</p>
          </div>
        ) : (
          <div className="stack gap-16">
            {l.imagenes.map((i) => <FilaImagen key={i.id} lid={l.id} i={i} onCambio={setL} />)}
          </div>
        )}
      </section>

      {dialogo === "editar" && <EditarLanding l={l} onListo={(x) => { setL(x); setUrl(x.url); setDialogo(null); }} onCerrar={() => setDialogo(null)} />}
      {dialogo === "reemplazar" && (
        <Confirmar
          titulo="Importar de nuevo"
          texto="Esto reemplaza las imágenes actuales de la landing, junto con sus decisiones y ediciones. ¿Quieres continuar?"
          accion="Reemplazar"
          onCerrar={() => setDialogo(null)}
          onSi={async () => { setDialogo(null); await importar(true); }}
        />
      )}
      {dialogo === "eliminar" && (
        <Confirmar
          titulo="Eliminar landing"
          texto={`Se borrarán “${l.nombre}”, sus ${l.total} imágenes y todas sus ediciones. No se puede deshacer.`}
          accion="Eliminar"
          onCerrar={() => setDialogo(null)}
          onSi={async () => { await api.eliminarLanding(l.id); toast("Landing eliminada"); nav("/landing"); }}
        />
      )}
    </>
  );
}

/** Campo de texto que guarda al salir de él. */
function CampoTexto({ id, etiqueta, valor, rows, placeholder, onGuardar }: { id: string; etiqueta: string; valor: string; rows: number; placeholder?: string; onGuardar: (v: string) => Promise<unknown> }) {
  const [v, setV] = useState(valor);
  const toast = useToast();
  useEffect(() => setV(valor), [valor]);
  return (
    <div className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <textarea
        id={id}
        className="textarea"
        rows={rows}
        style={{ minHeight: rows === 1 ? 42 : 80 }}
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== valor) onGuardar(v).catch((e) => toast((e as Error).message, "error")); }}
      />
    </div>
  );
}

function FilaImagen({ lid, i, onCambio }: { lid: string; i: ImagenLanding; onCambio: (l: TLanding) => void }) {
  const [instr, setInstr] = useState(i.instruccion);
  const [hall, setHall] = useState(i.hallazgos);
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [quitar, setQuitar] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  useEffect(() => setInstr(i.instruccion), [i.instruccion]);
  useEffect(() => setHall(i.hallazgos), [i.hallazgos]);

  const guardar = (cambios: Partial<Record<string, string | null>>) => api.editarImagenLanding(lid, i.n, cambios).then(onCambio).catch((e) => toast((e as Error).message, "error"));

  async function subirFinal(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return toast("Solo se aceptan imágenes", "error");
    setSubiendo(true);
    try {
      const nuevo = await api.subirFinal(lid, i.n, file);
      onCambio(nuevo);
      const f = nuevo.imagenes.find((x) => x.n === i.n)?.final;
      toast(f?.estado === "ok" ? "Edición aceptada" : "La medida no coincide con el original", f?.estado === "ok" ? "ok" : "error");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSubiendo(false);
    }
  }

  const est = ESTADO[i.estado];
  return (
    <article className="glass lim">
      <a className="lim-orig" href={i.ruta} target="_blank" rel="noopener noreferrer" title="Abrir el original">
        <img src={i.ruta_miniatura} alt={`Original ${i.n}`} loading="lazy" />
        <span className="badge onimg slot-num">#{i.n}</span>
      </a>

      <div className="lim-ctrl stack gap-12">
        <div className="row between wrap gap-8">
          <div className="row gap-8 wrap">
            <b className="mono">{i.ancho} × {i.alto} px</b>
            <span className="subtle small">{peso(i.bytes)} · {i.formato.toUpperCase()}</span>
          </div>
          <span className={`badge ${est.clase}`}>{est.texto}</span>
        </div>
        <div className="row gap-8 wrap">
          <div className="tabs" role="group" aria-label="Qué hacer con esta imagen">
            <button className={`tab ${i.accion === "intacta" ? "active" : ""}`} onClick={() => guardar({ accion: i.accion === "intacta" ? null : "intacta" })}>Intacta</button>
            <button className={`tab ${i.accion === "editar" ? "active" : ""}`} onClick={() => guardar({ accion: i.accion === "editar" ? null : "editar" })}>Editar</button>
          </div>
          <div className="tabs" role="group" aria-label="Tipo de pieza">
            <button className={`tab ${i.rol === "banner" ? "active" : ""}`} onClick={() => guardar({ rol: "banner" })}>Banner</button>
            <button className={`tab ${i.rol === "carrusel" ? "active" : ""}`} onClick={() => guardar({ rol: "carrusel" })}>Carrusel</button>
          </div>
          <button className="icon-btn" onClick={() => setQuitar(true)} aria-label="Quitar imagen de la secuencia" title="Quitar de la secuencia (p. ej. un ícono)"><X size={15} /></button>
        </div>
        {i.accion === "editar" && (
          <div className="field">
            <label htmlFor={`ins-${i.id}`}>Qué cambiar</label>
            <textarea id={`ins-${i.id}`} className="textarea" rows={2} style={{ minHeight: 64 }} value={instr} placeholder="Ej. Cambiar el precio por $79.900 COP y la bandera por la de Colombia" onChange={(e) => setInstr(e.target.value)} onBlur={() => instr !== i.instruccion && guardar({ instruccion: instr })} />
            <div className="chips" style={{ margin: 0, flexWrap: "wrap" }}>
              {CAMBIOS.map(([nombre, texto]) => (
                <button key={nombre} className="chip" style={{ height: 28, fontSize: 12.5 }} onClick={() => { const nuevo = instr ? `${instr.replace(/\s+$/, "")}. ${texto}` : texto; setInstr(nuevo); guardar({ instruccion: nuevo }); }}>+ {nombre}</button>
              ))}
            </div>
          </div>
        )}
        <details className="registro" style={{ margin: 0 }}>
          <summary>Lo que se ve en esta imagen (precios, banderas, logos)</summary>
          <textarea className="textarea" rows={2} style={{ minHeight: 56, marginBottom: 10 }} value={hall} aria-label="Hallazgos de la imagen" onChange={(e) => setHall(e.target.value)} onBlur={() => hall !== i.hallazgos && guardar({ hallazgos: hall })} />
        </details>
      </div>

      <div
        className={`lim-final ${encima ? "over" : ""}`}
        onDragOver={(e) => { if (i.accion === "editar") { e.preventDefault(); setEncima(true); } }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); if (i.accion === "editar") subirFinal(e.dataTransfer.files[0]); }}
      >
        {i.accion === "intacta" ? (
          <div className="lim-nota"><CheckCircle2 size={20} /><span className="small">Se copia intacta al paquete</span></div>
        ) : i.accion !== "editar" ? (
          <div className="lim-nota"><Circle size={20} /><span className="small">Decide qué hacer con esta imagen</span></div>
        ) : i.final ? (
          <>
            <a href={i.final.ruta} target="_blank" rel="noopener noreferrer" className="lim-fimg"><img src={i.final.ruta_miniatura} alt={`Edición ${i.n}`} loading="lazy" /></a>
            <div className="stack gap-4">
              <span className="mono small">{i.final.ancho} × {i.final.alto} px</span>
              <span className={`small ${i.final.estado === "ok" ? "muted" : "aviso-medida"}`}>{i.final.nota}</span>
              <div className="row gap-4">
                <button className="btn ghost sm" onClick={() => input.current?.click()} disabled={subiendo}>{subiendo ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Reemplazar</button>
                <button className="btn ghost sm" onClick={() => api.quitarFinal(lid, i.n).then(onCambio)}><X size={14} /> Quitar</button>
              </div>
            </div>
          </>
        ) : (
          <button className="lim-vacio" onClick={() => input.current?.click()} disabled={subiendo}>
            {subiendo ? <Loader2 size={20} className="spin" /> : <UploadCloud size={20} />}
            <span className="small">Suelta aquí la edición<br />({i.ancho} × {i.alto} px)</span>
          </button>
        )}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { subirFinal(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      {quitar && (
        <Confirmar
          titulo={`Quitar la imagen #${i.n}`}
          texto="Se quita de la secuencia y el resto se renumera. Úsalo para íconos o piezas que no forman parte de la landing."
          accion="Quitar"
          onCerrar={() => setQuitar(false)}
          onSi={async () => { onCambio(await api.quitarImagenLanding(lid, i.n)); setQuitar(false); }}
        />
      )}
    </article>
  );
}

function EditarLanding({ l, onListo, onCerrar }: { l: TLanding; onListo: (l: TLanding) => void; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(l.nombre);
  const [url, setUrl] = useState(l.url);
  const [notas, setNotas] = useState(l.notas);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  async function guardar() {
    setOcupado(true);
    setError("");
    try {
      onListo(await api.editarLanding(l.id, { nombre, url, notas }));
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }
  return (
    <Modal titulo={<>Editar <em>landing</em></>} onCerrar={onCerrar} pie={<><button className="btn" onClick={onCerrar}>Cancelar</button><button className="btn primary" disabled={ocupado || !nombre.trim()} onClick={guardar}>{ocupado && <Loader2 size={16} className="spin" />} Guardar</button></>}>
      <div className="field"><label htmlFor="el-n">Nombre</label><input id="el-n" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></div>
      <div className="field"><label htmlFor="el-u">Dirección de la fuente</label><input id="el-u" className="input" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
      <div className="field"><label htmlFor="el-t">Notas</label><textarea id="el-t" className="textarea" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}
