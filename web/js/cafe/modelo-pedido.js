// Pedidos de barra: generación (texto del cliente) y evaluación de la bebida preparada.
// Lo usan "Prepará el pedido" y "Rush Hour". Lógica pura.
import { RECETAS, TAZAS, distancia, ordenCumplido, clasificar, consejos } from './modelo-bebidas.js';
import { evaluarLeche } from './modelo-leche.js';

export const TEMP_PEDIDO = {
  tibio: { n: 'tibio', rango: [48, 56] },
  normal: { n: 'normal', rango: [55, 65] },
  caliente: { n: 'bien caliente', rango: [62, 70] },
};
export const CON_LECHE = id => !!(RECETAS[id].comp.leche || RECETAS[id].comp.espuma);
export const CLIENTES = ['Doña Rosa', 'Facu', 'Mica', 'el profe Tanaka', 'Yuki', 'Kenta', 'una turista', 'el cartero', 'Hana', 'un oficinista apurado', 'Sofi', 'don Tito'];

/** Receta ajustada al pedido (simple/doble cambia el rango de espresso). */
export function recetaDelPedido(p) {
  const r = RECETAS[p.receta];
  const comp = { ...r.comp };
  if (p.shots && comp.espresso && !['ristretto', 'lagrima', 'piccolo'].includes(p.receta)) comp.espresso = p.shots >= 2 ? [50, 80] : [25, 45];
  return { ...r, comp };
}

export function textoPedido(p, rnd = Math.random) {
  const r = RECETAS[p.receta];
  const elegir = a => a[Math.floor(rnd() * a.length)];
  let txt = r.n.toLowerCase();
  if (p.shots === 2 && !['doppio', 'flatwhite', 'longblack'].includes(p.receta)) txt += ' doble';
  if (p.temp === 'tibio') txt += ', tibio';
  if (p.temp === 'caliente') txt += ', bien caliente';
  return `${elegir(['Hola, ¿me hacés un', 'Buenas, quiero un', 'Un', '¿Me preparás un', 'Para tomar acá: un'])} ${txt}${elegir([', porfa.', ', gracias.', '.', ' 🙏'])}`;
}

/** Pedido al azar entre `recetas`. detalles=true agrega doble / temperatura. */
export function generarPedido(rnd, recetas, { detalles = false } = {}) {
  const receta = recetas[Math.floor(rnd() * recetas.length)];
  const base = ['doppio', 'flatwhite', 'longblack'].includes(receta) ? 2 : 1;
  const shots = detalles && base === 1 && RECETAS[receta].comp.espresso?.[1] >= 45 && rnd() < 0.4 ? 2 : base;
  const temp = detalles && CON_LECHE(receta) && rnd() < 0.45 ? (rnd() < 0.5 ? 'tibio' : 'caliente') : 'normal';
  const p = { receta, shots, temp, cliente: CLIENTES[Math.floor(rnd() * CLIENTES.length)] };
  p.texto = textoPedido(p, rnd);
  return p;
}

/**
 * prep: {taza, cont:{espresso,leche,espuma,agua}, orden:[...], shots:[puntaje 0..100], leche: resultadoLeche|null}
 * Devuelve {total, partes:{exactitud, tecnica, orden, presentacion}, notas, errores}
 */
export function evaluarPedido(p, prep) {
  const r = recetaDelPedido(p);
  const notas = [], errores = [];
  const dist = distancia(prep.cont, r, prep.orden);
  const exactitud = Math.round(100 * Math.exp(-dist / 2));
  const top = clasificar(prep.cont, prep.orden)[0];
  if (exactitud < 70) {
    errores.push('proporcion');
    notas.push(top && top.id !== p.receta ? `Lo que serviste se parece más a: ${top.n}.` : 'Las proporciones no son las de la receta.');
    for (const c of consejos(prep.cont, p.receta, prep.orden).filter(c => c.k !== 'orden')) notas.push(`→ ${c.txt}`);
  }
  // técnica: calidad de los shots y de la leche
  const partesTec = [];
  if (prep.shots?.length) {
    const s = prep.shots.reduce((a, b) => a + b, 0) / prep.shots.length;
    partesTec.push(s);
    if (s < 70) { errores.push('shot'); notas.push('☕ Los shots no salieron bien (cortá cerca de 30–40 g por shot).'); }
  }
  const usaLeche = (r.comp.leche?.[1] || 0) > 0 || (r.comp.espuma?.[1] || 0) > 0;
  if (usaLeche && (prep.cont.leche > 0 || prep.cont.espuma > 0)) {
    if (prep.leche) {
      const ev = evaluarLeche(prep.leche, p.receta, TEMP_PEDIDO[p.temp].rango);
      partesTec.push(ev.puntaje);
      if (ev.puntaje < 75) {
        notas.push(...ev.notas);
        if (prep.leche.quemada || prep.leche.maxTemp > TEMP_PEDIDO[p.temp].rango[1] + 4) errores.push('leche_temp');
        else if (prep.leche.temp < TEMP_PEDIDO[p.temp].rango[0] - 3) errores.push('leche_temp');
        if (prep.leche.textura < 0.65 && prep.leche.expansion > 0.04) errores.push('leche_textura');
      }
    }
  }
  const tecnica = partesTec.length ? Math.round(partesTec.reduce((a, b) => a + b, 0) / partesTec.length) : 100;
  const orden = ordenCumplido(r.orden, prep.orden) ? 100 : 0;
  if (!orden) { errores.push('orden'); notas.push(r.orden === 'espresso_ultimo' ? '🔁 El espresso va al final (sobre la leche o el agua).' : '🔁 El espresso va primero.'); }
  let presentacion = 100;
  const total = Object.values(prep.cont).reduce((a, b) => a + b, 0);
  if (!prep.taza) { presentacion = 0; notas.push('Sin taza…'); }
  else {
    if (total > TAZAS[prep.taza].cap) { presentacion -= 60; errores.push('rebalse'); notas.push('💦 Rebalsó la taza.'); }
    if (!r.taza.includes(prep.taza)) { presentacion -= 40; errores.push('taza'); notas.push(`🍵 Un ${r.n.toLowerCase()} suele ir en ${r.taza.map(t => TAZAS[t].n.toLowerCase()).join(' o ')}.`); }
  }
  presentacion = Math.max(0, presentacion);
  let totalPts = Math.round(0.4 * exactitud + 0.35 * tecnica + 0.15 * orden + 0.1 * presentacion);
  // si sirvió otra bebida, la técnica no la salva: el cliente pidió otra cosa
  if (exactitud < 50) totalPts = Math.min(totalPts, Math.round(exactitud * 0.7));
  return { total: totalPts, partes: { exactitud, tecnica, orden, presentacion }, notas, errores };
}

/**
 * Leche servida desde la jarra: devuelve {leche, espuma} que pasan a la taza.
 * Microespuma bien integrada sale mezclada; con burbujas grandes primero sale líquido y la espuma queda al final.
 * retener = sostener la espuma con una cuchara.
 */
export function servirDeJarra(j, ml, retener = false) {
  const vol = j.leche + j.espuma;
  if (vol <= 0 || ml <= 0) return { leche: 0, espuma: 0 };
  ml = Math.min(ml, vol);
  const fEsp = j.espuma / vol;
  const integrada = 1 - j.burbuja - (j.gruesa || 0) >= 0.6;
  let frac;
  if (retener) frac = j.leche > 1 ? 0 : 1;
  else if (integrada) frac = fEsp;
  else frac = j.leche / vol > 0.3 ? fEsp * 0.25 : Math.min(1, fEsp * 2.5);
  const esp = Math.min(j.espuma, ml * frac);
  const lec = Math.min(j.leche, ml - esp);
  j.espuma -= esp; j.leche -= lec;
  return { leche: lec, espuma: esp };
}
