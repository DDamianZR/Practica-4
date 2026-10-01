// Ejecutar con: node test/registro.test.js
import assert from 'node:assert/strict';
import { crearRegistro, bitsTexto } from '../js/registro.js';

// Importa todos los módulos (detecta errores de sintaxis o de import)
for (const m of ['registro', 'protoboard', 'esquematico', 'cronograma', 'main']) {
  await import(`../js/${m}.js`);
}

let pruebas = 0;
function prueba(nombre, fn) {
  fn();
  pruebas++;
  console.log(`ok - ${nombre}`);
}

function nuevo() {
  const r = crearRegistro();
  const serie = [];
  r.suscribir(ev => { if (ev.tipo === 'serie') serie.push(ev.texto); });
  r.reiniciar();
  return { r, serie };
}

prueba('estado inicial', () => {
  const { r, serie } = nuevo();
  const s = r.estado;
  assert.equal(bitsTexto(s.Q), '00000000');
  assert.deepEqual([s.DIR, s.SL, s.SR, s.AUTO, s.CLR], [0, 1, 0, 0, 0]);
  assert.equal(serie[0], 'Registro de corrimiento bidireccional de 8 bits');
  assert.equal(serie[3], 'Estado | DIR=0 (IZQ) SL=1 SR=0 | Q7..Q0 = 00000000');
});

prueba('secuencia de prueba', () => {
  const { r, serie } = nuevo();
  const pasos = [
    [0, 1, 0, '00000001', 0],
    [0, 1, 0, '00000011', 0],
    [0, 0, 0, '00000110', 0],
    [1, 0, 0, '00000011', 0],
    [1, 0, 1, '10000001', 1],
    [1, 0, 0, '01000000', 1],
  ];
  for (const [dir, sl, sr, esperado, sale] of pasos) {
    r.set('DIR', dir); r.set('SL', sl); r.set('SR', sr);
    const ev = r.flanco();
    assert.equal(bitsTexto(r.estado.Q), esperado);
    assert.equal(ev.sale, sale);
    assert.equal(r.estado.ultimoSale, sale);
  }
  assert.equal(serie.at(-1), 'CLK #6 | DER | SL=0 SR=0 | sale=1 | Q7..Q0 = 01000000');
});

prueba('relojes desfasados (P9)', () => {
  const { r } = nuevo();
  r.set('desfasado', true);
  r.set('DIR', 0); r.set('SL', 1);
  r.flanco();
  assert.equal(bitsTexto(r.estado.Q), '11111111');
});

prueba('CLR asíncrono y carga paralela', () => {
  const { r, serie } = nuevo();
  r.flanco(); r.flanco();
  assert.equal(bitsTexto(r.estado.Q), '00000011');
  r.setCLR(1);
  assert.equal(bitsTexto(r.estado.Q), '00000000');
  assert.equal(serie.at(-1), 'CLR | Q7..Q0 = 00000000');
  assert.equal(r.flanco(), null);
  assert.equal(bitsTexto(r.estado.Q), '00000000');
  assert.equal(r.estado.numFlanco, 2);
  r.setCLR(0);

  r.comandoSerie('P10110011');
  assert.equal(serie.at(-1), 'Carga paralela lista: 10110011 (se aplica en el siguiente flanco)');
  r.flanco();
  assert.equal(bitsTexto(r.estado.Q), '10110011');
  assert.equal(serie.at(-1), 'CLK #3 | CARGA PARALELA | Q7..Q0 = 10110011');
});

prueba('comandos serie', () => {
  const { r, serie } = nuevo();
  r.comandoSerie('?');
  assert.equal(serie.at(-1), 'Estado | DIR=0 (IZQ) SL=1 SR=0 | Q7..Q0 = 00000000');
  r.comandoSerie('P1012');
  assert.equal(serie.at(-1), 'Comandos: P10110011 = carga paralela | ? = estado');
  r.comandoSerie('P1011001x');
  assert.equal(serie.at(-1), 'Formato: P seguido de 8 bits, p. ej. P10110011');
});

prueba('AUTO ignora el CLK manual', () => {
  const { r } = nuevo();
  r.set('AUTO', 1);
  assert.equal(r.flanco('manual'), null);
  assert.ok(r.flanco('auto'));
  assert.equal(bitsTexto(r.estado.Q), '00000001');
});

console.log(`\n${pruebas} pruebas correctas`);
