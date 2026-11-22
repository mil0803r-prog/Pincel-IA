import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, Loader2, X } from "lucide-react";
import { api, separarPrompts } from "../api";
import { Modal, useToast } from "./ui";

export default function NuevaCampana({ onCerrar }: { onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [prompts, setPrompts] = useState("");
  const [refs, setRefs] = useState<File[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();
  const toast = useToast();
  const detectados = separarPrompts(prompts).length;

  async function crear() {
    setOcupado(true);
    setError("");
    try {
      const c = await api.crearCampana(nombre, prompts, notas);
      if (refs.length) await api.subirReferencias(c.id, refs).catch(() => toast("La campaña se creó, pero no se pudo subir el mockup", "error"));
      toast("Campaña creada");
      nav(`/campanas/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={<>Nueva <em>campaña</em></>}
      descripcion="Normalmente Claude la crea por ti; aquí puedes hacerlo a mano."
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn glow" disabled={ocupado || !nombre.trim() || detectados === 0} onClick={crear}>
            {ocupado && <Loader2 size={16} className="spin" />} Crear campaña
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="nc-nombre">Nombre</label>
        <input id="nc-nombre" className="input" autoFocus placeholder="Ej. Crema facial Black Friday" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <span className="hint">Corto y fácil de decir: lo usarás en ChatGPT para traer la campaña.</span>
      </div>
      <div className="field">
        <label htmlFor="nc-prompts">Prompts</label>
        <textarea
          id="nc-prompts"
          className="textarea"
          rows={8}
          placeholder={"1. Foto de producto de la crema sobre mármol blanco, luz suave...\n\n2. Mujer de 30 años aplicándose la crema frente al espejo..."}
          value={prompts}
          onChange={(e) => setPrompts(e.target.value)}
        />
        <span className="hint">
          Separa cada prompt con una línea en blanco o numéralos. {detectados > 0 && <span className="badge accent" style={{ height: 20, marginLeft: 4 }}>{detectados} detectados</span>}
        </span>
      </div>
      <div className="field">
        <label htmlFor="nc-notas">Notas de estilo <span className="subtle">(opcional)</span></label>
        <input id="nc-notas" className="input" placeholder="Ej. Formato vertical 9:16, colores de marca rosa y dorado" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      <div className="field">
        <label>Producto de referencia <span className="subtle">(opcional)</span></label>
        <div className="refs-row">
          {refs.map((f, i) => (
            <div className="ref" key={i}>
              <img src={URL.createObjectURL(f)} alt="" />
              <button type="button" className="ref-x" aria-label="Quitar" onClick={() => setRefs(refs.filter((_, j) => j !== i))}><X size={13} /></button>
            </div>
          ))}
          {refs.length < 6 && (
            <label className="ref ref-add" htmlFor="nc-refs">
              <ImagePlus size={20} />
              <span className="small">Subir mockup</span>
            </label>
          )}
        </div>
        <input id="nc-refs" type="file" accept="image/*" multiple hidden onChange={(e) => { setRefs([...refs, ...[...(e.target.files || [])]].slice(0, 6)); e.target.value = ""; }} />
        <span className="hint">ChatGPT usará este producto exacto en todas las imágenes.</span>
      </div>
      {error && <span className="error-text">{error}</span>}
    </Modal>
  );
}
