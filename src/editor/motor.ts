/**
 * Motor del editor: dibuja el fotograma del instante `t` en un lienzo y mantiene sincronizados los
 * videos y audios. Se usa igual para la vista previa y para exportar (lo que ves es lo que se exporta).
 */
import { durClip, duracionProyecto, filtroCss, finClip, type Clip, type Medio, type PistaId, type Proyecto } from "./tipos";

const ORDEN: PistaId[] = ["principal", "superposicion", "texto"]; // de abajo hacia arriba
const ANIM = 0.45; // duración de las animaciones de entrada y salida (s)
const suave = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export type Caja = { cx: number; cy: number; w: number; h: number; rot: number };

export function factorFundido(c: Clip, t: number): number {
  const dt = t - c.pos;
  const df = finClip(c) - t;
  let f = 1;
  if (c.fadeIn > 0 && dt < c.fadeIn) f = Math.min(f, dt / c.fadeIn);
  if (c.fadeOut > 0 && df < c.fadeOut) f = Math.min(f, df / c.fadeOut);
  return Math.max(0, Math.min(1, f));
}

export function dibujarTexto(ctx: CanvasRenderingContext2D, c: Clip, H: number, escala: number): { w: number; h: number } {
  const s = c.texto!;
  const px = Math.max(4, (s.tamano / 100) * H * escala);
  ctx.font = `${s.negrita ? 800 : 500} ${px}px "${s.fuente}", system-ui, sans-serif`;
  const lineas = (s.contenido || " ").split("\n");
  const alto = px * 1.18;
  const w = Math.max(...lineas.map((l) => ctx.measureText(l).width), px * 0.5);
  const h = alto * lineas.length;
  const pad = px * 0.38;
  if (s.fondo) {
    ctx.fillStyle = s.fondo;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - pad, -h / 2 - pad * 0.55, w + pad * 2, h + pad * 1.1, px * 0.28);
    ctx.fill();
  }
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.textAlign = s.alineacion;
  lineas.forEach((l, i) => {
    const y = -h / 2 + alto * (i + 0.5);
    const x = s.alineacion === "left" ? -w / 2 : s.alineacion === "right" ? w / 2 : 0;
    if (s.contorno) {
      ctx.lineWidth = px * 0.14;
      ctx.strokeStyle = s.contorno;
      ctx.strokeText(l, x, y);
    }
    ctx.fillStyle = s.color;
    ctx.fillText(l, x, y);
  });
  return { w: w + pad * 2, h: h + pad * 1.1 };
}

export class Motor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  proyecto: Proyecto | null = null;
  t = 0;
  reproduciendo = false;
  seleccion: string | null = null;
  readonly cajas = new Map<string, Caja>();
  private orden: string[] = [];
  private reloj = 0;
  private tInicio = 0;
  private raf = 0;
  private elementos = new Map<string, { el: HTMLMediaElement; url: string }>();
  private imagenes = new Map<string, HTMLImageElement>();
  private oyentes = new Set<(t: number) => void>();
  onFin: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, private opciones: { silencio?: boolean; guias?: boolean } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
  }

  suscribir(f: (t: number) => void) {
    this.oyentes.add(f);
    return () => { this.oyentes.delete(f); };
  }
  private emitir() { this.oyentes.forEach((f) => f(this.t)); }

  get duracion() { return this.proyecto ? duracionProyecto(this.proyecto) : 0; }
  private medio(id: string | null): Medio | undefined { return this.proyecto?.medios.find((m) => m.id === id); }

  setProyecto(p: Proyecto) {
    this.proyecto = p;
    const vivos = new Set<string>();
    for (const c of p.clips) {
      const m = this.medio(c.medioId);
      if (!m) continue;
      if (c.tipo === "imagen" && !this.imagenes.has(m.id)) {
        const img = new Image();
        img.src = m.url;
        img.onload = () => { if (!this.reproduciendo) this.dibujar(); };
        this.imagenes.set(m.id, img);
      }
      if (c.tipo !== "video" && c.tipo !== "audio") continue;
      vivos.add(c.id);
      const actual = this.elementos.get(c.id);
      if (actual && actual.url === m.url) continue;
      actual?.el.pause();
      const el: HTMLMediaElement = c.tipo === "video" ? document.createElement("video") : document.createElement("audio");
      el.preload = "auto";
      (el as HTMLVideoElement).playsInline = true;
      (el as HTMLMediaElement & { preservesPitch?: boolean }).preservesPitch = false; // igual que en la exportación
      el.muted = !!this.opciones.silencio;
      el.src = m.url;
      el.addEventListener("seeked", () => { if (!this.reproduciendo) this.dibujar(); });
      el.addEventListener("loadeddata", () => { if (!this.reproduciendo) { this.sincronizar(false); this.dibujar(); } });
      this.elementos.set(c.id, { el, url: m.url });
    }
    for (const [id, { el }] of this.elementos) {
      if (!vivos.has(id)) {
        el.pause();
        el.removeAttribute("src");
        el.load();
        this.elementos.delete(id);
      }
    }
    if (this.t > this.duracion) this.t = this.duracion;
    if (!this.reproduciendo) { this.sincronizar(false); this.dibujar(); }
  }

  /** Espera a que todos los videos, audios e imágenes estén listos (para exportar sin cortes). */
  async precargar(ms = 20000) {
    const espera = [...this.elementos.values()].map(({ el }) =>
      el.readyState >= 3 ? Promise.resolve() : new Promise<void>((ok) => { el.addEventListener("canplaythrough", () => ok(), { once: true }); el.addEventListener("error", () => ok(), { once: true }); }),
    );
    const imgs = [...this.imagenes.values()].map((i) => i.decode().catch(() => {}));
    await Promise.race([Promise.all([...espera, ...imgs]), new Promise((r) => setTimeout(r, ms))]);
  }

  play() {
    if (!this.proyecto || this.reproduciendo) return;
    if (this.t >= this.duracion - 0.01) this.t = 0;
    this.reproduciendo = true;
    this.reloj = performance.now();
    this.tInicio = this.t;
    const ciclo = () => {
      if (!this.reproduciendo) return;
      this.t = this.tInicio + (performance.now() - this.reloj) / 1000;
      if (this.t >= this.duracion) {
        this.t = this.duracion;
        this.pause();
        this.dibujar();
        this.onFin?.();
        return;
      }
      this.sincronizar(true);
      this.dibujar();
      this.emitir();
      this.raf = requestAnimationFrame(ciclo);
    };
    this.raf = requestAnimationFrame(ciclo);
  }

  pause() {
    this.reproduciendo = false;
    cancelAnimationFrame(this.raf);
    this.elementos.forEach(({ el }) => el.pause());
    this.emitir();
  }

  alternar() { if (this.reproduciendo) this.pause(); else this.play(); }

  seek(t: number) {
    this.t = Math.max(0, Math.min(t, this.duracion));
    this.tInicio = this.t;
    this.reloj = performance.now();
    this.sincronizar(this.reproduciendo);
    this.dibujar();
    this.emitir();
  }

  private sincronizar(reproduciendo: boolean) {
    if (!this.proyecto) return;
    for (const c of this.proyecto.clips) {
      const e = this.elementos.get(c.id);
      if (!e) continue;
      const el = e.el;
      const activo = this.t >= c.pos && this.t < finClip(c);
      const local = c.entrada + (this.t - c.pos) * c.velocidad;
      if (activo) {
        el.playbackRate = Math.max(0.0625, Math.min(16, c.velocidad));
        el.muted = !!this.opciones.silencio || c.silenciado;
        el.volume = Math.max(0, Math.min(1, c.volumen * factorFundido(c, this.t)));
        if (reproduciendo) {
          if (el.paused) {
            el.currentTime = local;
            el.play().catch(() => {});
          } else if (Math.abs(el.currentTime - local) > 0.3) {
            el.currentTime = local;
          }
        } else {
          if (!el.paused) el.pause();
          if (Math.abs(el.currentTime - local) > 0.03) el.currentTime = local;
        }
      } else {
        if (!el.paused) el.pause();
        // el que viene en menos de 1,5 s se deja listo en su punto de entrada para que arranque sin salto
        if (this.t < c.pos && c.pos - this.t < 1.5 && Math.abs(el.currentTime - c.entrada) > 0.1) el.currentTime = c.entrada;
      }
    }
  }

  dibujar() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = this.proyecto?.fondo || "#000";
    ctx.fillRect(0, 0, W, H);
    this.cajas.clear();
    this.orden = [];
    if (this.proyecto) {
      for (const pista of ORDEN) {
        const activos = this.proyecto.clips.filter((c) => c.pista === pista && this.t >= c.pos && this.t < finClip(c)).sort((a, b) => a.pos - b.pos);
        for (const c of activos) this.dibujarClip(c, W, H);
      }
      if (this.opciones.guias && this.seleccion) this.dibujarSeleccion(W, H);
    }
    ctx.restore();
  }

  private dibujarClip(c: Clip, W: number, H: number) {
    const { ctx } = this;
    const dt = this.t - c.pos;
    const df = finClip(c) - this.t;
    let alpha = c.opacidad * factorFundido(c, this.t);
    let esc = c.escala;
    let dy = 0;
    const anim = (tipo: string, k: number) => {
      if (tipo === "ninguna") return;
      const e = suave(k);
      alpha *= e;
      if (tipo === "subir") dy += (1 - e) * 0.06 * H;
      if (tipo === "zoom") esc *= 0.7 + 0.3 * e;
    };
    if (dt < ANIM) anim(c.animEntrada, dt / ANIM);
    if (df < ANIM) anim(c.animSalida, df / ANIM);
    if (alpha <= 0.001) return;

    const cx = W / 2 + c.x * W;
    const cy = H / 2 + c.y * H + dy;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.translate(cx, cy);
    ctx.rotate((c.rotacion * Math.PI) / 180);
    let caja: { w: number; h: number } | null = null;
    if (c.tipo === "texto" && c.texto) {
      caja = dibujarTexto(ctx, c, H, esc);
    } else {
      const m = this.medio(c.medioId);
      const fuente: CanvasImageSource | undefined =
        c.tipo === "video" ? (this.elementos.get(c.id)?.el as HTMLVideoElement | undefined) : c.tipo === "imagen" && m ? this.imagenes.get(m.id) : undefined;
      const sw = c.tipo === "video" ? (fuente as HTMLVideoElement | undefined)?.videoWidth || m?.ancho || 0 : m?.ancho || 0;
      const sh = c.tipo === "video" ? (fuente as HTMLVideoElement | undefined)?.videoHeight || m?.alto || 0 : m?.alto || 0;
      const listo = c.tipo === "video" ? ((fuente as HTMLVideoElement | undefined)?.readyState ?? 0) >= 2 : !!(fuente as HTMLImageElement | undefined)?.complete;
      if (fuente && sw && sh) {
        const s = c.encaje === "llenar" ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
        const dw = sw * s * esc, dh = sh * s * esc;
        const f = c.filtros;
        if (f.brillo !== 1 || f.contraste !== 1 || f.saturacion !== 1 || f.desenfoque || f.tono) ctx.filter = filtroCss(f);
        if (listo) ctx.drawImage(fuente, -dw / 2, -dh / 2, dw, dh);
        caja = { w: dw, h: dh };
      }
    }
    ctx.restore();
    if (caja) {
      this.cajas.set(c.id, { cx, cy, w: caja.w, h: caja.h, rot: c.rotacion });
      this.orden.push(c.id);
    }
  }

  private dibujarSeleccion(W: number, H: number) {
    const b = this.cajas.get(this.seleccion!);
    if (!b) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(b.cx, b.cy);
    ctx.rotate((b.rot * Math.PI) / 180);
    const g = Math.max(2, Math.round(Math.min(W, H) / 300));
    ctx.lineWidth = g;
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([g * 4, g * 3]);
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#ec4899";
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect((x * b.w) / 2 - g * 2.5, (y * b.h) / 2 - g * 2.5, g * 5, g * 5);
    ctx.restore();
  }

  /** El clip visible más arriba en un punto del lienzo (para seleccionar y mover con el ratón). */
  clipEn(x: number, y: number): string | null {
    for (let i = this.orden.length - 1; i >= 0; i--) {
      const id = this.orden[i];
      const b = this.cajas.get(id)!;
      const r = (-b.rot * Math.PI) / 180;
      const dx = x - b.cx, dy = y - b.cy;
      const lx = dx * Math.cos(r) - dy * Math.sin(r);
      const ly = dx * Math.sin(r) + dy * Math.cos(r);
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return id;
    }
    return null;
  }

  destruir() {
    this.pause();
    this.oyentes.clear();
    this.elementos.forEach(({ el }) => { el.removeAttribute("src"); el.load(); });
    this.elementos.clear();
    this.imagenes.clear();
  }
}

export const duracionDe = durClip;
