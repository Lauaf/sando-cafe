// Rush Hour: un turno de cafetería con clientes, paciencia y estaciones compartidas (lógica pura, sin DOM).
//
// Simplificaciones:
// - El turno dura `duracion` segundos reales. Los shots y el vapor corren acelerados (×VEL) para que un turno
//   entre en 3 minutos, pero usan los mismos modelos que el resto de la Academia.
// - Hay 2 grupos de espresso y 1 lanceta de vapor: si están ocupados hay que esperar (como en una barra real).
// - El espresso que espera demasiado "se muere" (pierde crema y aroma) y la leche servida tarde se enfría.
import { RECETA_BASE, crearShot, evaluar, OBJETIVOS, rng } from './modelo-espresso.js';
import { crearJarra, pasoJarra, resultadoLeche } from './modelo-leche.js';
import { RECETAS } from './modelo-bebidas.js';
import { generarPedido, evaluarPedido, recetaDelPedido, CON_LECHE } from './modelo-pedido.js';

export const VEL = 3;              // aceleración de shots y vapor
export const MAX_PREP = 3;         // bebidas en preparación a la vez
export const MAX_COLA = 6;

export const ACTOS = [
  { hasta: 60, n: 'Apertura', cada: [12, 18], paciencia: [80, 100], recetas: ['espresso', 'americano', 'cortado', 'doppio'], detalles: false },
  { hasta: 120, n: 'Media mañana', cada: [11, 16], paciencia: [65, 85], recetas: ['espresso', 'americano', 'cortado', 'flatwhite', 'latte', 'capuchino'], detalles: false },
  { hasta: Infinity, n: 'Hora pico', cada: [7, 11], paciencia: [50, 70], recetas: ['americano', 'cortado', 'flatwhite', 'latte', 'capuchino', 'macchiato', 'lattemacchiato', 'longblack'], detalles: true },
];
export const actoEn = t => ACTOS.find(a => t < a.hasta);
const PRECIO = { espresso: 2, doppio: 2.6, ristretto: 2, americano: 2.4, longblack: 2.6, macchiato: 2.4, cortado: 2.5, piccolo: 2.8, flatwhite: 3.2, capuchino: 3, latte: 3.2, lattemacchiato: 3.4, conleche: 2.8, lagrima: 2.6 };

/** Qué necesita cada bebida, en términos de estaciones. */
export function necesidades(p) {
  const r = recetaDelPedido(p);
  const soloEspuma = !!r.comp.espuma && (r.comp.leche?.[1] || 0) <= 15;
  const espuma = (r.comp.espuma?.[0] || 0) >= 30 || soloEspuma ? 'mucha' : 'poca';
  return { shots: p.shots || 1, leche: CON_LECHE(p.receta), soloEspuma, espuma, agua: !!r.comp.agua, ordenEspressoUltimo: r.orden === 'espresso_ultimo' };
}

export function crearTurno({ semilla = 1, duracion = 180, inicio = 0 } = {}) {
  return {
    t: 0, duracion, inicio, terminado: false, r: rng(semilla), proximo: 3, idCliente: 0,
    cola: [], preps: [], idPrep: 0,
    grupos: [null, null],            // {prep, shot, vertido}
    vapor: null,                     // {prep, jarra, aire}
    servidos: [], perdidos: [], eventos: [],
  };
}

const azar = (s, [a, b]) => a + s.r() * (b - a);

function llegar(s) {
  const acto = actoEn(s.t + s.inicio);
  const p = generarPedido(s.r, acto.recetas, { detalles: acto.detalles });
  const pac = azar(s, acto.paciencia);
  s.cola.push({ id: ++s.idCliente, pedido: p, llegada: s.t, paciencia: pac, pacienciaMax: pac, tomado: false });
  s.eventos.push({ t: s.t, tipo: 'llega', id: s.idCliente });
}

/** Avanza el turno dt segundos. */
export function avanzar(s, dt) {
  if (s.terminado) return s;
  s.t += dt;
  // llegadas
  if (s.t < s.duracion - 15) {
    s.proximo -= dt;
    if (s.proximo <= 0) {
      if (s.cola.filter(c => !c.tomado).length < MAX_COLA) llegar(s);
      s.proximo = azar(s, actoEn(s.t + s.inicio).cada);
    }
  }
  // paciencia: corre para todos los que no recibieron su bebida (más lento si ya está en preparación)
  for (const c of [...s.cola]) {
    c.paciencia -= dt * (c.tomado ? 0.6 : 1);
    if (c.paciencia <= 0) {
      s.cola.splice(s.cola.indexOf(c), 1);
      const prep = s.preps.find(p => p.cliente === c.id);
      if (prep) descartar(s, prep.id, false);
      s.perdidos.push({ cliente: c, t: s.t });
      s.eventos.push({ t: s.t, tipo: 'se_va', id: c.id });
    }
  }
  // grupos de espresso
  s.grupos.forEach((g, i) => {
    if (!g) return;
    for (let n = Math.round((dt * VEL) / 0.02); n > 0 && !g.shot.terminado; n--) g.shot.paso(0.02);
    if (g.shot.terminado) cortarShot(s, i); // el shot ahogado se corta solo
  });
  // vaporizador
  if (s.vapor) {
    const v = s.vapor;
    for (let n = Math.round((dt * VEL) / 0.02); n > 0; n--) {
      pasoJarra(v.jarra, 0.02, true, v.jarra.tVapor < v.aire ? 'superficie' : 'hundida');
    }
  }
  // lo que espera en la barra se degrada
  for (const p of s.preps) {
    if (p.espressoListo != null) p.esperaEspresso = s.t - p.espressoListo;
    if (p.jarra && s.vapor?.prep !== p.id) p.jarra.temp -= dt * 0.25;
  }
  if (s.t >= s.duracion) terminar(s);
  return s;
}

// ---------- acciones ----------
export function tomarPedido(s, idCliente) {
  const c = s.cola.find(x => x.id === idCliente);
  if (!c || c.tomado || s.preps.length >= MAX_PREP) return null;
  c.tomado = true;
  const prep = { id: ++s.idPrep, cliente: c.id, pedido: c.pedido, nec: necesidades(c.pedido), cont: { espresso: 0, leche: 0, espuma: 0, agua: 0 }, orden: [], shots: [], jarra: null, lecheRes: null, espressoListo: null, esperaEspresso: 0 };
  s.preps.push(prep);
  return prep;
}

export function iniciarShot(s, idPrep) {
  const prep = s.preps.find(p => p.id === idPrep);
  const i = s.grupos.findIndex(g => !g);
  if (!prep || i < 0) return -1;
  s.grupos[i] = { prep: prep.id, shot: crearShot({ ...RECETA_BASE }) };
  return i;
}

export function cortarShot(s, i) {
  const g = s.grupos[i];
  if (!g) return null;
  g.shot.cortar();
  const r = g.shot.resultado();
  s.grupos[i] = null;
  const prep = s.preps.find(p => p.id === g.prep);
  if (!prep) return r;
  const ev = evaluar(r, { ...OBJETIVOS.normale, ratio: [30 / 18, 40 / 18] });
  prep.shots.push(ev.puntaje);
  prep.cont.espresso += r.enTaza;
  if (prep.orden[prep.orden.length - 1] !== 'espresso') prep.orden.push('espresso');
  prep.espressoListo = s.t;
  return r;
}

/** aire: segundos (de simulación) con la punta en la superficie: ~3 para poca espuma, ~9 para mucha. */
export function iniciarVapor(s, idPrep, espuma = 'poca') {
  const prep = s.preps.find(p => p.id === idPrep);
  if (!prep || s.vapor) return false;
  const vol = Math.round((RECETAS[prep.pedido.receta].comp.leche?.[1] || 150) * 0.85 + 20);
  prep.jarra = crearJarra(vol);
  s.vapor = { prep: prep.id, jarra: prep.jarra, aire: espuma === 'mucha' ? 9 : 3 };
  return true;
}

export function cortarVapor(s) {
  if (!s.vapor) return null;
  const prep = s.preps.find(p => p.id === s.vapor.prep);
  s.vapor = null;
  if (prep) prep.lecheRes = resultadoLeche(prep.jarra);
  return prep?.lecheRes;
}

/** Vierte la leche vaporizada (la cantidad típica de la receta) y su espuma. */
export function servirLeche(s, idPrep) {
  const prep = s.preps.find(p => p.id === idPrep);
  if (!prep?.jarra || s.vapor?.prep === idPrep) return false;
  const j = prep.jarra;
  const r = RECETAS[prep.pedido.receta];
  if (prep.nec.soloEspuma) {
    // macchiato: solo una cucharada de espuma
    const esp = Math.min(j.espuma, (r.comp.espuma[0] + r.comp.espuma[1]) / 2);
    prep.cont.espuma += esp;
    if (prep.orden[prep.orden.length - 1] !== 'espuma') prep.orden.push('espuma');
  } else {
    const objetivo = r.comp.leche ? (r.comp.leche[0] + r.comp.leche[1]) / 2 : 0;
    const leche = Math.min(j.leche, objetivo);
    const espuma = j.espuma * (leche / Math.max(1, j.leche));
    prep.cont.leche += leche; prep.cont.espuma += espuma;
    for (const k of ['leche', 'espuma']) if (prep.orden[prep.orden.length - 1] !== k) prep.orden.push(k);
  }
  prep.lecheRes = resultadoLeche(j);
  prep.jarra = null;
  return true;
}

export function servirAgua(s, idPrep) {
  const prep = s.preps.find(p => p.id === idPrep);
  if (!prep) return false;
  const r = RECETAS[prep.pedido.receta];
  prep.cont.agua += r.comp.agua ? Math.round((r.comp.agua[0] + r.comp.agua[1]) / 2) : 120;
  if (prep.orden[prep.orden.length - 1] !== 'agua') prep.orden.push('agua');
  return true;
}

export function descartar(s, idPrep, liberarCliente = true) {
  const i = s.preps.findIndex(p => p.id === idPrep);
  if (i < 0) return;
  const prep = s.preps[i];
  s.preps.splice(i, 1);
  s.grupos.forEach((g, k) => { if (g?.prep === idPrep) s.grupos[k] = null; });
  if (s.vapor?.prep === idPrep) s.vapor = null;
  if (liberarCliente) { const c = s.cola.find(x => x.id === prep.cliente); if (c) c.tomado = false; }
}

/** Entrega la bebida: puntaje de la bebida + satisfacción (bebida y espera) + cobro y propina. */
export function servir(s, idPrep) {
  const i = s.preps.findIndex(p => p.id === idPrep);
  if (i < 0) return null;
  const prep = s.preps[i];
  if (s.grupos.some(g => g?.prep === idPrep) || s.vapor?.prep === idPrep) return null; // todavía hay algo en la máquina
  const c = s.cola.find(x => x.id === prep.cliente);
  const taza = RECETAS[prep.pedido.receta].taza[0];
  const ev = evaluarPedido(prep.pedido, { taza, cont: prep.cont, orden: prep.orden, shots: prep.shots, leche: prep.lecheRes });
  const errores = [...ev.errores];
  let calidad = ev.total;
  if (prep.esperaEspresso > 25 && prep.cont.espresso > 0) { calidad -= Math.min(25, (prep.esperaEspresso - 25) * 0.8); errores.push('espresso_muerto'); }
  const espera = c ? (s.t - c.llegada) / (c.pacienciaMax / 0.75) : 1;
  const satisf = Math.round(Math.max(0, Math.min(100, calidad - Math.max(0, espera - 0.5) * 40)));
  const precio = PRECIO[prep.pedido.receta] || 2.5;
  const propina = satisf >= 85 ? Math.round(precio * 0.15 * 100) / 100 : 0;
  s.preps.splice(i, 1);
  if (c) s.cola.splice(s.cola.indexOf(c), 1);
  const reg = { cliente: c, pedido: prep.pedido, calidad: Math.round(calidad), satisf, precio: satisf >= 30 ? precio : 0, propina, errores, notas: ev.notas, t: s.t };
  s.servidos.push(reg);
  s.eventos.push({ t: s.t, tipo: 'servido', id: prep.cliente, satisf });
  return reg;
}

function terminar(s) {
  s.terminado = true;
  s.grupos = [null, null];
  s.vapor = null;
}

/** Resumen del turno. El puntaje (0..100) mezcla satisfacción, clientes perdidos y volumen atendido. */
export function resumen(s) {
  const n = s.servidos.length, perd = s.perdidos.length;
  const llegaron = n + perd;
  const satisfProm = n ? Math.round(s.servidos.reduce((a, x) => a + x.satisf, 0) / n) : 0;
  const errores = {};
  for (const x of s.servidos) for (const e of x.errores) errores[e] = (errores[e] || 0) + 1;
  for (let k = 0; k < perd; k++) errores.cliente_perdido = (errores.cliente_perdido || 0) + 1;
  const dinero = Math.round(s.servidos.reduce((a, x) => a + x.precio + x.propina, 0) * 100) / 100;
  const atendidos = llegaron ? n / llegaron : 0;
  const puntaje = llegaron ? Math.round(satisfProm * (0.55 + 0.45 * atendidos) - Math.max(0, perd - 1) * 3) : 0;
  return { servidos: n, perdidos: perd, satisfProm, dinero, errores, puntaje: Math.max(0, Math.min(100, puntaje)),
    topErrores: Object.entries(errores).sort((a, b) => b[1] - a[1]).slice(0, 3) };
}

export const LECCIONES = [
  { id: 'rush-1', t: 'Apertura', duracion: 100, inicio: 0, aprender: 'Pocos clientes y pedidos simples. Aprendé el circuito: tomar pedido → shot → (leche/agua) → entregar. Cortá cada shot entre 30 y 40 g.' },
  { id: 'rush-2', t: 'Turno completo', duracion: 180, inicio: 0, aprender: 'La barra se llena. Trabajá en paralelo: mientras sale un shot, vaporizá la leche de otro pedido.' },
  { id: 'rush-3', t: 'Hora pico', duracion: 180, inicio: 60, aprender: 'Clientes impacientes y pedidos con detalles (doble, tibio, bien caliente). Priorizá a quien está por irse y no dejes morir el espresso.' },
];

export const NOMBRES_ERROR = {
  proporcion: 'Proporciones equivocadas', shot: 'Shots fuera de punto', leche_temp: 'Leche a mala temperatura', leche_textura: 'Espuma con burbujas grandes',
  orden: 'Orden de armado', rebalse: 'Taza rebalsada', taza: 'Recipiente', espresso_muerto: 'Espresso esperando demasiado', cliente_perdido: 'Clientes que se fueron',
};
