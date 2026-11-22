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
  RefreshCw,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { api, fecha, urlPublica, type Campana as TCampana, type Prompt } from "../api";
import { Cabecera, Confirmar, Estado, Menu, Modal, Progreso, useCopiar, useToast } from "../components/ui";
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
  const [subiendo, setSubiendo] = useState(false);
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
      setSubiendo(true);
      try {
        const r = await api.subirImagenes(id, imgs, n);
        if (r.subidas) toast(r.subidas === 1 ? "Imagen cargada" : `${r.subidas} imágenes cargadas`);
        r.errores.forEach((e) => toast(`${e.archivo}: ${e.error}`, "error"));
        await cargar();
      } catch (e) {
        toast((e as Error).message, "error");
      } finally {
        setSubiendo(false);
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
      <div className="card empty">
        <h2>No se pudo abrir la campaña</h2>
        <p className="muted">{error}</p>
        <Link to="/campanas" className="btn">Volver a campañas</Link>
      </div>
    );
  }
  if (!c) return <div className="skeleton" style={{ height: 420 }} />;

  const conImagen = c.prompts.filter((p) => p.imagen);
  const frase = `Trae la campaña ${c.nombre} de Pincel IA y crea las imágenes`;
  const todos = c.prompts.map((p) => `Imagen ${p.n}:\n${p.texto}`).join("\n\n");

  return (
    <>
      <Cabecera
        migas={<><Link to="/campanas">Campañas</Link><ChevronRight size={14} /><span className="ellipsis">{c.nombre}</span></>}
        titulo={c.nombre}
        subtitulo={
          <span className="row wrap gap-8">
            <Estado hechas={c.hechas} total={c.total} />
            <span>{c.hechas} de {c.total} imágenes</span>
            <span className="subtle">·</span>
            <span>Creada {fecha(c.creado)}{c.origen === "claude" ? " por Claude" : ""}</span>
          </span>
        }
      >
        <button className="btn primary" onClick={() => copiar(frase, "Frase copiada: pégala en ChatGPT")}>
          <MessageSquareText size={16} /> Copiar para ChatGPT
        </button>
        <a className={`btn ${c.hechas ? "" : "disabled"}`} href={c.hechas ? `/api/campanas/${c.id}/zip` : undefined} aria-disabled={!c.hechas}>
          <Download size={16} /> ZIP
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
      </Cabecera>

      <div className="stack gap-12">
        <Progreso hechas={c.hechas} total={c.total} />
        {c.notas && <div className="callout info"><Pencil size={16} /><span><b>Notas de estilo:</b> {c.notas}</span></div>}
        <div className="dropzone" onClick={() => elegir()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && elegir()}>
          <span className="dropzone-icon">{subiendo ? <Loader2 size={20} className="spin" /> : <UploadCloud size={20} />}</span>
          <div className="stack gap-4 grow">
            <b>{subiendo ? "Subiendo imágenes…" : "Arrastra aquí las imágenes de ChatGPT"}</b>
            <span className="muted small">Puedes soltar varias a la vez: se acomodan en orden en los puestos vacíos. O suelta cada una en su tarjeta.</span>
          </div>
          <span className="btn sm" aria-hidden><Upload size={14} /> Elegir archivos</span>
        </div>
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

      <div className="grid-slots">
        {c.prompts.map((p) => (
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
        <div className="drag-overlay"><div><UploadCloud size={20} /> Suelta las imágenes para cargarlas</div></div>
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
    <div className="card slot" data-slot={p.n} {...eventos}>
      <div className="slot-media">
        {p.imagen ? (
          <img src={p.imagen.ruta_miniatura} alt={`Imagen ${p.n}`} loading="lazy" onClick={onVer} />
        ) : (
          <button className={`slot-empty ${encima ? "over" : ""}`} onClick={onElegir}>
            <UploadCloud size={26} strokeWidth={1.6} />
            <span className="small">Suelta aquí la imagen {p.n}<br />o haz clic para elegirla</span>
          </button>
        )}
        <span className="slot-num">#{p.n}</span>
      </div>
      <div className="slot-body">
        <p className={`slot-prompt ${abierto ? "open" : ""}`} onClick={() => setAbierto(!abierto)} title="Clic para ver completo">
          {p.texto}
        </p>
        <div className="slot-actions">
          <button className="btn ghost icon sm" title="Copiar prompt" aria-label="Copiar prompt" onClick={() => copiar(p.texto, "Prompt copiado")}><Copy size={15} /></button>
          <button className="btn ghost icon sm" title="Editar prompt" aria-label="Editar prompt" onClick={onEditar}><Pencil size={15} /></button>
          {p.imagen && (
            <>
              <button className="btn ghost icon sm" title="Copiar link público" aria-label="Copiar link" onClick={() => copiar(urlPublica(p.imagen!.ruta), "Link copiado")}><Link2 size={15} /></button>
              <a className="btn ghost icon sm" title="Descargar" aria-label="Descargar" href={p.imagen.ruta} download><Download size={15} /></a>
              <button className="btn ghost icon sm" title="Reemplazar imagen" aria-label="Reemplazar imagen" onClick={onElegir}><RefreshCw size={15} /></button>
              <button className="btn ghost icon sm" title="Quitar imagen" aria-label="Quitar imagen" onClick={onQuitar}><X size={15} /></button>
            </>
          )}
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
    <Modal titulo="Editar campaña" onCerrar={onCerrar} pie={<Pie ocupado={ocupado} onCerrar={onCerrar} onGuardar={guardar} deshabilitado={!nombre.trim()} />}>
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
    <Modal titulo="Agregar prompts" descripcion={`Se añadirán a partir del #${c.total + 1}.`} onCerrar={onCerrar} pie={<Pie ocupado={ocupado} onCerrar={onCerrar} onGuardar={guardar} texto="Agregar" deshabilitado={!texto.trim()} />}>
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
    <Modal titulo={`Prompt #${p.n}`} onCerrar={onCerrar} ancho={640} pie={<Pie ocupado={ocupado} onCerrar={onCerrar} onGuardar={guardar} deshabilitado={!texto.trim()} />}>
      <textarea className="textarea" rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus aria-label="Texto del prompt" />
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}
