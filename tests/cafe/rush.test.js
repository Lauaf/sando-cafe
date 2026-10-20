// Rush Hour: el tiempo y las decisiones tienen consecuencias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../web/js/cafe/modelo-rush.js';

function jugar(semilla, { torpe = false, quieto = false } = {}) {
  const s = R.crearTurno({ semilla, duracion: 120 });
  while (!s.terminado) {
    if (!quieto) {
      for (const c of s.cola.filter(c => !c.tomado).sort((a, b) => a.paciencia - b.paciencia)) R.tomarPedido(s, c.id);
      for (const p of s.preps) {
        const previo = !p.nec.ordenEspressoUltimo || ((!p.nec.leche || p.lecheRes) && (!p.nec.agua || p.cont.agua));
        if (p.nec.agua && p.nec.ordenEspressoUltimo && !p.cont.agua) R.servirAgua(s, p.id);
        if (p.nec.leche && !p.jarra && !p.lecheRes && !s.vapor) R.iniciarVapor(s, p.id, p.nec.espuma);
        const enMaquina = s.grupos.filter(g => g?.prep === p.id).length;
        if (previo && p.shots.length + enMaquina < p.nec.shots) R.iniciarShot(s, p.id);
      }
      s.grupos.forEach((g, i) => { if (g && g.shot.enTaza >= (torpe ? 48 : 35)) R.cortarShot(s, i); });
      if (s.vapor && s.vapor.jarra.temp >= (torpe ? 75 : 60)) R.cortarVapor(s);
      for (const p of [...s.preps]) {
        if (p.jarra && p.lecheRes && s.vapor?.prep !== p.id && !(p.cont.leche + p.cont.espuma) && (p.nec.ordenEspressoUltimo || p.shots.length >= p.nec.shots)) R.servirLeche(s, p.id);
        if (p.nec.agua && !p.nec.ordenEspressoUltimo && p.shots.length >= p.nec.shots && !p.cont.agua) R.servirAgua(s, p.id);
        if (p.shots.length >= p.nec.shots && (!p.nec.leche || p.cont.leche + p.cont.espuma) && (!p.nec.agua || p.cont.agua)) R.servir(s, p.id);
      }
    }
    R.avanzar(s, 1 / 30);
  }
  return R.resumen(s);
}

test('sin atender, todos se van y el puntaje es 0', () => {
  const r = jugar(1, { quieto: true });
  assert.equal(r.servidos, 0);
  assert.ok(r.perdidos > 0);
  assert.equal(r.puntaje, 0);
});

test('trabajar bien da clientes satisfechos; descuidar la técnica baja la satisfacción', () => {
  const bien = jugar(2), mal = jugar(2, { torpe: true });
  assert.ok(bien.satisfProm >= 85, `bien ${bien.satisfProm}`);
  assert.ok(mal.satisfProm < bien.satisfProm - 10, `mal ${mal.satisfProm}`);
  assert.ok(mal.errores.leche_temp > 0 || mal.errores.shot > 0);
});

test('la misma semilla genera el mismo turno', () => {
  const a = R.crearTurno({ semilla: 5 }), b = R.crearTurno({ semilla: 5 });
  for (let i = 0; i < 900; i++) { R.avanzar(a, 1 / 30); R.avanzar(b, 1 / 30); }
  assert.deepEqual(a.cola.map(c => c.pedido.receta), b.cola.map(c => c.pedido.receta));
});

test('no se pueden preparar más de MAX_PREP bebidas a la vez ni usar un grupo ocupado', () => {
  const s = R.crearTurno({ semilla: 3 });
  for (let i = 0; i < 1800; i++) R.avanzar(s, 1 / 30);
  const ids = s.cola.map(c => c.id);
  ids.forEach(id => R.tomarPedido(s, id));
  assert.ok(s.preps.length <= R.MAX_PREP);
  const p = s.preps[0];
  assert.equal(R.iniciarShot(s, p.id), 0);
  assert.equal(R.iniciarShot(s, p.id), 1);
  assert.equal(R.iniciarShot(s, p.id), -1);
});
