import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import { api, type CampanaResumen, type Imagen } from "../api";
import { Cabecera, Vacio } from "../components/ui";
import Lightbox from "../components/Lightbox";

export default function Biblioteca() {
  const [imagenes, setImagenes] = useState<Imagen[] | null>(null);
  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
  const [filtro, setFiltro] = useState("");
  const [visor, setVisor] = useState<number | null>(null);

  useEffect(() => {
    api.campanas().then((cs) => setCampanas(cs.filter((c) => c.hechas > 0))).catch(() => {});
  }, []);
  useEffect(() => {
    setImagenes(null);
    api.imagenes(filtro || undefined).then(setImagenes).catch(() => setImagenes([]));
  }, [filtro]);

  return (
    <>
      <Cabecera titulo={<>Biblioteca</>} subtitulo={imagenes ? `${imagenes.length} imágenes listas para usar` : "Todas tus imágenes en un solo lugar"} />

      {campanas.length > 0 && (
        <div className="chips" role="tablist">
          <button className={`chip ${filtro === "" ? "on" : ""}`} onClick={() => setFiltro("")} role="tab" aria-selected={filtro === ""}>Todas</button>
          {campanas.map((c) => (
            <button key={c.id} className={`chip ${filtro === c.id ? "on" : ""}`} onClick={() => setFiltro(c.id)} role="tab" aria-selected={filtro === c.id}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {!imagenes ? (
        <div className="masonry">
          {[220, 300, 260, 200, 280, 240, 310, 230].map((h, i) => <div key={i} className="skeleton m-tile" style={{ height: h }} />)}
        </div>
      ) : imagenes.length === 0 ? (
        <Vacio icono={<Images size={24} />} titulo={<>Todavía no hay <em>imágenes</em></>} texto="Cuando ChatGPT envíe imágenes o las cargues en una campaña, aparecerán aquí." />
      ) : (
        <div className="masonry">
          {imagenes.map((img, i) => (
            <button className="m-tile" key={img.id} onClick={() => setVisor(i)} aria-label={`Ver imagen ${img.n} de ${img.campana_nombre}`}>
              <img src={img.ruta_miniatura} alt={img.prompt} loading="lazy" style={{ aspectRatio: `${img.ancho} / ${img.alto}` }} />
              <div className="m-info">
                <b>{img.campana_nombre}</b> · #{img.n}
              </div>
            </button>
          ))}
        </div>
      )}

      {visor !== null && imagenes && (
        <Lightbox
          items={imagenes.map((img) => ({ imagen: img, titulo: `${img.campana_nombre} · #${img.n}`, prompt: img.prompt || "" }))}
          indice={visor}
          onCambiar={setVisor}
          onCerrar={() => setVisor(null)}
        />
      )}
    </>
  );
}
