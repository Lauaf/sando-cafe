// Modelo de espresso: tendencias físicas, evaluación y lecciones resolubles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simularHasta, crearShot, evaluar, comparar, OBJETIVOS, OBJETIVOS_LECCION, LECCIONES, desafioDiario, riesgoCanal } from '../../web/js/cafe/modelo-espresso.js';

test('la receta base (18 g → 36 g) cae en la zona dulce en un tiempo típico', () => {
  const r = simularHasta({}, 36);
  assert.ok(r.ey >= 18 && r.ey <= 22, `EY ${r.ey}`);
  assert.ok(r.tiempo >= 22 && r.tiempo <= 32, `tiempo ${r.tiempo}`);
  assert.ok(r.tds >= 8 && r.tds <= 12, `TDS ${r.tds}`);
  assert.equal(evaluar(r).defectos.length, 0);
});

test('moler más fino alarga el shot y extrae más', () => {
  const fino = simularHasta({ molienda: 9 }, 36), grueso = simularHasta({ molienda: 15 }, 36);
  assert.ok(fino.tiempo > grueso.tiempo + 8);
  assert.ok(fino.ey > grueso.ey + 3);
});

test('más temperatura extrae más; un ratio más largo extrae más y diluye', () => {
  assert.ok(simularHasta({ temp: 96 }, 36).ey > simularHasta({ temp: 89 }, 36).ey);
  const corto = simularHasta({}, 27), largo = simularHasta({}, 54);
  assert.ok(largo.ey > corto.ey);
  assert.ok(largo.tds < corto.tds);
});

test('con molienda muy gruesa la bomba no llega a 9 bar', () => {
  const s = crearShot({ molienda: 26 });
  let max = 0;
  for (let i = 0; i < 400 && !s.terminado; i++) { s.paso(0.05); max = Math.max(max, s.presion); }
  assert.ok(max < 8, `presión máxima ${max}`);
});

test('un puck mal preparado canaliza y la preinfusión lo atenúa', () => {
  const malo = { distribucion: 0.2, nivelado: 0.45 };
  const r = simularHasta(malo, 36);
  assert.ok(r.canal > 0.5);
  assert.ok(evaluar(r).defectos.includes('canalizacion'));
  assert.ok(riesgoCanal({ ...malo, dosis: 18, molienda: 12, perfil: 'preinfusion' }).riesgo < riesgoCanal({ ...malo, dosis: 18, molienda: 12, perfil: 'plano' }).riesgo);
  assert.ok(simularHasta({ ...malo, perfil: 'preinfusion' }, 36).canal < r.canal);
});

test('evaluar detecta ratio corto y largo', () => {
  assert.ok(evaluar(simularHasta({}, 25), OBJETIVOS.normale).defectos.includes('ratio_corto'));
  assert.ok(evaluar(simularHasta({}, 50), OBJETIVOS.normale).defectos.includes('ratio_largo'));
});

test('comparar marca cuándo se cambió una sola variable', () => {
  const a = simularHasta({}, 36), b = simularHasta({ molienda: 10 }, 36), c = simularHasta({ molienda: 10, temp: 95 }, 36);
  assert.equal(comparar(a, b).unaVariable, true);
  assert.equal(comparar(a, c).unaVariable, false);
  assert.ok(comparar(a, b).dTiempo > 0);
});

test('cada lección arranca rota (salvo la primera) y tiene solución con sus controles', () => {
  for (const L of LECCIONES) {
    const o = OBJETIVOS_LECCION[L.obj];
    const dosis = L.p.dosis ?? 18;
    const inicio = evaluar(simularHasta(L.p, dosis * (o.ratio[0] + o.ratio[1]) / 2), o).puntaje;
    if (L.id !== 'esp-1') assert.ok(inicio < 75, `${L.id} arranca con ${inicio}`);
    let mejor = 0;
    const mols = L.controles.includes('molienda') ? [6, 7, 8, 8.5, 9, 10, 10.5, 11, 12, 13] : [L.p.molienda ?? 12];
    const temps = L.controles.includes('temp') ? [88, 90, 93, 95] : [L.p.temp ?? 93];
    const perfiles = L.controles.includes('perfil') ? ['plano', 'preinfusion'] : [L.p.perfil ?? 'plano'];
    const puck = L.controles.includes('puck') ? { distribucion: 0.95, nivelado: 0.97 } : {};
    for (const molienda of mols) for (const temp of temps) for (const perfil of perfiles) for (const rt of [o.ratio[0], (o.ratio[0] + o.ratio[1]) / 2, o.ratio[1]]) {
      mejor = Math.max(mejor, evaluar(simularHasta({ ...L.p, ...puck, molienda, temp, perfil }, dosis * rt), o).puntaje);
    }
    assert.ok(mejor >= 90, `${L.id} mejor ${mejor}`);
  }
});

test('el desafío diario es el mismo para la misma fecha', () => {
  assert.deepEqual(desafioDiario('2026-10-20').p, desafioDiario('2026-10-20').p);
});
