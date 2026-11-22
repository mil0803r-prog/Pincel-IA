import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Clock, FolderKanban, HardDrive, ImageIcon, Plug, Plus, Sparkles } from "lucide-react";
import { api, peso, type Resumen } from "../api";
import { Vacio } from "../components/ui";
import { useApp } from "../components/Layout";
import TarjetaCampana from "../components/TarjetaCampana";
import Actividad from "../components/Actividad";
import Lightbox from "../components/Lightbox";

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default function Inicio() {
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [visor, setVisor] = useState<number | null>(null);
  const { nuevaCampana } = useApp();

  useEffect(() => {
    api.resumen().then(setDatos).catch(() => {});
  }, []);

  const tres = datos?.ultimas.slice(0, 3) ?? [];
  const totalPeriodo = datos?.actividad.reduce((a, d) => a + d.imagenes, 0) ?? 0;

  return (
    <>
      <div className="bento stagger">
        <section className="glass hero">
          <div className="hero-copy">
            <span className="eyebrow">{saludo()}</span>
            <h1>
              Crea imágenes que <em className="grad-text">venden</em>.
            </h1>
            <p className="muted">
              Claude escribe los prompts, ChatGPT los convierte en imágenes y aquí quedan listas para tus campañas de WhatsApp.
            </p>
          </div>
          <div className="hero-stack" aria-hidden>
            {[0, 1, 2].map((i) =>
              tres[i] ? (
                <div className="ph" key={i}><img src={tres[i].ruta_miniatura} alt="" /></div>
              ) : (
                <div className="ph vacio" key={i}>{i === 1 ? <Sparkles size={28} /> : <ImageIcon size={24} />}</div>
              ),
            )}
          </div>
          <div className="hero-actions">
            <button className="btn glow lg" onClick={nuevaCampana}>
              <Plus size={17} /> Nueva campaña
            </button>
            <Link className="btn lg" to="/conexiones">
              <Plug size={16} /> Conectar ChatGPT
            </Link>
          </div>
        </section>

        <section className="glass chart-card">
          <span className="eyebrow">Imágenes · últimos 14 días</span>
          <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
            <span className="big">{datos ? totalPeriodo : "—"}</span>
            <span className="muted small">{datos ? `${datos.imagenes_semana} esta semana` : ""}</span>
          </div>
          {datos ? <Actividad datos={datos.actividad} /> : <div className="skeleton" style={{ flex: 1, minHeight: 150, marginTop: 16 }} />}
        </section>

        <Tile icono={<FolderKanban size={16} />} nombre="Campañas" valor={datos?.campanas} pie="en tu estudio" />
        <Tile icono={<ImageIcon size={16} />} nombre="Imágenes" valor={datos?.imagenes} pie="listas para vender" />
        <Tile icono={<Clock size={16} />} nombre="Por crear" valor={datos?.pendientes} pie="esperando a ChatGPT" />
        <Tile icono={<HardDrive size={16} />} nombre="Almacenamiento" valor={datos ? peso(datos.bytes) : undefined} pie="en la plataforma" />
      </div>

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4">
            <span className="eyebrow">Tu trabajo</span>
            <h2>Campañas <em>recientes</em></h2>
          </div>
          {datos && datos.recientes.length > 0 && (
            <Link to="/campanas" className="btn ghost sm">Ver todas <ArrowRight size={14} /></Link>
          )}
        </div>
        {!datos ? (
          <div className="grid-campanas">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 270 }} />)}</div>
        ) : datos.recientes.length === 0 ? (
          <Vacio icono={<Sparkles size={26} />} titulo={<>Tu primera campaña <em>te espera</em></>} texto="Pide a Claude que guarde los prompts de tu campaña en Pincel IA, o créala aquí pegando los prompts.">
            <button className="btn glow" onClick={nuevaCampana}><Plus size={16} /> Nueva campaña</button>
            <Link className="btn" to="/conexiones">Conectar ChatGPT y Claude</Link>
          </Vacio>
        ) : (
          <div className="grid-campanas stagger">{datos.recientes.map((c) => <TarjetaCampana key={c.id} c={c} />)}</div>
        )}
      </section>

      {datos && datos.ultimas.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="stack gap-4">
              <span className="eyebrow">Recién llegadas</span>
              <h2>Últimas <em>imágenes</em></h2>
            </div>
            <Link to="/biblioteca" className="btn ghost sm">Biblioteca <ArrowUpRight size={14} /></Link>
          </div>
          <div className="strip">
            {datos.ultimas.map((img, i) => (
              <button key={img.id} onClick={() => setVisor(i)} aria-label={`Ver imagen ${img.n} de ${img.campana_nombre}`}>
                <img src={img.ruta_miniatura} alt="" loading="lazy" />
                <span className="badge onimg">{img.campana_nombre}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <div className="stack gap-4">
            <span className="eyebrow">Flujo de trabajo</span>
            <h2>De la idea a la <em>venta</em></h2>
          </div>
        </div>
        <div className="flow stagger">
          <Paso n="01" titulo="Claude escribe" texto="Tu skill de ventas crea los prompts y los guarda aquí como campaña." />
          <Paso n="02" titulo="ChatGPT crea" texto="“Trae la campaña … y crea las imágenes”. Usa tu suscripción, sin costo extra." />
          <Paso n="03" titulo="Enviar a la plataforma" texto="ChatGPT las envía solas, o las arrastras todas juntas a la campaña." />
          <Paso n="04" titulo="Listas para vender" texto="Links públicos y ZIP para usarlas en Chatea Pro y WhatsApp." />
        </div>
      </section>

      {visor !== null && datos && (
        <Lightbox
          items={datos.ultimas.map((img) => ({ imagen: img, titulo: `${img.campana_nombre} · #${img.n}`, prompt: img.prompt || "" }))}
          indice={visor}
          onCambiar={setVisor}
          onCerrar={() => setVisor(null)}
        />
      )}
    </>
  );
}

function Tile({ icono, nombre, valor, pie }: { icono: React.ReactNode; nombre: string; valor: number | string | undefined; pie: string }) {
  return (
    <div className="glass tile">
      <div className="tile-top">{nombre}<span className="tile-icon">{icono}</span></div>
      <div className="stack gap-4">
        <span className="big">{valor ?? "—"}</span>
        <span className="tile-foot">{pie}</span>
      </div>
    </div>
  );
}

function Paso({ n, titulo, texto }: { n: string; titulo: string; texto: string }) {
  return (
    <div className="glass flow-step">
      <span className="flow-num">{n}</span>
      <h3>{titulo}</h3>
      <p className="muted small">{texto}</p>
    </div>
  );
}
