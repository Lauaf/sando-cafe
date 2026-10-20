// Blends: el perfil estimado responde a proporciones, tueste y componentes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mezclar, perfilTostado, CAFES, PEDIDOS, evaluarBlend } from '../../web/js/cafe/modelo-blend.js';

const cafe = id => CAFES.find(c => c.id === id);

test('el perfil es el promedio ponderado por proporción', () => {
  const m = mezclar([{ id: 'bra', pct: 50, tueste: 'medio' }, { id: 'eti-lav', pct: 50, tueste: 'medio' }]);
  assert.ok(Math.abs(m.perfil.cuerpo - (cafe('bra').p.cuerpo + cafe('eti-lav').p.cuerpo) / 2) < 1e-9);
});

test('tostar más oscuro baja la acidez y lo floral y sube amargor y cuerpo', () => {
  const claro = perfilTostado(cafe('eti-lav'), 'claro'), oscuro = perfilTostado(cafe('eti-lav'), 'oscuro');
  assert.ok(oscuro.acidez < claro.acidez && oscuro.floral < claro.floral);
  assert.ok(oscuro.amargor > claro.amargor && oscuro.cuerpo > claro.cuerpo);
});

test('mucha robusta tapa lo delicado y suma crema y cafeína', () => {
  const sin = mezclar([{ id: 'gei', pct: 100, tueste: 'medio' }]);
  const con = mezclar([{ id: 'gei', pct: 50, tueste: 'medio' }, { id: 'rob', pct: 50, tueste: 'medio' }]);
  assert.ok(con.perfil.floral < sin.perfil.floral / 2);
  assert.ok(con.crema > sin.crema && con.cafeina > sin.cafeina);
});

test('cada pedido del tostador tiene una solución conocida', () => {
  const soluciones = {
    'bl-1': [{ id: 'gua', pct: 90, tueste: 'oscuro' }, { id: 'eti-lav', pct: 10, tueste: 'oscuro' }],
    'bl-2': [{ id: 'eti-lav', pct: 100, tueste: 'claro' }],
    'bl-3': [{ id: 'bra', pct: 70, tueste: 'oscuro' }, { id: 'rob', pct: 20, tueste: 'oscuro' }, { id: 'eti-lav', pct: 10, tueste: 'oscuro' }],
    'bl-4': [{ id: 'eti-nat', pct: 50, tueste: 'oscuro' }, { id: 'ken', pct: 40, tueste: 'oscuro' }, { id: 'eti-lav', pct: 10, tueste: 'oscuro' }],
  };
  for (const P of PEDIDOS) assert.ok(evaluarBlend(mezclar(soluciones[P.id]), P, soluciones[P.id]).puntaje >= 80, P.id);
});

test('el pedido con robusta exige entre 10 y 30 %', () => {
  const P = PEDIDOS.find(p => p.id === 'bl-3');
  const mucha = [{ id: 'bra', pct: 40, tueste: 'medio' }, { id: 'rob', pct: 60, tueste: 'medio' }];
  assert.ok(evaluarBlend(mezclar(mucha), P, mucha).fallas.some(f => f.startsWith('Robusta')));
});
