// Vista "Circuito lógico": esquemático vivo de 8 muxes 2:1 + 8 flip-flops D.
import { N } from './registro.js';
import { el, caminoOrtogonal } from './protoboard.js';

const ANCHO = 1040, ALTO = 400;
const X0 = 130, DX = 110;                 // columna k = 0..7 (Q7..Q0)
const MUX = { arriba: 120, abajo: 166, medioArriba: 30, medioAbajo: 17 };
const FF = { arriba: 210, abajo: 290, medio: 32 };
const Y_DIR = 188, Y_CLK = 318, Y_CLR = 338;
const Y_Q = 230;                          // altura de la salida Q
const NIVEL = [70, 92];                   // niveles alternos de realimentación

const cxCol = k => X0 + k * DX;
const colBit = i => N - 1 - i;
const cxBit = i => cxCol(colBit(i));
const xI1 = i => cxBit(i) - 14;           // entrada I1 (izquierda del trapecio)
const xI0 = i => cxBit(i) + 14;           // entrada I0 (derecha del trapecio)
const xSubida = i => cxBit(i) + 46;       // columna por donde sube Q(i)

function cable(pts, extra = {}) {
  return el('path', { d: caminoOrtogonal(pts, 3), class: 'esq-cable', ...extra });
}
function punto(x, y) { return el('circle', { cx: x, cy: y, r: 3, class: 'esq-punto' }); }

export function crearEsquematico(contenedor) {
  const svg = el('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'vista-svg esquematico', role: 'img',
    'aria-label': 'Esquemático: 8 multiplexores 2:1 y 8 flip-flops D',
  });
  svg.append(el('rect', { x: 0, y: 0, width: ANCHO, height: ALTO, class: 'esq-fondo' }));
  const capaCables = el('g', { class: 'esq-cables' });
  const capaPartes = el('g', { class: 'esq-partes' });
  svg.append(capaCables, capaPartes);

  const refs = { q: [], d: [], sel: [], valorQ: [], s: [], clkRamas: [], clrRamas: [] };
  const xIzq = 40, xDer = ANCHO - 40;

  // ---------------- Buses ----------------
  const busDir = el('g', { 'data-control': 'dir', class: 'esq-bus' }, [el('title', {}, 'DIR → selector S de los 8 mux (clic para alternar)')]);
  busDir.append(cable([[xIzq, Y_DIR], [cxCol(N - 1) - 40, Y_DIR]]));
  const busClk = el('g', { 'data-control': 'clk', class: 'esq-bus esq-clk' }, [el('title', {}, 'CLK → todos los flip-flops (clic = flanco)')]);
  busClk.append(cable([[xIzq, Y_CLK], [cxCol(N - 1) - 44, Y_CLK]]));
  const busClr = el('g', { 'data-control': 'clr', class: 'esq-bus' }, [el('title', {}, 'CLR asíncrono → todos los flip-flops (mantener presionado)')]);
  busClr.append(cable([[xIzq, Y_CLR], [cxCol(N - 1) + 12, Y_CLR]]));
  capaCables.append(busDir, busClk, busClr);
  for (const [y, t, ctl] of [[Y_DIR, 'DIR', 'dir'], [Y_CLK, 'CLK', 'clk'], [Y_CLR, 'CLR', 'clr']]) {
    capaPartes.append(el('text', { x: xIzq - 6, y: y + 4, class: 'esq-rotulo', 'text-anchor': 'end', 'data-control': ctl }, t));
  }
  refs.busDir = busDir; refs.busClk = busClk; refs.busClr = busClr;

  // SR entra por la izquierda a I1 del mux7; SL por la derecha a I0 del mux0
  const sr = el('g', { 'data-control': 'sr', class: 'esq-entrada' }, [
    el('title', {}, 'SR → I1 del mux 7 (clic para alternar)'),
    cable([[xIzq, NIVEL[0] - 22], [xI1(N - 1), NIVEL[0] - 22], [xI1(N - 1), MUX.arriba]]),
  ]);
  const sl = el('g', { 'data-control': 'sl', class: 'esq-entrada' }, [
    el('title', {}, 'SL → I0 del mux 0 (clic para alternar)'),
    cable([[xDer, NIVEL[0] - 22], [xI0(0), NIVEL[0] - 22], [xI0(0), MUX.arriba]]),
  ]);
  capaCables.append(sr, sl);
  capaPartes.append(el('text', { x: xIzq - 6, y: NIVEL[0] - 18, class: 'esq-rotulo', 'text-anchor': 'end', 'data-control': 'sr' }, 'SR'));
  capaPartes.append(el('text', { x: xDer + 6, y: NIVEL[0] - 18, class: 'esq-rotulo', 'data-control': 'sl' }, 'SL'));
  refs.sr = sr; refs.sl = sl;

  // ---------------- Columnas ----------------
  for (let i = 0; i < N; i++) {
    const cx = cxBit(i);
    const nivel = NIVEL[i % 2];

    // Realimentación Q(i): sube y va a I0 del mux(i+1) (izquierda) y a I1 del mux(i-1) (derecha)
    const gq = el('g', { class: 'esq-senal' }, [el('title', {}, `Q${i}`)]);
    const xs = xSubida(i);
    gq.append(cable([[cx + FF.medio, Y_Q], [xs, Y_Q], [xs, nivel]]));
    const xa = i < N - 1 ? xI0(i + 1) : xs;
    const xb = i > 0 ? xI1(i - 1) : xs;
    gq.append(cable([[xa, nivel], [xb, nivel]]));
    if (i < N - 1) gq.append(cable([[xI0(i + 1), nivel], [xI0(i + 1), MUX.arriba]]));
    if (i > 0) gq.append(cable([[xI1(i - 1), nivel], [xI1(i - 1), MUX.arriba]]));
    if (i > 0 && i < N - 1) gq.append(punto(xs, nivel));
    refs.q[i] = gq;
    capaCables.append(gq);

    // Salida del mux → D
    const gd = el('g', { class: 'esq-senal' }, [el('title', {}, `D${i} = salida del mux ${i}`)]);
    gd.append(cable([[cx, MUX.abajo], [cx, FF.arriba]]));
    refs.d[i] = gd;
    capaCables.append(gd);

    // Selector S desde el bus DIR
    const ys = (MUX.arriba + MUX.abajo) / 2 + 6;
    const xSel = cx - 40;
    const gs = el('g', { class: 'esq-senal' }, [cable([[xSel, Y_DIR], [xSel, ys], [cx - 22, ys]]), punto(xSel, Y_DIR)]);
    refs.s[i] = gs;
    capaCables.append(gs);

    // Ramas de CLK y CLR
    const yClkFF = FF.abajo - 18;
    const rClk = el('g', { class: 'esq-senal' }, [cable([[cx - 44, Y_CLK], [cx - 44, yClkFF], [cx - FF.medio, yClkFF]]), punto(cx - 44, Y_CLK)]);
    const rClr = el('g', { class: 'esq-senal' }, [cable([[cx + 12, Y_CLR], [cx + 12, FF.abajo + 7]]), punto(cx + 12, Y_CLR)]);
    refs.clkRamas.push(rClk); refs.clrRamas.push(rClr);
    capaCables.append(rClk, rClr);

    // Mux (trapecio)
    const t = MUX;
    const mux = el('g', { class: 'esq-mux' }, [
      el('title', {}, `Mux ${i}: I0 = ${i === 0 ? 'SL' : 'Q' + (i - 1)}, I1 = ${i === N - 1 ? 'SR' : 'Q' + (i + 1)}, S = DIR`),
      el('path', { d: `M${cx - t.medioArriba} ${t.arriba} L${cx + t.medioArriba} ${t.arriba} L${cx + t.medioAbajo} ${t.abajo} L${cx - t.medioAbajo} ${t.abajo} Z`, class: 'esq-caja' }),
      el('text', { x: xI1(i), y: t.arriba + 11, class: 'esq-pin', 'text-anchor': 'middle' }, 'I1'),
      el('text', { x: xI0(i), y: t.arriba + 11, class: 'esq-pin', 'text-anchor': 'middle' }, 'I0'),
      el('text', { x: cx - 17, y: ys + 3, class: 'esq-pin' }, 'S'),
    ]);
    const sel = el('line', { x1: xI0(i), y1: t.arriba + 14, x2: cx, y2: t.abajo - 2, class: 'esq-seleccion' });
    refs.sel[i] = sel;
    mux.append(sel);
    capaPartes.append(mux);

    // Flip-flop D
    const f = FF;
    const valor = el('text', { x: cx + f.medio + 4, y: Y_Q + 16, class: 'esq-valor' }, '0');
    refs.valorQ[i] = valor;
    capaPartes.append(el('g', { class: 'esq-ff' }, [
      el('title', {}, `Flip-flop D ${i} → Q${i}`),
      el('rect', { x: cx - f.medio, y: f.arriba, width: 2 * f.medio, height: f.abajo - f.arriba, rx: 3, class: 'esq-caja' }),
      el('text', { x: cx, y: f.arriba + 13, class: 'esq-pin', 'text-anchor': 'middle' }, 'D'),
      el('text', { x: cx + f.medio - 4, y: Y_Q + 4, class: 'esq-pin', 'text-anchor': 'end' }, 'Q'),
      el('path', { d: `M${cx - f.medio} ${yClkFF - 6} L${cx - f.medio + 8} ${yClkFF} L${cx - f.medio} ${yClkFF + 6}`, class: 'esq-reloj' }),
      el('text', { x: cx + 12, y: f.abajo - 4, class: 'esq-pin pequeno', 'text-anchor': 'middle' }, 'CLR'),
      el('circle', { cx: cx + 12, cy: f.abajo + 3.5, r: 3.5, class: 'esq-burbuja' }),
      el('text', { x: cx - 4, y: (f.arriba + f.abajo) / 2 + 2, class: 'esq-nombre', 'text-anchor': 'middle' }, `FF${i}`),
      valor,
    ]));
    capaPartes.append(el('text', { x: cx, y: ALTO - 30, class: 'esq-col', 'text-anchor': 'middle' }, `Q${i}`));
  }

  // Marcas "sale"
  refs.saleIzq = el('text', { x: cxBit(N - 1) + FF.medio + 4, y: Y_Q + 34, class: 'esq-sale' }, [el('title', {}, 'Con DIR = 0 sale Q7'), 'sale']);
  refs.saleDer = el('text', { x: cxBit(0) + FF.medio + 4, y: Y_Q + 34, class: 'esq-sale' }, [el('title', {}, 'Con DIR = 1 sale Q0'), 'sale →']);
  capaPartes.append(refs.saleIzq, refs.saleDer);
  refs.leyenda = el('text', { x: xIzq, y: ALTO - 8, class: 'esq-leyenda' }, '');
  capaPartes.append(refs.leyenda);

  contenedor.append(svg);

  function nivel(nodo, v) {
    nodo.classList.toggle('v1', !!v);
    nodo.classList.toggle('v0', !v);
  }

  function actualizar(s, ui) {
    const D = ui.D;
    for (let i = 0; i < N; i++) {
      nivel(refs.q[i], s.Q[i]);
      nivel(refs.d[i], D[i]);
      nivel(refs.s[i], s.DIR);
      nivel(refs.sel[i], D[i]);
      refs.sel[i].setAttribute('x1', s.DIR ? xI1(i) : xI0(i));
      refs.valorQ[i].textContent = s.Q[i] ? '1' : '0';
      nivel(refs.valorQ[i], s.Q[i]);
      nivel(refs.clkRamas[i], ui.pulso);
      nivel(refs.clrRamas[i], s.CLR);
    }
    nivel(refs.busDir, s.DIR);
    nivel(refs.busClk, ui.pulso);
    nivel(refs.busClr, s.CLR);
    nivel(refs.sr, s.SR);
    nivel(refs.sl, s.SL);
    refs.busClk.classList.toggle('desfasado', !!s.desfasado);
    for (const r of refs.clkRamas) r.classList.toggle('desfasado', !!s.desfasado);
    refs.busClk.classList.toggle('deshabilitado', !!s.AUTO || !!ui.bloqueado);
    refs.leyenda.textContent = s.desfasado
      ? 'Relojes desfasados (P9): cada FF recibe el flanco después del anterior (Q0 primero, Q7 al final)'
      : '';
    refs.saleIzq.classList.toggle('activo', !s.DIR);
    refs.saleDer.classList.toggle('activo', !!s.DIR);
  }

  return { svg, actualizar };
}
