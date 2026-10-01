// Carta de tiempos en canvas. Eje X por eventos: cada flanco es una columna numerada.
import { N, aNumero } from './registro.js';

export const MAX_EVENTOS = 256;
const ANCHO_ETIQ = 58;
const ALTO_FILA = 18;
const REGLA = 18;
const ANCHO = { flanco: 34, cambio: 12, clr: 14, inicio: 12 };

const FILAS = [
  { nombre: 'CLK', tipo: 'clk' },
  { nombre: 'CLR', tipo: 'ent', f: s => s.CLR },
  { nombre: 'DIR', tipo: 'ent', f: s => s.DIR },
  { nombre: 'SL', tipo: 'ent', f: s => s.SL },
  { nombre: 'SR', tipo: 'ent', f: s => s.SR },
  ...Array.from({ length: N }, (_, k) => ({ nombre: `Q${N - 1 - k}`, tipo: 'q', f: s => s.Q[N - 1 - k] })),
  { nombre: 'Q hex', tipo: 'bus' },
];
const ALTO_TOTAL = REGLA + FILAS.length * ALTO_FILA + 6;

export const PALETAS = {
  oscuro: {
    fondo: '#0f141a', rejilla: '#1d2630', guia: '#253140', texto: '#8796a5', fuerte: '#e6edf3',
    q: '#ffb547', rellenoQ: 'rgba(255,181,71,0.13)', ent: '#6cc4ff', rellenoEnt: 'rgba(108,196,255,0.10)',
    clk: '#e6edf3', clr: '#ff6b6b', bus: '#ffb547',
  },
  claro: {
    fondo: '#ffffff', rejilla: '#e6e9ee', guia: '#d5dbe3', texto: '#5b6773', fuerte: '#1b232c',
    q: '#c26a00', rellenoQ: 'rgba(194,106,0,0.10)', ent: '#0b6fb8', rellenoEnt: 'rgba(11,111,184,0.08)',
    clk: '#1b232c', clr: '#c62828', bus: '#c26a00',
  },
};

function instantanea(s) {
  return { CLR: s.CLR, DIR: s.DIR, SL: s.SL, SR: s.SR, Q: s.Q.slice() };
}

// Dibuja la carta completa en ctx (unidades CSS). ox = desplazamiento de los datos.
function dibujar(ctx, segs, pal, { conEtiquetas, ancho }) {
  const ox = conEtiquetas ? ANCHO_ETIQ : 0;
  ctx.fillStyle = pal.fondo;
  ctx.fillRect(0, 0, ancho, ALTO_TOTAL);
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Filas alternas
  for (let r = 0; r < FILAS.length; r++) {
    if (r % 2) { ctx.fillStyle = pal.rejilla; ctx.globalAlpha = 0.45; ctx.fillRect(ox, REGLA + r * ALTO_FILA, ancho - ox, ALTO_FILA); ctx.globalAlpha = 1; }
  }

  // Regla y guías verticales de cada flanco
  let x = ox;
  const xs = [];
  for (const seg of segs) {
    const w = ANCHO[seg.tipo];
    xs.push(x);
    if (seg.tipo === 'flanco') {
      ctx.strokeStyle = pal.guia;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(x + 0.5, REGLA - 2); ctx.lineTo(x + 0.5, ALTO_TOTAL - 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.texto;
      ctx.textAlign = 'center';
      ctx.fillText(`#${seg.n}`, x + w / 2, REGLA / 2);
    } else if (seg.tipo === 'clr') {
      ctx.strokeStyle = pal.clr;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(x + 0.5, REGLA - 2); ctx.lineTo(x + 0.5, ALTO_TOTAL - 4); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    x += w;
  }

  FILAS.forEach((fila, r) => {
    const top = REGLA + r * ALTO_FILA;
    const yh = top + 4, yl = top + ALTO_FILA - 4;
    if (fila.tipo === 'bus') {
      ctx.strokeStyle = pal.bus;
      ctx.lineWidth = 1.2;
      let i = 0;
      while (i < segs.length) {
        const v = aNumero(segs[i].Q);
        let j = i;
        while (j + 1 < segs.length && aNumero(segs[j + 1].Q) === v) j++;
        const xa = xs[i], xb = xs[j] + ANCHO[segs[j].tipo], m = (yh + yl) / 2, b = Math.min(3, (xb - xa) / 2);
        ctx.beginPath();
        ctx.moveTo(xa, m); ctx.lineTo(xa + b, yh); ctx.lineTo(xb - b, yh); ctx.lineTo(xb, m);
        ctx.lineTo(xb - b, yl); ctx.lineTo(xa + b, yl); ctx.closePath();
        ctx.stroke();
        if (xb - xa >= 20) {
          ctx.fillStyle = pal.fuerte;
          ctx.textAlign = 'center';
          ctx.fillText(v.toString(16).toUpperCase().padStart(2, '0'), (xa + xb) / 2, m + 0.5);
        }
        i = j + 1;
      }
      return;
    }
    const color = fila.tipo === 'q' ? pal.q : fila.tipo === 'clk' ? pal.clk : fila.nombre === 'CLR' ? pal.clr : pal.ent;
    const relleno = fila.tipo === 'q' ? pal.rellenoQ : pal.rellenoEnt;
    // Piezas [x, ancho, valor]
    const piezas = [];
    segs.forEach((seg, k) => {
      const w = ANCHO[seg.tipo];
      if (fila.tipo === 'clk') {
        if (seg.tipo === 'flanco') piezas.push([xs[k], w / 2, 1], [xs[k] + w / 2, w / 2, 0]);
        else piezas.push([xs[k], w, 0]);
      } else {
        piezas.push([xs[k], w, fila.f(seg) ? 1 : 0]);
      }
    });
    ctx.fillStyle = relleno;
    for (const [px, pw, v] of piezas) if (v) ctx.fillRect(px, yh, pw, yl - yh);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let prev = null;
    for (const [px, pw, v] of piezas) {
      const y = v ? yh : yl;
      if (prev === null) ctx.moveTo(px, y);
      else if (v !== prev) { ctx.lineTo(px, prev ? yh : yl); ctx.lineTo(px, y); }
      ctx.lineTo(px + pw, y);
      prev = v;
    }
    ctx.stroke();
  });

  if (conEtiquetas) dibujarEtiquetas(ctx, pal);
}

function dibujarEtiquetas(ctx, pal) {
  ctx.fillStyle = pal.fondo;
  ctx.fillRect(0, 0, ANCHO_ETIQ, ALTO_TOTAL);
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  FILAS.forEach((fila, r) => {
    ctx.fillStyle = fila.tipo === 'q' || fila.tipo === 'bus' ? pal.fuerte : pal.texto;
    ctx.fillText(fila.nombre, 8, REGLA + r * ALTO_FILA + ALTO_FILA / 2);
  });
  ctx.strokeStyle = pal.guia;
  ctx.beginPath(); ctx.moveTo(ANCHO_ETIQ - 0.5, 0); ctx.lineTo(ANCHO_ETIQ - 0.5, ALTO_TOTAL); ctx.stroke();
}

function prepararCanvas(canvas, ancho, alto) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = Math.round(ancho * dpr);
  canvas.height = Math.round(alto * dpr);
  canvas.style.width = `${ancho}px`;
  canvas.style.height = `${alto}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function crearCronograma(contenedor) {
  const etiquetas = document.createElement('canvas');
  etiquetas.className = 'carta-etiquetas';
  const scroll = document.createElement('div');
  scroll.className = 'carta-scroll';
  const datos = document.createElement('canvas');
  scroll.append(datos);
  contenedor.append(etiquetas, scroll);

  let segs = [];
  let pendiente = false;
  let total = 0;

  function anchoDatos() { return segs.reduce((a, s) => a + ANCHO[s.tipo], 0); }

  function agregar(seg) {
    segs.push(seg);
    while (segs.length > MAX_EVENTOS) segs.shift();
    programar();
  }

  function registrar(ev, s) {
    if (ev.tipo === 'flanco') agregar({ tipo: 'flanco', n: ev.n, ...instantanea(s) });
    else if (ev.tipo === 'clr') agregar({ tipo: ev.activo ? 'clr' : 'cambio', ...instantanea(s) });
    else if (ev.tipo === 'entrada' && ['DIR', 'SL', 'SR'].includes(ev.nombre)) agregar({ tipo: 'cambio', ...instantanea(s) });
    else if (ev.tipo === 'reinicio') limpiar(s);
  }

  function limpiar(s) {
    segs = [{ tipo: 'inicio', ...instantanea(s) }];
    programar();
  }

  function programar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; render(); });
  }

  function render() {
    const cerca = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 48;
    total = anchoDatos() + 24;
    const ancho = Math.max(total, scroll.clientWidth || 0);
    const ctx = prepararCanvas(datos, ancho, ALTO_TOTAL);
    dibujar(ctx, segs, PALETAS.oscuro, { conEtiquetas: false, ancho });
    if (!etiquetas.width) dibujarEtiquetas(prepararCanvas(etiquetas, ANCHO_ETIQ, ALTO_TOTAL), PALETAS.oscuro);
    if (cerca) scroll.scrollLeft = scroll.scrollWidth;
  }

  // Canvas para exportar (fondo blanco, con etiquetas, escala 2)
  function canvasExportable() {
    const ancho = ANCHO_ETIQ + anchoDatos() + 24;
    const c = document.createElement('canvas');
    c.width = ancho * 2; c.height = ALTO_TOTAL * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    dibujar(ctx, segs, PALETAS.claro, { conEtiquetas: true, ancho });
    return c;
  }

  return { registrar, limpiar, render: programar, canvasExportable };
}
