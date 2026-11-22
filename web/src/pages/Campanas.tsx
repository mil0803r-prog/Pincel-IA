import { useEffect, useState } from "react";
import { FolderKanban, Plus, Search } from "lucide-react";
import { api, type CampanaResumen } from "../api";
import { Cabecera, Vacio } from "../components/ui";
import TarjetaCampana from "../components/TarjetaCampana";
import NuevaCampana from "../components/NuevaCampana";

export default function Campanas() {
  const [lista, setLista] = useState<CampanaResumen[] | null>(null);
  const [q, setQ] = useState("");
  const [nueva, setNueva] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => api.campanas(q).then(setLista).catch(() => setLista([])), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <Cabecera titulo="Campañas" subtitulo="Cada campaña agrupa los prompts y las imágenes de una promoción">
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder="Buscar campaña…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar campaña" />
        </div>
        <button className="btn primary" onClick={() => setNueva(true)}>
          <Plus size={16} /> Nueva campaña
        </button>
      </Cabecera>

      {!lista ? (
        <div className="grid-campanas">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 240 }} />)}
        </div>
      ) : lista.length === 0 ? (
        q ? (
          <Vacio icono={<Search size={24} />} titulo="Sin resultados" texto={`No hay campañas que coincidan con “${q}”.`} />
        ) : (
          <Vacio icono={<FolderKanban size={24} />} titulo="Aún no hay campañas" texto="Pide a Claude que guarde los prompts en Pincel IA o crea una campaña aquí.">
            <button className="btn primary" onClick={() => setNueva(true)}><Plus size={16} /> Nueva campaña</button>
          </Vacio>
        )
      ) : (
        <div className="grid-campanas">
          {lista.map((c) => <TarjetaCampana key={c.id} c={c} />)}
        </div>
      )}

      {nueva && <NuevaCampana onCerrar={() => setNueva(false)} />}
    </>
  );
}
