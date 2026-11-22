import { useEffect, useState } from "react";
import { FolderKanban, Plus, Search } from "lucide-react";
import { api, type CampanaResumen } from "../api";
import { Cabecera, Vacio } from "../components/ui";
import { useApp } from "../components/Layout";
import TarjetaCampana from "../components/TarjetaCampana";

type Filtro = "todas" | "progreso" | "completas" | "pendientes";
const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "progreso", nombre: "En progreso" },
  { id: "pendientes", nombre: "Pendientes" },
  { id: "completas", nombre: "Completas" },
];

export default function Campanas() {
  const [lista, setLista] = useState<CampanaResumen[] | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const { nuevaCampana } = useApp();

  useEffect(() => {
    const t = setTimeout(() => api.campanas(q).then(setLista).catch(() => setLista([])), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const visibles = (lista ?? []).filter((c) => {
    if (filtro === "completas") return c.total > 0 && c.hechas === c.total;
    if (filtro === "pendientes") return c.hechas === 0;
    if (filtro === "progreso") return c.hechas > 0 && c.hechas < c.total;
    return true;
  });

  return (
    <>
      <Cabecera
        titulo={<>Campañas</>}
        subtitulo={lista ? `${lista.length} ${lista.length === 1 ? "campaña" : "campañas"} · cada una agrupa los prompts e imágenes de una promoción` : "Cada campaña agrupa los prompts e imágenes de una promoción"}
      >
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder="Buscar campaña…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar campaña" />
        </div>
        <button className="btn primary" onClick={nuevaCampana}>
          <Plus size={16} /> Nueva campaña
        </button>
      </Cabecera>

      <div className="chips" role="tablist">
        {FILTROS.map((f) => (
          <button key={f.id} className={`chip ${filtro === f.id ? "on" : ""}`} onClick={() => setFiltro(f.id)} role="tab" aria-selected={filtro === f.id}>
            {f.nombre}
          </button>
        ))}
      </div>

      {!lista ? (
        <div className="grid-campanas">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 270 }} />)}</div>
      ) : visibles.length === 0 ? (
        q || filtro !== "todas" ? (
          <Vacio icono={<Search size={24} />} titulo={<>Nada por <em>aquí</em></>} texto={q ? `No hay campañas que coincidan con “${q}”.` : "No hay campañas con este estado."} />
        ) : (
          <Vacio icono={<FolderKanban size={24} />} titulo={<>Aún no hay <em>campañas</em></>} texto="Pide a Claude que guarde los prompts en Pincel IA o crea una campaña aquí.">
            <button className="btn glow" onClick={nuevaCampana}><Plus size={16} /> Nueva campaña</button>
          </Vacio>
        )
      ) : (
        <div className="grid-campanas stagger">{visibles.map((c) => <TarjetaCampana key={c.id} c={c} />)}</div>
      )}
    </>
  );
}
