// Arranque de la interfaz: conecta el registro con las vistas, el panel y el monitor serie.
import { crearRegistro, bitsTexto, aNumero, N, TICK_MS } from './registro.js';
import { crearProtoboard } from './protoboard.js';
import { crearEsquematico } from './esquematico.js';
import { crearCronograma } from './cronograma.js';

const PASO_MS = 600;
const PULSO_MS = 150;
const MAX_LINEAS = 500;
const SVGNS = 'http://www.w3.org/2000/svg';
const PROPS_EXPORT = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight',
  'text-anchor', 'display', 'visibility', 'paint-order',
];

const esperar = ms => new Promise(r => setTimeout(r, ms));

function descargar(canvas, nombre) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

// SVG → canvas con fondo claro: clona la vista bajo .tema-claro e incrusta los estilos calculados
async function exportarSVG(svg, nombre) {
  const host = document.createElement('div');
  host.className = 'tema-claro exportando';
  const clon = svg.cloneNode(true);
  host.append(clon);
  document.body.append(host);
  for (const n of [clon, ...clon.querySelectorAll('*')]) {
    const cs = getComputedStyle(n);
    let estilo = '';
    for (const p of PROPS_EXPORT) {
      const v = cs.getPropertyValue(p);
      if (v) estilo += `${p}:${v};`;
    }
    n.setAttribute('style', estilo);
  }
  host.remove();
  const vb = svg.viewBox.baseVal;
  clon.setAttribute('xmlns', SVGNS);
  clon.setAttribute('width', vb.width);
  clon.setAttribute('height', vb.height);
  const texto = new XMLSerializer().serializeToString(clon);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
    const escala = 2;
    const c = document.createElement('canvas');
    c.width = vb.width * escala;
    c.height = vb.height * escala;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    descargar(c, nombre);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function iniciar() {
  const $ = id => document.getElementById(id);
  const registro = crearRegistro();
  const s = registro.estado;
  const ui = { tick: false, pulso: false, clkPresionado: false, bloqueado: false, D: [] };
  const entrada = { clkPuntero: false, clkTecla: false, clrPuntero: false, clrTecla: false };

  const proto = crearProtoboard($('vista-protoboard'));
  const esq = crearEsquematico($('vista-circuito'));
  const carta = crearCronograma($('carta'));

  // ---------------- Encabezado ----------------
  const bitsCaja = $('bits');
  const bitsSpans = [];
  for (let i = N - 1; i >= 0; i--) {
    const b = document.createElement('span');
    b.className = 'bit';
    b.title = `Q${i}`;
    bitsSpans[i] = b;
    bitsCaja.append(b);
    if (i === 4) {
      const sep = document.createElement('span');
      sep.className = 'bit-sep';
      bitsCaja.append(sep);
    }
  }

  // ---------------- Carga paralela ----------------
  const cargaBits = new Array(N).fill(0);  // índice = bit
  const cargaBotones = [];
  for (let i = N - 1; i >= 0; i--) {
    const b = document.createElement('button');
    b.className = 'bit-carga';
    b.type = 'button';
    b.title = `Q${i}`;
    b.addEventListener('click', () => { cargaBits[i] ^= 1; programarRender(); });
    cargaBotones[i] = b;
    $('carga-bits').append(b);
  }

  // ---------------- Monitor serie ----------------
  const monitor = $('monitor');
  function escribirMonitor(texto, clase) {
    const linea = document.createElement('span');
    linea.textContent = texto + '\n';
    if (clase) linea.className = clase;
    monitor.append(linea);
    while (monitor.childNodes.length > MAX_LINEAS) monitor.firstChild.remove();
    monitor.scrollTop = monitor.scrollHeight;
  }
  function enviarSerie(txt) {
    escribirMonitor(`> ${txt}`, 'eco');
    registro.comandoSerie(txt);
  }

  // ---------------- Render ----------------
  let renderPendiente = false;
  function programarRender() {
    if (renderPendiente) return;
    renderPendiente = true;
    requestAnimationFrame(() => { renderPendiente = false; render(); });
  }

  const bot = {
    clk: $('btn-clk'), clr: $('btn-clr'), dir: $('btn-dir'), sl: $('btn-sl'), sr: $('btn-sr'), auto: $('btn-auto'),
  };
  const bloqueables = ['btn-cargar', 'chk-desfasado', 'btn-secuencia', 'btn-demo', 'btn-reiniciar', 'frecuencia'].map($);

  function render() {
    ui.D = registro.entradasD();
    ui.clkPresionado = entrada.clkPuntero || entrada.clkTecla || ui.pulso;

    for (let i = 0; i < N; i++) {
      bitsSpans[i].textContent = s.Q[i] ? '1' : '0';
      bitsSpans[i].classList.toggle('on', !!s.Q[i]);
      cargaBotones[i].textContent = cargaBits[i];
      cargaBotones[i].classList.toggle('on', !!cargaBits[i]);
      cargaBotones[i].disabled = ui.bloqueado;
    }
    const v = aNumero(s.Q);
    $('m-dec').textContent = v;
    $('m-hex').textContent = '0x' + v.toString(16).toUpperCase().padStart(2, '0');
    $('m-flanco').textContent = `#${s.numFlanco}`;
    $('m-sale').textContent = s.ultimoSale == null ? '—' : String(s.ultimoSale);
    bitsCaja.setAttribute('aria-label', `Q7..Q0 = ${bitsTexto(s.Q)}`);

    bot.dir.setAttribute('aria-checked', String(!!s.DIR));
    bot.dir.classList.toggle('der', !!s.DIR);
    for (const k of ['sl', 'sr', 'auto']) {
      const val = s[k.toUpperCase()];
      bot[k].textContent = val ? '1' : '0';
      bot[k].setAttribute('aria-checked', String(!!val));
      bot[k].classList.toggle('on', !!val);
    }
    bot.clk.disabled = !!s.AUTO || ui.bloqueado || !!s.CLR;
    bot.clk.classList.toggle('presionado', ui.clkPresionado);
    bot.clr.classList.toggle('presionado', !!s.CLR);
    for (const k of ['clr', 'dir', 'sl', 'sr', 'auto']) bot[k].disabled = ui.bloqueado;
    for (const b of bloqueables) b.disabled = ui.bloqueado;
    $('chk-desfasado').checked = s.desfasado;
    $('frecuencia').value = s.frecuencia;
    $('frecuencia-valor').textContent = `${s.frecuencia} Hz`;
    document.body.classList.toggle('bloqueado', ui.bloqueado);
    document.body.classList.toggle('auto', !!s.AUTO);

    proto.actualizar(s, ui);
    esq.actualizar(s, ui);
  }

  // ---------------- Reloj automático ----------------
  let temporizador = null;
  function reprogramarAuto() {
    clearInterval(temporizador);
    temporizador = null;
    if (s.AUTO) temporizador = setInterval(() => registro.flanco('auto'), 1000 / s.frecuencia);
  }

  let tTick = null, tPulso = null;
  registro.suscribir((ev, estado) => {
    if (ev.tipo === 'serie') escribirMonitor(ev.texto);
    carta.registrar(ev, estado);
    if (ev.tipo === 'flanco') {
      ui.tick = true;
      ui.pulso = true;
      clearTimeout(tTick); clearTimeout(tPulso);
      tTick = setTimeout(() => { ui.tick = false; programarRender(); }, TICK_MS);
      const pulso = estado.AUTO ? Math.min(PULSO_MS, 450 / estado.frecuencia) : PULSO_MS;
      tPulso = setTimeout(() => { ui.pulso = false; programarRender(); }, pulso);
    }
    if (ev.tipo === 'reinicio' || (ev.tipo === 'entrada' && (ev.nombre === 'AUTO' || ev.nombre === 'frecuencia'))) {
      reprogramarAuto();
    }
    programarRender();
  });

  // ---------------- Acciones ----------------
  function pulsarCLK() {
    if (ui.bloqueado) return;
    registro.flanco('manual');
  }
  const ALTERNABLES = { dir: 'DIR', sl: 'SL', sr: 'SR', auto: 'AUTO' };

  // Cualquier [data-control] de cualquier vista equivale al control del panel
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const t = e.target.closest('[data-control]');
    if (!t || ui.bloqueado) return;
    const ctl = t.dataset.control;
    if (ctl === 'clk') {
      if (s.AUTO) return;
      entrada.clkPuntero = true;
      pulsarCLK();
      programarRender();
    } else if (ctl === 'clr') {
      entrada.clrPuntero = true;
      registro.setCLR(1);
    }
  });
  const soltarPuntero = () => {
    if (entrada.clkPuntero) { entrada.clkPuntero = false; programarRender(); }
    if (entrada.clrPuntero) {
      entrada.clrPuntero = false;
      if (!entrada.clrTecla) registro.setCLR(0);
    }
  };
  window.addEventListener('pointerup', soltarPuntero);
  window.addEventListener('pointercancel', soltarPuntero);
  window.addEventListener('blur', () => {
    entrada.clkTecla = false;
    if (entrada.clrTecla) { entrada.clrTecla = false; if (!entrada.clrPuntero) registro.setCLR(0); }
    soltarPuntero();
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-control]');
    if (!t || ui.bloqueado) return;
    const ctl = t.dataset.control;
    if (ctl === 'clk' && e.detail === 0) pulsarCLK();  // activado con teclado (Enter)
    else if (ALTERNABLES[ctl]) registro.alternar(ALTERNABLES[ctl]);
  });

  // ---------------- Atajos de teclado ----------------
  const enCampo = t => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || enCampo(e.target)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      if (e.repeat || ui.bloqueado || s.AUTO) return;
      entrada.clkTecla = true;
      pulsarCLK();
      programarRender();
      return;
    }
    if (e.repeat || ui.bloqueado) return;
    if (k === 'c') {
      entrada.clrTecla = true;
      registro.setCLR(1);
    } else if (k === 'd') registro.alternar('DIR');
    else if (k === 'l') registro.alternar('SL');
    else if (k === 'r') registro.alternar('SR');
    else if (k === 'a') registro.alternar('AUTO');
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') {
      if (!enCampo(e.target)) e.preventDefault();
      if (entrada.clkTecla) { entrada.clkTecla = false; programarRender(); }
    } else if (k === 'c' && entrada.clrTecla) {
      entrada.clrTecla = false;
      if (!entrada.clrPuntero) registro.setCLR(0);
    }
  });

  // ---------------- Panel ----------------
  $('frecuencia').addEventListener('input', e => registro.set('frecuencia', e.target.value));
  $('chk-desfasado').addEventListener('change', e => registro.set('desfasado', e.target.checked));
  $('btn-cargar').addEventListener('click', () => {
    let bits = '';
    for (let i = N - 1; i >= 0; i--) bits += cargaBits[i];
    enviarSerie('P' + bits);
  });
  $('form-serie').addEventListener('submit', e => {
    e.preventDefault();
    const campo = $('entrada-serie');
    if (!campo.value.trim()) return;
    enviarSerie(campo.value.trim());
    campo.value = '';
  });
  $('btn-monitor-limpiar').addEventListener('click', () => monitor.replaceChildren());
  $('btn-monitor-copiar').addEventListener('click', async e => {
    const boton = e.currentTarget;
    const texto = monitor.textContent;
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const area = document.createElement('textarea');
      area.value = texto;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    boton.textContent = 'Copiado';
    setTimeout(() => { boton.textContent = 'Copiar'; }, 1200);
  });
  $('btn-reiniciar').addEventListener('click', () => {
    if (ui.bloqueado) return;
    monitor.replaceChildren();
    registro.reiniciar();
  });
  $('btn-carta-limpiar').addEventListener('click', () => carta.limpiar(s));
  $('btn-carta-exportar').addEventListener('click', () => descargar(carta.canvasExportable(), 'carta-de-tiempos.png'));

  // ---------------- Secuencias ----------------
  async function correrSecuencia(pasos) {
    if (ui.bloqueado) return;
    registro.set('AUTO', 0);
    entrada.clrPuntero = entrada.clrTecla = false;
    registro.setCLR(0);
    ui.bloqueado = true;
    programarRender();
    try {
      for (const paso of pasos) {
        paso();
        await esperar(PASO_MS);
      }
    } finally {
      ui.bloqueado = false;
      programarRender();
    }
  }
  const clrPulso = [() => registro.setCLR(1), () => registro.setCLR(0)];
  $('btn-secuencia').addEventListener('click', () => {
    const tabla = [[0, 1, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0], [1, 0, 1], [1, 0, 0]];
    correrSecuencia([
      ...clrPulso,
      ...tabla.map(([dir, sl, sr]) => () => {
        registro.set('DIR', dir); registro.set('SL', sl); registro.set('SR', sr);
        registro.flanco('secuencia');
      }),
    ]);
  });
  $('btn-demo').addEventListener('click', () => {
    correrSecuencia([
      ...clrPulso,
      () => { registro.set('desfasado', true); registro.set('DIR', 0); registro.set('SL', 1); },
      () => registro.flanco('secuencia'),
      () => registro.set('desfasado', false),
    ]);
  });

  // ---------------- Pestañas y exportación ----------------
  const pestanas = [
    { tab: $('tab-protoboard'), vista: $('vista-protoboard'), svg: proto.svg, archivo: 'protoboard.png' },
    { tab: $('tab-circuito'), vista: $('vista-circuito'), svg: esq.svg, archivo: 'circuito-logico.png' },
  ];
  let activa = 0;
  function mostrar(i) {
    activa = i;
    pestanas.forEach((p, k) => {
      p.tab.setAttribute('aria-selected', String(k === i));
      p.vista.hidden = k !== i;
    });
    try { localStorage.setItem('registro8.pestana', String(i)); } catch { /* sin almacenamiento */ }
  }
  pestanas.forEach((p, i) => p.tab.addEventListener('click', () => mostrar(i)));
  try { mostrar(Number(localStorage.getItem('registro8.pestana')) === 1 ? 1 : 0); } catch { mostrar(0); }
  $('exportar-vista').addEventListener('click', () => {
    const p = pestanas[activa];
    exportarSVG(p.svg, p.archivo).catch(err => escribirMonitor(`No se pudo exportar: ${err?.message || err}`, 'eco'));
  });

  registro.reiniciar();
  render();
}

if (typeof document !== 'undefined') iniciar();
