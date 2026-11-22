import { useRef, useState } from "react";
import { ImagePlus, Loader2, Package, X } from "lucide-react";
import { api, type Campana } from "../api";
import { useToast } from "./ui";

/**
 * Imágenes de referencia del producto (mockup, foto real, logo).
 * ChatGPT las recibe con cada lote de prompts para que el producto salga idéntico.
 */
export default function Referencias({ c, onCambio }: { c: Campana; onCambio: (c: Campana) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [encima, setEncima] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const refs = c.referencias || [];

  async function subir(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, 6 - refs.length);
    if (!imgs.length) return toast(refs.length >= 6 ? "Máximo 6 referencias por campaña" : "Solo se aceptan imágenes", "error");
    setOcupado(true);
    try {
      onCambio(await api.subirReferencias(c.id, imgs));
      toast(imgs.length === 1 ? "Referencia guardada" : `${imgs.length} referencias guardadas`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section
      className={`glass refs ${encima ? "over" : ""}`}
      data-slot="ref"
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setEncima(false); subir([...e.dataTransfer.files]); }}
    >
      <div className="refs-head">
        <span className="tile-icon"><Package size={16} /></span>
        <div className="stack gap-4 grow">
          <h3>Producto de referencia</h3>
          <p className="muted small">
            {refs.length
              ? "ChatGPT recibe estas imágenes con cada lote para mantener el producto idéntico: forma, colores, etiqueta y logo."
              : "Sube el mockup o la foto real del producto: ChatGPT lo usará como referencia en todas las imágenes."}
          </p>
        </div>
      </div>
      <div className="refs-row">
        {refs.map((r) => (
          <div className="ref" key={r.id}>
            <img src={r.ruta_miniatura} alt="Referencia del producto" />
            <button
              className="ref-x"
              aria-label="Quitar referencia"
              title="Quitar referencia"
              onClick={async () => {
                try { onCambio(await api.quitarReferencia(c.id, r.id)); toast("Referencia quitada"); } catch (e) { toast((e as Error).message, "error"); }
              }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {refs.length < 6 && (
          <button className="ref ref-add" onClick={() => input.current?.click()} disabled={ocupado}>
            {ocupado ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
            <span className="small">{refs.length ? "Agregar" : "Subir mockup"}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { subir([...(e.target.files || [])]); e.target.value = ""; }}
      />
    </section>
  );
}
