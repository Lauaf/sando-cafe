// Minijuego 7 — Laboratorio de métodos filtrados: V60, AeroPress y prensa, con experimentos A/B.
import { el, sfx, limitar } from '../util.js';
import { evento } from '../progreso.js';
import { METODOS, VARIABLES, PATRONES, LECCIONES, simular, evaluarFiltro, diferencias, planVertido } from './modelo-filtro.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { intro, estrellas, lienzo, ajustar, bucle, paso, mezcla, menosMovimiento } from './vista.js';

const APRUEBA = 80;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const COL = { A: '#5b7bd5', B: '#f2a14e' };

export function hubFiltro(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'En filtro hay dos ejes: la extracción (cuánto del café se disolvió: agrio ↔ amargo) y la intensidad (cuánto café hay en el agua: aguado ↔ pesado). El ratio mueve sobre todo la intensidad; molienda, temperatura y tiempo, la extracción.',
      meta: 'Hacé las lecciones y después usá el laboratorio A/B: cambiá UNA variable por vez y mirá qué pasa.' }),
    el('div.ac-lecciones', LECCIONES.map((L, i) => {
      const abierta = desbloqueada(a, LECCIONES, L.id);
      const reg = a.lecciones[L.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), { disabled: !abierta, onclick: () => ctx.ir(L.t, (cc, cx) => leccion(cc, cx, L)) },
        el('span.n', String(i + 1)), el('span.t', `${L.t} · ${METODOS[L.metodo].n}`), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nueva' : '🔒'));
    })),
    el('button.tarjeta', { onclick: () => ctx.ir('Laboratorio A/B', laboratorioAB) },
      el('div.t-ico', '⚖️'), el('div.t-tit', 'Laboratorio A/B'),
      el('div.t-desc', 'Dos recetas lado a lado, con la misma simulación. Ideal para aislar el efecto de una sola variable.'),
      el('div.t-tag', `${a.ab || 0} experimentos con una sola variable`)),
  );
}

/** Editor de receta: devuelve {nodo, receta, refrescar}. controles = null → todo editable. */
function editor(metodo, receta, controles, alCambiar) {
  const tipo = METODOS[metodo].tipo;
  const nodo = el('div.ac-editor');
  const pasos = {};
  for (const [k, v] of Object.entries(VARIABLES)) {
    if (v.solo && v.solo !== tipo) continue;
    const bloq = controles && !controles.includes(k);
    pasos[k] = paso({ etiqueta: v.n, valor: receta[k], min: v.min, max: v.max, delta: v.paso, fmt: x => `${Math.round(x * 10) / 10}${v.u ? ' ' + v.u : ''}`, bloqueado: bloq, alCambiar: x => { receta[k] = x; alCambiar(k); } });
    nodo.append(pasos[k]);
  }
  if (tipo === 'percolacion') {
    const bloq = controles && !controles.includes('patron');
    nodo.append(el('div.ac-paso', el('span', 'Patrón'), el('div.chips', Object.entries(PATRONES).map(([k, n]) => el('button.chip' + (receta.patron === k ? '.sel' : ''), {
      disabled: bloq, onclick: e => { receta.patron = k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); alCambiar('patron'); },
    }, n)))));
  }
  const ratio = el('div.suave');
  const pintarRatio = () => { ratio.textContent = `Ratio 1:${(receta.agua / receta.dosis).toFixed(1)}`; };
  pintarRatio();
  nodo.append(ratio);
  return { nodo, refrescar: () => { for (const [k, p] of Object.entries(pasos)) p.fijar(receta[k]); pintarRatio(); }, pintarRatio };
}

// ---------- animación de la preparación ----------
function animador(cv, metodo, receta, sim, alTerminar) {
  const M = METODOS[metodo];
  const plan = planVertido(metodo, receta);
  const total = sim.resultado.tiempo;
  const reducido = menosMovimiento();
  let t = 0, vel = 12, listo = false;
  const parar = bucle(dt => {
    if (!listo) {
      t = Math.min(total, t + dt * vel);
      if (t >= total) { listo = true; alTerminar(); }
    }
    dibujar();
  });
  function punto() {
    const i = Math.min(sim.curva.length - 1, Math.floor(t));
    return sim.curva[i] || { t: 0, ey: 0, eyTaza: 0, taza: 0, nivel: 0, tds: 0 };
  }
  function dibujar() {
    const { g, w, h } = ajustar(cv);
    const p = punto();
    g.fillStyle = '#17110e'; g.fillRect(0, 0, w, h);
    const cx = w * 0.45;
    const colLiq = mezcla('#c99a5e', '#3b1a0c', limitar((p.tds || 1.3) / 1.8, 0, 1));
    const vierte = plan.some(x => t >= x.desde && t < x.hasta);
    // pava
    g.fillStyle = '#8e8681'; g.fillRect(w * 0.06, h * 0.02, w * 0.16, h * 0.1);
    g.strokeStyle = '#8e8681'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.22, h * 0.05); g.quadraticCurveTo(w * 0.32, h * 0.04, cx - 6, h * 0.14); g.stroke();
    if (vierte) {
      g.strokeStyle = '#d9eef7'; g.lineWidth = 2;
      const off = receta.patron === 'espiral' && !reducido ? Math.sin(t * 2) * w * 0.05 : 0;
      g.beginPath(); g.moveTo(cx - 6, h * 0.14); g.lineTo(cx + off, h * 0.3); g.stroke();
    }
    const nivelLiq = limitar(p.nivel / (receta.agua * 0.75), 0, 1);
    if (M.tipo === 'percolacion') {
      // cono
      const top = h * 0.2, bot = h * 0.56, aw = w * 0.2;
      g.fillStyle = '#ffffff12';
      g.beginPath(); g.moveTo(cx - aw, top); g.lineTo(cx + aw, top); g.lineTo(cx + 6, bot); g.lineTo(cx - 6, bot); g.closePath(); g.fill();
      const yAt = f => bot - (bot - top) * f, xAt = (f, s) => cx + s * (6 + (aw - 6) * f);
      const fCama = 0.35;
      const fAgua = limitar(fCama + nivelLiq * 0.65, fCama, 1);
      if (p.nivel > 1) { g.fillStyle = colLiq + 'cc'; g.beginPath(); g.moveTo(xAt(fAgua, -1), yAt(fAgua)); g.lineTo(xAt(fAgua, 1), yAt(fAgua)); g.lineTo(xAt(fCama, 1), yAt(fCama)); g.lineTo(xAt(fCama, -1), yAt(fCama)); g.closePath(); g.fill(); }
      g.fillStyle = '#5a3a24'; g.beginPath(); g.moveTo(xAt(fCama, -1), yAt(fCama)); g.lineTo(xAt(fCama, 1), yAt(fCama)); g.lineTo(cx + 6, bot); g.lineTo(cx - 6, bot); g.closePath(); g.fill();
      g.strokeStyle = '#f6eedbaa'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - aw, top); g.lineTo(cx - 6, bot); g.lineTo(cx + 6, bot); g.lineTo(cx + aw, top); g.stroke();
      // goteo
      const caudal = sim.curva[Math.min(sim.curva.length - 1, Math.floor(t) + 1)]?.taza - p.taza;
      if (caudal > 0.05 && !listo) { g.strokeStyle = colLiq; g.lineWidth = Math.min(4, 1 + caudal); g.beginPath(); g.moveTo(cx, bot); g.lineTo(cx, h * 0.68); g.stroke(); }
    } else {
      // cámara de inmersión (AeroPress o prensa)
      const top = h * 0.2, bot = h * 0.58, aw = w * (metodo === 'prensa' ? 0.16 : 0.11);
      g.fillStyle = '#ffffff12'; g.fillRect(cx - aw, top, aw * 2, bot - top);
      const enPrensa = t >= plan[0].hasta + receta.reposo;
      const fPr = enPrensa ? limitar((t - plan[0].hasta - receta.reposo) / receta.prensa, 0, 1) : 0;
      const liq = limitar(p.nivel / receta.agua, 0, 1);
      const yL = bot - (bot - top) * liq;
      g.fillStyle = colLiq + 'dd'; g.fillRect(cx - aw, yL, aw * 2, bot - yL);
      if (metodo === 'prensa') {
        g.fillStyle = '#5a3a24'; g.fillRect(cx - aw, yL, aw * 2, Math.min(14, bot - yL)); // costra
        if (enPrensa) { const yP = top + (bot - top - 16) * fPr; g.fillStyle = '#b8b2ad'; g.fillRect(cx - aw, yP, aw * 2, 4); g.fillRect(cx - 2, top - 30, 4, yP - top + 30); }
      } else if (enPrensa) {
        const yP = top + (yL - top) * fPr * 0 + (bot - top) * (1 - liq); g.fillStyle = '#3b3330'; g.fillRect(cx - aw + 3, Math.max(top - 20, yP - 24), aw * 2 - 6, 24);
      }
      g.strokeStyle = '#f6eedbaa'; g.lineWidth = 2; g.strokeRect(cx - aw, top, aw * 2, bot - top);
      if (enPrensa && !listo) { g.strokeStyle = colLiq; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, bot); g.lineTo(cx, h * 0.68); g.stroke(); }
    }
    // servidor / taza
    const sTop = h * 0.66, sBot = h * 0.96, sw = w * 0.17;
    const cap = Math.max(300, receta.agua * 1.1);
    const f = limitar(p.taza / cap, 0, 1);
    g.fillStyle = colLiq; g.fillRect(cx - sw, sBot - (sBot - sTop) * f, sw * 2, (sBot - sTop) * f);
    g.strokeStyle = '#f6eedbaa'; g.strokeRect(cx - sw, sTop, sw * 2, sBot - sTop);
    // lecturas
    g.fillStyle = '#f2c14e'; g.font = `${Math.round(h * 0.06)}px DotGothic16, monospace`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(fmtT(t), w * 0.7, h * 0.05);
    g.fillStyle = '#9ff0c0'; g.font = `${Math.round(h * 0.045)}px DotGothic16, monospace`;
    g.fillText(`${Math.round(p.taza)} g`, w * 0.7, h * 0.14);
    g.fillStyle = '#a99fc6'; g.fillText(`TDS ≈ ${(p.tds || 0).toFixed(2)} %`, w * 0.7, h * 0.22);
    g.fillText(`disuelto ≈ ${p.ey.toFixed(1)} %`, w * 0.7, h * 0.29);
  }
  return { parar, saltar: () => { t = total; }, acelerar: () => { vel = vel === 12 ? 40 : 12; return vel; } };
}

/** Gráfico de control: TDS vs extracción, con la zona dulce del método. */
function grafico(cv, puntos, metodo) {
  const { g, w, h } = ajustar(cv);
  const [tMin, tMax] = METODOS[metodo].tds;
  g.fillStyle = '#0003'; g.fillRect(0, 0, w, h);
  const x0 = 34, y0 = 8, ww = w - x0 - 10, hh = h - y0 - 24;
  const X = ey => x0 + ((ey - 12) / 16) * ww, Y = t => y0 + hh - ((t - 0.7) / 1.3) * hh;
  g.fillStyle = '#4caf6a26'; g.fillRect(X(18), Y(tMax), X(22) - X(18), Y(tMin) - Y(tMax));
  g.strokeStyle = '#4caf6a'; g.strokeRect(X(18), Y(tMax), X(22) - X(18), Y(tMin) - Y(tMax));
  g.fillStyle = '#a99fc6'; g.font = '10px DotGothic16, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (const ey of [14, 18, 22, 26]) g.fillText(`${ey}%`, X(ey), y0 + hh + 3);
  g.fillText('extracción →', x0 + ww / 2, y0 + hh + 12);
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const t of [1.0, 1.4, 1.8]) g.fillText(t.toFixed(1), x0 - 3, Y(t));
  g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText('fuerte', x0 + 3, y0 + 2); g.textBaseline = 'bottom'; g.fillText('aguado', x0 + 3, y0 + hh - 2);
  for (const pt of puntos) {
    const x = limitar(X(pt.ey), x0, x0 + ww), y = limitar(Y(pt.tds), y0, y0 + hh);
    g.fillStyle = pt.col; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
    g.fillStyle = '#f6eedb'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(pt.n, x, y - 7);
  }
}

// ---------- lección ----------
function leccion(c, ctx, L) {
  const receta = { ...METODOS[L.metodo].base, ...L.p };
  const vista = lienzo('ac-filtro', `Preparación en ${METODOS[L.metodo].n}`);
  const chart = lienzo('ac-mapa', 'Gráfico de control: TDS contra extracción');
  const resultado = el('div', { 'aria-live': 'polite' });
  const historial = [];
  let anim = null;
  const ed = editor(L.metodo, receta, L.controles, () => {});
  const btn = el('button.btn.prim.ac-grande', { onclick: preparar }, '☕ Preparar');
  c.append(intro({ aprender: L.aprender, meta: L.meta }),
    el('div.ac-banco',
      el('div.ac-col', vista, el('div.fila', btn, el('button.btn.chico', { onclick: () => anim?.saltar() }, '⏭ Saltar'), el('button.btn.chico', { onclick: e => { if (anim) e.target.textContent = `⏩ ×${anim.acelerar()}`; } }, '⏩ ×12')), chart),
      el('div.ac-col', el('div.panel', el('b', 'Receta'), ed.nodo), resultado)));
  requestAnimationFrame(() => grafico(chart, [], L.metodo));

  function preparar() {
    anim?.parar();
    const sim = simular(L.metodo, receta);
    btn.disabled = true;
    resultado.replaceChildren(el('div.suave.escribiendo-ia', 'preparando'));
    anim = animador(vista, L.metodo, { ...receta }, sim, () => mostrar(sim));
  }
  function mostrar(sim) {
    btn.disabled = false;
    const r = sim.resultado, e = evaluarFiltro(r);
    historial.push({ ey: r.ey, tds: r.tds, col: '#d39a62', n: `#${historial.length + 1}` });
    const aprob = e.puntaje >= APRUEBA;
    const est = e.puntaje >= 95 ? 3 : e.puntaje >= 88 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'filtrado', leccion: L.id, puntaje: e.puntaje, estrellas: est, aprobada: aprob, errores: e.defectos }, aprob ? 'filtrado' : 'práctica de filtrado');
    aprob ? sfx.bien() : sfx.mal();
    grafico(chart, historial.map((x, i) => ({ ...x, col: i === historial.length - 1 ? '#f2c14e' : '#d39a6288' })), L.metodo);
    resultado.replaceChildren(el('div.panel',
      el('div.fila', el('span.mediano', `${e.puntaje}`), el('span.suave', '/100'), estrellas(est), aprob ? el('span.ok', '✅ ¡Lección superada!') : null),
      el('div', `⏱ ${fmtT(r.tiempo)} · ${Math.round(r.bebida)} g de bebida · EY ≈ ${r.ey.toFixed(1)} % · TDS ≈ ${r.tds.toFixed(2)} %`),
      el('div.suave', 'Estimaciones del modelo (no mediciones).'),
      e.notas.map(n => el('div', n)),
      aprob ? el('button.btn.prim', { onclick: () => ctx.volver() }, 'Volver a las lecciones') : null));
  }
  return () => anim?.parar();
}

// ---------- laboratorio A/B ----------
function laboratorioAB(c) {
  let metodo = 'v60';
  const a = academia();
  const cuerpo = el('div');
  c.append(intro({ aprender: 'Un experimento sirve si cambiás una sola cosa. Si cambiás molienda y temperatura a la vez, no vas a saber cuál produjo el efecto.',
    meta: 'Armá la receta A, copiala en B, cambiá UNA variable y prepará las dos.' }),
  el('div.chips', Object.entries(METODOS).map(([k, m]) => el('button.chip' + (k === metodo ? '.sel' : ''), { onclick: e => { metodo = k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); montar(); } }, m.n))),
  cuerpo);
  let limpiar = () => {};
  function montar() {
    limpiar();
    const recA = { ...METODOS[metodo].base }, recB = { ...METODOS[metodo].base };
    const aviso = el('div', { 'aria-live': 'polite' });
    const pintarAviso = () => {
      const d = diferencias(recA, recB);
      aviso.className = d.length === 1 ? 'ok' : d.length ? 'no' : 'suave';
      aviso.textContent = d.length === 0 ? 'A y B son iguales: cambiá una variable en B.' : d.length === 1 ? `✔ Cambia solo: ${VARIABLES[d[0]]?.n || 'patrón'}. Buen experimento.` : `⚠️ Cambian ${d.length} variables (${d.map(k => VARIABLES[k]?.n || 'patrón').join(', ')}): el resultado no se va a poder atribuir a una sola.`;
    };
    const edA = editor(metodo, recA, null, () => pintarAviso());
    const edB = editor(metodo, recB, null, () => pintarAviso());
    const cvA = lienzo('ac-filtro', 'Receta A'), cvB = lienzo('ac-filtro', 'Receta B');
    const chart = lienzo('ac-mapa', 'Gráfico de control con A y B');
    const curvas = lienzo('ac-grafico', 'Extracción a lo largo del tiempo, A y B');
    const tabla = el('div', { 'aria-live': 'polite' });
    let anims = [];
    const btn = el('button.btn.prim.ac-grande', { onclick: preparar }, '☕ Preparar A y B');
    cuerpo.replaceChildren(
      el('div.ac-ab',
        el('div.panel', el('b', { style: { color: COL.A } }, 'Receta A'), edA.nodo, cvA),
        el('div.panel', el('div.fila', el('b', { style: { color: COL.B } }, 'Receta B'), el('button.btn.chico', { onclick: () => { Object.assign(recB, recA); edB.refrescar(); pintarAviso(); } }, '⇐ copiar A')), edB.nodo, cvB)),
      aviso, el('div.fila', btn), tabla, el('div.dos-col', chart, curvas));
    pintarAviso();
    requestAnimationFrame(() => grafico(chart, [], metodo));
    function preparar() {
      anims.forEach(x => x.parar());
      const sA = simular(metodo, recA), sB = simular(metodo, recB);
      const d = diferencias(recA, recB);
      let listos = 0;
      btn.disabled = true;
      const fin = () => {
        if (++listos < 2) return;
        btn.disabled = false;
        const eA = evaluarFiltro(sA.resultado), eB = evaluarFiltro(sB.resultado);
        if (d.length === 1) { a.ab = (a.ab || 0) + 1; evento('ab_unavariable'); registrarAcademia({ comp: 'filtrado', puntaje: Math.max(eA.puntaje, eB.puntaje), evaluado: false }, 'experimento A/B'); }
        grafico(chart, [{ ...sA.resultado, col: COL.A, n: 'A' }, { ...sB.resultado, col: COL.B, n: 'B' }], metodo);
        dibujarCurvas(curvas, sA, sB);
        const fila = (n, fa, fb, u = '') => el('tr', el('td', n), el('td', `${fa}${u}`), el('td', `${fb}${u}`));
        tabla.replaceChildren(el('div.panel', el('table.tabla',
          el('tr', el('th', ''), el('th', { style: { color: COL.A } }, 'A'), el('th', { style: { color: COL.B } }, 'B')),
          fila('Tiempo total', fmtT(sA.resultado.tiempo), fmtT(sB.resultado.tiempo)),
          fila('Bebida', Math.round(sA.resultado.bebida), Math.round(sB.resultado.bebida), ' g'),
          fila('Extracción ≈', sA.resultado.ey.toFixed(1), sB.resultado.ey.toFixed(1), ' %'),
          fila('TDS ≈', sA.resultado.tds.toFixed(2), sB.resultado.tds.toFixed(2), ' %'),
          fila('Puntaje', eA.puntaje, eB.puntaje)),
        el('div', el('b', 'A: '), eA.notas[0]), el('div', el('b', 'B: '), eB.notas[0]),
        d.length === 1 ? el('div.ok', `🔬 Conclusión: cambiar ${VARIABLES[d[0]]?.n.toLowerCase() || 'el patrón'} movió la extracción ${signo(sB.resultado.ey - sA.resultado.ey)} % y el TDS ${signo(sB.resultado.tds - sA.resultado.tds, 2)} %.`) : null,
        el('div.suave', 'Estimaciones del modelo, no mediciones.')));
      };
      anims = [animador(cvA, metodo, { ...recA }, sA, fin), animador(cvB, metodo, { ...recB }, sB, fin)];
    }
    limpiar = () => anims.forEach(x => x.parar());
  }
  montar();
  return () => limpiar();
}

const signo = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;

function dibujarCurvas(cv, sA, sB) {
  const { g, w, h } = ajustar(cv);
  g.fillStyle = '#0003'; g.fillRect(0, 0, w, h);
  const x0 = 28, y0 = 8, ww = w - x0 - 8, hh = h - y0 - 20;
  const tmax = Math.max(sA.resultado.tiempo, sB.resultado.tiempo);
  const X = t => x0 + (t / tmax) * ww, Y = ey => y0 + hh - (ey / 26) * hh;
  g.fillStyle = '#a99fc6'; g.font = '10px DotGothic16, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let t = 0; t <= tmax; t += 60) g.fillText(fmtT(t), X(t), y0 + hh + 4);
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const ey of [10, 20]) g.fillText(`${ey}%`, x0 - 3, Y(ey));
  for (const [s, col] of [[sA, COL.A], [sB, COL.B]]) {
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    s.curva.forEach((p, i) => (i ? g.lineTo(X(p.t), Y(p.ey)) : g.moveTo(X(p.t), Y(p.ey))));
    g.stroke();
  }
  g.textAlign = 'left'; g.fillStyle = '#a99fc6'; g.fillText('café disuelto en el tiempo (incluye lo que queda en la cama)', x0 + 4, y0 + 8);
}
