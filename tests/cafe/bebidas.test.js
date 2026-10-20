// Recetas, clasificador, capas de la taza, vaporizado y pedidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECETAS, clasificar, consejos, capas } from '../../web/js/cafe/modelo-bebidas.js';
import { crearJarra, pasoJarra, resultadoLeche, evaluarLeche } from '../../web/js/cafe/modelo-leche.js';
import { evaluarPedido, servirDeJarra } from '../../web/js/cafe/modelo-pedido.js';

const centro = r => Object.fromEntries(Object.entries(r.comp).map(([k, [a, b]]) => [k, (a + b) / 2]));
const ordenPara = (r, c) => r.orden === 'espresso_ultimo' ? [...Object.keys(c).filter(k => k !== 'espresso'), 'espresso'] : ['espresso', ...Object.keys(c).filter(k => k !== 'espresso')];

test('el centro de cada receta se clasifica como esa bebida', () => {
  for (const [id, r] of Object.entries(RECETAS)) {
    const c = centro(r);
    assert.equal(clasificar(c, ordenPara(r, c))[0].id, id);
  }
});

test('el orden distingue americano de long black', () => {
  const c = { espresso: 60, agua: 120 };
  assert.equal(clasificar(c, ['espresso', 'agua'])[0].id, 'americano');
  assert.equal(clasificar(c, ['agua', 'espresso'])[0].id, 'longblack');
});

test('los consejos dicen qué falta y qué sobra', () => {
  const tips = consejos({ espresso: 60, leche: 200, espuma: 10 }, 'capuchino', ['espresso', 'leche', 'espuma']);
  assert.ok(tips.some(t => t.k === 'leche' && !t.falta));
  assert.ok(tips.some(t => t.k === 'espuma' && t.falta));
});

test('el latte macchiato queda en capas y la espuma siempre arriba', () => {
  const cs = capas({ leche: 200, espuma: 50, espresso: 30 }, ['leche', 'espuma', 'espresso']);
  assert.deepEqual(cs.map(x => x.tipo), ['leche', 'espresso', 'espuma']);
  assert.equal(capas({ espresso: 30, leche: 200, espuma: 20 }, ['espresso', 'leche', 'espuma']).at(-1).tipo, 'espuma');
});

const vaporizar = (pasos, leche = 200) => { const j = crearJarra(leche); for (const [seg, pos] of pasos) for (let t = 0; t < seg; t += 0.05) pasoJarra(j, 0.05, true, pos); return j; };

test('airear temprano da microespuma; airear tarde, burbujas grandes', () => {
  const bien = resultadoLeche(vaporizar([[9, 'superficie'], [19, 'hundida']]));
  const tarde = resultadoLeche(vaporizar([[18, 'hundida'], [9, 'superficie']]));
  assert.equal(bien.tipo, 'microespuma');
  assert.ok(bien.expansion > 0.25 && bien.expansion < 0.5);
  assert.ok(tarde.textura < 0.5);
  assert.ok(evaluarLeche(bien, 'capuchino').puntaje > evaluarLeche(tarde, 'capuchino').puntaje + 30);
});

test('pasarse de temperatura quema la leche', () => {
  const r = resultadoLeche(vaporizar([[4, 'superficie'], [36, 'hundida']]));
  assert.equal(r.quemada, true);
  assert.ok(evaluarLeche(r, 'latte').puntaje < 50);
});

test('retener la espuma con cuchara sirve solo líquido', () => {
  const j = vaporizar([[8, 'superficie'], [18, 'hundida']]);
  const q = servirDeJarra(j, 60, true);
  assert.equal(q.espuma, 0);
  assert.ok(q.leche > 59);
});

test('un pedido bien hecho puntúa alto y servir otra bebida no', () => {
  const p = { receta: 'capuchino', shots: 1, temp: 'normal' };
  const leche = resultadoLeche(vaporizar([[9, 'superficie'], [19, 'hundida']]));
  const bien = evaluarPedido(p, { taza: 'capuchino', cont: { espresso: 36, leche: 90, espuma: 60, agua: 0 }, orden: ['espresso', 'leche', 'espuma'], shots: [95], leche });
  const mal = evaluarPedido(p, { taza: 'capuchino', cont: { espresso: 36, leche: 0, espuma: 0, agua: 120 }, orden: ['espresso', 'agua'], shots: [95], leche: null });
  assert.ok(bien.total >= 90, `bien ${bien.total}`);
  assert.ok(mal.total < 40, `mal ${mal.total}`);
  assert.ok(mal.errores.includes('proporcion'));
});
