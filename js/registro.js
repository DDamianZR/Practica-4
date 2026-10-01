// Lógica del registro de corrimiento bidireccional de 8 bits.
// Réplica de registro_bidireccional_8bits.ino: 8 flip-flops D + 8 multiplexores 2:1.
// No toca el DOM: se puede importar desde node.

export const N = 8;
export const FRECUENCIA_MIN = 0.5;
export const FRECUENCIA_MAX = 10;
export const FRECUENCIA_INICIAL = 2;  // PERIODO_AUTO_MS = 500 en el sketch
export const TICK_MS = 80;

const LARGO_BUFFER = 11;  // sizeof(buf) - 1 en el sketch

export function mux2a1(sel, i0, i1) { return sel ? i1 : i0; }

// Q7..Q0 como texto ("00000110")
export function bitsTexto(Q) {
  let t = '';
  for (let i = N - 1; i >= 0; i--) t += Q[i] ? '1' : '0';
  return t;
}

export function aNumero(Q) {
  let v = 0;
  for (let i = 0; i < N; i++) if (Q[i]) v |= 1 << i;
  return v;
}

export function crearRegistro() {
  const s = {};
  const subs = new Set();
  let P = new Array(N).fill(0);
  let buf = '';

  function estadoInicial() {
    Object.assign(s, {
      Q: new Array(N).fill(0),  // Q[0] = LSB
      DIR: 0,
      SL: 1,                    // para que el primer CLK se note
      SR: 0,
      AUTO: 0,
      CLR: 0,
      desfasado: false,
      cargaPendiente: false,
      numFlanco: 0,
      ultimoSale: null,
      frecuencia: FRECUENCIA_INICIAL,
    });
    P = new Array(N).fill(0);
    buf = '';
  }
  estadoInicial();

  function emitir(ev) { for (const f of subs) f(ev, s); }
  function imprimir(texto) { emitir({ tipo: 'serie', texto }); }

  function salidaMux(i) {
    const i0 = i === 0 ? s.SL : s.Q[i - 1];      // DIR = 0: toma el bit de la posición inferior
    const i1 = i === N - 1 ? s.SR : s.Q[i + 1];  // DIR = 1: toma el bit de la posición superior
    return mux2a1(s.DIR, i0, i1);
  }

  function entradasD() {
    const D = [];
    for (let i = 0; i < N; i++) D.push(salidaMux(i));
    return D;
  }

  function imprimirEstado() {
    imprimir(`Estado | DIR=${s.DIR ? '1 (DER)' : '0 (IZQ)'} SL=${s.SL} SR=${s.SR} | Q7..Q0 = ${bitsTexto(s.Q)}`);
  }

  function bienvenida() {
    imprimir('Registro de corrimiento bidireccional de 8 bits');
    imprimir('DIR=0: izquierda (entra SL en Q0) | DIR=1: derecha (entra SR en Q7)');
    imprimir('Comandos: P10110011 = carga paralela | ? = estado');
    imprimirEstado();
  }

  // origen: 'manual' (botón CLK) o 'auto' (reloj automático / secuencias)
  function flanco(origen = 'manual') {
    if (s.CLR) return null;                       // CLR tiene prioridad sobre el reloj
    if (origen === 'manual' && s.AUTO) return null;

    const dir = s.DIR, sl = s.SL, sr = s.SR;
    const sale = dir ? s.Q[0] : s.Q[N - 1];
    const fueCarga = s.cargaPendiente;
    s.numFlanco++;

    if (fueCarga) {
      s.Q = P.slice();
      s.cargaPendiente = false;
    } else if (s.desfasado) {
      // Cada FF se actualiza antes de que el siguiente lea su entrada
      for (let i = 0; i < N; i++) s.Q[i] = salidaMux(i);
    } else {
      // 1) Los 8 multiplexores calculan D con el estado ACTUAL
      const D = entradasD();
      // 2) Los 8 flip-flops capturan D en el MISMO flanco
      s.Q = D;
    }
    if (!fueCarga) s.ultimoSale = sale;

    let texto = `CLK #${s.numFlanco}`;
    if (fueCarga) texto += ' | CARGA PARALELA';
    else texto += `${dir ? ' | DER' : ' | IZQ'} | SL=${sl} SR=${sr} | sale=${sale}`;
    texto += ` | Q7..Q0 = ${bitsTexto(s.Q)}`;

    const ev = {
      tipo: 'flanco', n: s.numFlanco, origen, dir, sl, sr, sale,
      carga: fueCarga, desfasado: s.desfasado, Q: s.Q.slice(), texto,
    };
    imprimir(texto);
    emitir(ev);
    return ev;
  }

  // CLR asíncrono: al activarse borra Q de inmediato
  function setCLR(v) {
    v = v ? 1 : 0;
    if (v === s.CLR) return;
    s.CLR = v;
    if (v) {
      s.Q = new Array(N).fill(0);
      imprimir('CLR | Q7..Q0 = 00000000');
    }
    emitir({ tipo: 'clr', activo: v });
  }

  function set(nombre, valor) {
    if (nombre === 'CLR') return setCLR(valor);
    if (nombre === 'frecuencia') {
      valor = Math.min(FRECUENCIA_MAX, Math.max(FRECUENCIA_MIN, Number(valor) || FRECUENCIA_INICIAL));
    } else if (nombre === 'desfasado') {
      valor = !!valor;
    } else if (['DIR', 'SL', 'SR', 'AUTO'].includes(nombre)) {
      valor = valor ? 1 : 0;
    } else {
      throw new Error(`Entrada desconocida: ${nombre}`);
    }
    if (s[nombre] === valor) return;
    s[nombre] = valor;
    emitir({ tipo: 'entrada', nombre, valor });
  }

  function alternar(nombre) { set(nombre, !s[nombre]); }

  // Monitor serie: mismo análisis carácter por carácter que leerSerie()/procesarComando()
  function procesarComando() {
    if (buf === '?') {
      imprimirEstado();
    } else if (buf.length === 9 && (buf[0] === 'P' || buf[0] === 'p')) {
      const bits = buf.slice(1);
      if (/^[01]{8}$/.test(bits)) {
        for (let k = 0; k < N; k++) P[N - 1 - k] = bits[k] === '1' ? 1 : 0;
        s.cargaPendiente = true;
        imprimir(`Carga paralela lista: ${bits} (se aplica en el siguiente flanco)`);
        emitir({ tipo: 'carga', bits });
      } else {
        imprimir('Formato: P seguido de 8 bits, p. ej. P10110011');
      }
    } else if (buf.length > 0) {
      imprimir('Comandos: P10110011 = carga paralela | ? = estado');
    }
    buf = '';
  }

  function recibir(c) {
    if (c === '\n' || c === '\r') {
      if (buf.length > 0) procesarComando();
      return;
    }
    if (c === ' ') return;
    buf += c;
    const completo = (buf.length === 1 && buf[0] === '?') ||
                     (buf.length === 9 && (buf[0] === 'P' || buf[0] === 'p'));
    if (completo || buf.length >= LARGO_BUFFER) procesarComando();
  }

  function comandoSerie(txt) {
    for (const c of String(txt) + '\n') recibir(c);
  }

  function reiniciar() {
    estadoInicial();
    emitir({ tipo: 'reinicio' });
    bienvenida();
  }

  function suscribir(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  return {
    get estado() { return s; },
    salidaMux, entradasD, flanco, setCLR, set, alternar,
    comandoSerie, imprimirEstado, reiniciar, suscribir,
  };
}
