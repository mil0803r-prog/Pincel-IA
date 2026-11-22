import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  Copy,
  Download,
  Link2,
  ListPlus,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { api, DEMO, fecha, urlPublica, type Campana as TCampana, type Prompt } from "../api";
import { Anillo, Confirmar, Estado, Menu, Modal, useCopiar, useToast } from "../components/ui";
import Lightbox from "../components/Lightbox";

type Dialogo =
  | { tipo: "editar" }
  | { tipo: "agregar" }
  | { tipo: "eliminar" }
  | { tipo: "prompt"; p: Prompt }
  | { tipo: "quitar"; p: Prompt }
  | null;

export default function Campana() {
  const { id = "" } = useParams();
  const [c, setC] = useState<TCampana | null>(null);
  const [error, setError] = useState("");
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number } | null>(null);
  const [vista, setVista] = useState<"todas" | "faltan" | "listas">("todas");
  const [simulando, setSimulando] = useState(false);
  const simular = async () => {
    if (!api.simularChatGPT) return;
    setSimulando(true);
    let n = 0;
    try {
      while (n < 8 && (await api.simularChatGPT(id))) {
        n++;
        await cargar();
      }
      toast(n ? `ChatGPT envió ${n} ${n === 1 ? "imagen" : "imágenes"}` : "No falta ninguna imagen");
    } finally {
      setSimulando(false);
    }
  };
  const [arrastrando, setArrastrando] = useState(false);
  const [visor, setVisor] = useState<number | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const destino = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const copiar = useCopiar();
  const toast = useToast();
  const nav = useNavigate();

  const cargar = useCallback(() => api.campana(id).then(setC).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  // refresco automático mientras falten imágenes (por si ChatGPT las está enviando)
  useEffect(() => {
    if (!c || c.hechas === c.total) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") api.campana(id).then(setC).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [c, id]);

  const subir = useCallback(
    async (files: File[], n?: number) => {
      const imgs = files
        .filter((f) => f.type.startsWith("image/"))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (!imgs.length) return toast("Solo se aceptan imágenes", "error");
      // en tandas de 8 para soportar cualquier cantidad de archivos y mostrar el avance
      const TANDA = 8;
      let subidas = 0;
      const errores: { archivo: string; error: string }[] = [];
      setSubiendo({ hechas: 0, total: imgs.length });
      try {
        for (let i = 0; i < imgs.length; i += TANDA) {
          const parte = imgs.slice(i, i + TANDA);
          try {
            const r = await api.subirImagenes(id, parte, n ? n + i : undefined);
            subidas += r.subidas;
            errores.push(...r.errores);
          } catch (e) {
            errores.push({ archivo: `${parte.length} archivos`, error: (e as Error).message });
            if ((e as Error).message.includes("Todas las imágenes ya están cargadas")) break;
          }
          setSubiendo({ hechas: Math.min(i + TANDA, imgs.length), total: imgs.length });
          if (i + TANDA < imgs.length && (i / TANDA) % 3 === 2) cargar();
        }
        if (subidas) toast(subidas === 1 ? "Imagen cargada" : `${subidas} imágenes cargadas`);
        errores.slice(0, 3).forEach((e) => toast(`${e.archivo}: ${e.error}`, "error"));
        if (errores.length > 3) toast(`${errores.length - 3} archivos más no se pudieron cargar`, "error");
        await cargar();
      } finally {
        setSubiendo(null);
      }
    },
    [id, cargar, toast],
  );

  // arrastrar archivos sobre toda la página
  useEffect(() => {
    let cont = 0;
    const tieneArchivos = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => { if (tieneArchivos(e)) { cont++; setArrastrando(true); } };
    const leave = () => { cont = Math.max(0, cont - 1); if (!cont) setArrastrando(false); };
    const over = (e: DragEvent) => { if (tieneArchivos(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!tieneArchivos(e)) return;
      e.preventDefault();
      cont = 0;
      setArrastrando(false);
      if (!(e.target as HTMLElement).closest("[data-slot]")) subir([...(e.dataTransfer?.files || [])]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [subir]);

  function elegir(n?: number) {
    destino.current = n;
    if (inputRef.current) {
      inputRef.current.multiple = n === undefined;
      inputRef.current.click();
    }
  }

  if (error) {
    return (
      <div className="glass empty">
        <h2>No se pudo abrir la <em>campaña</em></h2>
        <p className="muted">{error}</p>
        <Link to="/campanas" className="btn">Volver a campañas</Link>
      </div>
    );
  }
  if (!c) return (
    <div className="stack gap-16">
      <div className="skeleton" style={{ height: 190 }} />
      <div className="grid-slots">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 330 }} />)}</div>
    </div>
  );

  const conImagen = c.prompts.filter((p) => p.imagen);
  const visibles = c.prompts.filter((p) => (vista === "faltan" ? !p.imagen : vista === "listas" ? !!p.imagen : true));
  const frase = `Trae la campaña ${c.nombre} de Pincel IA y crea las imágenes`;
  const todos = c.prompts.map((p) => `Imagen ${p.n}:\n${p.texto}`).join("\n\n");

  return (
    <>
      <section className="cover">
        {c.portada && <div className="cover-bg" style={{ backgroundImage: `url(${c.portada.ruta_miniatura})` }} />}
        <div className="cover-in">
          <div className="stack gap-12" style={{ minWidth: 0, flex: "1 1 360px" }}>
            <div className="crumbs"><Link to="/campanas">Campañas</Link><ChevronRight size={14} /><span className="ellipsis">{c.nombre}</span></div>
            <h1>{c.nombre}</h1>
            <div className="cover-meta">
              <Estado hechas={c.hechas} total={c.total} />
              <span>Creada {fecha(c.creado)}{c.origen === "claude" ? " por Claude" : ""}</span>
              {c.hechas < c.total && <span className="row gap-6"><Sparkles size={13} /> Se actualiza sola mientras llegan imágenes</span>}
            </div>
          </div>
          <div className="cover-right">
            <div className="row gap-12">
              <Anillo hechas={c.hechas} total={c.total} size={64} grosor={5} />
              <div className="stack">
                <span className="big" style={{ fontSize: 28 }}>{c.hechas}<span className="subtle" style={{ fontSize: 18 }}> / {c.total}</span></span>
                <span className="subtle small">imágenes</span>
              </div>
            </div>
            <div className="row gap-8">
              {DEMO && c.hechas < c.total && (
                <button className="btn" onClick={simular} disabled={simulando}>
                  {simulando ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {simulando ? "ChatGPT enviando…" : "Simular ChatGPT"}
                </button>
              )}
              <button className="btn glow" onClick={() => copiar(frase, "Frase copiada: pégala en ChatGPT")}>
                <MessageSquareText size={16} /> Copiar para ChatGPT
              </button>
              <a className={`btn icon ${c.hechas ? "" : "disabled"}`} href={c.hechas && !DEMO ? `/api/campanas/${c.id}/zip` : undefined} onClick={DEMO ? () => toast("El ZIP se descarga en la versión publicada") : undefined} aria-disabled={!c.hechas} title="Descargar ZIP" aria-label="Descargar ZIP">
                <Download size={16} />
              </a>
              <Menu boton={(abrir) => <button className="btn icon" onClick={abrir} aria-label="Más opciones"><MoreHorizontal size={18} /></button>}>
                {(cerrar) => (
                  <>
                    <button onClick={() => { cerrar(); copiar(todos, "Prompts copiados"); }}><Copy size={16} /> Copiar todos los prompts</button>
                    <button onClick={() => { cerrar(); setDialogo({ tipo: "editar" }); }}><Pencil size={16} /> Editar nombre y notas</button>
                    <button onClick={() => { cerrar(); setDialogo({ tipo: "agregar" }); }}><ListPlus size={16} /> Agregar prompts</button>
                    <hr />
                    <button className="danger" onClick={() => { cerrar(); setDialogo({ tipo: "eliminar" }); }}><Trash2 size={16} /> Eliminar campaña</button>
                  </>
                )}
              </Menu>
            </div>
          </div>
        </div>
      </section>

      {c.notas && <div className="notes"><Pencil size={15} /><span><b>Notas de estilo:</b> {c.notas}</span></div>}
      <div className="dropzone" onClick={() => elegir()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && elegir()}>
        <span className="dropzone-icon">{subiendo ? <Loader2 size={20} className="spin" /> : <UploadCloud size={20} />}</span>
        <div className="stack gap-4 grow">
          <b>{subiendo ? `Subiendo ${subiendo.hechas} de ${subiendo.total}…` : "Arrastra aquí las imágenes de ChatGPT"}</b>
          <span className="muted small hide-sm">Suelta varias a la vez y se acomodan en orden en los puestos vacíos, o suelta cada una en su tarjeta.</span>
        </div>
        <span className="btn sm" aria-hidden><Upload size={14} /> Elegir archivos</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          subir([...(e.target.files || [])], destino.current);
          e.target.value = "";
        }}
      />

      {subiendo && <div className="progress" style={{ marginTop: 10 }}><div style={{ width: `${(subiendo.hechas / subiendo.total) * 100}%` }} /></div>}

      <div className="row between wrap" style={{ marginTop: 22, gap: 12 }}>
        <div className="chips" role="tablist" style={{ margin: 0 }}>
          <button className={`chip ${vista === "todas" ? "on" : ""}`} onClick={() => setVista("todas")} role="tab" aria-selected={vista === "todas"}>Todas · {c.total}</button>
          <button className={`chip ${vista === "faltan" ? "on" : ""}`} onClick={() => setVista("faltan")} role="tab" aria-selected={vista === "faltan"}>Faltan · {c.total - c.hechas}</button>
          <button className={`chip ${vista === "listas" ? "on" : ""}`} onClick={() => setVista("listas")} role="tab" aria-selected={vista === "listas"}>Listas · {c.hechas}</button>
        </div>
        <button className="btn sm" onClick={() => setDialogo({ tipo: "agregar" })}><Plus size={14} /> Agregar prompts</button>
      </div>

      {visibles.length === 0 && (
        <div className="glass empty" style={{ marginTop: 16, padding: 40 }}>
          <p className="muted">{vista === "faltan" ? "¡No falta ninguna! La campaña está completa." : "Todavía no hay imágenes cargadas."}</p>
        </div>
      )}
      <div className="grid-slots">
        {visibles.map((p) => (
          <Slot
            key={p.n}
            p={p}
            onVer={() => setVisor(conImagen.findIndex((x) => x.n === p.n))}
            onElegir={() => elegir(p.n)}
            onSoltar={(files) => subir(files, p.n)}
            onEditar={() => setDialogo({ tipo: "prompt", p })}
            onQuitar={() => setDialogo({ tipo: "quitar", p })}
          />
        ))}
      </div>

      {arrastrando && (
        <div className="drag-overlay"><div><span className="dropzone-icon"><UploadCloud size={22} /></span>Suelta las imágenes para cargarlas</div></div>
      )}

      {visor !== null && (
        <Lightbox
          items={conImagen.map((p) => ({ imagen: p.imagen!, titulo: `${c.nombre} · #${p.n}`, prompt: p.texto }))}
          indice={visor}
          onCambiar={setVisor}
          onCerrar={() => setVisor(null)}
        />
      )}

      {dialogo?.tipo === "editar" && <EditarCampana c={c} onListo={(n) => { setC(n); setDialogo(null); }} onCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "agregar" && <AgregarPrompts c={c} onListo={(n) => { setC(n); setDialogo(null); }} onCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "prompt" && <EditarPrompt c={c} p={dialogo.p} onListo={(n) => { setC(n); setDialogo(null); }} onCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "quitar" && (
        <Confirmar
          titulo={`Quitar la imagen #${dialogo.p.n}`}
          texto="La imagen se borrará de la plataforma y su link dejará de funcionar. El prompt se mantiene."
          accion="Quitar imagen"
          onCerrar={() => setDialogo(null)}
          onSi={async () => { setC(await api.quitarImagen(c.id, dialogo.p.n)); setDialogo(null); toast("Imagen quitada"); }}
        />
      )}
      {dialogo?.tipo === "eliminar" && (
        <Confirmar
          titulo="Eliminar campaña"
          texto={`Se borrarán “${c.nombre}”, sus ${c.total} prompts y ${c.hechas} imágenes. Los links públicos dejarán de funcionar. No se puede deshacer.`}
          accion="Eliminar"
          onCerrar={() => setDialogo(null)}
          onSi={async () => { await api.eliminarCampana(c.id); toast("Campaña eliminada"); nav("/campanas"); }}
        />
      )}
    </>
  );
}

function Slot({
  p,
  onVer,
  onElegir,
  onSoltar,
  onEditar,
  onQuitar,
}: {
  p: Prompt;
  onVer: () => void;
  onElegir: () => void;
  onSoltar: (f: File[]) => void;
  onEditar: () => void;
  onQuitar: () => void;
}) {
  const [encima, setEncima] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const copiar = useCopiar();
  const eventos = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setEncima(true); },
    onDragLeave: () => setEncima(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setEncima(false); onSoltar([...e.dataTransfer.files]); },
  };
  return (
    <div className="glass slot" data-slot={p.n} {...eventos}>
      <div className="slot-media">
        {p.imagen ? (
          <>
            <img src={p.imagen.ruta_miniatura} alt={`Imagen ${p.n}`} loading="lazy" onClick={onVer} />
            <div className="slot-tools">
              <button title="Copiar link público" aria-label="Copiar link" onClick={() => copiar(urlPublica(p.imagen!.ruta), "Link copiado")}><Link2 size={15} /></button>
              <a title="Descargar" aria-label="Descargar" href={p.imagen.ruta} download><Download size={15} /></a>
              <button title="Reemplazar imagen" aria-label="Reemplazar imagen" onClick={onElegir}><RefreshCw size={15} /></button>
              <button title="Quitar imagen" aria-label="Quitar imagen" onClick={onQuitar}><X size={15} /></button>
            </div>
          </>
        ) : (
          <button className={`slot-empty ${encima ? "over" : ""}`} onClick={onElegir}>
            <span className="plus"><Plus size={20} /></span>
            <span className="small">Suelta la imagen {p.n}<br />o haz clic para elegirla</span>
          </button>
        )}
        <span className={`badge ${p.imagen ? "onimg" : ""} slot-num`}>#{p.n}</span>
      </div>
      <div className="slot-body">
        <p className={`slot-prompt ${abierto ? "open" : ""}`} onClick={() => setAbierto(!abierto)} title="Clic para ver completo">
          {p.texto}
        </p>
        <div className="slot-foot">
          <span className="subtle small">{p.imagen ? (p.imagen.origen === "chatgpt" ? "Desde ChatGPT" : "Subida") : "Esperando imagen"}</span>
          <div className="row gap-4">
            <button className="icon-btn" title="Copiar prompt" aria-label="Copiar prompt" onClick={() => copiar(p.texto, "Prompt copiado")}><Copy size={15} /></button>
            <button className="icon-btn" title="Editar prompt" aria-label="Editar prompt" onClick={onEditar}><Pencil size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useGuardar<T>(accion: () => Promise<T>, onListo: (r: T) => void) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const guardar = async () => {
    setOcupado(true);
    setError("");
    try {
      onListo(await accion());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, error, guardar };
}

function Pie({ ocupado, onCerrar, onGuardar, texto = "Guardar", deshabilitado }: { ocupado: boolean; onCerrar: () => void; onGuardar: () => void; texto?: string; deshabilitado?: boolean }) {
  return (
    <>
      <button className="btn" onClick={onCerrar}>Cancelar</button>
      <button className="btn primary" disabled={ocupado || deshabilitado} onClick={onGuardar}>
        {ocupado && <Loader2 size={16} className="spin" />} {texto}
      </button>
    </>
  );
}

function EditarCampana({ c, onListo, onCerrar }: { c: TCampana; onListo: (c: TCampana) => void; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(c.nombre);
  const [notas, setNotas] = useState(c.notas);
  const { ocupado, error, guardar } = useGuardar(() => api.editarCampana(c.id, { nombre, notas }), onListo);
  return (
    <Modal titulo={<>Editar <em>campaña</em></>} onCerrar={onCerrar} pie={<Pie ocupado={ocupado} onCerrar={onCerrar} onGuardar={guardar} deshabilitado={!nombre.trim()} />}>
      <div className="field">
        <label htmlFor="ec-n">Nombre</label>
        <input id="ec-n" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="ec-s">Notas de estilo</label>
        <textarea id="ec-s" className="textarea" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}

function AgregarPrompts({ c, onListo, onCerrar }: { c: TCampana; onListo: (c: TCampana) => void; onCerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const { ocupado, error, guardar } = useGuardar(() => api.agregarPrompts(c.id, texto), onListo);
  return (
    <Modal titulo={<>Agregar <em>prompts</em></>} descripcion={`Se añadirán a partir del #${c.total + 1}.`} onCerrar={onCerrar} pie={<Pie ocupado={ocupado} onCerrar={onCerrar} onGuardar={guardar} texto="Agregar" deshabilitado={!texto.trim()} />}>
      <div className="field">
        <label htmlFor="ap-t">Prompts</label>
        <textarea id="ap-t" className="textarea" rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <span className="hint">Separa cada prompt con una línea en blanco o numéralos.</span>
      </div>
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}

function EditarPrompt({ c, p, onListo, onCerrar }: { c: TCampana; p: Prompt; onListo: (c: TCampana) => void; onCerrar: () => void }) {
  const [texto, setTexto] = useState(p.texto);
  const { ocupado, error, guardar } = useGuardar(() => api.editarPrompt(c.id, p.n, texto), onListo);
  return (
    <Modal titulo={<>Prompt <em>#{p.n}</em></>} onCerrar={onCerrar} ancho={640} pie={<Pie ocupado={ocupado} onCerrar={onCerrar} onGuardar={guardar} deshabilitado={!texto.trim()} />}>
      <textarea className="textarea" rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus aria-label="Texto del prompt" />
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}
