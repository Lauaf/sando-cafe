// Latte art: la técnica correcta dibuja la figura; la incorrecta no.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearSuperficie, paso, evaluarLatte, LECCIONES } from '../../web/js/cafe/modelo-latte.js';

const dt = 1 / 60;
function verter(guion) {
  const s = crearSuperficie();
  let px = 0, py = 0;
  for (const [dur, f] of guion) for (let t = 0; t < dur; t += dt) {
    const e = f(t / dur);
    paso(s, dt, { calidad: 1, ...e, mx: e.vertiendo ? (e.x - px) / dt : 0, my: e.vertiendo ? (e.y - py) / dt : 0 });
    px = e.x; py = e.y;
  }
  return s;
}
const base = [[(300 * 0.36) / 15, () => ({ vertiendo: true, x: 0, y: 0.1, flujo: 0.5, altura: 0.9 })]];
const CIRCULO = [...base, [5.4, () => ({ vertiendo: true, x: 0, y: 0, flujo: 0.8, altura: 0.05 })]];
const CORAZON = [...base, [4.6, () => ({ vertiendo: true, x: 0, y: 0, flujo: 0.8, altura: 0.05 })],
  [0.3, () => ({ vertiendo: false, x: 0, y: -0.3, flujo: 0, altura: 0.5 })], [0.55, u => ({ vertiendo: true, x: 0, y: -0.45 + 1.15 * u, flujo: 0.3, altura: 0.5 })]];
const leccion = id => LECCIONES.find(l => l.id === id);

test('verter alto llena la base sin dibujar blanco', () => {
  const s = verter([[16, () => ({ vertiendo: true, x: 0, y: 0.1, flujo: 0.5, altura: 0.9 })]]);
  const ev = evaluarLatte(s, leccion('la-1'));
  assert.ok(ev.puntaje >= 90, `${ev.puntaje}`);
  assert.ok(s.W.every(w => w < 0.5));
});

test('quedarse cerca y quieto dibuja un círculo que aprueba la lección', () => {
  assert.ok(evaluarLatte(verter(CIRCULO), leccion('la-2')).puntaje >= 80);
});

test('el corte convierte el círculo en corazón; sin corte no aprueba el corazón', () => {
  assert.ok(evaluarLatte(verter(CORAZON), leccion('la-3')).puntaje >= 80);
  assert.ok(evaluarLatte(verter(CIRCULO), leccion('la-3')).puntaje < 80);
});

test('rebalsar la taza penaliza', () => {
  const s = verter([[26, () => ({ vertiendo: true, x: 0, y: 0, flujo: 0.6, altura: 0.9 })]]);
  assert.ok(s.rebalso > 0);
  assert.ok(evaluarLatte(s, leccion('la-1')).partes.nivel < 0.5);
});
