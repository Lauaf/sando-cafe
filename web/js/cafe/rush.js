// Minijuego 5 — Rush Hour: la hora pico con clientes, paciencia y estaciones compartidas.
import { el, sfx, limitar } from '../util.js';
import { evento } from '../progreso.js';
import * as R from './modelo-rush.js';
import { RECETAS, TAZAS, capas } from './modelo-bebidas.js';
import { TEMP_PEDIDO } from './modelo-pedido.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { MAPA_ERRORES_RUSH } from './mapa-errores.js';
import { intro, estrellas, svgTaza, bucle, zumbido, siseo } from './vista.js';

export function hubRush(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'En la hora pico la técnica tiene que salir sola y el tiempo pasa a ser parte de la receta: un shot que no cortás se pasa, la leche que olvidás se quema y el espresso que espera se muere.',
      meta: 'Atendé a todos los que puedas, bien y a tiempo. La satisfacción mezcla la calidad de la bebida con cuánto esperó cada cliente.' }),
    el('div.ac-lecciones', R.LECCIONES.map((L, i) => {
      const abierta = desbloqueada(a, R.LECCIONES, L.id);
      const reg = a.lecciones[L.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), { disabled: !abierta, onclick: () => ctx.ir(L.t, (cc, cx) => turno(cc, cx, L)) },
        el('span.n', String(i + 1)), el('span.t', `${L.t} · ${Math.round(L.duracion / 60 * 10) / 10} min`), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nuevo' : '🔒'));
    })),
    el('div.panel.suave', '⌨️ Atajos: 1 y 2 cortan los shots de cada grupo · 3 corta el vapor. Se aprueba con 70 puntos.'),
  );
}

function turno(c, ctx, L) {
  const s = R.crearTurno({ semilla: Math.floor(Math.random() * 1e9), duracion: L.duracion, inicio: L.inicio });
  let empezado = false, pausa = false, sonidoBomba = [null, null], sonidoVapor = null;
  const cab = el('div.ac-rush-cab');
  const cola = el('div.ac-cola', { 'aria-live': 'polite', 'aria-label': 'Clientes esperando' });
  const estaciones = el('div.ac-estaciones-rush');
  const tickets = el('div.ac-tickets');
  const log = el('div.ac-log', { 'aria-live': 'polite' });
  const fin = el('div');
  const btnEmpezar = el('button.btn.prim.ac-grande', { onclick: () => { empezado = true; btnEmpezar.remove(); sfx.aceptar(); } }, '▶ Abrir la cafetería');
  const btnPausa = el('button.btn.chico', { onclick: () => { pausa = !pausa; btnPausa.textContent = pausa ? '▶ Seguir' : '⏸ Pausa'; } }, '⏸ Pausa');
  c.append(intro({ aprender: L.aprender }), el('div.fila', btnEmpezar, btnPausa), cab, el('div.suave', 'Clientes (tocá uno para tomar su pedido · la barra es su paciencia)'), cola, estaciones, tickets, log, fin);

  const tecla = e => {
    if (!empezado || s.terminado) return;
    if (e.key === '1' || e.key === '2') { const i = +e.key - 1; if (s.grupos[i]) { cortar(i); e.preventDefault(); } }
    if (e.key === '3' && s.vapor) { R.cortarVapor(s); sonidoVapor?.parar(); sonidoVapor = null; e.preventDefault(); }
  };
  addEventListener('keydown', tecla);

  function cortar(i) {
    const r = R.cortarShot(s, i);
    sonidoBomba[i]?.(); sonidoBomba[i] = null;
    if (r) mensaje(`☕ Grupo ${i + 1}: ${r.enTaza.toFixed(0)} g en ${r.tiempo.toFixed(0)} s${r.enTaza < 30 ? ' (corto)' : r.enTaza > 40 ? ' (se pasó)' : ' ✔'}`);
  }
  function mensaje(txt, clase = '') {
    log.prepend(el('div' + clase, txt));
    while (log.children.length > 5) log.lastChild.remove();
  }

  // estructura fija de estaciones (se actualiza cada cuadro)
  const grupos = [0, 1].map(i => {
    const lcd = el('span.ac-lcd', '—');
    const barra = el('div.hp', el('i'));
    const btn = el('button.btn', { onclick: () => cortar(i) }, `✂️ Cortar (${i + 1})`);
    const nodo = el('div.panel.ac-estacion', el('b', `☕ Grupo ${i + 1}`), lcd, barra, btn);
    return { nodo, lcd, barra, btn };
  });
  const vapLcd = el('span.ac-lcd', '—');
  const vapBarra = el('div.hp', el('i'));
  const vapBtn = el('button.btn', { onclick: () => { R.cortarVapor(s); sonidoVapor?.parar(); sonidoVapor = null; } }, '✂️ Cortar vapor (3)');
  const vapor = el('div.panel.ac-estacion', el('b', '♨️ Vapor'), vapLcd, vapBarra, vapBtn);
  estaciones.append(grupos[0].nodo, grupos[1].nodo, vapor);

  let ultimaCola = '', ultimosTickets = '';
  const parar = bucle(dt => {
    if (empezado && !pausa && !s.terminado) {
      const antes = s.perdidos.length;
      R.avanzar(s, dt);
      if (s.perdidos.length > antes) { sfx.mal(); mensaje(`😠 ${s.perdidos[s.perdidos.length - 1].cliente.pedido.cliente} se cansó de esperar y se fue.`, '.no'); }
      if (s.terminado) terminar();
    }
    pintar();
  });

  function pintar() {
    const res = R.resumen(s);
    const acto = R.actoEn(s.t + s.inicio);
    cab.replaceChildren(
      el('span', `⏱ ${Math.max(0, Math.ceil(s.duracion - s.t))} s`), el('span', `📣 ${acto.n}`),
      el('span', `💰 $${res.dinero.toFixed(2)}`), el('span', `😊 ${res.servidos ? res.satisfProm : '—'}`),
      el('span', `✔ ${res.servidos}`), el('span', `✘ ${res.perdidos}`));
    // cola: se reconstruye solo si cambia quién está; las barras de paciencia se actualizan siempre
    const claveCola = s.cola.map(x => `${x.id}${x.tomado ? 't' : ''}`).join(',');
    if (claveCola !== ultimaCola) {
      ultimaCola = claveCola;
      cola.replaceChildren(...(s.cola.length ? s.cola.map(x => el('button.ac-cliente' + (x.tomado ? '.tomado' : ''), {
        'data-id': x.id, disabled: x.tomado || s.preps.length >= R.MAX_PREP && !x.tomado,
        onclick: () => { if (R.tomarPedido(s, x.id)) { sfx.cursor(); ultimosTickets = ''; } },
      }, el('div', `🙂 ${x.pedido.cliente}`), el('div.suave', `"${x.pedido.texto}"`), el('div.hp', el('i')))) : [el('div.suave', empezado ? 'Nadie esperando… por ahora.' : 'La cafetería está cerrada.')]));
    }
    for (const n of cola.querySelectorAll('.ac-cliente')) {
      const x = s.cola.find(y => y.id === +n.dataset.id);
      if (!x) continue;
      const f = limitar(x.paciencia / x.pacienciaMax, 0, 1);
      const i = n.querySelector('.hp i');
      i.style.width = `${f * 100}%`;
      i.style.background = f > 0.5 ? 'var(--bien)' : f > 0.25 ? 'var(--oro)' : 'var(--mal)';
      n.classList.toggle('apurado', f < 0.25);
      n.disabled = x.tomado || s.preps.length >= R.MAX_PREP;
    }
    // estaciones
    s.grupos.forEach((g, i) => {
      const G = grupos[i];
      if (g) {
        if (!sonidoBomba[i]) sonidoBomba[i] = zumbido(50 + i * 4, 0.012);
        const prep = s.preps.find(p => p.id === g.prep);
        G.lcd.textContent = `${g.shot.enTaza.toFixed(1)} g · ${g.shot.t.toFixed(0)} s → ${prep?.pedido.cliente || ''}`;
        const f = limitar(g.shot.enTaza / 50, 0, 1);
        G.barra.firstChild.style.width = `${f * 100}%`;
        G.barra.firstChild.style.background = g.shot.enTaza < 30 ? 'var(--azul)' : g.shot.enTaza <= 40 ? 'var(--bien)' : 'var(--mal)';
        G.btn.disabled = false;
      } else {
        G.lcd.textContent = 'libre'; G.barra.firstChild.style.width = '0%'; G.btn.disabled = true;
      }
    });
    if (s.vapor) {
      if (!sonidoVapor) sonidoVapor = siseo(0.012, 2600);
      const j = s.vapor.jarra;
      const prep = s.preps.find(p => p.id === s.vapor.prep);
      vapLcd.textContent = `${Math.round(j.temp)} °C · +${Math.round((j.espuma / j.leche) * 100)} % → ${prep?.pedido.cliente || ''}`;
      vapBarra.firstChild.style.width = `${limitar(j.temp / 80, 0, 1) * 100}%`;
      vapBarra.firstChild.style.background = j.temp < 55 ? 'var(--azul)' : j.temp <= 66 ? 'var(--bien)' : 'var(--mal)';
      vapBtn.disabled = false;
    } else {
      if (sonidoVapor) { sonidoVapor.parar(); sonidoVapor = null; }
      vapLcd.textContent = 'libre'; vapBarra.firstChild.style.width = '0%'; vapBtn.disabled = true;
    }
    // tickets: se reconstruyen cuando cambia su estado
    const clave = s.preps.map(p => JSON.stringify([p.id, p.shots.length, !!p.jarra, !!p.lecheRes, Math.round(p.cont.leche + p.cont.espuma), p.cont.agua, s.grupos.map(g => g?.prep), s.vapor?.prep])).join('|') + `|${!!s.vapor}|${s.grupos.map(g => !!g)}`;
    if (clave !== ultimosTickets) { ultimosTickets = clave; pintarTickets(); }
    for (const n of tickets.querySelectorAll('[data-espera]')) {
      const p = s.preps.find(x => x.id === +n.dataset.espera);
      n.textContent = p && p.espressoListo != null ? `espresso esperando ${Math.round(p.esperaEspresso)} s${p.esperaEspresso > 25 ? ' ⚠️' : ''}` : '';
    }
  }

  function pintarTickets() {
    tickets.replaceChildren(...(s.preps.length ? s.preps.map(p => {
      const r = RECETAS[p.pedido.receta];
      const n = p.nec;
      const enGrupo = s.grupos.filter(g => g?.prep === p.id).length;
      const vaporEste = s.vapor?.prep === p.id;
      const grupoLibre = s.grupos.some(g => !g);
      const shotsHechos = p.shots.length;
      const taza = TAZAS[r.taza[0]];
      const vaso = el('div.ac-taza-mini', { html: svgTaza(capas(p.cont, p.orden), taza.cap, { etiqueta: r.n }) });
      const botones = [
        el('button.btn.chico', { disabled: !grupoLibre || shotsHechos + enGrupo >= n.shots, onclick: () => { if (R.iniciarShot(s, p.id) >= 0) sfx.cursor(); } },
          `☕ Shot ${shotsHechos}/${n.shots}${enGrupo ? ' (saliendo)' : ''}`),
        n.leche ? el('button.btn.chico', { disabled: !!s.vapor || !!p.jarra || !!(p.cont.leche + p.cont.espuma), onclick: () => R.iniciarVapor(s, p.id, 'poca') }, '🥛 Vapor: poca espuma') : null,
        n.leche ? el('button.btn.chico', { disabled: !!s.vapor || !!p.jarra || !!(p.cont.leche + p.cont.espuma), onclick: () => R.iniciarVapor(s, p.id, 'mucha') }, '☁️ Vapor: mucha espuma') : null,
        n.leche ? el('button.btn.chico', { disabled: !p.jarra || vaporEste, onclick: () => R.servirLeche(s, p.id) }, n.soloEspuma ? '🥄 Cucharada de espuma' : '🫗 Servir leche') : null,
        n.agua ? el('button.btn.chico', { disabled: p.cont.agua > 0, onclick: () => R.servirAgua(s, p.id) }, '♨️ Agua caliente') : null,
        el('button.btn.chico.prim', { disabled: !!enGrupo || vaporEste, onclick: () => entregar(p.id) }, '🛎️ Entregar'),
        el('button.btn.chico', { onclick: () => R.descartar(s, p.id), title: 'Tirar y volver a empezar' }, '🗑️'),
      ];
      return el('div.panel.ac-ticket-rush',
        el('div.fila', vaso, el('div', { style: { flex: 1, minWidth: '10em' } },
          el('b', `${r.n}${p.pedido.shots === 2 && !['doppio', 'flatwhite', 'longblack'].includes(p.pedido.receta) ? ' doble' : ''}`),
          el('div.suave', `${p.pedido.cliente}${p.pedido.temp !== 'normal' ? ` · leche ${TEMP_PEDIDO[p.pedido.temp].n}` : ''}`),
          el('div.suave', { 'data-espera': p.id }),
          p.jarra && !vaporEste ? el('div.suave', `jarra lista: ${Math.round(p.jarra.temp)} °C`) : null)),
        el('div.ac-botones', botones));
    }) : [el('div.suave', 'Sin pedidos en preparación. Tomá uno de la cola.')]));
  }

  function entregar(idPrep) {
    const reg = R.servir(s, idPrep);
    if (!reg) return;
    ultimosTickets = '';
    reg.satisf >= 80 ? sfx.bien() : reg.satisf >= 50 ? sfx.aceptar() : sfx.mal();
    if (reg.satisf >= 75) evento('pedido_ok');
    const cara = reg.satisf >= 85 ? '😍' : reg.satisf >= 65 ? '🙂' : reg.satisf >= 40 ? '😐' : '😖';
    mensaje(`${cara} ${reg.pedido.cliente}: ${reg.satisf}/100${reg.propina ? ` (+$${reg.propina.toFixed(2)} de propina)` : ''}${reg.notas[0] ? ` — ${reg.notas[0]}` : ''}`);
  }

  function terminar() {
    sonidoBomba.forEach(f => f?.()); sonidoVapor?.parar();
    const res = R.resumen(s);
    const aprob = res.puntaje >= 70;
    const est = res.puntaje >= 90 ? 3 : res.puntaje >= 80 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'servicio', leccion: L.id, puntaje: res.puntaje, estrellas: est, aprobada: aprob, errores: Object.keys(res.errores) }, aprob ? 'turno superado' : 'turno');
    if (res.perdidos === 0 && res.servidos >= 5) evento('rush_limpio');
    aprob ? sfx.subir() : sfx.mal();
    const recs = res.topErrores.map(([e]) => MAPA_ERRORES_RUSH[e]).filter(Boolean);
    fin.replaceChildren(el('div.panel', { style: { textAlign: 'center' } },
      el('div.mediano', `${res.puntaje}/100`), estrellas(est),
      el('div', aprob ? '✅ ¡Turno superado!' : '❌ 70 para aprobar el turno.'),
      el('table.tabla', { style: { maxWidth: '28em', margin: '8px auto' } },
        el('tr', el('td', 'Clientes atendidos'), el('td', res.servidos)), el('tr', el('td', 'Se fueron sin café'), el('td', res.perdidos)),
        el('tr', el('td', 'Satisfacción promedio'), el('td', res.servidos ? res.satisfProm : '—')), el('tr', el('td', 'Caja (con propinas)'), el('td', `$${res.dinero.toFixed(2)}`))),
      res.topErrores.length ? el('div', el('b', 'Lo que más te costó: '), res.topErrores.map(([e, k]) => `${R.NOMBRES_ERROR[e] || e} (${k})`).join(' · ')) : el('div.ok', 'Sin errores repetidos. ¡Barra impecable!'),
      recs.length ? el('div.ac-recs', recs.map(x => el('div.ac-rec', el('span', `👉 ${x.texto}`)))) : null,
      el('div.fila.centro', el('button.btn', { onclick: () => ctx.rehacer() }, '↻ Otro turno'), el('button.btn.prim', { onclick: () => ctx.volver() }, 'Volver'))));
    fin.scrollIntoView({ block: 'nearest' });
  }

  return () => { parar(); removeEventListener('keydown', tecla); sonidoBomba.forEach(f => f?.()); sonidoVapor?.parar(); };
}
