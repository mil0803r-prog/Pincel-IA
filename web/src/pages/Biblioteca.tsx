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
    api.campanas().then(setCampanas).catch(() => {});
  }, []);
  useEffect(() => {
    setImagenes(null);
    api.imagenes(filtro || undefined).then(setImagenes).catch(() => setImagenes([]));
  }, [filtro]);

  return (
    <>
      <Cabecera titulo="Biblioteca" subtitulo={imagenes ? `${imagenes.length} imágenes` : "Todas tus imágenes en un solo lugar"}>
        <select className="select input" style={{ width: 240 }} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por campaña">
          <option value="">Todas las campañas</option>
          {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </Cabecera>

      {!imagenes ? (
        <div className="masonry">
          {[220, 300, 260, 200, 280, 240, 310, 230].map((h, i) => <div key={i} className="skeleton tile" style={{ height: h }} />)}
        </div>
      ) : imagenes.length === 0 ? (
        <Vacio icono={<Images size={24} />} titulo="Todavía no hay imágenes" texto="Cuando ChatGPT envíe imágenes o las cargues en una campaña, aparecerán aquí." />
      ) : (
        <div className="masonry">
          {imagenes.map((img, i) => (
            <div className="tile" key={img.id} onClick={() => setVisor(i)}>
              <img src={img.ruta_miniatura} alt={img.prompt} loading="lazy" style={{ aspectRatio: `${img.ancho} / ${img.alto}` }} />
              <div className="tile-info">
                <b>{img.campana_nombre}</b> · #{img.n}
              </div>
            </div>
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
