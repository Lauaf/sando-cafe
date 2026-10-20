// Minijuego 8 — Laboratorio de blends: mezclá cafés y mirá el perfil sensorial ESTIMADO.
import { el, sfx } from '../util.js';
import { evento } from '../progreso.js';
import { CAFES, ATRIBUTOS, CLAVES, TUESTES, mezclar, explicarAportes, PEDIDOS, evaluarBlend } from './modelo-blend.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { intro, estrellas, barras } from './vista.js';

const AVISO = '⚠️ Perfil estimado por un modelo educativo a partir de perfiles típicos de cada origen y proceso. No es una cata ni una medición: cada lote real es distinto.';

export function hubBlend(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'Un blend combina cafés que se complementan: uno aporta estructura (cuerpo, chocolate), otro dulzor y otro acidez o fruta. El proceso (lavado, natural, honey) y el tueste cambian mucho el aporte de cada uno.',
      meta: 'Cumplí los pedidos del tostador o mezclá libremente. Arrastrá las bolsas a la tolva.' }),
    el('div.ac-lecciones', PEDIDOS.map((P, i) => {
      const abierta = desbloqueada(a, PEDIDOS, P.id);
      const reg = a.lecciones[P.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), { disabled: !abierta, onclick: () => ctx.ir(P.t, (cc, cx) => mesa(cc, cx, P)) },
        el('span.n', String(i + 1)), el('span.t', P.t), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nuevo' : '🔒'));
    })),
    el('button.tarjeta', { onclick: () => ctx.ir('Mezcla libre', (cc, cx) => mesa(cc, cx, null)) },
      el('div.t-ico', '🌱'), el('div.t-tit', 'Mezcla libre'), el('div.t-desc', 'Probá combinaciones y mirá cómo suma cada café.')),
    el('div.suave', AVISO),
  );
}

function mesa(c, ctx, P) {
  const comps = [];      // [{id, pct, tueste}]
  const tolva = el('div.ac-tolva', { 'aria-label': 'Tolva: soltá acá las bolsas de café' });
  const bolsa = el('div.ac-prop');
  const radar = el('div.ac-radar');
  const datos = el('div');
  const evalNodo = el('div', { 'aria-live': 'polite' });
  const catalogo = el('div.ac-catalogo', CAFES.map(cafe => {
    const card = el('button.ac-bolsa', { 'data-id': cafe.id, title: cafe.nota, 'aria-label': `${cafe.origen} ${cafe.proceso}: arrastrá a la tolva o tocá para agregar` },
      el('span.ac-bolsa-color', { style: { background: cafe.color } }),
      el('b', cafe.origen), el('span.suave', `${cafe.variedad} · ${cafe.proceso}`), el('span.suave.ac-bolsa-nota', cafe.nota));
    arrastrarBolsa(card, () => agregar(cafe.id));
    return card;
  }));

  c.append(
    P ? intro({ aprender: P.aprender, meta: P.meta }) : intro({ meta: 'Mezclá libremente: el perfil de la derecha cambia en vivo.' }),
    el('div.ac-banco',
      el('div.ac-col', el('div.panel', el('b', 'Cafés verdes disponibles'), el('div.suave', 'Arrastrá una bolsa a la tolva (o tocala).'), catalogo)),
      el('div.ac-col',
        el('div.panel', el('b', '🫘 Tolva'), tolva, bolsa),
        el('div.panel', el('b', 'Perfil estimado'), radar, datos, evalNodo),
        el('div.suave', AVISO))));

  function agregar(id) {
    if (comps.some(x => x.id === id)) return;
    comps.push({ id, pct: comps.length ? 20 : 100, tueste: 'medio' });
    sfx.cursor();
    pintar();
  }

  // estructura de la tolva (solo cuando se agrega o quita un café); los valores se actualizan aparte
  function pintar() {
    tolva.replaceChildren(...(comps.length ? comps.map(x => {
      const cafe = CAFES.find(y => y.id === x.id);
      const rango = el('input', { type: 'range', min: 0, max: 100, step: 5, value: x.pct, 'aria-label': `Proporción de ${cafe.origen} ${cafe.proceso}` });
      x.val = el('span.val');
      rango.addEventListener('input', () => { x.pct = +rango.value; actualizar(); });
      return el('div.ac-comp',
        el('span.ac-bolsa-color', { style: { background: cafe.color } }),
        el('span', { style: { minWidth: '8em' } }, `${cafe.origen} · ${cafe.proceso}`),
        rango, x.val,
        el('div.chips', Object.keys(TUESTES).map(t => el('button.chip' + (x.tueste === t ? '.sel' : ''), {
          onclick: e => { x.tueste = t; e.target.parentNode.querySelectorAll('.chip').forEach(b => b.classList.toggle('sel', b === e.target)); actualizar(); },
        }, t))),
        el('button.btn.chico', { onclick: () => { comps.splice(comps.indexOf(x), 1); pintar(); }, 'aria-label': 'quitar' }, '✕'));
    }) : [el('div.suave', 'Vacía. Arrastrá cafés acá.')]));
    actualizar();
  }

  function actualizar() {
    const total = comps.reduce((s, x) => s + x.pct, 0) || 1;
    for (const x of comps) if (x.val) x.val.textContent = `${Math.round((x.pct / total) * 100)} %`;
    // bolsa: proporciones visuales
    bolsa.replaceChildren(...comps.filter(x => x.pct > 0).map(x => {
      const cafe = CAFES.find(y => y.id === x.id);
      return el('div', { style: { width: `${(x.pct / total) * 100}%`, background: cafe.color }, title: cafe.origen }, x.pct / total > 0.14 ? `${Math.round((x.pct / total) * 100)}%` : '');
    }));
    const m = mezclar(comps);
    if (!m) { radar.innerHTML = svgRadar(null, P); datos.replaceChildren(); evalNodo.replaceChildren(); return; }
    radar.innerHTML = svgRadar(m.perfil, P);
    datos.replaceChildren(
      el('div.fila', el('span', `☕ Cafeína ×${m.cafeina.toFixed(1)}`), el('span', `🟫 Crema ${m.crema.toFixed(1)}/10`), el('span', `🧩 Complejidad ${m.complejidad.toFixed(0)}/10`)),
      barras(m.perfil, ATRIBUTOS),
      el('div', el('b', '¿Por qué? '), explicarAportes(m).map(x => { const cafe = CAFES.find(y => y.id === x.id); return el('div.suave', `• ${cafe.origen} ${cafe.proceso.toLowerCase()} aporta sobre todo ${x.txt}.`); })),
      m.notas.map(n => el('div', n)));
    if (P) {
      const ev = evaluarBlend(m, P, comps);
      evalNodo.replaceChildren(el('div.panel',
        el('div.fila', el('span.mediano', `${ev.puntaje}`), el('span.suave', '/100 (estimado)'), ev.puntaje >= 80 ? el('span.ok', '✔ cumple el pedido') : null),
        ev.fallas.map(f => el('div.no', `→ ${f}`)),
        el('button.btn.prim', { onclick: () => enviar(ev) }, '📦 Mandar al tostador')));
    }
  }

  function enviar(ev) {
    const aprob = ev.puntaje >= 80;
    const est = ev.puntaje >= 95 ? 3 : ev.puntaje >= 88 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'cata', leccion: P.id, puntaje: ev.puntaje, estrellas: est, aprobada: aprob }, aprob ? 'blend aprobado' : 'blend');
    if (aprob) { sfx.subir(); evento('blend_ok'); } else sfx.mal();
    evalNodo.append(el('div' + (aprob ? '.ok' : '.no'), aprob ? '✅ El tostador lo aprueba para una prueba de cata.' : '❌ Todavía no: mirá qué atributo falta y qué café lo aporta.'),
      aprob ? el('button.btn', { onclick: () => ctx.volver() }, 'Volver a los pedidos') : null);
  }

  pintar();
  return () => {};
}

/** Arrastre de bolsas a la tolva con puntero (mouse/táctil). Un toque sin arrastrar también agrega. */
function arrastrarBolsa(card, alSoltar) {
  let fantasma = null, x0 = 0, y0 = 0, movio = false;
  card.style.touchAction = 'none';
  card.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; movio = false; card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => {
    if (!card.hasPointerCapture(e.pointerId)) return;
    if (!movio && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) {
      movio = true;
      fantasma = el('div.ac-fantasma', '🫘');
      document.body.append(fantasma);
    }
    if (fantasma) {
      fantasma.style.left = `${e.clientX - 28}px`; fantasma.style.top = `${e.clientY - 28}px`;
      const t = document.querySelector('.ac-tolva');
      const r = t?.getBoundingClientRect();
      t?.classList.toggle('encima', !!r && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom);
    }
  });
  const fin = e => {
    const t = document.querySelector('.ac-tolva');
    if (fantasma) {
      const r = t?.getBoundingClientRect();
      if (r && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) alSoltar();
      fantasma.remove(); fantasma = null;
    } else if (e.type === 'pointerup') alSoltar();
    t?.classList.remove('encima');
  };
  card.addEventListener('pointerup', fin);
  card.addEventListener('pointercancel', fin);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alSoltar(); } });
}

/** Radar SVG del perfil (0..10) con los rangos pedidos (si hay pedido). */
function svgRadar(perfil, pedido) {
  const n = CLAVES.length, cx = 130, cy = 120, R = 90;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * R * v / 10, cy + Math.sin(a) * R * v / 10]; };
  let s = `<svg viewBox="0 0 260 245" role="img" aria-label="Radar del perfil sensorial estimado">`;
  for (const v of [2.5, 5, 7.5, 10]) s += `<polygon points="${CLAVES.map((_, i) => pt(i, v).join(',')).join(' ')}" fill="none" stroke="#ffffff1a"/>`;
  CLAVES.forEach((k, i) => {
    const [x, y] = pt(i, 10), [lx, ly] = pt(i, 12.2);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#ffffff14"/>`;
    s += `<text x="${lx}" y="${ly}" font-size="9" fill="#a99fc6" text-anchor="middle" dominant-baseline="middle" font-family="DotGothic16, monospace">${ATRIBUTOS[k].split(' ')[0]}</text>`;
  });
  if (pedido) {
    for (const [k, [a, b]] of Object.entries(pedido.req)) {
      const i = CLAVES.indexOf(k);
      const [x1, y1] = pt(i, a), [x2, y2] = pt(i, b);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4caf6a" stroke-width="6" stroke-linecap="round" opacity=".55"/>`;
    }
  }
  if (perfil) s += `<polygon points="${CLAVES.map((k, i) => pt(i, perfil[k]).join(',')).join(' ')}" fill="#f2c14e44" stroke="#f2c14e" stroke-width="2"/>`;
  return s + '</svg>';
}
