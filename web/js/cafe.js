// 喫茶店 Kissaten de Kenji: laboratorio de extracción, barra de pedidos, quiz, bitácora real y guía en vivo.
import { el, sfx, mezclar, elegir, esperar, toast, hoy, hablar } from './util.js';
import { P, ganarXP, evento, guardar, nivelDe } from './progreso.js';
import { abrir } from './actividad.js';
import { METODOS, MOLIENDA, extraer, diagnostico, INGREDIENTES, BEBIDAS, CLIENTES, QUIZ, GUIAS } from './datos/cafe.js';
import { parsear, renderTokens } from './jp/texto.js';
import { preguntar, IA } from './ia.js';
import { seccionAcademia } from './cafe/academia.js';

export function abrirCafeteria() {
  P.cafe.equipo ??= [];
  abrir('cafe', '喫茶店 Kissaten de Kenji', hub, { sub: 'café' });
}

const tengo = m => P.cafe.equipo.includes(m);

function hub(c, ctx) {
  const t = (ico, tit, desc, tag, fn) => el('button.tarjeta', { onclick: fn }, el('div.t-ico', ico), el('div.t-tit', tit), el('div.t-desc', desc), tag ? el('div.t-tag', tag) : null);
  const bit = P.cafe.bitacora || [];
  c.append(seccionAcademia(ctx), el('h3.ac-h3', '☕ El kissaten'), el('div.rejilla',
    t('🔬', 'Laboratorio', 'Jugá con molienda, ratio, temperatura y tiempo. Mirá cómo cambian la extracción y el sabor.', 'gráfico de control SCA', () => ctx.ir('Laboratorio de extracción', laboratorio)),
    t('🎯', 'Desafío de calibración', 'Kenji te da una receta que salió mal. Arreglala en 3 intentos.', 'como un barista de verdad', () => ctx.ir('Desafío de calibración', (cc, cx) => laboratorio(cc, cx, true))),
    t('🧾', 'La barra', 'Llegan clientes y piden cortados, flat whites, lágrimas… Armá cada bebida.', `${BEBIDAS.filter(b => b.nivel <= nivelBarra()).length}/${BEBIDAS.length} bebidas desbloqueadas`, () => ctx.ir('La barra', barra)),
    t('❓', 'Quiz barista', 'Orígenes, procesos, tueste, leche, agua y diagnóstico de sabor.', null, () => ctx.ir('Quiz barista', quiz)),
    t('⏲️', 'Preparar de verdad', 'Guía paso a paso con temporizador y voz para tu V60, prensa, moka…', null, () => ctx.ir('Preparar de verdad', guias)),
    t('📓', 'Bitácora', 'Anotá cada café real que hacés y cómo salió. Kenji te dice qué ajustar.', `${bit.length} cafés registrados`, () => ctx.ir('Bitácora', bitacora)),
    t('🧰', 'Mi equipo', 'Qué cafeteras tenés en casa (adapta todo a tu equipo).', P.cafe.equipo.map(m => METODOS[m]?.ico).join(' ') || 'sin elegir', () => ctx.ir('Mi equipo', equipo)),
  ));
}

function equipo(c, ctx) {
  P.cafe.extras ??= {};
  c.append(
    el('div', '¿Qué tenés en casa?'),
    el('div.chips', Object.entries(METODOS).map(([k, m]) => el('button.chip' + (tengo(k) ? '.sel' : ''), {
      onclick: () => { P.cafe.equipo = tengo(k) ? P.cafe.equipo.filter(x => x !== k) : [...P.cafe.equipo, k]; guardar(); ctx.rehacer(); },
    }, `${m.ico} ${m.n}`))),
    el('div', 'Accesorios'),
    el('div.chips', [['molinillo', '⚙️ Molinillo'], ['balanza', '⚖️ Balanza'], ['termometro', '🌡️ Pava con temperatura'], ['vaporizador', '🥛 Vaporizador / espumador']].map(([k, n]) =>
      el('button.chip' + (P.cafe.extras[k] ? '.sel' : ''), { onclick: () => { P.cafe.extras[k] = !P.cafe.extras[k]; guardar(); ctx.rehacer(); } }, n))),
    el('div.panel.suave', consejoEquipo()),
  );
}
function consejoEquipo() {
  const x = P.cafe.extras || {};
  if (!x.balanza) return '💡 La compra que más mejora tu café: una balanza de cocina con 0.1 g (o 1 g). Medir con cuchara varía ±30 %.';
  if (!x.molinillo) return '💡 Con café ya molido no podés ajustar la molienda: compralo molido para tu método y corregí con tiempo y temperatura. Un molinillo manual de muelas es la mejor inversión siguiente.';
  if (!x.termometro) return '💡 Sin termómetro: dejá reposar el agua 30–45 s después de hervir y queda ~93 °C.';
  return '💡 Tenés todo para calibrar en serio. Cambiá UNA variable por vez y anotá en la bitácora.';
}

// ---------- Laboratorio ----------
const fmtT = s => s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function recetaRota(metodo) {
  const M = METODOS[metodo];
  const p = { ...M.def };
  const fallas = M.espresso
    ? [['molienda', 3.2, 'Salió en 12 segundos, agrio y aguado.'], ['molienda', 1.1, 'Tardó una eternidad y salió amarguísimo.'], ['salida', 70, 'Salió largo, aguado y amargo al final.']]
    : M.moka ? [['fuego', 'alto', 'Sabe a quemado y amargo.'], ['molienda', 6, 'Salió aguado y ácido.']]
      : [['molienda', Math.min(M.rango.molienda[1], M.def.molienda + 3), 'El cliente dice que está agrio y aguado.'],
        ['molienda', Math.max(M.rango.molienda[0], M.def.molienda - 2.5), 'El cliente dice que está amargo y le seca la boca.'],
        ['agua', Math.round(M.def.agua * 1.45), 'El cliente dice que está aguado, como "agua sucia".'],
        ['temp', M.frio ? 93 : 80, 'Le falta dulzor, está ácido.']].filter(f => !(M.frio && f[0] === 'temp'));
  const [k, v, queja] = elegir(fallas);
  p[k] = v;
  return { p, queja };
}

function laboratorio(c, ctx, desafio = false) {
  let metodo = P.cafe.labMetodo && METODOS[P.cafe.labMetodo] ? P.cafe.labMetodo : (P.cafe.equipo[0] || 'v60');
  let p = { ...METODOS[metodo].def };
  let intentos = 0, reto = null;
  const historia = [];
  if (desafio) { reto = recetaRota(metodo); p = { ...reto.p }; }

  const izq = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
  const der = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' } });
  const chart = el('canvas', { style: { width: '100%', height: 'calc(var(--px) * 52)' } });
  const resultado = el('div.panel', { style: { width: '100%' } }, el('div.suave', desafio ? `🧑‍🍳 Kenji: "${reto.queja} Arreglalo: tenés 3 intentos."` : 'Ajustá la receta y apretá Preparar.'));
  c.append(
    el('div.chips', Object.entries(METODOS).map(([k, m]) => el('button.chip' + (k === metodo ? '.sel' : ''), {
      onclick: () => { P.cafe.labMetodo = k; guardar(); ctx.rehacer(); },
    }, `${m.ico} ${m.n}${tengo(k) ? ' ✓' : ''}`))),
    el('div.dos-col', izq, der));
  der.append(chart, resultado);

  function slider(clave, etiqueta, min, max, paso, fmt) {
    const val = el('span.val', fmt(p[clave]));
    const inp = el('input', { type: 'range', min, max, step: paso, value: p[clave] });
    inp.addEventListener('input', () => { p[clave] = +inp.value; val.textContent = fmt(p[clave]); actualizarRatio(); });
    return el('div.slider', el('span', etiqueta), inp, val);
  }
  const ratioTxt = el('div.suave');
  const actualizarRatio = () => {
    const M = METODOS[metodo];
    ratioTxt.textContent = M.espresso ? `ratio 1:${(p.salida / p.dosis).toFixed(1)}` : `ratio 1:${(p.agua / p.dosis).toFixed(1)}`;
  };
  const M = METODOS[metodo], R = M.rango;
  izq.append(slider('dosis', 'Café', R.dosis[0], R.dosis[1], 0.5, v => `${v} g`));
  if (M.espresso) izq.append(slider('salida', 'En taza', R.salida[0], R.salida[1], 1, v => `${v} g`));
  else izq.append(slider('agua', 'Agua', R.agua[0], R.agua[1], 5, v => `${v} g`));
  izq.append(ratioTxt);
  izq.append(slider('molienda', 'Molienda', R.molienda[0], R.molienda[1], M.espresso ? 0.1 : 0.5, v => M.espresso ? `${v.toFixed(1)}` : `${v}`),
    el('div.suave', { style: { fontSize: '.7em' } }, '1 = extra fina · 5 = media · 10 = extra gruesa'));
  if (R.temp) izq.append(slider('temp', 'Agua a', R.temp[0], R.temp[1], 1, v => `${v} °C`));
  if (R.tiempo) izq.append(slider('tiempo', 'Tiempo', R.tiempo[0], R.tiempo[1], 5, fmtT));
  if (R.horas) izq.append(slider('horas', 'Reposo', R.horas[0], R.horas[1], 1, v => `${v} h`));
  if (M.moka) izq.append(el('div.fila', 'Fuego', el('div.chips', ['bajo', 'medio', 'alto'].map(f => el('button.chip' + (p.fuego === f ? '.sel' : ''), { onclick: e => { p.fuego = f; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); } }, f)))));
  if (!M.espresso && !M.moka) izq.append(el('div.fila', 'Revolver', el('div.chips', ['nada', 'un poco', 'bastante'].map((f, i) => el('button.chip' + ((p.agitacion ?? 1) === i ? '.sel' : ''), { onclick: e => { p.agitacion = i; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); } }, f)))));
  const boton = el('button.btn.prim', { onclick: preparar }, '☕ Preparar');
  izq.append(el('div.fila', boton,
    el('button.btn', { onclick: () => { p = { ...METODOS[metodo].def }; ctx.rehacer(); } }, 'Receta base'),
    GUIAS[metodo] ? el('button.btn', { onclick: () => ctx.ir('Preparar de verdad', (cc, cx) => guiaVivo(cc, cx, metodo, p)) }, '⏲️ Hacerlo de verdad') : null));
  actualizarRatio();

  function dibujarChart() {
    const W = chart.clientWidth, H = chart.clientHeight;
    chart.width = W * devicePixelRatio; chart.height = H * devicePixelRatio;
    const g = chart.getContext('2d');
    g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const [tmin, tmax] = METODOS[metodo].tds;
    const x0 = 34, y0 = 8, w = W - x0 - 8, h = H - y0 - 26;
    const eyMin = 12, eyMax = 28, tdsMin = tmin * 0.55, tdsMax = tmax * 1.45;
    const X = ey => x0 + (ey - eyMin) / (eyMax - eyMin) * w;
    const Y = t => y0 + h - (t - tdsMin) / (tdsMax - tdsMin) * h;
    g.fillStyle = '#0003'; g.fillRect(x0, y0, w, h);
    g.fillStyle = '#4caf6a33'; g.fillRect(X(18), Y(tmax), X(22) - X(18), Y(tmin) - Y(tmax));
    g.strokeStyle = '#4caf6a'; g.strokeRect(X(18), Y(tmax), X(22) - X(18), Y(tmin) - Y(tmax));
    g.fillStyle = '#d6c2a6'; g.font = '11px DotGothic16'; g.textBaseline = 'top';
    g.fillText('agrio', x0 + 4, y0 + h / 2); g.textAlign = 'right'; g.fillText('amargo', x0 + w - 4, y0 + h / 2);
    g.textAlign = 'center'; g.fillText('fuerte', X(20), y0 + 2); g.fillText('aguado', X(20), y0 + h - 14);
    g.fillText('extracción % →', x0 + w / 2, y0 + h + 10);
    for (const ey of [14, 18, 22, 26]) g.fillText(ey, X(ey), y0 + h + 1);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const t of [tmin, tmax]) g.fillText(t.toFixed(t < 2 ? 2 : 1), x0 - 3, Y(t));
    g.textAlign = 'left';
    historia.forEach((r, i) => {
      const x = Math.max(x0, Math.min(x0 + w, X(r.ey))), y = Math.max(y0, Math.min(y0 + h, Y(r.tds)));
      if (i > 0) {
        const a = historia[i - 1];
        g.strokeStyle = '#ffffff44'; g.beginPath();
        g.moveTo(Math.max(x0, Math.min(x0 + w, X(a.ey))), Math.max(y0, Math.min(y0 + h, Y(a.tds)))); g.lineTo(x, y); g.stroke();
      }
      g.fillStyle = i === historia.length - 1 ? '#f2c14e' : '#d39a62';
      g.beginPath(); g.arc(x, y, i === historia.length - 1 ? 6 : 4, 0, 7); g.fill();
    });
  }

  function taza(tds) {
    const [tmin, tmax] = METODOS[metodo].tds;
    const f = Math.max(0, Math.min(1, (tds - tmin * 0.5) / (tmax * 1.5 - tmin * 0.5)));
    const col = `rgb(${Math.round(160 - f * 120)},${Math.round(100 - f * 70)},${Math.round(60 - f * 45)})`;
    return el('div', { html: `<svg class="taza" viewBox="0 0 48 48"><path d="M8 16h28v14a12 12 0 0 1-12 12h-4A12 12 0 0 1 8 30z" fill="#f6eedb"/><path d="M10 18h24v11a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z" fill="${col}"/><path d="M36 20h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#f6eedb" stroke-width="3"/><path d="M17 6c0 4 4 4 4 8M25 4c0 4 4 4 4 8" stroke="#ffffff66" stroke-width="2" fill="none"/></svg>` });
  }

  async function preparar() {
    boton.disabled = true;
    resultado.replaceChildren(el('div.escribiendo-ia', 'preparando'));
    await esperar(900);
    boton.disabled = false;
    const r = extraer(metodo, p);
    const d = diagnostico(metodo, r);
    historia.push(r);
    intentos++;
    evento('brew_lab');
    if (d.perfecto) { evento('brew_perfecto'); sfx.bien(); }
    const M = METODOS[metodo];
    resultado.replaceChildren(
      el('div.fila', taza(r.tds), el('div',
        el('div.mediano', { style: { fontSize: '1.3em' } }, `${d.puntaje}/100`),
        el('div.estrellas', '★'.repeat(Math.round(d.puntaje / 20)) + '☆'.repeat(5 - Math.round(d.puntaje / 20))))),
      el('div', `Extracción ${r.ey.toFixed(1)} % · TDS ${r.tds.toFixed(2)} % · ${M.frio ? fmtT(r.tiempo) : M.espresso ? `${Math.round(r.tiempo)} s` : fmtT(r.tiempo)} · ${Math.round(r.bebida)} g en taza`),
      el('div', `👅 ${d.sabores.join(' · ')}`),
      ...r.extra.map(x => el('div.no', `⚠️ ${x}`)),
      d.consejos.length ? el('div', `🧑‍🍳 Kenji: ${d.consejos.join('; ')}.`) : el('div.ok', '🧑‍🍳 Kenji: ¡Eso es! Así se calibra.'),
    );
    dibujarChart();
    if (desafio) {
      if (d.puntaje >= 90) {
        sfx.subir();
        ganarXP('cafe', 35 - intentos * 5, 'desafío superado');
        resultado.append(el('div.ok', `✅ ¡Lo arreglaste en ${intentos} intento${intentos > 1 ? 's' : ''}!`), el('button.btn.prim', { onclick: () => ctx.rehacer() }, 'Otro desafío'));
        boton.disabled = true;
      } else if (intentos >= 3) {
        ganarXP('cafe', 5, 'buen intento');
        const def = METODOS[metodo].def;
        resultado.append(el('div.no', '❌ Se acabaron los intentos.'), el('div.suave', `Receta de referencia: ${Object.entries(def).map(([k, v]) => `${k} ${v}`).join(', ')}`),
          el('button.btn.prim', { onclick: () => ctx.rehacer() }, 'Otro desafío'));
        boton.disabled = true;
      } else resultado.append(el('div.suave', `Intento ${intentos}/3`));
    } else ganarXP('cafe', d.perfecto ? 8 : 4);
  }
  requestAnimationFrame(dibujarChart);
}

// ---------- Barra ----------
const nivelBarra = () => Math.min(4, 1 + Math.floor((nivelDe(P.skills.cafe.xp) - 1) / 2));

function barra(c, ctx) {
  const disponibles = BEBIDAS.filter(b => b.nivel <= nivelBarra());
  const turno = Array.from({ length: 5 }, () => ({ bebida: elegir(disponibles), cliente: elegir(CLIENTES) }));
  let i = 0, buenos = 0;
  const vaso = {};
  const pedido = el('div.panel');
  const tazaNodo = el('div', { style: { width: 'calc(var(--px) * 34)', height: 'calc(var(--px) * 46)', border: '3px solid var(--crema)', borderTop: 'none', borderRadius: '0 0 18px 18px', display: 'flex', flexDirection: 'column-reverse', overflow: 'hidden', background: '#0003', position: 'relative' } });
  const listaVaso = el('div.suave', { style: { fontSize: '.75em', textAlign: 'center' } });
  const controles = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' } });
  const recetario = el('div.panel.oculto', { style: { fontSize: '.75em' } }, disponibles.map(b => el('div', el('b', b.n), ': ', b.desc, el('span.suave', ` (${Object.entries(b.req).map(([k, [a, z]]) => `${INGREDIENTES.find(x => x.id === k).n} ${a === z ? a : a + '–' + z}`).join(', ')})`))));
  const acciones = el('div.fila',
    el('button.btn.prim', { onclick: servir }, '🛎️ Servir'),
    el('button.btn', { onclick: () => { for (const k in vaso) delete vaso[k]; pintarVaso(); } }, '🗑️ Tirar'),
    el('button.btn', { onclick: () => recetario.classList.toggle('oculto') }, '📋 Recetario'));
  c.append(pedido, el('div.dos-col', controles, el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' } }, tazaNodo, listaVaso)), acciones, recetario);

  INGREDIENTES.forEach(ing => {
    const cant = el('span', { style: { minWidth: '3em', textAlign: 'center' } });
    const fila = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.78em' } },
      el('span', { style: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, `${ing.ico} ${ing.n}`),
      el('button.btn.chico', { onclick: () => { vaso[ing.id] = Math.max(0, (vaso[ing.id] || 0) - ing.paso); pintarVaso(); } }, '−'), cant,
      el('button.btn.chico', { onclick: () => { vaso[ing.id] = Math.min(ing.max, (vaso[ing.id] || 0) + ing.paso); sfx.cursor(); pintarVaso(); } }, '+'));
    fila.dataset.id = ing.id;
    controles.append(fila);
  });

  function pintarVaso() {
    const capas = INGREDIENTES.filter(x => vaso[x.id] > 0).map(x => ({ x, ml: vaso[x.id] * x.ml }));
    const total = Math.max(240, capas.reduce((s, c2) => s + c2.ml, 0));
    tazaNodo.replaceChildren(...capas.map(({ x, ml }) => el('div', { title: x.n, style: { height: ml / total * 100 + '%', background: x.color, borderTop: '1px solid #0002' } })));
    listaVaso.textContent = capas.map(({ x }) => `${x.ico} ${vaso[x.id]}${['agua', 'leche', 'fria'].includes(x.id) ? ' ml' : x.id === 'espuma' ? ' cm' : ''}`).join(' · ') || 'vaso vacío';
    controles.querySelectorAll('[data-id]').forEach(f => { f.children[2].textContent = vaso[f.dataset.id] || 0; });
  }

  function mostrarPedido() {
    for (const k in vaso) delete vaso[k];
    pintarVaso();
    if (i >= turno.length) {
      const xp = buenos * 2 + 5;
      ganarXP('cafe', xp, 'turno en la barra');
      pedido.replaceChildren(el('div.mediano', `Fin del turno: ${buenos}/${turno.length} clientes felices`), el('button.btn.prim', { onclick: () => ctx.rehacer() }, 'Otro turno'));
      acciones.classList.add('oculto');
      return;
    }
    const { bebida, cliente } = turno[i];
    const enJapones = bebida.ja && P.jp.nivel && (P.jp.nivel !== 'cero' || Math.random() < 0.3);
    pedido.replaceChildren(el('div.suave', `Cliente ${i + 1}/${turno.length} · ${cliente}`));
    if (enJapones) {
      const r = renderTokens(parsear(bebida.ja + '。'), { furigana: P.jp.furigana, romaji: P.jp.romaji });
      pedido.append(el('div.mediano', { style: { fontSize: '1.2em' } }, '「', r.nodo, '」'), r.romajiNodo, el('div.suave', '(¡pide en japonés! tocá las palabras)'));
      hablar(r.nodo.textContent);
    } else {
      pedido.append(el('div.mediano', { style: { fontSize: '1.2em' } }, `"${elegir(['Hola, ¿me hacés un', 'Buenas, quiero un', 'Un', 'Para llevar: un', '¿Me preparás un'])} ${bebida.n.toLowerCase()}${elegir([', porfa?', '?', ', gracias.', '.'])}"`));
    }
  }

  async function servir() {
    const { bebida, cliente } = turno[i];
    const errores = [];
    for (const ing of INGREDIENTES) {
      const v = vaso[ing.id] || 0;
      const req = bebida.req[ing.id];
      const u = ['agua', 'leche', 'fria'].includes(ing.id) ? ' ml' : ing.id === 'espuma' ? ' cm' : '';
      if (req && (v < req[0] || v > req[1])) errores.push(`${ing.n}: pusiste ${v}${u}, va ${req[0] === req[1] ? req[0] : `${req[0]}–${req[1]}`}${u}`);
      if (!req && v > 0) errores.push(`${ing.n}: no lleva`);
    }
    if (!errores.length) {
      buenos++; sfx.bien(); evento('pedido_ok');
      ganarXP('cafe', 5);
      pedido.replaceChildren(el('div.ok.mediano', `😊 ${cliente}: "¡Perfecto!"`), el('div.suave', `${bebida.n}: ${bebida.desc}`));
    } else {
      sfx.mal();
      pedido.replaceChildren(el('div.no.mediano', `😕 ${cliente}: "Mmm… esto no es un ${bebida.n.toLowerCase()}."`), ...errores.map(e => el('div.suave', `· ${e}`)), el('div', `📋 ${bebida.n}: ${bebida.desc}`));
    }
    acciones.classList.add('oculto');
    await esperar(errores.length ? 3800 : 1800);
    acciones.classList.remove('oculto');
    i++;
    mostrarPedido();
  }
  mostrarPedido();
}

// ---------- Quiz ----------
async function quiz(c, ctx) {
  let preguntas = mezclar(QUIZ).slice(0, 8);
  const zona = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' } });
  c.append(zona);
  if (IA.disponible && Math.random() < 0.6) {
    zona.append(el('div.suave.escribiendo-ia', 'Kenji está pensando preguntas nuevas'));
    const r = await preguntar('Sos un barista experto y profesor (Q-grader). Respondés SOLO JSON válido en castellano rioplatense.', [{ role: 'user', content:
      `Inventá 4 preguntas de opción múltiple (4 opciones) sobre café, nivel ${nivelDe(P.skills.cafe.xp) < 4 ? 'principiante' : 'intermedio'}: preparación, extracción, molienda, orígenes, procesos, leche o cata. Distintas de estas: ${QUIZ.slice(0, 6).map(q => q.p).join(' | ')}. Datos correctos y verificables.
{"preguntas":[{"p":"pregunta","o":["correcta","b","c","d"],"ok":0,"e":"explicación corta"}]}` }], { json: true, temperatura: 0.9, max_tokens: 1500 });
    if (Array.isArray(r?.preguntas)) preguntas = mezclar([...r.preguntas.filter(q => q.p && q.o?.length === 4).slice(0, 4), ...preguntas.slice(0, 4)]);
  }
  let i = 0, ok = 0;
  function sig() {
    if (i >= preguntas.length) {
      ganarXP('cafe', ok * 3 + 2, 'quiz');
      zona.replaceChildren(el('div.mediano', `${ok}/${preguntas.length}`), el('button.btn.prim', { onclick: () => ctx.rehacer() }, 'Otra ronda'));
      return;
    }
    const q = preguntas[i++];
    const ops = mezclar(q.o.map((o, n) => ({ o, bien: n === +q.ok })));
    zona.replaceChildren(el('div.suave', `${i}/${preguntas.length}`), el('div', { style: { fontSize: '1.2em', maxWidth: '40em' } }, q.p),
      el('div.opciones4', { style: { width: '100%' } }, ops.map(x => el('button.btn', { style: { fontSize: '.85em' }, onclick: async e => {
        zona.querySelectorAll('.opciones4 button').forEach((b, n) => { b.disabled = true; if (ops[n].bien) b.classList.add('correcta'); });
        if (x.bien) { ok++; sfx.bien(); evento('quiz_cafe_ok'); } else { sfx.mal(); e.currentTarget.classList.add('incorrecta'); }
        zona.append(el('div.suave', `💡 ${q.e || ''}`), el('button.btn.prim', { onclick: sig }, 'Siguiente ▶'));
      } }, x.o))));
  }
  sig();
}

// ---------- Guía en vivo ----------
function guias(c, ctx) {
  const orden = [...P.cafe.equipo.filter(m => GUIAS[m]), ...Object.keys(GUIAS).filter(m => !tengo(m))];
  c.append(el('div.suave', 'Elegí tu método. La guía te avisa con voz y pitido en cada paso (dejá la compu cerca de la pava).'),
    el('div.rejilla', orden.map(m => el('button.tarjeta', { onclick: () => ctx.ir(GUIAS[m].n, (cc, cx) => guiaVivo(cc, cx, m)) },
      el('div.t-ico', METODOS[m].ico), el('div.t-tit', GUIAS[m].n), el('div.t-desc', METODOS[m].n), tengo(m) ? el('div.t-tag', 'lo tenés') : null))));
}

function guiaVivo(c, ctx, metodo, recetaLab = null) {
  const G = GUIAS[metodo];
  const receta = { ...G.receta, ...(recetaLab || {}) };
  const escala = recetaLab && G.receta.agua && recetaLab.agua ? recetaLab.agua / G.receta.agua : recetaLab && G.receta.salida && recetaLab.salida ? recetaLab.salida / G.receta.salida : 1;
  const ajustar = txt => escala === 1 ? txt : txt.replace(/(\d+) g/g, (m, n) => `${Math.round(n * escala)} g`);
  let t0 = null, reloj = null, ultimoPaso = -1;
  const vT = el('div.grande', { style: { fontSize: 'calc(var(--px) * 18)' } }, '0:00');
  const lista = el('ol', { style: { lineHeight: 1.7, paddingLeft: '1.3em' } }, G.pasos.map(([s, txt, g]) =>
    el('li', el('span.suave', `${fmtT(s)} `), ajustar(txt), g ? el('b', { style: { color: 'var(--oro)' } }, ` → ${Math.round(g * escala)} g`) : '')));
  const btn = el('button.btn.prim', { onclick: alternar }, '▶ Empezar');
  c.append(
    el('div.panel', el('div', 'Antes de empezar:'), el('ul', { style: { margin: '6px 0', lineHeight: 1.6 } }, G.antes.map(a => el('li', el('label', el('input', { type: 'checkbox' }), ' ', ajustar(a)))))),
    el('div.fila', vT, btn, el('button.btn', { onclick: () => registrar() }, '📓 Anotar en la bitácora')),
    lista);
  function alternar() {
    if (reloj) { clearInterval(reloj); reloj = null; btn.textContent = '▶ Reiniciar'; return; }
    t0 = Date.now(); ultimoPaso = -1;
    btn.textContent = '■ Parar';
    reloj = setInterval(tick, 250);
    tick();
  }
  function tick() {
    const s = (Date.now() - t0) / 1000;
    vT.textContent = fmtT(s);
    let paso = -1;
    G.pasos.forEach(([ini], k) => { if (s >= ini) paso = k; });
    [...lista.children].forEach((li, k) => { li.style.color = k === paso ? 'var(--oro)' : k < paso ? '#8d84aa' : ''; li.style.fontSize = k === paso ? '1.15em' : ''; });
    if (paso !== ultimoPaso) {
      ultimoPaso = paso;
      sfx.aceptar();
      hablar(ajustar(G.pasos[paso][1]).replace(/→/g, ''), 'es', 1);
      if (paso === G.pasos.length - 1) { clearInterval(reloj); reloj = null; btn.textContent = '▶ Reiniciar'; }
    }
  }
  function registrar() {
    ctx.ir('Bitácora', (cc, cx) => bitacora(cc, cx, { metodo, ...receta, tiempo: t0 ? Math.round((Date.now() - t0) / 1000) : null }));
  }
  return () => { clearInterval(reloj); speechSynthesis?.cancel(); };
}

// ---------- Bitácora real ----------
function bitacora(c, ctx, previo = null) {
  P.cafe.bitacora ??= [];
  const f = { metodo: previo?.metodo || P.cafe.equipo[0] || 'v60', cafe: P.cafe.ultimoGrano || '', dosis: previo?.dosis || '', agua: previo?.agua || previo?.salida || '', molienda: previo?.molienda || '', tiempo: previo?.tiempo || '',
    acidez: 3, amargor: 3, dulzor: 3, cuerpo: 3, nota: 3, comentario: '' };
  const campo = (k, ph, w = '6em') => {
    const i = el('input.entrada', { value: f[k], placeholder: ph, style: { width: w } });
    i.addEventListener('input', () => { f[k] = i.value; });
    i.addEventListener('keydown', e => e.stopPropagation());
    return i;
  };
  const escala = (k, n) => el('div.slider', el('span', n), (() => {
    const i = el('input', { type: 'range', min: 1, max: 5, step: 1, value: f[k] });
    const v = el('span.val', ['', 'muy bajo', 'bajo', 'medio', 'alto', 'muy alto'][f[k]]);
    i.addEventListener('input', () => { f[k] = +i.value; v.textContent = ['', 'muy bajo', 'bajo', 'medio', 'alto', 'muy alto'][f[k]]; });
    setTimeout(() => i.parentNode.append(v));
    return i;
  })());
  const salida = el('div');
  c.append(
    el('div.panel',
      el('div.chips', Object.entries(METODOS).map(([k, m]) => el('button.chip' + (f.metodo === k ? '.sel' : ''), { onclick: e => { f.metodo = k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); } }, `${m.ico} ${m.n}`))),
      el('div.fila', { style: { marginTop: '10px' } }, campo('cafe', 'Café (ej: Colombia lavado, tueste medio)', '18em'), campo('dosis', 'g café'), campo('agua', 'g agua/taza'), campo('molienda', 'molienda'), campo('tiempo', 'seg'))),
    el('div.panel', el('div', '¿Cómo salió?'), escala('acidez', 'Acidez'), escala('amargor', 'Amargor'), escala('dulzor', 'Dulzor'), escala('cuerpo', 'Intensidad'), escala('nota', 'Me gustó'),
      campo('comentario', 'Notas (sabores, qué cambiaste…)', '100%')),
    el('div.fila', el('button.btn.prim', { onclick: guardarEntrada }, '✔ Guardar y pedir consejo')),
    salida,
    P.cafe.bitacora.length ? el('div.panel', el('div', 'Tus últimos cafés'), el('table.tabla',
      el('tr', el('th', 'día'), el('th', 'método'), el('th', 'receta'), el('th', '★'), el('th', 'consejo')),
      P.cafe.bitacora.slice(0, 8).map(b => el('tr', el('td', b.fecha.slice(5)), el('td', METODOS[b.metodo]?.ico || ''), el('td', `${b.dosis}g/${b.agua}g m${b.molienda}`), el('td', '★'.repeat(b.nota)), el('td.suave', b.consejo || ''))))) : null,
  );

  function reglas(b) {
    const out = [];
    if (b.acidez >= 4 && b.dulzor <= 2) out.push('acidez alta sin dulzor = subextraído → molé un poco más fino (o +2 °C / +20 s)');
    if (b.amargor >= 4) out.push('amargo = sobreextraído o tueste muy oscuro → molé más grueso o bajá la temperatura');
    if (b.cuerpo <= 2) out.push('poca intensidad → subí la dosis 1–2 g con la misma agua');
    if (b.cuerpo >= 5 && b.amargor >= 3) out.push('demasiado intenso → más agua o menos café');
    if (!out.length) out.push(b.nota >= 4 ? 'está muy bien: repetí exactamente esta receta 2 veces para fijarla' : 'cambiá una sola variable por vez (primero la molienda) y anotá');
    return out.join('; ');
  }

  async function guardarEntrada() {
    const b = { ...f, fecha: hoy(), dosis: +f.dosis || f.dosis, agua: +f.agua || f.agua };
    b.consejo = reglas(b);
    P.cafe.ultimoGrano = f.cafe;
    P.cafe.bitacora.unshift(b);
    P.cafe.bitacora = P.cafe.bitacora.slice(0, 300);
    evento('bitacora');
    ganarXP('cafe', 20, 'café real anotado');
    salida.replaceChildren(el('div.panel', el('div', `🧑‍🍳 Kenji: ${b.consejo}.`)));
    if (IA.disponible) {
      const nota = el('div.suave.escribiendo-ia', 'Kenji lo está pensando mejor');
      salida.firstChild.append(nota);
      const prev = P.cafe.bitacora.slice(1, 5).map(x => `${x.fecha} ${x.metodo} ${x.dosis}g/${x.agua}g molienda ${x.molienda} t${x.tiempo}s acidez${x.acidez} amargor${x.amargor} dulzor${x.dulzor} intensidad${x.cuerpo} gustó${x.nota}/5 "${x.comentario}"`).join('\n');
      const r = await preguntar('Sos Kenji, un barista japonés buena onda que enseña en castellano rioplatense. Respuestas cortas, concretas, con números.', [{ role: 'user', content:
        `Mi café de hoy: ${METODOS[b.metodo].n}, café "${b.cafe}", ${b.dosis} g de café, ${b.agua} g de agua (o salida), molienda ${b.molienda}, tiempo ${b.tiempo} s. Sabor (1-5): acidez ${b.acidez}, amargor ${b.amargor}, dulzor ${b.dulzor}, intensidad ${b.cuerpo}. Me gustó ${b.nota}/5. Notas: "${b.comentario}". Equipo: ${(P.cafe.equipo || []).join(', ')}; accesorios: ${Object.keys(P.cafe.extras || {}).filter(k => P.cafe.extras[k]).join(', ') || 'ninguno'}.
Anteriores:\n${prev || 'ninguno'}\nDecime en máximo 3 líneas: qué pasó y qué UNA cosa cambiar mañana (con número concreto).` }], { max_tokens: 400 });
      nota.remove();
      if (r) { b.consejo = r.replace(/\n+/g, ' '); salida.firstChild.replaceChildren(el('div', `🧑‍🍳 Kenji: ${r}`)); guardar(); }
    }
  }
}
