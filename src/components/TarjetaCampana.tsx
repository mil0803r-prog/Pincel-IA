import { Link } from "react-router-dom";
import { fecha, type CampanaResumen } from "../api";
import { Anillo, Estado, iniciales } from "./ui";

export default function TarjetaCampana({ c }: { c: CampanaResumen }) {
  const mini = c.miniaturas.slice(0, 4);
  return (
    <Link to={`/campanas/${c.id}`} className="glass camp">
      <div className={`collage n${Math.max(mini.length, 1)}`}>
        {mini.length ? (
          mini.map((src) => <img key={src} src={src} alt="" loading="lazy" />)
        ) : (
          <div className="collage-empty"><span>{iniciales(c.nombre)}</span></div>
        )}
        <Estado hechas={c.hechas} total={c.total} sobreImagen />
      </div>
      <div className="camp-body">
        <div className="stack gap-4 grow">
          <div className="camp-title" title={c.nombre}>{c.nombre}</div>
          <span className="subtle small">{c.hechas} de {c.total} imágenes · {fecha(c.creado)}</span>
        </div>
        <Anillo hechas={c.hechas} total={c.total} size={40} grosor={3.5} />
      </div>
    </Link>
  );
}
