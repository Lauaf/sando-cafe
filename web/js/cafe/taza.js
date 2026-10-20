// Minijuego 4 — ¿Qué café preparaste?: verté espresso, leche, espuma y agua y mirá a qué bebida se parece.
import { el, sfx, mezclar } from '../util.js';
import { RECETAS, TAZAS, COMPONENTES, CLAVES, clasificar, consejos, proporciones, capas, ordenCumplido } from './modelo-bebidas.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { intro, estrellas, svgTaza, barraProporciones, arrastrarParaVerter, siseo } from './vista.js';

const COLORES = { espresso: '#6b3a1d', leche: '#efe2cc', espuma: '#ffffff', agua: '#b98a5c' };
const NOMBRES = Object.fromEntries(CLAVES.map(k => [k, COMPONENTES[k].n]));
// velocidad de vertido (ml/s) de cada jarra
const CAUDAL = { espresso: 18, leche: 45, espuma: 22, agua: 50 };
const FUENTES = [
  { k: 'espresso', ico: '☕', n: 'Espresso', d: 'jarrita de shots' },
  { k: 'leche', ico: '🥛', n: 'Leche vaporizada', d: 'sin espuma' },
  { k: 'espuma', ico: '☁️', n: 'Espuma', d: 'con cuchara' },
  { k: 'agua', ico: '♨️', n: 'Agua caliente', d: 'del grupo' },
];

export const LECCIONES_TAZA = [
  { id: 'taza-1', t: 'Las bases', objetivos: ['espresso', 'americano', 'cortado', 'latte'], aprender: 'Casi todas las bebidas son espresso + algo: agua, leche o espuma. Lo que cambia es cuánto de cada cosa.' },
  { id: 'taza-2', t: 'La familia de la espuma', objetivos: ['macchiato', 'capuchino', 'flatwhite', 'conleche'], aprender: 'Cappuccino, flat white y latte llevan lo mismo: la diferencia está en la proporción de espuma y de leche.' },
  { id: 'taza-3', t: 'Parecidas pero distintas', objetivos: ['lattemacchiato', 'longblack', 'piccolo', 'lagrima'], aprender: 'A veces importa el orden: el espresso arriba de la leche queda en capas, y arriba del agua conserva la crema.' },
];

export function hubTaza(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'Cada bebida es una proporción. Un cappuccino y un latte llevan los mismos ingredientes: cambia cuánta espuma y cuánta leche.',
      meta: 'Arrastrá las jarras sobre la taza para verter (o mantené Espacio sobre una jarra). Mirá en vivo a qué bebida se parece y compará con la receta.' }),
    el('div.ac-lecciones', LECCIONES_TAZA.map((L, i) => {
      const abierta = desbloqueada(a, LECCIONES_TAZA, L.id);
      const reg = a.lecciones[L.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), { disabled: !abierta, onclick: () => ctx.ir(L.t, (cc, cx) => mesa(cc, cx, L)) },
        el('span.n', String(i + 1)), el('span.t', `${L.t} · ${L.objetivos.length} bebidas`), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nueva' : '🔒'));
    })),
    el('button.tarjeta', { onclick: () => ctx.ir('Mesa libre', (cc, cx) => mesa(cc, cx, null)) },
      el('div.t-ico', '🧪'), el('div.t-tit', 'Mesa libre'), el('div.t-desc', 'Prepará lo que quieras: el clasificador te dice qué bebida hiciste y cómo se compara con las recetas.')),
  );
}

function mesa(c, ctx, L) {
  const objetivos = L ? mezclar(L.objetivos) : [];
  let iObj = 0;
  const puntos = [];
  let taza = L ? 'capuchino' : 'latte';
  const cont = { espresso: 0, leche: 0, espuma: 0, agua: 0 };
  let orden = [];
  let comparar = null;
  let sonido = null;

  const vaso = el('div.ac-taza');
  const etiquetaTaza = el('div.suave');
  const ranking = el('div.ac-ranking', { 'aria-live': 'polite' });
  const prop = el('div');
  const comparacion = el('div');
  const pedido = el('div.panel');
  const feedback = el('div', { 'aria-live': 'polite' });
  const tazas = el('div.chips', Object.entries(TAZAS).map(([k, t]) => el('button.chip' + (k === taza ? '.sel' : ''), {
    onclick: e => { taza = k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); pintar(); },
  }, `${t.n} ${t.cap} ml`)));
  const fuentes = el('div.ac-fuentes', FUENTES.map(f => {
    const b = el('button.ac-fuente', { 'data-ico': f.ico, 'aria-label': `${f.n}: arrastrá sobre la taza o mantené Espacio para verter` },
      el('span.ico', f.ico), el('b', f.n), el('span.suave', f.d));
    arrastrarParaVerter(b, {
      destino: () => vaso,
      color: COLORES[f.k],
      alEmpezar: () => { if (orden[orden.length - 1] !== f.k) orden.push(f.k); sonido = siseo(0.01, f.k === 'espuma' ? 900 : 1800); },
      alParar: () => { sonido?.parar(); sonido = null; },
      alVerter: dt => { cont[f.k] += CAUDAL[f.k] * dt; pintar(); },
    });
    return b;
  }));
  const chipsComparar = el('div.chips', Object.entries(RECETAS).map(([k, r]) => el('button.chip', {
    onclick: e => { comparar = comparar === k ? null : k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target && comparar)); pintar(); },
  }, r.n)));

  c.append(...[
    L ? intro({ aprender: L.aprender }) : intro({ meta: 'Verté libremente. El ranking de la derecha se actualiza en vivo; tocá una receta para compararte con ella.' }),
    L ? pedido : null,
    el('div.ac-banco',
      el('div.ac-col', el('div.panel', el('div.suave', 'Recipiente'), tazas),
        el('div.ac-mesa', el('div.ac-mostrador', vaso, etiquetaTaza), fuentes),
        el('div.fila',
          L ? el('button.btn.prim', { onclick: servir }, '🛎️ Servir') : null,
          el('button.btn', { onclick: () => vaciar() }, '🗑️ Vaciar')),
        feedback),
      el('div.ac-col',
        el('div.panel', el('b', 'Se parece a…'), ranking),
        el('div.panel', el('b', 'Proporciones'), prop, el('div.suave', { style: { marginTop: '8px' } }, 'Comparar con una receta:'), chipsComparar, comparacion)))].filter(Boolean));

  function vaciar() {
    for (const k of CLAVES) cont[k] = 0;
    orden = [];
    feedback.replaceChildren();
    pintar();
  }

  function pintar() {
    const total = CLAVES.reduce((s, k) => s + cont[k], 0);
    const cap = TAZAS[taza].cap;
    vaso.innerHTML = svgTaza(capas(cont, orden), cap, { etiqueta: `Taza con ${Math.round(total)} ml` });
    etiquetaTaza.textContent = `${Math.round(total)} / ${cap} ml${total > cap ? ' · ¡rebalsa!' : ''} · ${CLAVES.filter(k => cont[k] > 0.5).map(k => `${NOMBRES[k].split(' ')[0].toLowerCase()} ${Math.round(cont[k])}`).join(' · ')}`;
    const rk = clasificar(cont, orden).slice(0, 4);
    ranking.replaceChildren(...(rk.length ? rk.map((x, i) => el('div.fila' + (i === 0 ? '.top' : ''), el('span', { style: { width: '8.5em' } }, x.n),
      el('div.hp', el('i', { style: { width: `${x.parecido}%`, background: i === 0 ? 'var(--oro)' : 'var(--acento)' } })), el('span', `${x.parecido}%`)))
      : [el('div.suave', 'Taza vacía')]));
    prop.replaceChildren(el('div.suave', 'Tu bebida'), barraProporciones(proporciones(cont), COLORES, NOMBRES));
    if (comparar) {
      const r = RECETAS[comparar];
      const centro = Object.fromEntries(CLAVES.map(k => [k, r.comp[k] ? (r.comp[k][0] + r.comp[k][1]) / 2 : 0]));
      comparacion.replaceChildren(el('div',
        el('div.suave', `${r.n} (receta orientativa)`), barraProporciones(proporciones(centro), COLORES, NOMBRES),
        el('div', { style: { fontSize: '.8em', marginTop: '6px' } }, r.desc),
        el('table.tabla', el('tr', el('th', ''), el('th', 'vos'), el('th', 'receta')),
          CLAVES.filter(k => r.comp[k] || cont[k] > 0.5).map(k => el('tr', el('td', NOMBRES[k]), el('td', `${Math.round(cont[k])} ml`), el('td', r.comp[k] ? `${r.comp[k][0]}–${r.comp[k][1]} ml` : '—')))),
        r.orden ? el('div.suave', r.orden === 'espresso_ultimo' ? '⚠️ El espresso va al final.' : '⚠️ El espresso va primero.') : null,
        r.variantes ? el('div.suave', `🌍 ${r.variantes}`) : null,
        consejos(cont, comparar, orden).map(x => el('div.ok', `→ ${x.txt}`))));
    } else comparacion.replaceChildren();
  }

  function mostrarPedido() {
    vaciar();
    if (!L) return;
    if (iObj >= objetivos.length) return fin();
    const r = RECETAS[objetivos[iObj]];
    pedido.replaceChildren(el('div.suave', `Bebida ${iObj + 1}/${objetivos.length}`), el('div.mediano', { style: { fontSize: '1.2em' } }, `Prepará: ${r.n}`),
      el('div.suave', 'Elegí el recipiente, verté y apretá Servir. Si dudás, compará con la receta (no resta puntos).'));
  }

  function servir() {
    const id = objetivos[iObj];
    const r = RECETAS[id];
    const rk = clasificar(cont, orden);
    const mio = rk.find(x => x.id === id);
    const total = CLAVES.reduce((s, k) => s + cont[k], 0);
    const rebalsa = total > TAZAS[taza].cap;
    const tazaOk = r.taza.includes(taza);
    let pts = mio ? mio.parecido : 0;
    if (rk[0]?.id !== id) pts = Math.min(pts, 60);
    if (rebalsa) pts -= 20;
    if (!tazaOk) pts -= 10;
    pts = Math.max(0, Math.round(pts));
    puntos.push(pts);
    const bien = pts >= 70;
    bien ? sfx.bien() : sfx.mal();
    feedback.replaceChildren(el('div.panel',
      el('div.fila', el('span.mediano', `${pts}`), el('span.suave', '/100'), el('span', bien ? `😊 ¡Eso es un ${r.n.toLowerCase()}!` : `😕 Eso se parece más a: ${rk[0]?.n || 'nada'}`)),
      !ordenCumplido(r.orden, orden) ? el('div.no', `El orden importa: ${r.orden === 'espresso_ultimo' ? 'el espresso va al final' : 'el espresso va primero'}.`) : null,
      rebalsa ? el('div.no', 'Se rebalsó la taza: medí antes de llenar.') : null,
      !tazaOk ? el('div.suave', `Recipiente: un ${r.n.toLowerCase()} suele ir en ${r.taza.map(t => TAZAS[t].n.toLowerCase()).join(' o ')}.`) : null,
      ...consejos(cont, id, orden).map(x => el('div', `→ ${x.txt}`)),
      el('div.suave', r.desc),
      el('div.fila', el('button.btn', { onclick: () => { puntos.pop(); vaciar(); } }, '↻ Reintentar esta'), el('button.btn.prim', { onclick: () => { iObj++; mostrarPedido(); } }, 'Siguiente ▶'))));
  }

  function fin() {
    const prom = Math.round(puntos.reduce((s, x) => s + x, 0) / Math.max(1, puntos.length));
    const aprob = prom >= 70;
    const est = prom >= 90 ? 3 : prom >= 80 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'recetas', leccion: L.id, puntaje: prom, estrellas: est, aprobada: aprob }, aprob ? 'recetas' : 'práctica de recetas');
    if (aprob) sfx.subir();
    pedido.replaceChildren(el('div.mediano', `${prom}/100 `), estrellas(est), el('div', aprob ? '✅ Lección aprobada.' : '❌ 70 para aprobar. Usá "comparar con la receta" para ver qué te faltó.'),
      el('div.fila', el('button.btn', { onclick: () => ctx.rehacer() }, '↻ Repetir'), el('button.btn.prim', { onclick: () => ctx.volver() }, 'Volver')));
  }

  mostrarPedido();
  pintar();
  return () => sonido?.parar();
}
