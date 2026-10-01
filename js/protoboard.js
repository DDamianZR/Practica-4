// Vista "Protoboard": montaje estilo Tinkercad (solo visual, sin simular conectividad).
import { N } from './registro.js';

const SVGNS = 'http://www.w3.org/2000/svg';

// Helper para crear elementos SVG: el('rect', {x: 0}, [hijos])
export function el(tag, attrs = {}, hijos = []) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v);
  for (const h of [].concat(hijos)) {
    if (h == null) continue;
    e.append(typeof h === 'string' || typeof h === 'number' ? document.createTextNode(String(h)) : h);
  }
  return e;
}

// Camino ortogonal con esquinas redondeadas a partir de una lista de puntos [x, y]
export function caminoOrtogonal(pts, r = 6) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    if (!l1 || !l2) continue;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = x1 - (x1 - x0) / l1 * rr, ay = y1 - (y1 - y0) / l1 * rr;
    const bx = x1 + (x2 - x1) / l2 * rr, by = y1 + (y2 - y1) / l2 * rr;
    d += ` L${ax} ${ay} Q${x1} ${y1} ${bx} ${by}`;
  }
  const u = pts[pts.length - 1];
  return d + ` L${u[0]} ${u[1]}`;
}

// ---------------- Geometría (rejilla de 0.1" = 16 px) ----------------
const PASO = 16;
const ANCHO = 900, ALTO = 830;
const BB = { x: 40, y: 22, cols: 50 };
BB.w = PASO * (BB.cols + 2);
BB.h = 312;
const colX = c => BB.x + PASO + c * PASO;
const FILAS = 'abcdefghij';
const FILA = { a: 94, b: 110, c: 126, d: 142, e: 158, f: 206, g: 222, h: 238, i: 254, j: 270 };
const RIEL = { supMas: 38, supMenos: 54, infMenos: 302, infMas: 318 };
const RANURA = 182;

const ARD = { x: 240, y: 480, w: 440, h: 300 };
const HEADER_Y = ARD.y + 12;
const ANALOG_Y = ARD.y + ARD.h - 12;
const HEADER1 = ['AREF', 'GND', '13', '12', '11', '10', '9', '8'];
const HEADER2 = ['7', '6', '5', '4', '3', '2', '1', '0'];
const POWER = ['IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN'];
const ANALOG = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
const xHeader1 = i => ARD.x + 100 + i * PASO;
const xHeader2 = i => ARD.x + 240 + i * PASO;
const xPower = i => ARD.x + 120 + i * PASO;
const xAnalog = i => ARD.x + 280 + i * PASO;

function xPinDigital(n) {
  return n >= 8 ? xHeader1(HEADER1.indexOf(String(n))) : xHeader2(HEADER2.indexOf(String(n)));
}

// Canal k = 0..7 de izquierda a derecha (Q7..Q0)
const colCanal = k => 13 + 4 * k;
const bitCanal = k => N - 1 - k;

const COLORES_Q = ['#ff7043', '#ffa726', '#ffca28', '#ef5350', '#ec407a', '#ff8a65', '#ffb74d', '#d4e157'];
const COLORES_ENT = { clk: '#29b6f6', clr: '#5c6bc0', dir: '#26c6da', sr: '#42a5f5', sl: '#7e57c2', auto: '#26a69a' };
const NEGRO = '#2a2a2a';

function cable(pts, color, nombre) {
  const d = caminoOrtogonal(pts, 7);
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  return el('g', { class: 'pb-cable' }, [
    el('title', {}, nombre),
    el('path', { d, class: 'pb-cable-borde' }),
    el('path', { d, stroke: color, class: 'pb-cable-alma' }),
    el('circle', { cx: x0, cy: y0, r: 2.6, fill: color, class: 'pb-cable-punta' }),
    el('circle', { cx: x1, cy: y1, r: 2.6, fill: color, class: 'pb-cable-punta' }),
  ]);
}

function etiquetaVertical(x, y, texto) {
  const ancho = texto.length * 5.6 + 6;
  return el('g', { class: 'pb-etiqueta', transform: `rotate(-90 ${x} ${y})` }, [
    el('rect', { x: x - ancho / 2, y: y - 6, width: ancho, height: 12, rx: 3 }),
    el('text', { x, y: y + 3.5, 'text-anchor': 'middle' }, texto),
  ]);
}

function etiqueta(x, y, texto) {
  const ancho = texto.length * 5.6 + 8;
  return el('g', { class: 'pb-etiqueta' }, [
    el('rect', { x: x - ancho / 2, y: y - 6.5, width: ancho, height: 13, rx: 3 }),
    el('text', { x, y: y + 3.5, 'text-anchor': 'middle' }, texto),
  ]);
}

function dibujarProtoboard() {
  const g = el('g', { class: 'pb-protoboard' });
  g.append(el('rect', { x: BB.x, y: BB.y, width: BB.w, height: BB.h, rx: 8, class: 'pb-placa-blanca' }));
  g.append(el('rect', { x: BB.x + 6, y: RANURA - 6, width: BB.w - 12, height: 12, class: 'pb-ranura' }));
  // Líneas de los rieles
  for (const [y, cls] of [[RIEL.supMas - 9, 'mas'], [RIEL.supMenos + 9, 'menos'], [RIEL.infMenos - 9, 'menos'], [RIEL.infMas + 9, 'mas']]) {
    g.append(el('line', { x1: BB.x + 14, x2: BB.x + BB.w - 14, y1: y, y2: y, class: `pb-riel-${cls}` }));
  }
  for (const [y, s] of [[RIEL.supMas, '+'], [RIEL.supMenos, '−'], [RIEL.infMenos, '−'], [RIEL.infMas, '+']]) {
    g.append(el('text', { x: BB.x + 8, y: y + 3.5, class: 'pb-rotulo', 'text-anchor': 'middle' }, s));
    g.append(el('text', { x: BB.x + BB.w - 8, y: y + 3.5, class: 'pb-rotulo', 'text-anchor': 'middle' }, s));
  }
  // Orificios
  const filasY = [...Object.values(RIEL), ...Object.values(FILA)];
  for (let c = 0; c < BB.cols; c++) {
    for (const y of filasY) g.append(el('rect', { x: colX(c) - 2.5, y: y - 2.5, width: 5, height: 5, rx: 1, class: 'pb-orificio' }));
    if (c === 0 || (c + 1) % 5 === 0) {
      g.append(el('text', { x: colX(c), y: 286, class: 'pb-rotulo', 'text-anchor': 'middle' }, String(c + 1)));
    }
  }
  for (const f of FILAS) {
    g.append(el('text', { x: BB.x + 8, y: FILA[f] + 3, class: 'pb-rotulo', 'text-anchor': 'middle' }, f));
    g.append(el('text', { x: BB.x + BB.w - 8, y: FILA[f] + 3, class: 'pb-rotulo', 'text-anchor': 'middle' }, f));
  }
  return g;
}

function dibujarArduino(refs) {
  const { x, y, w, h } = ARD;
  const g = el('g', { class: 'pb-arduino' }, [el('title', {}, 'Placa tipo UNO')]);
  g.append(el('rect', { x, y, width: w, height: h, rx: 12, class: 'pb-ard-placa' }));
  for (const [cx, cy] of [[x + 30, y + 14], [x + w - 20, y + 30], [x + w - 20, y + h - 30], [x + 40, y + h - 14]]) {
    g.append(el('circle', { cx, cy, r: 6, class: 'pb-ard-agujero' }));
  }
  g.append(el('rect', { x: x - 14, y: y + 40, width: 66, height: 50, rx: 3, class: 'pb-ard-usb' }));
  g.append(el('rect', { x: x - 10, y: y + 200, width: 58, height: 52, rx: 4, class: 'pb-ard-jack' }));
  g.append(el('rect', { x: x + 20, y: y + 104, width: 14, height: 14, rx: 2, class: 'pb-ard-reset' }));
  // Microcontrolador
  g.append(el('rect', { x: x + 190, y: y + 150, width: 200, height: 46, rx: 3, class: 'pb-ard-chip' }));
  for (let i = 0; i < 14; i++) {
    g.append(el('rect', { x: x + 196 + i * 14, y: y + 144, width: 6, height: 6, class: 'pb-ard-pata' }));
    g.append(el('rect', { x: x + 196 + i * 14, y: y + 196, width: 6, height: 6, class: 'pb-ard-pata' }));
  }
  g.append(el('circle', { cx: x + 202, cy: y + 173, r: 4, class: 'pb-ard-marca' }));

  // Headers
  const header = (xs, yh, nombres, arriba) => {
    const x0 = xs[0] - 8, ancho = xs.length * PASO;
    g.append(el('rect', { x: x0, y: yh - 8, width: ancho, height: 16, rx: 1.5, class: 'pb-ard-header' }));
    xs.forEach((xp, i) => {
      g.append(el('rect', { x: xp - 3, y: yh - 3, width: 6, height: 6, class: 'pb-ard-pin' }));
      const ty = arriba ? yh + 12 : yh - 12;
      g.append(el('text', {
        x: xp + 3, y: ty, class: 'pb-ard-texto',
        'text-anchor': arriba ? 'end' : 'start', transform: `rotate(-90 ${xp + 3} ${ty})`,
      }, nombres[i]));
    });
  };
  header(HEADER1.map((_, i) => xHeader1(i)), HEADER_Y, HEADER1, true);
  header(HEADER2.map((_, i) => xHeader2(i)), HEADER_Y, HEADER2, true);
  header(POWER.map((_, i) => xPower(i)), ANALOG_Y, POWER, false);
  header(ANALOG.map((_, i) => xAnalog(i)), ANALOG_Y, ANALOG, false);
  g.append(el('text', { x: xHeader2(0) + 56, y: y + 76, class: 'pb-ard-texto grande', 'text-anchor': 'middle' }, 'DIGITAL'));
  g.append(el('text', { x: xPower(3), y: y + h - 74, class: 'pb-ard-texto grande', 'text-anchor': 'middle' }, 'POWER'));
  g.append(el('text', { x: xAnalog(2.5), y: y + h - 74, class: 'pb-ard-texto grande', 'text-anchor': 'middle' }, 'ANALOG IN'));

  // LED "L" (pin 13) y LED de encendido
  const lx = xHeader1(2) - 4, ly = y + 84;
  refs.ledL = el('rect', { x: lx, y: ly, width: 10, height: 6, rx: 1, class: 'pb-ard-led-l' });
  g.append(el('g', {}, [el('title', {}, 'LED L (pin 13): destella en cada flanco'), refs.ledL]));
  g.append(el('text', { x: lx + 14, y: ly + 6, class: 'pb-ard-texto' }, 'L'));
  g.append(el('rect', { x: x + w - 70, y: y + 96, width: 10, height: 6, rx: 1, class: 'pb-ard-led-on' }));
  g.append(el('text', { x: x + w - 56, y: y + 102, class: 'pb-ard-texto' }, 'ON'));
  return g;
}

function dibujarResistencia(x, y1, y2) {
  const cy = (y1 + y2) / 2;
  const bandas = ['#f57c00', '#f57c00', '#6d4c41', '#c9a227'];  // naranja-naranja-café-dorado
  const g = el('g', { class: 'pb-resistencia' }, [
    el('title', {}, 'Resistencia 330 Ω'),
    el('line', { x1: x, x2: x, y1, y2, class: 'pb-pata' }),
    el('rect', { x: x - 6, y: cy - 18, width: 12, height: 36, rx: 5, class: 'pb-res-cuerpo' }),
  ]);
  [-12, -6, 0, 11].forEach((dy, i) => {
    g.append(el('rect', { x: x - 6, y: cy + dy - 1.5, width: 12, height: 3, fill: bandas[i] }));
  });
  return g;
}

function dibujarLED(x, bit, k) {
  const cx = x + 8;
  const g = el('g', { class: 'pb-led' }, [
    el('title', {}, `LED Q${bit} (D${2 + bit}) con resistencia de 330 Ω`),
    el('circle', { cx, cy: 108, r: 20, class: 'pb-led-halo', fill: 'url(#pbHalo)' }),
    el('line', { x1: x, x2: x, y1: 119, y2: FILA.c, class: 'pb-pata' }),
    el('line', { x1: x + PASO, x2: x + PASO, y1: 119, y2: FILA.c, class: 'pb-pata' }),
    el('rect', { x: cx - 10, y: 116, width: 20, height: 4, rx: 1, class: 'pb-led-base' }),
    el('path', { d: `M${cx - 8} 118 L${cx - 8} 106 A8 8 0 0 1 ${cx + 8} 106 L${cx + 8} 118 Z`, class: 'pb-led-cuerpo' }),
    el('path', { d: `M${cx - 4.5} 112 L${cx - 4.5} 106 A4.5 4.5 0 0 1 ${cx} 101.5`, class: 'pb-led-brillo' }),
  ]);
  g.dataset.canal = k;
  return g;
}

function dibujarPulsador(c, nombre, pin, control) {
  const cx = colX(c + 1), cy = RANURA;
  const g = el('g', { class: 'pb-pulsador', 'data-control': control }, [el('title', {}, `Pulsador ${nombre} (${pin})`)]);
  for (const [px, py] of [[colX(c), FILA.e], [colX(c + 2), FILA.e], [colX(c), FILA.f], [colX(c + 2), FILA.f]]) {
    g.append(el('rect', { x: px - 2, y: Math.min(py, cy), width: 4, height: Math.abs(py - cy), class: 'pb-pulsador-pata' }));
  }
  g.append(el('rect', { x: cx - 22, y: cy - 22, width: 44, height: 44, rx: 4, class: 'pb-pulsador-cuerpo' }));
  for (const [dx, dy] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
    g.append(el('circle', { cx: cx + dx, cy: cy + dy, r: 2.2, class: 'pb-pulsador-remache' }));
  }
  const tapa = el('g', { class: 'pb-pulsador-tapa' }, [
    el('circle', { cx, cy, r: 13, class: 'pb-pulsador-aro' }),
    el('circle', { cx, cy, r: 10, class: 'pb-pulsador-boton' }),
  ]);
  g.append(tapa);
  return { g, tapa };
}

function dibujarDIP(cols, nombres, pines, controles, refs) {
  const x0 = colX(cols[0]) - 10, x1 = colX(cols[cols.length - 1]) + 10;
  const g = el('g', { class: 'pb-dip' });
  for (const c of cols) {
    g.append(el('line', { x1: colX(c), x2: colX(c), y1: FILA.e, y2: FILA.f, class: 'pb-pata' }));
  }
  g.append(el('rect', { x: x0, y: RANURA - 20, width: x1 - x0, height: 40, rx: 2, class: 'pb-dip-cuerpo' }));
  g.append(el('text', { x: x0 + 3, y: RANURA - 22, class: 'pb-rotulo' }, 'ON'));
  refs.dip = {};
  cols.forEach((c, i) => {
    const x = colX(c);
    const perilla = el('rect', { x: x - 4, y: RANURA - 2, width: 8, height: 12, rx: 1.5, class: 'pb-dip-perilla' });
    const sw = el('g', { class: 'pb-dip-switch', 'data-control': controles[i] }, [
      el('title', {}, `${nombres[i]} (${pines[i]}) — cerrado = 1`),
      el('rect', { x: x - 6, y: RANURA - 16, width: 12, height: 30, class: 'pb-dip-hueco' }),
      el('rect', { x: x - 4.5, y: RANURA - 14, width: 9, height: 26, rx: 1, class: 'pb-dip-ranura' }),
      perilla,
      el('text', { x, y: RANURA + 19, class: 'pb-dip-num', 'text-anchor': 'middle' }, String(i + 1)),
    ]);
    refs.dip[controles[i]] = { sw, perilla };
    g.append(sw);
  });
  return g;
}

export function crearProtoboard(contenedor) {
  const refs = { leds: [], ledsQ: [] };
  const svg = el('svg', {
    viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'vista-svg protoboard', role: 'img',
    'aria-label': 'Montaje en protoboard con placa tipo UNO',
  });
  svg.append(el('defs', {}, [
    el('pattern', { id: 'pbRejilla', width: PASO, height: PASO, patternUnits: 'userSpaceOnUse' }, [
      el('path', { d: `M${PASO} 0 L0 0 0 ${PASO}`, class: 'pb-rejilla-linea' }),
    ]),
    el('radialGradient', { id: 'pbHalo' }, [
      el('stop', { offset: '0%', 'stop-color': '#ff4b3e', 'stop-opacity': 0.75 }),
      el('stop', { offset: '100%', 'stop-color': '#ff4b3e', 'stop-opacity': 0 }),
    ]),
  ]));
  svg.append(el('rect', { x: 0, y: 0, width: ANCHO, height: ALTO, class: 'pb-fondo' }));
  svg.append(el('rect', { x: 0, y: 0, width: ANCHO, height: ALTO, fill: 'url(#pbRejilla)' }));
  svg.append(dibujarProtoboard());
  svg.append(dibujarArduino(refs));

  // ---------------- Cables ----------------
  const cables = el('g', { class: 'pb-cables' });
  // Salidas Q: D9..D2 hacia la mitad inferior (fila j)
  for (let k = 0; k < N; k++) {
    const bit = bitCanal(k), x = colX(colCanal(k)), px = xPinDigital(2 + bit);
    const nivel = k < 4 ? 420 - 12 * k : 420 + 12 * (k - 4);
    cables.append(cable([[px, HEADER_Y], [px, nivel], [x, nivel], [x, FILA.j]], COLORES_Q[k], `Q${bit} ← D${2 + bit}`));
    // Cátodo al riel −
    const xc = x + PASO;
    cables.append(cable([[xc, FILA.a], [xc, RIEL.supMenos]], NEGRO, `Cátodo Q${bit} → GND (riel −)`));
  }
  // Pulsadores: CLR en columnas 2..4, CLK en 7..9
  const C_CLR = 2, C_CLK = 7;
  cables.append(cable([[xPinDigital(11), HEADER_Y], [xPinDigital(11), 444], [colX(C_CLR + 2), 444], [colX(C_CLR + 2), FILA.j]], COLORES_ENT.clr, 'CLR → D11'));
  cables.append(cable([[xPinDigital(10), HEADER_Y], [xPinDigital(10), 432], [colX(C_CLK + 2), 432], [colX(C_CLK + 2), FILA.j]], COLORES_ENT.clk, 'CLK → D10'));
  for (const c of [C_CLR, C_CLK]) cables.append(cable([[colX(c), FILA.a], [colX(c), RIEL.supMenos]], NEGRO, 'Pulsador → GND (riel −)'));
  // DIP: DIR (D12), SR (A0), SL (A1), AUTO (A2)
  const DIP_COLS = [45, 46, 47, 48];
  cables.append(cable([[xPinDigital(12), HEADER_Y], [xPinDigital(12), 470], [colX(DIP_COLS[0]), 470], [colX(DIP_COLS[0]), FILA.j]], COLORES_ENT.dir, 'DIR → D12'));
  ['sr', 'sl', 'auto'].forEach((nombre, i) => {
    const px = xAnalog(i), xd = colX(DIP_COLS[i + 1]), nivel = ARD.y + ARD.h + 14 + 10 * i;
    cables.append(cable([[px, ANALOG_Y], [px, nivel], [xd, nivel], [xd, FILA.j]], COLORES_ENT[nombre], `${nombre.toUpperCase()} → A${i}`));
  });
  for (const c of DIP_COLS) cables.append(cable([[colX(c), FILA.a], [colX(c), RIEL.supMenos]], NEGRO, 'DIP → GND (riel −)'));
  // GND de la placa al riel − superior, por el borde izquierdo de la protoboard
  const xg = xHeader1(1);
  cables.append(cable([[xg, HEADER_Y], [xg, 456], [BB.x - 16, 456], [BB.x - 16, RIEL.supMenos], [colX(0), RIEL.supMenos]], NEGRO, 'GND de la placa → riel −'));
  svg.append(cables);

  // ---------------- Componentes ----------------
  for (let k = 0; k < N; k++) {
    const bit = bitCanal(k), x = colX(colCanal(k));
    svg.append(dibujarResistencia(x, FILA.d, FILA.g));
    const led = dibujarLED(x, bit, k);
    refs.ledsQ[bit] = led;
    svg.append(led);
    svg.append(el('text', { x: x + 4, y: 90, class: 'pb-etiqueta-q', 'text-anchor': 'middle' }, `Q${bit}`));
  }
  const clr = dibujarPulsador(C_CLR, 'CLR', 'D11', 'clr');
  const clk = dibujarPulsador(C_CLK, 'CLK', 'D10', 'clk');
  refs.clr = clr; refs.clk = clk;
  svg.append(clr.g, clk.g);
  svg.append(etiqueta(colX(C_CLR + 1), FILA.b, 'CLR'));
  svg.append(etiqueta(colX(C_CLK + 1), FILA.b, 'CLK'));
  svg.append(dibujarDIP(DIP_COLS, ['DIR', 'SR', 'SL', 'AUTO'], ['D12', 'A0', 'A1', 'A2'], ['dir', 'sr', 'sl', 'auto'], refs));
  ['DIR', 'SR', 'SL', 'AUTO'].forEach((t, i) => svg.append(etiquetaVertical(colX(DIP_COLS[i]) + 0.5, FILA.h, t)));

  contenedor.append(svg);

  const DIP_ESTADO = { dir: 'DIR', sr: 'SR', sl: 'SL', auto: 'AUTO' };
  function actualizar(s, ui) {
    for (let i = 0; i < N; i++) refs.ledsQ[i].classList.toggle('on', !!s.Q[i]);
    refs.ledL.classList.toggle('on', !!ui.tick);
    const clkAbajo = !!ui.clkPresionado;
    refs.clk.g.classList.toggle('presionado', clkAbajo);
    refs.clk.tapa.setAttribute('transform', clkAbajo ? 'translate(0 1.5) scale(1)' : '');
    refs.clk.g.classList.toggle('deshabilitado', !!s.AUTO || !!ui.bloqueado);
    refs.clr.g.classList.toggle('presionado', !!s.CLR);
    refs.clr.tapa.setAttribute('transform', s.CLR ? 'translate(0 1.5)' : '');
    refs.clr.g.classList.toggle('deshabilitado', !!ui.bloqueado);
    for (const [ctl, nombre] of Object.entries(DIP_ESTADO)) {
      const { sw, perilla } = refs.dip[ctl];
      const on = !!s[nombre];
      sw.classList.toggle('on', on);
      sw.classList.toggle('deshabilitado', !!ui.bloqueado);
      perilla.setAttribute('y', on ? RANURA - 12 : RANURA - 1);
    }
  }

  return { svg, actualizar };
}
