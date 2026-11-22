import { useEffect, useRef, useState } from "react";

type Punto = { dia: string; imagenes: number };

const corto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });

/**
 * Barras de imágenes por día (una sola serie): barras finas con 2px de separación,
 * extremo superior redondeado anclado a la línea base, tooltip por barra y tabla accesible.
 */
export default function Actividad({ datos }: { datos: Punto[] }) {
  const [on, setOn] = useState<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(280);
  useEffect(() => {
    if (!caja.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, e.contentRect.width)));
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, []);
  const H = 140;
  const n = datos.length;
  const max = Math.max(1, ...datos.map((d) => d.imagenes));
  const gap = 2;
  const ancho = (W - gap * (n - 1)) / n;
  const r = Math.min(4, ancho / 2);

  const barra = (i: number, v: number) => {
    const h = v === 0 ? 3 : Math.max(6, (v / max) * (H - 8));
    const x = i * (ancho + gap);
    const y = H - h;
    const rr = Math.min(r, h);
    // solo esquinas superiores redondeadas; base recta sobre el eje
    return `M${x},${H} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + ancho - rr} Q${x + ancho},${y} ${x + ancho},${y + rr} V${H} Z`;
  };

  return (
    <>
      <div ref={caja} className={`bars ${on !== null ? "hover" : ""}`} onMouseLeave={() => setOn(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Imágenes por día, últimos ${n} días`}>
          {datos.map((d, i) => (
            <g key={d.dia}>
              <path d={barra(i, d.imagenes)} className={`bar ${d.imagenes === 0 ? "cero" : ""} ${on === i ? "on" : ""}`} />
              {/* zona de toque más grande que la barra */}
              <rect x={i * (ancho + gap) - gap / 2} y={0} width={ancho + gap} height={H} fill="transparent" onMouseEnter={() => setOn(i)} onTouchStart={() => setOn(i)} />
            </g>
          ))}
          <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className="axis" vectorEffect="non-scaling-stroke" />
        </svg>
        {on !== null && (
          <div className="tip" style={{ left: `${((on + 0.5) / n) * 100}%`, top: `${100 - (Math.max(datos[on].imagenes, 0.05) / max) * 92}%` }}>
            {corto(datos[on].dia)} · <b>{datos[on].imagenes}</b> {datos[on].imagenes === 1 ? "imagen" : "imágenes"}
          </div>
        )}
      </div>
      <div className="bars-x">
        <span>{corto(datos[0].dia)}</span>
        <span>Hoy</span>
      </div>
      <table className="sr-only">
        <caption>Imágenes por día</caption>
        <tbody>
          {datos.map((d) => (
            <tr key={d.dia}><th scope="row">{corto(d.dia)}</th><td>{d.imagenes}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
