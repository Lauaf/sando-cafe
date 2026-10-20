// Minijuego 1 — El espresso perfecto: moler por peso, distribuir, tampear y extraer en tiempo real.
import { el, sfx, hoy, limitar } from '../util.js';
import { evento, guardar } from '../progreso.js';
import {
  RECETA_BASE, TUESTES, PERFILES, OBJETIVOS, OBJETIVOS_LECCION, LECCIONES, DOSIS_RANGO, MOLIENDA_RANGO, TEMP_RANGO,
  crearShot, evaluar, comparar, desafioDiario,
} from './modelo-espresso.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { lienzo, ajustar, bucle, intro, estrellas, barras, mezcla, mantener, paso, zumbido, menosMovimiento, vivo } from './vista.js';

export const ETIQUETAS_SABOR = { acidez: 'Acidez', dulzor: 'Dulzor', amargor: 'Amargor', astringencia: 'Astringencia', intensidad: 'Intensidad' };
export const COLORES_SABOR = { acidez: '#e8c547', dulzor: '#e89a5b', amargor: '#7b4a2e', astringencia: '#a35a6f', intensidad: '#c98a4b' };
const APRUEBA = 75;

// ---------- Menú del módulo ----------
export function hubEspresso(c, ctx) {
  const a = academia();
  const diario = desafioDiario(hoy());
  const d = a.diario.espresso?.fecha === hoy() ? a.diario.espresso : null;
  c.append(
    intro({ aprender: 'Un espresso es agua a ~9 bar atravesando ~18 g de café molido durante ~25–35 s. Molienda, dosis, temperatura, presión y la preparación del puck deciden cuánto se disuelve.',
      meta: 'Aprendé a leer el shot (tiempo, peso, color del chorro) y a corregirlo cambiando una variable por vez.' }),
    el('h3.ac-h3', 'Carrera'),
    el('div.ac-lecciones', LECCIONES.map((L, i) => {
      const abierta = desbloqueada(a, LECCIONES, L.id);
      const reg = a.lecciones[L.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), {
        disabled: !abierta,
        onclick: () => ctx.ir(`${i + 1}. ${L.t}`, (cc, cx) => banco(cc, cx, { leccion: L })),
      }, el('span.n', String(i + 1)), el('span.t', L.t), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nueva' : '🔒'));
    })),
    el('div.rejilla',
      el('button.tarjeta', { onclick: () => ctx.ir('Desafío del día', (cc, cx) => banco(cc, cx, { leccion: diario, diario: true })) },
        el('div.t-ico', '📅'), el('div.t-tit', 'Desafío del día'),
        el('div.t-desc', 'Una receta rota distinta cada día. 1 shot de diagnóstico gratis + 5 intentos.'),
        el('div.t-tag', d ? `hoy: ${d.mejor} pts · ${d.intentos}/5 intentos` : 'sin jugar hoy')),
      el('button.tarjeta', { onclick: () => ctx.ir('Práctica libre', (cc, cx) => banco(cc, cx, { libre: true })) },
        el('div.t-ico', '🧪'), el('div.t-tit', 'Práctica libre'),
        el('div.t-desc', 'Todos los controles. Elegí tueste y estilo (ristretto, normale, lungo) y experimentá.'),
        el('div.t-tag', 'sin límite de intentos'))),
  );
}

/** Banco en práctica libre con una receta precargada (lo usa el diagnóstico para "probarlo de verdad"). */
export const bancoCon = (receta, salida) => (c, ctx) => banco(c, ctx, { libre: true, receta, salida });

// ---------- Banco de trabajo ----------
function banco(c, ctx, cfg) {
  const libre = !!cfg.libre;
  let L = cfg.leccion || { id: 'libre', t: 'Práctica libre', obj: 'normale', intentos: Infinity, p: {}, controles: ['dosis', 'molienda', 'temp', 'perfil', 'puck', 'extraer'] };
  const puede = k => libre || L.controles.includes(k);
  let objetivo = OBJETIVOS_LECCION[L.obj];
  const receta = { ...RECETA_BASE, ...L.p, ...(cfg.receta || {}) };
  const a = academia();
  const diarioReg = cfg.diario ? (a.diario.espresso?.fecha === hoy() ? a.diario.espresso : (a.diario.espresso = { fecha: hoy(), intentos: 0, mejor: 0, diagnostico: false })) : null;

  let intentos = 0, superada = false, agotada = false;
  let shot = null, anterior = null;
  const historial = [];          // resultados para el mapa de extracción
  // estado del puck en el portafiltro
  const puck = { molido: 0, clumps: null, distribucion: receta.distribucion, nivelado: receta.nivelado, tampeado: false };
  let fase = 'preparar';         // preparar | listo | extrayendo | terminado
  let velocidad = 1;
  let pararBomba = () => {}, pararMolino = () => {};
  let moliendo = false;

  // --- columnas ---
  const escena = lienzo('ac-escena', 'Máquina de espresso: portafiltro, chorro, taza sobre la balanza y manómetro');
  const grafico = lienzo('ac-grafico', 'Gráfico en vivo de presión, caudal y peso en la taza');
  const lectura = vivo('.ac-lectura');
  const resultado = vivo('.ac-resultado');
  const mapa = lienzo('ac-mapa', 'Mapa de extracción: cada punto es uno de tus shots');
  const estadoIntentos = el('span.suave');
  const btnExtraer = el('button.btn.prim.ac-grande', { onclick: () => alternarShot() }, '▶ Extraer');
  const btnVel = el('button.btn.chico', { onclick: () => { velocidad = velocidad === 1 ? 2 : 1; btnVel.textContent = velocidad === 1 ? '⏩ ×1' : '⏩ ×2'; }, title: 'Velocidad de la simulación' }, '⏩ ×1');

  // --- controles ---
  const pasos = el('div.ac-pasos');
  const objSel = libre ? el('div.chips', Object.entries(OBJETIVOS).map(([k, o]) => el('button.chip' + (k === 'normale' ? '.sel' : ''), {
    onclick: e => { objetivo = o; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); metaLibre.textContent = o.desc; },
  }, `${o.n} 1:${o.ratio[0]}–${o.ratio[1]}`))) : null;
  const metaLibre = el('div.suave', libre ? OBJETIVOS.normale.desc : '');
  const tuesteSel = libre ? el('div.chips', Object.entries(TUESTES).map(([k, t]) => el('button.chip' + (k === receta.tueste ? '.sel' : ''), {
    title: t.desc, onclick: e => { receta.tueste = k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); },
  }, `Tueste ${t.n.toLowerCase()}`))) : null;

  // 1. Molienda
  const perilla = perillaMolienda(receta.molienda, v => { receta.molienda = v; }, !puede('molienda'));
  // 2. Dosis (moler por peso)
  const vasoDosis = lienzo('ac-dosis', 'Canasta del portafiltro llenándose de café molido');
  const lecturaDosis = el('span.ac-lcd', '0.0 g');
  const btnMoler = mantener(el('button.btn', { disabled: !puede('dosis') }, '⚙️ Moler (mantener)'), {
    alIniciar: () => { moliendo = true; pararMolino = zumbido(118, 0.018, 'square', 900); },
    alSoltar: () => { moliendo = false; pararMolino(); },
  });
  const btnQuitar = el('button.btn.chico', { disabled: !puede('dosis'), onclick: () => { puck.molido = Math.max(0, puck.molido - 0.3); sfx.cursor(); } }, '− 0.3 g');
  const btnVaciar = el('button.btn.chico', { disabled: !puede('dosis'), onclick: () => { nuevoPuck(); } }, 'Vaciar');
  // 3. WDT
  const wdt = lienzo('ac-wdt', 'Canasta vista desde arriba: arrastrá para romper los grumos');
  const lecturaWdt = el('span.suave');
  const btnWdtAuto = el('button.btn.chico', { onclick: () => wdtAuto() }, '🪡 Distribuir (teclado)');
  // 4. Tampeo
  const nivel = lienzo('ac-nivel', 'Nivel de burbuja: tampeá cuando la burbuja esté en el centro');
  const lecturaTamp = el('span.suave');
  const btnTamp = el('button.btn', { onclick: () => tampear() }, '⬇ Tampear');
  // 5. Máquina
  const pTemp = paso({ etiqueta: 'Temperatura', valor: receta.temp, min: TEMP_RANGO[0], max: TEMP_RANGO[1], delta: 0.5, fmt: v => `${v.toFixed(1)} °C`, alCambiar: v => { receta.temp = v; }, bloqueado: !puede('temp') });
  const perfiles = el('div.chips', Object.entries(PERFILES).map(([k, pf]) => el('button.chip' + (k === receta.perfil ? '.sel' : ''), {
    disabled: !puede('perfil'), title: pf.desc,
    onclick: e => { receta.perfil = k; e.target.parentNode.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === e.target)); },
  }, pf.n)));

  const paso1 = el('div.ac-paso-caja', el('div.ac-paso-tit', '1 · Molienda'), el('div.fila', perilla, el('div.suave', puede('molienda') ? 'Arrastrá la perilla o usá las flechas. Cada punto cambia el tiempo ~10 %.' : 'Fija en esta lección.')));
  const paso2 = el('div.ac-paso-caja', el('div.ac-paso-tit', '2 · Dosis'),
    el('div.fila', vasoDosis, el('div', lecturaDosis, el('div.suave', puede('dosis') ? `Canasta de 18 g · rango ${DOSIS_RANGO[0]}–${DOSIS_RANGO[1]} g` : `El molino dosifica ${receta.dosis} g`), el('div.fila', btnMoler, btnQuitar, btnVaciar))));
  const paso3 = el('div.ac-paso-caja', el('div.ac-paso-tit', '3 · Distribuir (WDT)'), el('div.fila', wdt, el('div', el('div.suave', 'Revolvé con la aguja dibujando círculos sobre la canasta.'), lecturaWdt, btnWdtAuto)));
  const paso4 = el('div.ac-paso-caja', el('div.ac-paso-tit', '4 · Tampear'), nivel, el('div.fila', btnTamp, lecturaTamp));
  const paso5 = el('div.ac-paso-caja', el('div.ac-paso-tit', '5 · Máquina'), pTemp, el('div.suave', 'Perfil de presión'), perfiles);
  pasos.append(paso1, paso2);
  if (puede('puck')) pasos.append(paso3, paso4);
  pasos.append(paso5);

  const cabecera = el('div',
    cfg.leccion ? intro({ aprender: L.aprender, meta: L.meta, extra: el('div.fila', el('span.suave', `Estilo: ${objetivo.n} · ratio 1:${objetivo.ratio[0]}–${objetivo.ratio[1]}`), estadoIntentos) }) : null,
    libre ? el('div.panel', el('div.fila', el('b', 'Estilo'), objSel), metaLibre, el('div.fila', el('b', 'Café'), tuesteSel),
      cfg.receta ? el('div.ok', `🩺 Receta del escenario: molienda ${receta.molienda.toFixed(1)}, ${receta.temp} °C, ${receta.dosis} g → cortá cerca de ${Math.round(cfg.salida)} g. Aplicá tu corrección y comprobá.`) : null) : null);
  c.append(cabecera,
    el('div.ac-banco',
      el('div.ac-col', escena, el('div.fila.ac-acciones', btnExtraer, btnVel, el('span.suave', 'Espacio: extraer / cortar')), lectura, resultado, grafico, mapa),
      el('div.ac-col', pasos)));

  // ---------- puck ----------
  function nuevoPuck() {
    puck.molido = puede('dosis') ? 0 : receta.dosis;
    puck.tampeado = !puede('puck');
    puck.distribucion = puede('puck') ? 0.25 : receta.distribucion;
    puck.nivelado = puede('puck') ? 0 : receta.nivelado;
    puck.clumps = Array.from({ length: 24 }, (_, i) => 0.75 + 0.25 * Math.abs(Math.sin(i * 12.9898)));
    fase = 'preparar';
    lecturaTamp.textContent = puede('puck') ? 'Sin tampear' : '';
    actualizarFase();
  }
  function puckListo() {
    return puck.molido >= DOSIS_RANGO[0] - 0.01 && puck.molido <= DOSIS_RANGO[1] + 0.01 && puck.tampeado;
  }
  function actualizarFase() {
    if (fase === 'extrayendo') { btnExtraer.textContent = '■ Cortar'; btnExtraer.disabled = false; return; }
    const listo = puckListo();
    if (fase !== 'terminado') fase = listo ? 'listo' : 'preparar';
    btnExtraer.textContent = fase === 'terminado' ? '↻ Preparar otro puck' : '▶ Extraer';
    btnExtraer.disabled = fase === 'preparar' || agotada;
    btnMoler.disabled = btnQuitar.disabled = btnVaciar.disabled = !puede('dosis') || fase === 'terminado' || puck.tampeado && puede('puck');
    btnTamp.disabled = !puede('puck') || puck.tampeado || puck.molido < 1;
    btnWdtAuto.disabled = !puede('puck') || puck.tampeado || puck.molido < 1;
    const max = cfg.diario ? 5 : L.intentos;
    estadoIntentos.textContent = Number.isFinite(max) ? `Intento ${Math.min(intentos + 1, max)}/${max}` : '';
    if (cfg.diario && !diarioReg.diagnostico) estadoIntentos.textContent = 'Shot de diagnóstico (no cuenta)';
  }
  function wdtAuto() {
    let t = 0;
    const id = setInterval(() => {
      t += 0.1;
      puck.clumps = puck.clumps.map(v => Math.max(0.06, v - 0.13));
      if (t >= 1) clearInterval(id);
    }, 100);
    sfx.cursor();
  }
  function tampear() {
    if (puck.tampeado || puck.molido < 1) return;
    puck.nivelado = limitar(1 - Math.abs(burbuja) * 1.05, 0, 1);
    puck.tampeado = true;
    puck.distribucion = 1 - mediaClumps() * 0.75;
    lecturaTamp.textContent = `Nivelado ${Math.round(puck.nivelado * 100)} % · ${puck.nivelado > 0.85 ? 'parejo ✔' : puck.nivelado > 0.6 ? 'algo torcido' : 'muy torcido'}`;
    sfx.golpe();
    actualizarFase();
  }
  const mediaClumps = () => puck.clumps.reduce((s, x) => s + x, 0) / puck.clumps.length;

  // arrastrar sobre la canasta = WDT
  let ultimo = null;
  wdt.addEventListener('pointerdown', e => { if (!puck.tampeado && puede('puck')) { ultimo = [e.offsetX, e.offsetY]; wdt.setPointerCapture(e.pointerId); } });
  wdt.addEventListener('pointerup', () => { ultimo = null; });
  wdt.addEventListener('pointermove', e => {
    if (!ultimo || puck.molido < 1) return;
    const [x0, y0] = ultimo, x = e.offsetX, y = e.offsetY;
    const d = Math.hypot(x - x0, y - y0);
    ultimo = [x, y];
    const r = wdt.clientWidth / 2;
    const dx = (x - r) / r, dy = (y - r) / r;
    const rad = Math.hypot(dx, dy);
    if (rad > 1) return;
    const anillo = Math.min(2, Math.floor(rad * 3));
    const sector = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8;
    for (let k = 0; k < 24; k++) {
      const an = Math.floor(k / 8), se = k % 8;
      const cerca = Math.abs(an - anillo) <= 1 && (Math.min((se - sector + 8) % 8, (sector - se + 8) % 8) <= (an === 0 ? 3 : 1));
      if (cerca) puck.clumps[k] = Math.max(0.04, puck.clumps[k] - d * (an === anillo ? 0.006 : 0.002));
    }
    trazos.push({ x: dx, y: dy, v: 1 });
  });
  const trazos = [];

  // ---------- extracción ----------
  function alternarShot() {
    if (fase === 'terminado') { nuevoPuck(); resultado.replaceChildren(); return; }
    if (fase === 'listo') {
      shot = crearShot({ ...receta, dosis: puck.molido, distribucion: puck.distribucion, nivelado: puck.nivelado });
      fase = 'extrayendo';
      pararBomba = zumbido(52, 0.022);
      resultado.replaceChildren();
      actualizarFase();
    } else if (fase === 'extrayendo') {
      cortar();
    }
  }
  function cortar() {
    if (!shot || shot.terminado && fase !== 'extrayendo') return;
    shot.cortar();
    pararBomba();
    fase = 'terminado';
    sfx.aceptar();
    const r = shot.resultado();
    mostrarResultado(r);
    actualizarFase();
  }

  function mostrarResultado(r) {
    const e = evaluar(r, objetivo);
    const cmp = anterior ? comparar(anterior, r) : null;
    const diagnostico = cfg.diario && !diarioReg.diagnostico;
    historial.push({ r, e });
    anterior = r;
    evento('brew_lab');
    if (!e.defectos.length) evento('esp_ok');
    let titulo = null;
    if (diagnostico) {
      diarioReg.diagnostico = true;
      guardar();
      titulo = el('div.suave', '🔎 Shot de diagnóstico: no cuenta para el puntaje. Ahora corregilo.');
    } else if (libre) {
      registrarAcademia({ comp: 'extraccion', puntaje: e.puntaje, errores: e.defectos, evaluado: false }, 'shot en práctica');
    } else {
      intentos++;
      const aprob = e.puntaje >= APRUEBA;
      if (cfg.diario) {
        diarioReg.intentos++;
        diarioReg.mejor = Math.max(diarioReg.mejor, e.puntaje);
        registrarAcademia({ comp: 'extraccion', puntaje: e.puntaje, errores: e.defectos }, 'desafío del día');
        if (diarioReg.intentos >= 5) { agotada = true; titulo = el('div', `📅 Desafío terminado: tu mejor puntaje de hoy es ${diarioReg.mejor}. Mañana hay otra receta rota.`); }
      } else {
        const res = registrarAcademia({ comp: 'extraccion', leccion: L.id, puntaje: e.puntaje, estrellas: aprob ? e.estrellas : 0, aprobada: aprob, errores: e.defectos }, aprob ? 'lección superada' : 'shot');
        if (aprob) {
          superada = true;
          sfx.subir();
          const i = LECCIONES.findIndex(x => x.id === L.id);
          const sig = LECCIONES[i + 1];
          titulo = el('div.ok', `✅ ¡Lección superada${res.aprobadaPorPrimeraVez ? '' : ' otra vez'}! `,
            sig ? el('button.btn.prim', { onclick: () => ctx.volver() }, `Siguiente: ${sig.t} ▶`) : el('span', '¡Completaste la carrera de espresso!'));
          if (!sig) evento('carrera_espresso');
        } else if (!superada && intentos >= L.intentos) {
          agotada = true;
          titulo = el('div.no', '❌ Se acabaron los intentos. Leé el diagnóstico y reintentá: cada intento te acerca.',
            el('button.btn', { onclick: () => ctx.rehacer() }, '↻ Reintentar lección'));
        }
      }
    }
    if (!diagnostico && !libre && !cfg.diario && e.puntaje < APRUEBA && !agotada) sfx.mal();
    const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
    resultado.replaceChildren(el('div.panel',
      titulo,
      el('div.fila', el('span.mediano', `${e.puntaje}`), el('span.suave', '/100'), estrellas(e.estrellas)),
      el('div', `⏱ ${fmt(r.tiempo)} s · primera gota ${r.primeraGota != null ? fmt(r.primeraGota) + ' s' : '—'} · ⚖ ${fmt(r.enTaza)} g (1:${fmt(r.ratio)})`),
      el('div.suave', `Extracción ≈ ${fmt(r.ey)} % · TDS ≈ ${fmt(r.tds)} % · estimaciones del modelo, no mediciones`),
      barras(e.sabor, ETIQUETAS_SABOR, { colores: COLORES_SABOR }),
      e.detalle.length
        ? e.detalle.map(d => el('div.ac-defecto', el('b', `${d.ico} ${d.n}. `), d.exp, el('div.ok', `→ Probá: ${d.consejo}.`)))
        : el('div.ok', '☕ Balanceado: dulce, con acidez viva y sin amargor seco. Repetilo para fijar la receta.'),
      cmp ? el('div.ac-comparar', cmp.cambios.length
        ? [el('b', 'Comparado con el shot anterior: '), `cambiaste ${cmp.cambios.map(x => `${x.n} ${fmtValor(x.antes)} → ${fmtValor(x.ahora)}`).join(', ')}. `,
          `Tiempo ${signo(cmp.dTiempo)} s, extracción ${signo(cmp.dEY)} %.`,
          cmp.unaVariable ? null : el('div.suave', '⚠️ Cambiaste más de una cosa: no vas a saber cuál produjo el efecto.')]
        : el('span.suave', 'Misma receta que el shot anterior: buena forma de comprobar que el resultado se repite.')) : null,
    ));
    dibujarMapa();
    resultado.scrollIntoView({ block: 'nearest', behavior: menosMovimiento() ? 'auto' : 'smooth' });
  }
  const fmtValor = v => typeof v === 'number' ? (Math.round(v * 10) / 10).toString() : v;
  const signo = v => `${v >= 0 ? '+' : ''}${(Math.round(v * 10) / 10).toFixed(1)}`;

  // teclado: Espacio extrae/corta (si el foco no está en un botón u otro control)
  const tecla = e => {
    if (e.key !== ' ' || /BUTTON|INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    if (document.activeElement?.getAttribute('role') === 'slider') return;
    e.preventDefault();
    if (!btnExtraer.disabled) alternarShot();
  };
  addEventListener('keydown', tecla);

  // ---------- dibujo ----------
  let burbuja = 0, tBurbuja = 0, tGotas = 0;
  const gotas = [];
  const reducido = menosMovimiento();
  const parar = bucle((dt) => {
    if (moliendo && puede('dosis')) puck.molido = Math.min(DOSIS_RANGO[1] + 1.5, puck.molido + dt * 2.4);
    if (fase === 'preparar' && puckListo()) actualizarFase();
    if (fase === 'preparar' && moliendo) actualizarFase();
    if (fase === 'extrayendo' && shot) {
      let n = Math.round((dt * velocidad) / 0.02);
      while (n-- > 0 && !shot.terminado) shot.paso(0.02);
      if (shot.terminado) cortar();
    }
    tBurbuja += dt * (reducido ? 0.9 : 2.1) * (0.85 + 0.15 * Math.sin(tBurbuja * 0.37));
    burbuja = Math.sin(tBurbuja) * 0.95;
    lecturaDosis.textContent = `${puck.molido.toFixed(1)} g`;
    lecturaWdt.textContent = puck.molido < 1 ? 'Primero molé el café.' : `Distribución ${Math.round((1 - mediaClumps() * 0.75) * 100)} %`;
    dibujarEscena(dt);
    dibujarGrafico();
    dibujarDosis();
    if (puede('puck')) { dibujarWdt(); dibujarNivel(); }
    if (fase === 'extrayendo' && shot) lectura.textContent = `⏱ ${shot.t.toFixed(1)} s · ⚖ ${shot.enTaza.toFixed(1)} g · ${shot.presion.toFixed(1)} bar · ${shot.caudal.toFixed(1)} g/s`;
  });

  function dibujarEscena(dt) {
    const { g, w, h } = ajustar(escena);
    const cx = w / 2;
    // fondo
    const fondo = g.createLinearGradient(0, 0, 0, h);
    fondo.addColorStop(0, '#2b201b'); fondo.addColorStop(1, '#17110e');
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    // cuerpo de la máquina
    g.fillStyle = '#4a3f3b'; rr(g, w * 0.08, -10, w * 0.84, h * 0.36 + 10, 14); g.fill();
    g.fillStyle = '#5c504b'; g.fillRect(w * 0.08, h * 0.33, w * 0.84, h * 0.03);
    // manómetro
    const pr = shot ? shot.presion : 0;
    const gx = w * 0.24, gy = h * 0.17, gr = Math.min(w, h) * 0.1;
    g.fillStyle = '#f6eedb'; g.beginPath(); g.arc(gx, gy, gr, 0, 7); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#9a8f86'; g.stroke();
    const ang = v => Math.PI * 0.75 + (v / 12) * Math.PI * 1.5;
    g.lineWidth = gr * 0.16; g.strokeStyle = '#4caf6a88'; g.beginPath(); g.arc(gx, gy, gr * 0.78, ang(8), ang(10)); g.stroke();
    g.fillStyle = '#2a2140'; g.font = `${Math.round(gr * 0.24)}px DotGothic16, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const v of [0, 3, 6, 9, 12]) g.fillText(v, gx + Math.cos(ang(v)) * gr * 0.55, gy + Math.sin(ang(v)) * gr * 0.55);
    g.strokeStyle = '#d94a4a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(ang(pr)) * gr * 0.8, gy + Math.sin(ang(pr)) * gr * 0.8); g.stroke();
    g.fillStyle = '#2a2140'; g.fillText('bar', gx, gy + gr * 0.45);
    // reloj LCD
    lcd(g, w * 0.76, h * 0.17, `${(shot ? shot.t : 0).toFixed(1)} s`, Math.min(w, h) * 0.075);
    // grupo
    g.fillStyle = '#b8b2ad'; rr(g, cx - w * 0.11, h * 0.3, w * 0.22, h * 0.07, 6); g.fill();
    const montado = fase !== 'preparar' || puckListo();
    if (montado) {
      // portafiltro y mango
      g.fillStyle = '#2c2624'; rr(g, cx - w * 0.12, h * 0.37, w * 0.24, h * 0.06, 8); g.fill();
      g.fillStyle = '#16110f'; rr(g, cx + w * 0.1, h * 0.385, w * 0.27, h * 0.035, 10); g.fill();
      g.fillStyle = '#8e8681'; g.fillRect(cx - w * 0.035, h * 0.43, w * 0.02, h * 0.025); g.fillRect(cx + w * 0.015, h * 0.43, w * 0.02, h * 0.025);
    } else {
      g.fillStyle = '#f6eedb88'; g.font = `${Math.round(h * 0.035)}px DotGothic16, monospace`; g.textAlign = 'center';
      g.fillText('Prepará el puck →', cx, h * 0.42);
    }
    // balanza y taza
    const by = h * 0.86;
    g.fillStyle = '#26201d'; rr(g, cx - w * 0.2, by, w * 0.4, h * 0.07, 6); g.fill();
    lcd(g, cx, by + h * 0.035, `${(shot ? shot.enTaza : 0).toFixed(1)} g`, h * 0.04, true);
    const tw = w * 0.15, tTop = h * 0.64, tBot = by;
    const lleno = shot ? limitar(shot.enTaza / 90, 0, 1) : 0;
    const nivelY = tBot - (tBot - tTop - 6) * lleno;
    if (lleno > 0) {
      const conc = shot.extraido / Math.max(1, shot.enTaza);
      g.fillStyle = mezcla('#b5793f', '#2e170b', limitar(conc * 7, 0, 1));
      g.fillRect(cx - tw / 2 + 3, nivelY, tw - 6, tBot - nivelY - 3);
      // crema: espuma de CO₂ y aceites (más espesa con café fresco y shot concentrado)
      const crema = Math.min(10, 2 + shot.enTaza * 0.12);
      g.fillStyle = '#c98a4b'; g.fillRect(cx - tw / 2 + 3, nivelY, tw - 6, Math.min(crema, tBot - nivelY - 3));
      g.fillStyle = '#e0b07a55'; g.fillRect(cx - tw / 2 + 3, nivelY, tw - 6, 2);
    }
    g.strokeStyle = '#f6eedbcc'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - tw / 2, tTop); g.lineTo(cx - tw / 2 + 2, tBot); g.lineTo(cx + tw / 2 - 2, tBot); g.lineTo(cx + tw / 2, tTop); g.stroke();
    // chorros
    if (shot && fase === 'extrayendo') {
      const q = shot.caudal;
      const col = mezcla('#d9a866', '#3b1a0c', limitar(shot.concentracion * 5.5, 0, 1));
      const y0 = h * 0.455;
      if (q > 0.55) {
        const ancho = 2 + Math.sqrt(q) * 2.6;
        for (const sx of [cx - w * 0.025, cx + w * 0.025]) {
          const desv = shot.canalActivo && !reducido ? Math.sin(performance.now() / 60 + sx) * shot.severidad * 3 : 0;
          g.strokeStyle = col; g.lineWidth = ancho; g.lineCap = 'round';
          g.beginPath(); g.moveTo(sx, y0); g.quadraticCurveTo(sx + desv, (y0 + nivelY) / 2, cx + (sx - cx) * 0.4 + desv, nivelY); g.stroke();
        }
      }
      if (q > 0.02) {
        tGotas -= dt;
        const cada = q > 0.55 ? 0.12 : 0.5 / Math.max(0.1, q);
        if (tGotas <= 0) { tGotas = cada; for (const sx of [cx - w * 0.025, cx + w * 0.025]) gotas.push({ x: sx, y: y0, vy: 0, vx: 0, col }); }
      }
      // canalización: chorritos que salpican de costado
      if (shot.canalActivo && !reducido && Math.random() < shot.severidad * 0.6) {
        gotas.push({ x: cx + (Math.random() - 0.5) * w * 0.08, y: y0, vx: (Math.random() - 0.5) * 120, vy: -30 * Math.random(), col: '#d9a866' });
      }
    }
    g.fillStyle = '#3b1a0c';
    for (let i = gotas.length - 1; i >= 0; i--) {
      const d = gotas[i];
      d.vy += 900 * dt; d.y += d.vy * dt; d.x += d.vx * dt;
      if (d.y >= nivelY) { gotas.splice(i, 1); continue; }
      g.fillStyle = d.col; g.beginPath(); g.arc(d.x, d.y, 2, 0, 7); g.fill();
    }
    if (shot?.canalActivo) {
      g.fillStyle = '#ffcf8a'; g.font = `${Math.round(h * 0.032)}px DotGothic16, monospace`; g.textAlign = 'left';
      g.fillText('💥 ¡canaliza!', w * 0.62, h * 0.5);
    }
  }

  function dibujarGrafico() {
    const { g, w, h } = ajustar(grafico);
    g.fillStyle = '#0004'; g.fillRect(0, 0, w, h);
    const x0 = 30, y0 = 8, ww = w - x0 - 34, hh = h - y0 - 20;
    const tmax = Math.max(40, Math.ceil(((shot?.t || 0) + 5) / 10) * 10);
    const X = t => x0 + (t / tmax) * ww;
    g.strokeStyle = '#ffffff14'; g.lineWidth = 1;
    g.fillStyle = '#a99fc6'; g.font = '10px DotGothic16, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let t = 0; t <= tmax; t += 10) { g.beginPath(); g.moveTo(X(t), y0); g.lineTo(X(t), y0 + hh); g.stroke(); g.fillText(`${t}s`, X(t), y0 + hh + 4); }
    // ventana de tiempo orientativa (no es una regla: depende de café y receta)
    g.fillStyle = '#4caf6a14'; g.fillRect(X(25), y0, X(35) - X(25), hh);
    const serie = (k, max, col, dash = []) => {
      const hs = shot?.historia || [];
      g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(dash); g.beginPath();
      hs.forEach((p, i) => { const y = y0 + hh - limitar(p[k] / max, 0, 1) * hh; i ? g.lineTo(X(p.t), y) : g.moveTo(X(p.t), y); });
      g.stroke(); g.setLineDash([]);
    };
    serie('presion', 12, '#5b7bd5');
    serie('caudal', 5, '#f2c14e');
    serie('enTaza', 60, '#f6eedb', [4, 3]);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    [['presión (0–12 bar)', '#5b7bd5'], ['caudal (0–5 g/s)', '#f2c14e'], ['en taza (0–60 g)', '#f6eedb']].forEach(([t, col], i) => {
      g.fillStyle = col; g.fillText(t, x0 + 6, y0 + 8 + i * 13);
    });
  }

  function dibujarDosis() {
    const { g, w, h } = ajustar(vasoDosis);
    g.clearRect(0, 0, w, h);
    const cx = w / 2, r = Math.min(w, h) * 0.42;
    g.fillStyle = '#8e8681'; g.beginPath(); g.ellipse(cx, h * 0.62, r, r * 0.45, 0, 0, 7); g.fill();
    g.fillStyle = '#2c2624'; g.beginPath(); g.ellipse(cx, h * 0.6, r * 0.85, r * 0.36, 0, 0, 7); g.fill();
    const f = limitar(puck.molido / 22, 0, 1.1);
    if (f > 0) {
      const alto = puck.tampeado ? r * 0.08 : r * 0.55 * f;
      g.fillStyle = puck.tampeado ? '#5a3a24' : '#6b4429';
      g.beginPath(); g.ellipse(cx, h * 0.6 - alto * 0.3, r * 0.85 * Math.min(1, 0.4 + f), r * 0.36 * Math.min(1, 0.4 + f) + alto * 0.4, 0, Math.PI, 0, true); g.fill();
    }
    const dif = puck.molido - receta.dosis;
    g.fillStyle = Math.abs(dif) < 0.35 ? '#8fe3a5' : '#a99fc6';
    g.font = '11px DotGothic16, monospace'; g.textAlign = 'center';
    g.fillText(`obj. ${receta.dosis} g`, cx, h * 0.12);
  }

  function dibujarWdt() {
    const { g, w } = ajustar(wdt);
    const r = w / 2;
    g.clearRect(0, 0, w, w);
    g.fillStyle = '#8e8681'; g.beginPath(); g.arc(r, r, r - 1, 0, 7); g.fill();
    g.fillStyle = puck.molido < 1 ? '#2c2624' : '#7a4f31'; g.beginPath(); g.arc(r, r, r * 0.88, 0, 7); g.fill();
    if (puck.molido >= 1) {
      for (let k = 0; k < 24; k++) {
        const an = Math.floor(k / 8), se = k % 8;
        const n = Math.round(puck.clumps[k] * 7);
        for (let j = 0; j < n; j++) {
          const a = ((se + ((j * 37 + k * 11) % 10) / 10) / 8) * Math.PI * 2 - Math.PI;
          const rr2 = ((an + ((j * 53 + k * 7) % 10) / 10) / 3) * r * 0.85;
          g.fillStyle = '#3a2416'; g.beginPath(); g.arc(r + Math.cos(a) * rr2, r + Math.sin(a) * rr2, 2.4, 0, 7); g.fill();
        }
      }
      for (let i = trazos.length - 1; i >= 0; i--) {
        const t = trazos[i]; t.v -= 0.04;
        if (t.v <= 0) { trazos.splice(i, 1); continue; }
        g.fillStyle = `rgba(246,238,219,${t.v * 0.25})`; g.beginPath(); g.arc(r + t.x * r, r + t.y * r, 3, 0, 7); g.fill();
      }
      if (puck.tampeado) { g.fillStyle = '#5a3a24cc'; g.beginPath(); g.arc(r, r, r * 0.88, 0, 7); g.fill(); }
    }
  }

  function dibujarNivel() {
    const { g, w, h } = ajustar(nivel);
    g.clearRect(0, 0, w, h);
    const cy = h * 0.32, x0 = w * 0.08, x1 = w * 0.92;
    g.fillStyle = '#c8e6a0'; rr(g, x0, cy - 9, x1 - x0, 18, 9); g.fill();
    g.strokeStyle = '#2a2140'; g.lineWidth = 1;
    for (const f of [-0.12, 0.12]) { const x = (x0 + x1) / 2 + f * (x1 - x0) / 2; g.beginPath(); g.moveTo(x, cy - 9); g.lineTo(x, cy + 9); g.stroke(); }
    const b = puck.tampeado ? (1 - puck.nivelado) / 1.05 * Math.sign(burbuja || 1) : burbuja;
    const bx = (x0 + x1) / 2 + b * (x1 - x0) / 2 * 0.9;
    g.fillStyle = '#ffffffdd'; g.beginPath(); g.ellipse(bx, cy, 10, 6, 0, 0, 7); g.fill();
    // tamper visto de costado, inclinado según la burbuja
    const ang = (puck.tampeado ? b : burbuja) * 0.18;
    g.save(); g.translate(w / 2, h * 0.78); g.rotate(ang);
    g.fillStyle = '#b8b2ad'; g.fillRect(-w * 0.14, -4, w * 0.28, 8);
    g.fillStyle = '#6b4429'; g.fillRect(-w * 0.03, -h * 0.28, w * 0.06, h * 0.26);
    g.restore();
  }

  function dibujarMapa() {
    const { g, w, h } = ajustar(mapa);
    g.fillStyle = '#0003'; g.fillRect(0, 0, w, h);
    const x0 = 28, y0 = 8, ww = w - x0 - 8, hh = h - y0 - 22;
    const X = ey => x0 + ((ey - 12) / 16) * ww, Y = t => y0 + hh - ((t - 5) / 10) * hh;
    const [e1, e2] = objetivo.ey;
    g.fillStyle = '#4caf6a33'; g.fillRect(X(e1), Y(12), X(e2) - X(e1), Y(7.5) - Y(12));
    g.strokeStyle = '#4caf6a'; g.strokeRect(X(e1), Y(12), X(e2) - X(e1), Y(7.5) - Y(12));
    g.fillStyle = '#a99fc6'; g.font = '10px DotGothic16, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (const ey of [14, 18, 22, 26]) g.fillText(ey + '%', X(ey), y0 + hh + 3);
    g.fillText('extracción →', x0 + ww / 2, y0 + hh + 11);
    g.textAlign = 'left'; g.fillText('agrio', x0 + 3, y0 + 3); g.textAlign = 'right'; g.fillText('amargo', x0 + ww - 3, y0 + 3);
    g.save(); g.translate(10, y0 + hh / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('TDS', 0, 0); g.restore();
    historial.forEach(({ r }, i) => {
      const x = limitar(X(r.ey), x0, x0 + ww), y = limitar(Y(r.tds), y0, y0 + hh);
      if (i) { const p = historial[i - 1].r; g.strokeStyle = '#ffffff44'; g.beginPath(); g.moveTo(limitar(X(p.ey), x0, x0 + ww), limitar(Y(p.tds), y0, y0 + hh)); g.lineTo(x, y); g.stroke(); }
      g.fillStyle = i === historial.length - 1 ? '#f2c14e' : '#d39a62'; g.beginPath(); g.arc(x, y, i === historial.length - 1 ? 5 : 3.5, 0, 7); g.fill();
    });
  }

  nuevoPuck();
  if (diarioReg && diarioReg.intentos >= 5) {
    agotada = true;
    actualizarFase();
    resultado.append(el('div.panel', `📅 Ya jugaste el desafío de hoy: ${diarioReg.mejor} puntos. Mañana hay otra receta rota; mientras tanto, la práctica libre no tiene límite.`));
  }
  requestAnimationFrame(dibujarMapa);
  return () => { parar(); pararBomba(); pararMolino(); removeEventListener('keydown', tecla); };
}

// ---------- perilla de molienda (SVG, arrastrable, accesible) ----------
function perillaMolienda(valor, alCambiar, bloqueada) {
  const [min, max] = MOLIENDA_RANGO;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('ac-perilla');
  const marcas = [];
  for (let v = min; v <= max; v++) {
    const a = ang(v);
    const largo = v % 5 === 0 ? 8 : 4;
    marcas.push(`<line x1="${50 + Math.cos(a) * 44}" y1="${50 + Math.sin(a) * 44}" x2="${50 + Math.cos(a) * (44 - largo)}" y2="${50 + Math.sin(a) * (44 - largo)}" stroke="#d6c2a6" stroke-width="${v % 5 === 0 ? 2 : 1}"/>`);
  }
  svg.innerHTML = `${marcas.join('')}<circle cx="50" cy="50" r="30" fill="#3b3330" stroke="#8e8681" stroke-width="3"/><line class="ind" x1="50" y1="50" x2="50" y2="24" stroke="#f2c14e" stroke-width="4" stroke-linecap="round"/><text x="50" y="56" text-anchor="middle" font-size="15" fill="#f6eedb" font-family="DotGothic16, monospace" class="num"></text><text x="12" y="98" font-size="9" fill="#a99fc6" font-family="DotGothic16">fino</text><text x="66" y="98" font-size="9" fill="#a99fc6" font-family="DotGothic16">grueso</text>`;
  const cont = el('div.ac-perilla-caja', {
    tabindex: bloqueada ? -1 : 0, role: 'slider', 'aria-label': 'Molienda (menor = más fino)',
    'aria-valuemin': min, 'aria-valuemax': max, 'aria-disabled': bloqueada ? 'true' : 'false',
  }, svg);
  if (bloqueada) cont.classList.add('bloq');
  const btnMenos = el('button.btn.chico', { disabled: bloqueada, onclick: () => set(valor - 0.5), 'aria-label': 'más fino' }, '◀ fino');
  const btnMas = el('button.btn.chico', { disabled: bloqueada, onclick: () => set(valor + 0.5), 'aria-label': 'más grueso' }, 'grueso ▶');
  function ang(v) { return Math.PI * 0.75 + ((v - min) / (max - min)) * Math.PI * 1.5; }
  function pintar() {
    const a = ang(valor) * 180 / Math.PI + 90;
    svg.querySelector('.ind').setAttribute('transform', `rotate(${a} 50 50)`);
    svg.querySelector('.num').textContent = valor.toFixed(1);
    cont.setAttribute('aria-valuenow', valor);
  }
  function set(v) {
    const nv = Math.round(limitar(v, min, max) * 2) / 2;
    if (nv !== valor) { valor = nv; sfx.cursor(); alCambiar(valor); }
    pintar();
  }
  let arrastre = false;
  const desdePuntero = e => {
    const r = svg.getBoundingClientRect();
    let a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    a = (a - Math.PI * 0.75 + Math.PI * 4) % (Math.PI * 2);
    if (a > Math.PI * 1.5) a = a > Math.PI * 1.75 ? 0 : Math.PI * 1.5;
    set(min + (a / (Math.PI * 1.5)) * (max - min));
  };
  cont.addEventListener('pointerdown', e => { if (bloqueada) return; arrastre = true; cont.setPointerCapture(e.pointerId); desdePuntero(e); });
  cont.addEventListener('pointermove', e => { if (arrastre) desdePuntero(e); });
  cont.addEventListener('pointerup', () => { arrastre = false; });
  cont.addEventListener('keydown', e => {
    if (bloqueada) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(valor - 0.5); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(valor + 0.5); }
  });
  pintar();
  return el('div.ac-perilla-fila', btnMenos, cont, btnMas);
}

// ---------- utilidades de dibujo ----------
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function lcd(g, x, y, txt, tam, verde = false) {
  g.font = `${Math.round(tam)}px DotGothic16, monospace`;
  const m = g.measureText(txt).width;
  g.fillStyle = '#111a12'; rr(g, x - m / 2 - 8, y - tam * 0.75, m + 16, tam * 1.5, 4); g.fill();
  g.fillStyle = verde ? '#9ff0c0' : '#f2c14e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, x, y + 1);
}
