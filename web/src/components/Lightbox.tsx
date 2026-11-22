import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, Link2, X } from "lucide-react";
import { fecha, peso, urlPublica, type Imagen } from "../api";
import { useCopiar } from "./ui";

export type ItemVisor = { imagen: Imagen; titulo: string; prompt: string };

export default function Lightbox({
  items,
  indice,
  onCambiar,
  onCerrar,
}: {
  items: ItemVisor[];
  indice: number;
  onCambiar: (i: number) => void;
  onCerrar: () => void;
}) {
  const copiar = useCopiar();
  const item = items[indice];
  const hayPrev = indice > 0;
  const haySig = indice < items.length - 1;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft" && hayPrev) onCambiar(indice - 1);
      if (e.key === "ArrowRight" && haySig) onCambiar(indice + 1);
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [indice, hayPrev, haySig, onCambiar, onCerrar]);

  if (!item) return null;
  const { imagen } = item;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.titulo}>
      <div className="lb-stage" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
        <img src={imagen.ruta} alt={item.prompt} />
        {hayPrev && (
          <button className="lb-btn lb-prev" onClick={() => onCambiar(indice - 1)} aria-label="Anterior">
            <ChevronLeft size={22} />
          </button>
        )}
        {haySig && (
          <button className="lb-btn lb-next" onClick={() => onCambiar(indice + 1)} aria-label="Siguiente">
            <ChevronRight size={22} />
          </button>
        )}
        <button className="lb-btn lb-close" onClick={onCerrar} aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
      <aside className="lb-side">
        <div className="stack gap-4">
          <span className="small muted">{indice + 1} de {items.length}</span>
          <h2>{item.titulo}</h2>
        </div>
        <div className="row gap-8 wrap">
          <button className="btn primary sm" onClick={() => copiar(urlPublica(imagen.ruta), "Link copiado")}>
            <Link2 size={15} /> Copiar link
          </button>
          <a className="btn sm" href={imagen.ruta} download>
            <Download size={15} /> Descargar
          </a>
        </div>
        <div className="stack gap-8">
          <h3>Prompt</h3>
          <p className="muted small" style={{ whiteSpace: "pre-wrap" }}>{item.prompt}</p>
          <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => copiar(item.prompt, "Prompt copiado")}>
            Copiar prompt
          </button>
        </div>
        <dl className="kv">
          <dt>Tamaño</dt>
          <dd>{imagen.ancho} × {imagen.alto} px</dd>
          <dt>Peso</dt>
          <dd>{peso(imagen.bytes)}</dd>
          <dt>Origen</dt>
          <dd>{imagen.origen === "chatgpt" ? "Enviada desde ChatGPT" : "Subida en la app"}</dd>
          <dt>Fecha</dt>
          <dd>{fecha(imagen.creado)}</dd>
        </dl>
      </aside>
    </div>
  );
}
