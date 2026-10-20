// Minijuego 6 — Diagnóstico de espresso: leer el shot, nombrar la causa y elegir la corrección.
import { el, sfx, limitar } from '../util.js';
import { evento } from '../progreso.js';
import { RECETA_BASE, crearShot, TUESTES, sabor } from './modelo-espresso.js';
import { CAUSAS, RONDAS, armarRonda, puntuar, notasDeCata, pistasVisuales } from './modelo-diagnostico.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { bancoCon, ETIQUETAS_SABOR, COLORES_SABOR } from './espresso.js';
import { lienzo, ajustar, intro, estrellas, barras, mezcla } from './vista.js';

export function hubDiagnostico(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'Un barista no adivina: prueba, mira el tiempo y el peso, y razona. Agrio + rápido suele ser poca extracción; amargo + lento, demasiada; agrio y amargo a la vez, un puck desparejo.',
      meta: 'En cada caso: 1) elegí la causa más probable, 2) elegí la corrección. Después vas a ver qué habría pasado con cada opción (simulado con el mismo modelo del simulador).' }),
    el('div.ac-lecciones', RONDAS.map((R, i) => {
      const abierta = desbloqueada(a, RONDAS, R.id);
      const reg = a.lecciones[R.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), {
        disabled: !abierta, onclick: () => ctx.ir(R.t, (cc, cx) => ronda(cc, cx, R)),
      }, el('span.n', String(i + 1)), el('span.t', `${R.t} · ${R.n} casos`), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nueva' : '🔒'));
    })),
    el('div.suave', 'Cada ronda se aprueba con 70 puntos de promedio. Los casos cambian en cada intento.'),
  );
}

function ronda(c, ctx, R) {
  const casos = armarRonda(R, Math.floor(Math.random() * 1e9));
  let i = 0;
  const puntos = [];
  const zona = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  c.append(intro({ aprender: R.aprender }), zona);
  mostrar();

  function mostrar() {
    if (i >= casos.length) return fin();
    const caso = casos[i];
    const { r } = caso.base;
    const e = caso.escenario;
    let causa = null;
    const curva = lienzo('ac-grafico', 'Curvas de presión y caudal del shot del caso');
    const cata = notasDeCata(r), pistas = pistasVisuales(r);
    const pasoCausa = el('div.panel', el('div', el('b', '1 · ¿Cuál es la causa más probable?')),
      el('div.ac-opciones', Object.entries(CAUSAS).map(([k, x]) => el('button.btn', { onclick: ev => elegirCausa(k, ev.currentTarget) }, x.n))));
    const pasoCorr = el('div.panel.oculto', el('div', el('b', '2 · ¿Qué cambiás para el próximo shot?')),
      el('div.ac-opciones', caso.opciones.map(o => el('button.btn', { onclick: ev => elegirCorr(o.id, ev.currentTarget) }, o.n))));
    const salida = el('div', { 'aria-live': 'polite' });
    zona.replaceChildren(
      el('div.suave', `Caso ${i + 1}/${casos.length}`),
      el('div.panel.ac-caso',
        el('div.mediano', { style: { fontSize: '1.1em' } }, `🗣️ "${caso.plantilla.queja}"`),
        el('div.dos-col',
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            el('div', `📋 Receta: ${e.p.dosis} g → ${r.enTaza.toFixed(0)} g en taza (1:${r.ratio.toFixed(1)}) · ${e.p.temp} °C · tueste ${TUESTES[e.p.tueste].n.toLowerCase()}`),
            el('div', `⏱ ${r.tiempo.toFixed(1)} s · primera gota a los ${r.primeraGota?.toFixed(1) ?? '—'} s`),
            el('div', `👅 En la taza: ${cata.join(', ')}`),
            pistas.length ? el('div', `👀 ${pistas.join('; ')}`) : null,
            tazaColor(r)),
          curva)),
      pasoCausa, pasoCorr, salida);
    requestAnimationFrame(() => dibujarCurva(curva, e));

    function elegirCausa(k, boton) {
      if (causa) return;
      causa = k;
      const ok = caso.plantilla.causas.includes(k), parcial = caso.plantilla.parcial.includes(k);
      pasoCausa.querySelectorAll('button').forEach(b => { b.disabled = true; });
      boton.classList.add(ok ? 'correcta' : parcial ? 'parcial' : 'incorrecta');
      if (!ok) pasoCausa.querySelectorAll('button').forEach((b, n) => { if (caso.plantilla.causas.includes(Object.keys(CAUSAS)[n])) b.classList.add('correcta'); });
      ok ? sfx.bien() : sfx.mal();
      const principal = CAUSAS[caso.plantilla.causas[0]];
      pasoCausa.append(el('div' + (ok ? '.ok' : parcial ? '' : '.no'), ok ? `✔ ${principal.desc}` : parcial ? `≈ Tiene algo de eso, pero lo principal es: ${principal.n}. ${principal.desc}` : `✘ Lo principal es: ${principal.n}. ${principal.desc}`));
      pasoCorr.classList.remove('oculto');
    }

    function elegirCorr(id, boton) {
      const p = puntuar(caso, causa, id);
      puntos.push(p.total);
      if (p.diag === 50 && p.corr >= 35) evento('diag_ok');
      pasoCorr.querySelectorAll('button').forEach(b => { b.disabled = true; });
      boton.classList.add(p.clase === 'mejor' ? 'correcta' : p.clase === 'valida' || p.clase === 'poco' ? 'parcial' : 'incorrecta');
      p.corr >= 35 ? sfx.bien() : sfx.mal();
      const etiqueta = { mejor: '🏆 la mejor', valida: '👍 también sirve', poco: '🤏 ayuda poco', neutra: '😐 casi no cambia', empeora: '👎 empeora' };
      salida.replaceChildren(el('div.panel',
        el('div.fila', el('span.mediano', `${p.total}`), el('span.suave', '/100 en este caso')),
        el('div.suave', 'Qué habría pasado con cada opción (simulado):'),
        el('table.tabla', el('tr', el('th', 'opción'), el('th', 'resultado'), el('th', 'tiempo'), el('th', 'extracción'), el('th', 'puntaje')),
          caso.opciones.map(o => el('tr' + (o.id === id ? '.sel' : ''),
            el('td', o.n, el('div.suave', o.por)), el('td', etiqueta[o.clase]),
            el('td', `${o.r.tiempo.toFixed(0)} s`), el('td', `${o.r.ey.toFixed(1)} %`),
            el('td', `${o.ev.puntaje} (${o.delta >= 0 ? '+' : ''}${o.delta})`)))),
        el('div.suave', 'No hay una única respuesta: varias correcciones pueden funcionar. La molienda suele ser la primera palanca porque cambia el tiempo de contacto sin tocar la receta.'),
        el('div.fila',
          el('button.btn', { onclick: () => ctx.ir('Probalo en el simulador', bancoCon(e.p, e.salida)) }, '☕ Probalo en el simulador'),
          el('button.btn.prim', { onclick: () => { i++; mostrar(); } }, i + 1 < casos.length ? 'Siguiente caso ▶' : 'Ver resultado ▶'))));
    }
  }

  function fin() {
    const prom = Math.round(puntos.reduce((s, x) => s + x, 0) / puntos.length);
    const aprob = prom >= R.aprueba;
    const est = prom >= 90 ? 3 : prom >= 80 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'diagnostico', leccion: R.id, puntaje: prom, estrellas: est, aprobada: aprob }, aprob ? 'ronda de diagnóstico' : 'diagnóstico');
    if (aprob) sfx.subir();
    zona.replaceChildren(el('div.panel', { style: { textAlign: 'center' } },
      el('div.mediano', `${prom}/100`), estrellas(est),
      el('div', aprob ? '✅ Ronda aprobada.' : '❌ Te faltó un poco: 70 para aprobar.'),
      el('div.fila.centro', el('button.btn', { onclick: () => ctx.rehacer() }, '↻ Otra ronda'), el('button.btn.prim', { onclick: () => ctx.volver() }, 'Volver'))));
  }
}

/** Color de la taza vista desde arriba: más claro si está diluido o poco extraído. */
function tazaColor(r) {
  const s = sabor(r);
  return el('div.fila',
    el('div', { style: { width: '54px', height: '54px', borderRadius: '50%', border: '5px solid #f6eedb', background: `radial-gradient(circle, ${mezcla('#d9a866', '#7a4520', limitar(r.tds / 12, 0, 1))}, ${mezcla('#b5793f', '#3b1a0c', limitar(r.tds / 12, 0, 1))})` }, title: 'crema' }),
    el('div', { style: { flex: 1, minWidth: '12em' } }, barras(s, ETIQUETAS_SABOR, { colores: COLORES_SABOR })));
}

function dibujarCurva(cv, e) {
  const s = crearShot({ ...RECETA_BASE, ...e.p });
  while (!s.terminado && s.enTaza < e.salida) s.paso(0.05);
  const { g, w, h } = ajustar(cv);
  g.fillStyle = '#0004'; g.fillRect(0, 0, w, h);
  const x0 = 26, y0 = 8, ww = w - x0 - 10, hh = h - y0 - 20;
  const tmax = Math.max(40, Math.ceil((s.t + 3) / 10) * 10);
  const X = t => x0 + (t / tmax) * ww;
  g.fillStyle = '#a99fc6'; g.font = '10px DotGothic16, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let t = 0; t <= tmax; t += 10) g.fillText(`${t}s`, X(t), y0 + hh + 4);
  const serie = (k, max, col) => {
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    s.historia.forEach((p, i) => { const y = y0 + hh - limitar(p[k] / max, 0, 1) * hh; i ? g.lineTo(X(p.t), y) : g.moveTo(X(p.t), y); });
    g.stroke();
  };
  serie('presion', 12, '#5b7bd5'); serie('caudal', 5, '#f2c14e'); serie('enTaza', 60, '#f6eedb');
  g.textAlign = 'left'; g.textBaseline = 'middle';
  [['presión', '#5b7bd5'], ['caudal', '#f2c14e'], ['en taza', '#f6eedb']].forEach(([t, col], i) => { g.fillStyle = col; g.fillText(t, x0 + 6, y0 + 8 + i * 13); });
}
