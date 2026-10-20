// Progresión: dominio por promedio reciente, desbloqueo en orden, XP sin premiar la repetición vacía.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaAcademia, normalizar, registrar, dominio, desbloqueada, recomendar, xpPor } from '../../web/js/cafe/modelo-academia.js';

const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('el dominio es el promedio de los últimos 8 resultados', () => {
  const a = nuevaAcademia();
  for (let i = 0; i < 10; i++) registrar(a, { comp: 'extraccion', puntaje: i < 2 ? 0 : 80 });
  assert.equal(dominio(a, 'extraccion'), 80);
  assert.equal(dominio(a, 'latte'), null);
});

test('una lección se desbloquea al aprobar la anterior', () => {
  const a = nuevaAcademia();
  assert.equal(desbloqueada(a, lista, 'a'), true);
  assert.equal(desbloqueada(a, lista, 'b'), false);
  registrar(a, { comp: 'x', leccion: 'a', puntaje: 60, aprobada: false });
  assert.equal(desbloqueada(a, lista, 'b'), false);
  const r = registrar(a, { comp: 'x', leccion: 'a', puntaje: 85, estrellas: 2, aprobada: true });
  assert.equal(r.aprobadaPorPrimeraVez, true);
  assert.equal(desbloqueada(a, lista, 'b'), true);
  assert.equal(registrar(a, { comp: 'x', leccion: 'a', puntaje: 90, aprobada: true }).aprobadaPorPrimeraVez, false);
});

test('el bonus de XP es por aprobar o mejorar, no por repetir', () => {
  assert.ok(xpPor({ puntaje: 80, aprobadaPorPrimeraVez: true }) > xpPor({ puntaje: 80 }) + 10);
  assert.ok(xpPor({ puntaje: 80, evaluado: false }) < xpPor({ puntaje: 80 }));
});

test('las recomendaciones priorizan errores repetidos y luego competencias flojas', () => {
  const a = nuevaAcademia();
  const ruta = [{ id: 'espresso', comp: 'extraccion', n: 'Espresso' }, { id: 'latte', comp: 'latte', n: 'Latte' }];
  registrar(a, { comp: 'extraccion', puntaje: 40, errores: ['canalizacion'] });
  registrar(a, { comp: 'extraccion', puntaje: 45, errores: ['canalizacion'] });
  const recs = recomendar(a, ruta, { canalizacion: { modulo: 'espresso', leccion: 'esp-5', texto: 'puck' } });
  assert.equal(recs[0].leccion, 'esp-5');
  assert.ok(recs.some(r => r.modulo === 'latte'));
});

test('normalizar completa partidas viejas sin academia', () => {
  const a = normalizar(undefined);
  assert.deepEqual(Object.keys(a).sort(), ['ab', 'comp', 'diario', 'lecciones', 'recientes']);
  const b = normalizar({ lecciones: { x: { aprobada: true } } });
  assert.equal(b.lecciones.x.aprobada, true);
  assert.ok(Array.isArray(b.recientes));
});
