// Diagnóstico: las correcciones se juzgan con el mismo modelo del simulador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANTILLAS, generar, evaluarCorrecciones, puntuar, armarRonda, RONDAS } from '../../web/js/cafe/modelo-diagnostico.js';
import { RECETA_BASE } from '../../web/js/cafe/modelo-espresso.js';

const plantilla = id => PLANTILLAS.find(p => p.id === id);

test('para un espresso agrio y rápido, moler más fino ayuda y más grueso empeora', () => {
  const g = generar(plantilla('acido'), 7);
  const fino = g.todas.find(x => x.id === 'fino'), grueso = g.todas.find(x => x.id === 'grueso');
  assert.ok(fino.delta > 10);
  assert.equal(grueso.clase, 'empeora');
});

test('para un puck desparejo la mejor corrección es preparar bien el puck', () => {
  const e = { p: { ...RECETA_BASE, distribucion: 0.2, nivelado: 0.45 }, salida: 36 };
  const { lista } = evaluarCorrecciones(e);
  const mejor = lista.reduce((a, b) => (b.ev.puntaje > a.ev.puntaje ? b : a));
  assert.equal(mejor.id, 'puck');
});

test('cada caso ofrece 4 opciones con al menos una que mejora', () => {
  for (const P of PLANTILLAS) {
    const g = generar(P, 123);
    assert.equal(g.opciones.length, 4, P.id);
    assert.ok(g.opciones.some(o => o.delta >= 10), `${P.id} sin opción que mejore`);
    assert.ok(g.base.ev.puntaje < 90, `${P.id} no está roto (${g.base.ev.puntaje})`);
  }
});

test('el puntaje premia diagnóstico y corrección por separado', () => {
  const g = generar(plantilla('amargo'), 3);
  const mejor = g.todas.find(x => x.clase === 'mejor');
  assert.equal(puntuar(g, 'sobre', mejor.id).total, 100);
  assert.equal(puntuar(g, 'sub', mejor.id).diag, 0);
});

test('las rondas no repiten plantillas', () => {
  for (const R of RONDAS) {
    const casos = armarRonda(R, 99);
    assert.equal(new Set(casos.map(c => c.plantilla.id)).size, casos.length);
  }
});
