// Métodos de filtro: tendencias de molienda, bloom, ratio e inmersión.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simular, evaluarFiltro, METODOS, LECCIONES, diferencias } from '../../web/js/cafe/modelo-filtro.js';

test('las recetas de referencia caen en la zona dulce', () => {
  for (const m of Object.keys(METODOS)) {
    const { resultado: r } = simular(m, {});
    assert.ok(r.ey >= 18 && r.ey <= 22, `${m} EY ${r.ey}`);
    assert.ok(evaluarFiltro(r).puntaje >= 90, m);
  }
});

test('en el V60, moler más fino tarda más y extrae más', () => {
  const fino = simular('v60', { molienda: 500 }).resultado, grueso = simular('v60', { molienda: 900 }).resultado;
  assert.ok(fino.tiempo > grueso.tiempo + 60);
  assert.ok(fino.ey > grueso.ey + 3);
});

test('sin bloom el café fresco se extrae desparejo', () => {
  const r = simular('v60', { bloom: 0, bloomT: 0 }).resultado;
  assert.ok(r.canal > 0);
  assert.ok(evaluarFiltro(r).defectos.includes('canal'));
});

test('el ratio mueve sobre todo la intensidad', () => {
  const fuerte = simular('v60', { agua: 190 }).resultado, suave = simular('v60', { agua: 300 }).resultado;
  const cambioTDS = fuerte.tds / suave.tds - 1, cambioEY = Math.abs(fuerte.ey / suave.ey - 1);
  assert.ok(fuerte.tds > suave.tds + 0.3);
  assert.ok(cambioTDS > 2 * cambioEY, `TDS ${cambioTDS} vs EY ${cambioEY}`);
});

test('en inmersión, más tiempo de infusión extrae más', () => {
  assert.ok(simular('aeropress', { reposo: 180 }).resultado.ey > simular('aeropress', { reposo: 30 }).resultado.ey + 3);
});

test('las lecciones arrancan mal', () => {
  for (const L of LECCIONES) assert.ok(evaluarFiltro(simular(L.metodo, L.p).resultado).puntaje < 80, L.id);
});

test('diferencias detecta qué variables cambiaron', () => {
  const a = { ...METODOS.v60.base }, b = { ...a, temp: 96 };
  assert.deepEqual(diferencias(a, b), ['temp']);
});
