import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, FolderKanban, ImageIcon, MessageSquareText, Plus, Send, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { api, type Resumen } from "../api";
import { Cabecera, Vacio } from "../components/ui";
import TarjetaCampana from "../components/TarjetaCampana";
import NuevaCampana from "../components/NuevaCampana";

export default function Inicio() {
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [nueva, setNueva] = useState(false);

  useEffect(() => {
    api.resumen().then(setDatos).catch(() => {});
  }, []);

  const stats = [
    { nombre: "Campañas", valor: datos?.campanas, icono: FolderKanban },
    { nombre: "Imágenes", valor: datos?.imagenes, icono: ImageIcon },
    { nombre: "Por crear", valor: datos?.pendientes, icono: Clock },
    { nombre: "Esta semana", valor: datos?.imagenes_semana, icono: TrendingUp },
  ];

  return (
    <>
      <Cabecera titulo="Inicio" subtitulo="Resumen de tu estudio de imágenes">
        <button className="btn primary" onClick={() => setNueva(true)}>
          <Plus size={16} /> Nueva campaña
        </button>
      </Cabecera>

      <div className="stats">
        {stats.map((s) => (
          <div className="card stat" key={s.nombre}>
            <div className="stat-top">
              {s.nombre}
              <span className="stat-icon"><s.icono size={16} /></span>
            </div>
            <div className="stat-value">{s.valor ?? "—"}</div>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Campañas recientes</h2>
          {datos && datos.recientes.length > 0 && (
            <Link to="/campanas" className="btn ghost sm">
              Ver todas <ArrowRight size={14} />
            </Link>
          )}
        </div>
        {!datos ? (
          <div className="grid-campanas">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 240 }} />)}
          </div>
        ) : datos.recientes.length === 0 ? (
          <Vacio
            icono={<Sparkles size={24} />}
            titulo="Crea tu primera campaña"
            texto="Pide a Claude que guarde los prompts de tu campaña en Pincel IA, o créala aquí pegando los prompts."
          >
            <button className="btn primary" onClick={() => setNueva(true)}><Plus size={16} /> Nueva campaña</button>
            <Link className="btn" to="/conexiones">Conectar ChatGPT y Claude</Link>
          </Vacio>
        ) : (
          <div className="grid-campanas">
            {datos.recientes.map((c) => <TarjetaCampana key={c.id} c={c} />)}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Cómo funciona</h2></div>
        <div className="card how">
          <Paso icono={<Wand2 size={17} />} titulo="1. Claude escribe" texto="Tu skill de ventas crea los prompts y los guarda aquí como campaña." />
          <Paso icono={<MessageSquareText size={17} />} titulo="2. ChatGPT crea" texto='En ChatGPT: "Trae la campaña … y crea las imágenes".' />
          <Paso icono={<Send size={17} />} titulo="3. Enviar a la plataforma" texto="ChatGPT las envía solas, o las arrastras a la campaña." />
          <Paso icono={<ImageIcon size={17} />} titulo="4. Listas para vender" texto="Links públicos y ZIP para Chatea Pro y WhatsApp." />
        </div>
      </section>

      {nueva && <NuevaCampana onCerrar={() => setNueva(false)} />}
    </>
  );
}

function Paso({ icono, titulo, texto }: { icono: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div>
      <span className="how-icon">{icono}</span>
      <h3>{titulo}</h3>
      <p className="muted small">{texto}</p>
    </div>
  );
}
