import { Link } from "react-router-dom";
import { ImageIcon } from "lucide-react";
import { fecha, type CampanaResumen } from "../api";
import { Estado, Progreso } from "./ui";

export default function TarjetaCampana({ c }: { c: CampanaResumen }) {
  return (
    <Link to={`/campanas/${c.id}`} className="card camp">
      <div className="camp-cover">
        {c.portada ? <img src={c.portada.ruta_miniatura} alt="" loading="lazy" /> : <ImageIcon size={30} strokeWidth={1.5} />}
        <Estado hechas={c.hechas} total={c.total} />
      </div>
      <div className="camp-body">
        <div className="camp-title" title={c.nombre}>{c.nombre}</div>
        <Progreso hechas={c.hechas} total={c.total} />
        <div className="camp-meta">
          <span>{c.hechas}/{c.total} imágenes</span>
          <span>{fecha(c.creado)}</span>
        </div>
      </div>
    </Link>
  );
}
