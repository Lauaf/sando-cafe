// Minijuego 2 — Prepará el pedido: taza, shots, vaporizado de leche y vertido, en el orden que corresponda.
import { el, sfx, limitar } from '../util.js';
import { evento } from '../progreso.js';
import { RECETA_BASE, crearShot, evaluar, OBJETIVOS } from './modelo-espresso.js';
import { RECETAS, TAZAS, capas } from './modelo-bebidas.js';
import { crearJarra, pasoJarra, resultadoLeche, POSICIONES } from './modelo-leche.js';
import { generarPedido, evaluarPedido, recetaDelPedido, servirDeJarra, TEMP_PEDIDO, CON_LECHE } from './modelo-pedido.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { intro, estrellas, svgTaza, arrastrarParaVerter, mantener, bucle, ajustar, lienzo, siseo, zumbido, mezcla, menosMovimiento, barras } from './vista.js';

export const LECCIONES_PEDIDO = [
  { id: 'ped-1', t: 'Sin leche', recetas: ['espresso', 'americano', 'doppio'], aprender: 'Sacá cada shot cortando cerca de 30–40 g. El americano es espresso + agua caliente: primero el café, después el agua.' },
  { id: 'ped-2', t: 'Leche sedosa', recetas: ['cortado', 'flatwhite', 'latte'], aprender: 'Para poca espuma, aireá apenas 2–4 s con la punta en la superficie y después hundila: el remolino da microespuma. Pará entre 55 y 65 °C.' },
  { id: 'ped-3', t: 'Mucha espuma', recetas: ['capuchino', 'macchiato', 'capuchino'], aprender: 'Para un cappuccino aireá más tiempo (8–10 s) mientras la leche está fría. Aireá tarde y salen burbujas grandes.' },
  { id: 'ped-4', t: 'El orden importa', recetas: ['lattemacchiato', 'longblack', 'americano'], aprender: 'En el latte macchiato y el long black el espresso va al final, sobre la leche o el agua.' },
  { id: 'ped-5', t: 'Pedidos con detalles', recetas: ['capuchino', 'latte', 'cortado', 'flatwhite', 'americano', 'macchiato'], detalles: true, aprender: 'Doble = dos shots. Tibio ≈ 50 °C, bien caliente ≈ 68 °C (arriba de 70 °C la leche pierde dulzor).' },
];

export function hubPedido(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'En la barra no alcanza con saber la receta: hay que elegir la taza, sacar bien el shot, vaporizar la leche a la textura y temperatura justas y armar todo en el orden correcto.',
      meta: 'Cada lección trae 3 pedidos. Se evalúa exactitud (proporciones), técnica (shot y leche), orden y presentación.' }),
    el('div.ac-lecciones', LECCIONES_PEDIDO.map((L, i) => {
      const abierta = desbloqueada(a, LECCIONES_PEDIDO, L.id);
      const reg = a.lecciones[L.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), { disabled: !abierta, onclick: () => ctx.ir(L.t, (cc, cx) => barra(cc, cx, L)) },
        el('span.n', String(i + 1)), el('span.t', L.t), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nueva' : '🔒'));
    })),
    el('button.tarjeta', { onclick: () => ctx.ir('Barra libre', (cc, cx) => barra(cc, cx, { id: 'libre', t: 'Barra libre', recetas: Object.keys(RECETAS), detalles: true, libre: true })) },
      el('div.t-ico', '🧾'), el('div.t-tit', 'Barra libre'), el('div.t-desc', 'Pedidos al azar de todo el menú, sin límite.')),
  );
}

function barra(c, ctx, L) {
  const pedidos = Array.from({ length: L.libre ? 1 : 3 }, () => generarPedido(Math.random, L.recetas, { detalles: !!L.detalles }));
  let iP = 0;
  const puntos = [];
  let s;           // estado de la preparación actual
  let shot = null, jarra = null, vapor = false, posicion = 'hundida', sVapor = null, sAgua = null, pararBomba = () => {};
  let retener = false;

  const ticket = el('div.panel.ac-ticket');
  const vaso = el('div.ac-taza');
  const etiqueta = el('div.suave');
  const feedback = el('div', { 'aria-live': 'polite' });
  const estaciones = el('div.ac-estaciones');
  const tabs = el('div.chips', { role: 'tablist' });
  const paneles = {};
  const ir = k => {
    for (const [kk, n] of Object.entries(paneles)) n.classList.toggle('oculto', kk !== k);
    tabs.querySelectorAll('.chip').forEach(b => b.classList.toggle('sel', b.dataset.k === k));
  };
  for (const [k, t] of [['taza', '🍵 Taza'], ['espresso', '☕ Espresso'], ['leche', '🥛 Leche'], ['agua', '♨️ Agua']]) {
    tabs.append(el('button.chip', { role: 'tab', 'data-k': k, onclick: () => ir(k) }, t));
  }

  // --- Taza ---
  const panelTaza = el('div.panel', el('div.suave', 'Elegí el recipiente (antes de servir nada).'),
    el('div.chips', Object.entries(TAZAS).map(([k, t]) => el('button.chip', { 'data-taza': k, onclick: () => { if (total() > 0) return; s.taza = k; pintar(); ir('espresso'); } }, `${t.n} · ${t.cap} ml`))));
  // --- Espresso ---
  const lcdShot = el('div.ac-lcd', '0.0 g · 0.0 s');
  const btnShot = el('button.btn.prim', { onclick: () => alternarShot() }, '▶ Sacar shot');
  const panelEsp = el('div.panel', el('div.suave', 'Receta de la casa: 18 g de café. Cortá cerca de 30–40 g por shot (un ristretto, 15–25 g). La simulación va a ×3.'),
    el('div.fila', btnShot, lcdShot), el('div.suave', 'El shot cae directo en la taza.'));
  // --- Leche ---
  const lecheFria = el('span.ac-lcd', '0 ml');
  const btnLlenar = mantener(el('button.btn', '🥛 Llenar jarra (mantener)'), { alIniciar: () => { llenando = true; }, alSoltar: () => { llenando = false; } });
  let llenando = false;
  const cvJarra = lienzo('ac-jarra', 'Jarra de leche: nivel, espuma y termómetro');
  const lecturaLeche = el('div.ac-lectura');
  const btnVapor = mantener(el('button.btn.prim', '♨️ Vapor (mantener)'), {
    alIniciar: () => { if (!jarra || jarra.leche <= 0) return; vapor = true; sVapor = siseo(0.02, 2400); },
    alSoltar: () => { vapor = false; sVapor?.parar(); sVapor = null; },
  });
  const posBtns = el('div.chips', Object.entries(POSICIONES).map(([k, x]) => el('button.chip' + (k === posicion ? '.sel' : ''), {
    'data-pos': k, title: x.desc, onclick: () => setPos(k),
  }, x.n)));
  const fuenteJarra = el('button.ac-fuente', { 'data-ico': '🫗', 'aria-label': 'Jarra: arrastrá sobre la taza para servir' }, el('span.ico', '🫗'), el('b', 'Servir leche'), el('span.suave', 'arrastrá a la taza'));
  const chkRetener = el('label.fila', el('input', { type: 'checkbox', onchange: e => { retener = e.target.checked; } }), 'Retener la espuma con cuchara');
  const btnCuchara = el('button.btn.chico', { onclick: () => { if (!jarra || !s.taza) return; const q = Math.min(15, jarra.espuma); jarra.espuma -= q; verterEnTaza('espuma', q); } }, '🥄 Cucharada de espuma');
  const btnTirar = el('button.btn.chico', { onclick: () => { jarra = null; s.lecheRes = null; } }, '🗑️ Vaciar jarra');
  const panelLeche = el('div.panel',
    el('div.fila', btnLlenar, lecheFria, btnTirar),
    el('div.ac-jarra-fila', cvJarra, el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '11em' } },
      el('div.suave', 'Posición de la punta (W/S o ↑/↓)'), posBtns, btnVapor, lecturaLeche)),
    el('div.fila', fuenteJarra, el('div', chkRetener, btnCuchara)));
  arrastrarParaVerter(fuenteJarra, {
    destino: () => vaso, color: '#f1e6d2',
    alEmpezar: () => {},
    alVerter: dt => { if (!jarra || !s.taza) return; const q = servirDeJarra(jarra, 38 * dt, retener); if (q.leche > 0.01) verterEnTaza('leche', q.leche); if (q.espuma > 0.01) verterEnTaza('espuma', q.espuma); },
  });
  // --- Agua ---
  const fuenteAgua = el('button.ac-fuente', { 'data-ico': '♨️', 'aria-label': 'Agua caliente: arrastrá sobre la taza o mantené Espacio' }, el('span.ico', '♨️'), el('b', 'Agua caliente'), el('span.suave', 'arrastrá a la taza'));
  arrastrarParaVerter(fuenteAgua, {
    destino: () => vaso, color: '#b98a5c',
    alEmpezar: () => { sAgua = siseo(0.008, 1200); }, alParar: () => { sAgua?.parar(); },
    alVerter: dt => { if (s.taza) verterEnTaza('agua', 45 * dt); },
  });
  const panelAgua = el('div.panel', el('div.suave', 'Agua caliente del grupo (≈ 90 °C).'), fuenteAgua);
  Object.assign(paneles, { taza: panelTaza, espresso: panelEsp, leche: panelLeche, agua: panelAgua });
  estaciones.append(tabs, panelTaza, panelEsp, panelLeche, panelAgua);

  const btnEntregar = el('button.btn.prim.ac-grande', { onclick: entregar }, '🛎️ Entregar');
  const btnReceta = el('button.btn.chico', { onclick: () => { s.ayuda = true; receta.classList.toggle('oculto'); } }, '📋 Receta');
  const receta = el('div.panel.oculto');
  c.append(intro({ aprender: L.aprender }), el('div.ac-banco',
    el('div.ac-col', ticket, el('div.ac-mesa', el('div.ac-mostrador', vaso, etiqueta), el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, btnEntregar, btnReceta, el('button.btn.chico', { onclick: () => nuevo(false) }, '🗑️ Empezar de nuevo'))), receta, feedback),
    el('div.ac-col', estaciones)));

  const total = () => Object.values(s.cont).reduce((a, b) => a + b, 0);
  const pedidoActual = () => (L.libre ? pedidos[0] : pedidos[iP]);
  function verterEnTaza(k, ml) {
    if (!s.taza || ml <= 0) return;
    if (s.orden[s.orden.length - 1] !== k) s.orden.push(k);
    s.cont[k] += ml;
  }
  function setPos(k) {
    posicion = k;
    posBtns.querySelectorAll('.chip').forEach(b => b.classList.toggle('sel', b.dataset.pos === k));
    sVapor?.set(k === 'alta' ? 0.04 : k === 'superficie' ? 0.03 : 0.018, k === 'alta' ? 4200 : k === 'superficie' ? 3000 : 1800);
  }
  const tecla = e => {
    if (paneles.leche.classList.contains('oculto')) return;
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { e.preventDefault(); setPos(posicion === 'hundida' ? 'superficie' : 'alta'); }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') { e.preventDefault(); setPos(posicion === 'alta' ? 'superficie' : 'hundida'); }
  };
  addEventListener('keydown', tecla);

  function alternarShot() {
    if (shot && !shot.terminado) { cortarShot(); return; }
    if (!s.taza) { feedback.replaceChildren(el('div.no', 'Primero elegí la taza.')); ir('taza'); return; }
    shot = crearShot({ ...RECETA_BASE });
    shot.vertido = 0;
    btnShot.textContent = '■ Cortar';
    pararBomba = zumbido(52, 0.02);
  }
  function cortarShot() {
    shot.cortar();
    pararBomba();
    const r = shot.resultado();
    const corto = pedidoActual().receta === 'ristretto';
    const ev = evaluar(r, corto ? { ...OBJETIVOS.ristretto, ratio: [15 / 18, 25 / 18] } : { ...OBJETIVOS.normale, ratio: [30 / 18, 40 / 18] });
    s.shots.push(ev.puntaje);
    btnShot.textContent = '▶ Sacar otro shot';
    feedback.replaceChildren(el('div.suave', `Shot: ${r.enTaza.toFixed(0)} g en ${r.tiempo.toFixed(0)} s → ${ev.puntaje >= 75 ? 'bien ✔' : ev.defectos.map(d => d.replace('_', ' ')).join(', ')}`));
    sfx.aceptar();
  }

  const reducido = menosMovimiento();
  let fase = 0;
  const parar = bucle(dt => {
    if (shot && !shot.terminado) {
      for (let n = Math.round((dt * 3) / 0.02); n > 0 && !shot.terminado; n--) shot.paso(0.02);
      const nuevo = shot.enTaza - shot.vertido;
      if (nuevo > 0) { verterEnTaza('espresso', nuevo); shot.vertido = shot.enTaza; }
      lcdShot.textContent = `${shot.enTaza.toFixed(1)} g · ${shot.t.toFixed(1)} s`;
      if (shot.t > 70) cortarShot();
    }
    if (llenando) { jarra ??= crearJarra(0); if (jarra.tVapor === 0) jarra.leche = Math.min(400, jarra.leche + 90 * dt); }
    if (jarra) {
      pasoJarra(jarra, dt, vapor, posicion);
      s.lecheRes = resultadoLeche(jarra);
    }
    lecheFria.textContent = `${Math.round(jarra?.leche || 0)} ml`;
    fase += dt;
    dibujarJarra();
    pintar();
  });

  function dibujarJarra() {
    const { g, w, h } = ajustar(cvJarra);
    g.clearRect(0, 0, w, h);
    const x0 = w * 0.18, x1 = w * 0.72, y0 = h * 0.12, y1 = h * 0.94;
    const capJ = 600;
    // cuerpo de la jarra (acero)
    g.fillStyle = '#b8b2ad33'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1 + 6, y1); g.lineTo(x0 - 6, y1); g.closePath(); g.fill();
    if (jarra) {
      const vol = jarra.leche + jarra.espuma;
      const yL = y1 - (jarra.leche / capJ) * (y1 - y0), yE = y1 - (vol / capJ) * (y1 - y0);
      g.fillStyle = '#f1e6d2'; g.fillRect(x0 - 3, yL, x1 - x0 + 6, y1 - yL);
      if (jarra.espuma > 0.5) {
        const tex = 1 - jarra.burbuja - (jarra.gruesa || 0);
        g.fillStyle = '#fbf8f2'; g.fillRect(x0 - 3, yE, x1 - x0 + 6, yL - yE);
        // burbujas: grandes y visibles si la textura es mala
        const n = Math.round((1 - tex) * 26);
        for (let i = 0; i < n; i++) {
          const bx = x0 + ((i * 37) % 100) / 100 * (x1 - x0), by = yE + 2 + ((i * 53) % 100) / 100 * Math.max(2, (yL - yE) - 4);
          g.strokeStyle = '#c9bfae'; g.beginPath(); g.arc(bx, by, 2 + (1 - tex) * 4, 0, 7); g.stroke();
        }
      }
      if (vapor && jarra.leche > 0 && !reducido) {
        // remolino (hundida) o salpicadura (alta)
        g.strokeStyle = '#d8ccb7'; g.lineWidth = 1.5;
        const cx = (x0 + x1) / 2, cy = yE + 6;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(cx, cy, (x1 - x0) * (0.12 + k * 0.1), 3, 0, fase * (posicion === 'hundida' ? 6 : 2) + k, fase * 6 + k + 2.5); g.stroke(); }
        if (posicion === 'alta') for (let k = 0; k < 6; k++) { g.fillStyle = '#fbf8f2'; g.beginPath(); g.arc(cx + Math.sin(fase * 20 + k) * 20, yE - 4 - Math.abs(Math.cos(fase * 13 + k)) * 12, 2, 0, 7); g.fill(); }
      }
      // lanceta de vapor
      const prof = posicion === 'hundida' ? 26 : posicion === 'superficie' ? 2 : -12;
      g.strokeStyle = '#8e8681'; g.lineWidth = 4; g.beginPath(); g.moveTo(x1 + 20, 0); g.lineTo((x0 + x1) / 2 + 10, yE + prof); g.stroke();
    }
    // termómetro
    const t = jarra?.temp ?? 5;
    const tx = w * 0.86, ty0 = h * 0.1, ty1 = h * 0.9;
    const Y = v => ty1 - (limitar(v, 0, 90) / 90) * (ty1 - ty0);
    g.fillStyle = '#0005'; g.fillRect(tx - 5, ty0, 10, ty1 - ty0);
    g.fillStyle = '#4caf6a66'; g.fillRect(tx - 5, Y(65), 10, Y(55) - Y(65));
    g.fillStyle = '#d94a4a55'; g.fillRect(tx - 5, Y(90), 10, Y(70) - Y(90));
    g.fillStyle = mezcla('#5b7bd5', '#d94a4a', t / 80); g.fillRect(tx - 3, Y(t), 6, ty1 - Y(t));
    g.fillStyle = '#f6eedb'; g.font = '11px DotGothic16, monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText(`${Math.round(t)}°`, tx - 8, Y(t));
    if (jarra?.tVapor > 0) {
      const r = resultadoLeche(jarra);
      lecturaLeche.textContent = `${Math.round(r.temp)} °C · +${Math.round(r.expansion * 100)} % volumen · ${r.tipo}${r.quemada ? ' · ¡quemada!' : ''}`;
    } else lecturaLeche.textContent = jarra ? 'Leche fría en la jarra. Mantené "Vapor".' : 'Llená la jarra con leche fría.';
  }

  function pintar() {
    const cap = s.taza ? TAZAS[s.taza].cap : 200;
    vaso.innerHTML = s.taza ? svgTaza(capas(s.cont, s.orden), cap, { etiqueta: 'taza del pedido' }) : '<div class="suave" style="padding-top:40%;text-align:center">sin taza</div>';
    etiqueta.textContent = s.taza ? `${TAZAS[s.taza].n} · ${Math.round(total())}/${cap} ml` : '';
    panelTaza.querySelectorAll('[data-taza]').forEach(b => b.classList.toggle('sel', b.dataset.taza === s.taza));
  }

  function nuevo(siguiente = true) {
    if (siguiente) iP++;
    s = { taza: null, cont: { espresso: 0, leche: 0, espuma: 0, agua: 0 }, orden: [], shots: [], lecheRes: null, ayuda: false };
    shot?.cortar(); shot = null; jarra = null; pararBomba();
    btnShot.textContent = '▶ Sacar shot';
    feedback.replaceChildren();
    receta.classList.add('oculto');
    if (!L.libre && iP >= pedidos.length) return fin();
    const p = L.libre ? (pedidos[0] = generarPedido(Math.random, L.recetas, { detalles: true })) : pedidos[iP];
    const r = recetaDelPedido(p);
    ticket.replaceChildren(el('div.suave', L.libre ? 'Barra libre' : `Pedido ${iP + 1}/${pedidos.length} · ${p.cliente}`),
      el('div.mediano', { style: { fontSize: '1.15em' } }, `🗣️ "${p.texto}"`));
    receta.replaceChildren(el('b', r.n), el('div.suave', r.desc),
      el('div', Object.entries(r.comp).map(([k, [a, b]]) => `${k} ${a}–${b} ml`).join(' · ')),
      el('div.suave', `Taza: ${r.taza.map(t => TAZAS[t].n).join(' o ')}${r.orden ? ' · ' + (r.orden === 'espresso_ultimo' ? 'espresso al final' : 'espresso primero') : ''}${p.temp !== 'normal' ? ` · leche ${TEMP_PEDIDO[p.temp].rango.join('–')} °C` : ''}`));
    ir('taza');
    pintar();
  }

  function entregar() {
    if (shot && !shot.terminado) cortarShot();
    const p = L.libre ? pedidos[0] : pedidos[iP];
    const ev = evaluarPedido(p, { taza: s.taza, cont: s.cont, orden: s.orden, shots: s.shots, leche: s.lecheRes });
    puntos.push(ev.total);
    if (ev.total >= 75) { sfx.bien(); evento('pedido_ok'); } else sfx.mal();
    registrarAcademia({ comp: CON_LECHE(p.receta) ? 'leche' : 'recetas', puntaje: ev.total, errores: ev.errores, evaluado: false }, '');
    feedback.replaceChildren(el('div.panel',
      el('div.fila', el('span.mediano', `${ev.total}`), el('span.suave', '/100'), el('span', ev.total >= 75 ? `😊 ${p.cliente}: "¡Qué rico!"` : `😕 ${p.cliente}: "Mmm…"`)),
      barras({ exactitud: ev.partes.exactitud / 10, tecnica: ev.partes.tecnica / 10, orden: ev.partes.orden / 10, presentacion: ev.partes.presentacion / 10 },
        { exactitud: 'Exactitud', tecnica: 'Técnica', orden: 'Orden', presentacion: 'Presentación' }),
      ev.notas.map(n => el('div', n)),
      s.ayuda ? el('div.suave', '📋 Usaste la receta: está perfecto para aprender.') : null,
      el('div.fila', el('button.btn.prim', { onclick: () => nuevo(true) }, L.libre ? 'Otro pedido ▶' : iP + 1 < pedidos.length ? 'Siguiente pedido ▶' : 'Ver resultado ▶'))));
    btnEntregar.disabled = true;
    setTimeout(() => { btnEntregar.disabled = false; }, 400);
  }

  function fin() {
    const prom = Math.round(puntos.reduce((a, b) => a + b, 0) / puntos.length);
    const aprob = prom >= 70;
    const est = prom >= 90 ? 3 : prom >= 80 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'leche', leccion: L.id, puntaje: prom, estrellas: est, aprobada: aprob }, aprob ? 'pedidos' : 'práctica de pedidos');
    if (aprob) sfx.subir();
    ticket.replaceChildren(el('div.mediano', `${prom}/100 `), estrellas(est), el('div', aprob ? '✅ Lección aprobada.' : '❌ 70 para aprobar. Mirá las notas de cada pedido.'),
      el('div.fila', el('button.btn', { onclick: () => ctx.rehacer() }, '↻ Repetir'), el('button.btn.prim', { onclick: () => ctx.volver() }, 'Volver')));
  }

  nuevo(false);
  return () => { parar(); pararBomba(); sVapor?.parar(); sAgua?.parar(); removeEventListener('keydown', tecla); };
}
