// Minijuego 3 — Latte Art Academy: dibujá con el vertido (posición, inclinación y altura de la jarra).
import { el, sfx, limitar } from '../util.js';
import { evento } from '../progreso.js';
import { N, crearSuperficie, paso, evaluarLatte, LECCIONES, mascara, coord, NIVEL_INICIAL } from './modelo-latte.js';
import { desbloqueada } from './modelo-academia.js';
import { academia, registrarAcademia } from './progreso-academia.js';
import { intro, estrellas, barras, bucle, ajustar, lienzo, siseo, menosMovimiento } from './vista.js';

const APRUEBA = 80;
const ETIQUETAS = { forma: 'Forma', hojas: 'Hojas', simetria: 'Simetría', centrado: 'Centrado', definicion: 'Definición', nivel: 'Taza llena', continuidad: 'Continuidad', constancia: 'Flujo constante', limpio: 'Crema limpia' };

export function hubLatte(c, ctx) {
  const a = academia();
  c.append(
    intro({ aprender: 'El dibujo depende de tres cosas que controlás con la jarra: dónde cae el chorro, cuánto flujo sale (inclinación) y a qué altura está el pico. Alto = la leche se hunde; rozando = la espuma flota y dibuja.',
      meta: 'Progresión clásica: control del flujo → círculo → corazón → tulipán → rosetta. Cada lección se aprueba con 80.' }),
    el('div.ac-lecciones', LECCIONES.map((L, i) => {
      const abierta = desbloqueada(a, LECCIONES, L.id);
      const reg = a.lecciones[L.id];
      return el('button.ac-leccion' + (abierta ? '' : '.bloq') + (reg?.aprobada ? '.hecha' : ''), { disabled: !abierta, onclick: () => ctx.ir(L.t, (cc, cx) => taza(cc, cx, L)) },
        el('span.n', String(i + 1)), el('span.t', L.t), reg ? estrellas(reg.estrellas) : el('span.suave', abierta ? 'nueva' : '🔒'));
    })),
    el('button.tarjeta', { onclick: () => ctx.ir('Lienzo libre', (cc, cx) => taza(cc, cx, null)) },
      el('div.t-ico', '🎨'), el('div.t-tit', 'Lienzo libre'), el('div.t-desc', 'Sin objetivo ni puntaje: experimentá con flujo, altura y movimiento.')),
  );
}

function taza(c, ctx, L) {
  const reducido = menosMovimiento();
  let s = crearSuperficie();
  let grabacion = [];
  let repitiendo = null;
  // estado de la mano
  const mano = { x: 0, y: 0.1, ox: 0, oy: 0.1, objX: 0, objY: 0.1, vertiendo: false, flujo: 0.5, altura: 'alta', teclaCerca: false };
  let terminado = false, quieto = 0, sonido = null, guia = !!L && L.fig;
  const mask = L?.fig ? mascara(L.fig) : null;

  const cv = lienzo('ac-latte', 'Taza vista desde arriba. Mantené apretado para verter; mové para dirigir el chorro.');
  cv.tabIndex = 0;
  const off = document.createElement('canvas'); off.width = N; off.height = N;
  const offG = off.getContext('2d');
  const img = offG.createImageData(N, N);
  // textura fija de la crema (manchas tipo "tigre")
  const textura = Float32Array.from({ length: N * N }, (_, k) => 0.92 + 0.08 * Math.sin(k * 12.9898) * Math.sin(k * 0.071));

  const flujo = el('input', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Inclinación de la jarra (flujo)' });
  flujo.addEventListener('input', () => { mano.flujo = +flujo.value / 100; });
  const ALTURAS = { alta: { n: '⬆ Alta', v: 0.9, d: 'la leche se hunde: llena la base' }, media: { n: '↕ Media', v: 0.5, d: 'para cortar' }, cerca: { n: '⬇ Cerca', v: 0.06, d: 'rozando: dibuja' } };
  const btnAltura = el('div.chips', { role: 'radiogroup', 'aria-label': 'Altura de la jarra' }, Object.entries(ALTURAS).map(([k, a], i) =>
    el('button.chip', { role: 'radio', 'data-alt': k, title: `${a.d} (tecla ${i + 1})`, onclick: () => { mano.altura = k; pintarAltura(); } }, a.n)));
  const alturaActual = () => (mano.teclaCerca ? 'cerca' : mano.altura);
  const pintarAltura = () => btnAltura.querySelectorAll('.chip').forEach(b => {
    const sel = b.dataset.alt === alturaActual();
    b.classList.toggle('sel', sel); b.setAttribute('aria-checked', String(sel));
  });
  const medidores = el('canvas.ac-medidores', { role: 'img', 'aria-label': 'Nivel de la taza, flujo y altura' });
  const lectura = el('div.ac-lectura', { 'aria-live': 'off' });
  const resultado = el('div', { 'aria-live': 'polite' });
  setTimeout(pintarAltura);
  const chkGuia = el('label.fila', el('input', { type: 'checkbox', checked: guia, disabled: !mask, onchange: e => { guia = e.target.checked; } }), 'Mostrar la figura guía');

  c.append(
    L ? intro({ aprender: L.aprender, meta: L.meta, extra: el('div.suave', `💡 ${L.ayuda}`) }) : intro({ meta: 'Experimentá libremente. Probá verter alto y después rozando, quieto y moviendo la jarra.' }),
    el('div.ac-banco',
      el('div.ac-col', cv, el('div.suave', '🖱️ Mantené apretado sobre la taza para verter y mové para dirigir el chorro. La jarra entra desde arriba. Rueda o +/−: inclinación · Altura: 1 alta, 2 media, 3 cerca (o mantené Shift = cerca) · Teclado: flechas mueven, Espacio vierte.')),
      el('div.ac-col',
        el('div.panel', el('div.fila', el('b', 'Inclinación (flujo)'), flujo), el('div.fila', el('b', 'Altura'), btnAltura), chkGuia, medidores, lectura,
          el('div.fila', el('button.btn', { onclick: reiniciar }, '↻ Taza nueva'), L ? el('button.btn.prim', { onclick: () => evaluar() }, '✔ Evaluar') : null,
            el('button.btn', { onclick: repetir }, '▶ Repetición'))),
        resultado)));

  // ---------- entrada ----------
  let radioLiquido = 1;
  const aTaza = e => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - (r.left + r.width / 2)) / radioLiquido, (e.clientY - (r.top + r.height / 2)) / radioLiquido];
  };
  cv.addEventListener('pointerdown', e => { if (repitiendo) return; cv.setPointerCapture(e.pointerId); [mano.objX, mano.objY] = aTaza(e); mano.vertiendo = true; cv.focus({ preventScroll: true }); });
  cv.addEventListener('pointermove', e => { [mano.objX, mano.objY] = aTaza(e); });
  const soltar = () => { mano.vertiendo = false; };
  cv.addEventListener('pointerup', soltar);
  cv.addEventListener('pointercancel', soltar);
  cv.addEventListener('wheel', e => { e.preventDefault(); mano.flujo = limitar(mano.flujo - Math.sign(e.deltaY) * 0.05, 0, 1); flujo.value = Math.round(mano.flujo * 100); }, { passive: false });
  const teclas = new Set();
  const abajo = e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '') && document.activeElement !== flujo) return;
    if (e.key === 'Shift') { mano.teclaCerca = true; pintarAltura(); }
    if (['1', '2', '3'].includes(e.key)) { mano.altura = ['alta', 'media', 'cerca'][+e.key - 1]; pintarAltura(); }
    if (document.activeElement !== cv) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', '+', '-'].includes(e.key)) e.preventDefault();
    if (e.key === ' ') mano.vertiendo = true;
    if (e.key === '+') { mano.flujo = limitar(mano.flujo + 0.05, 0, 1); flujo.value = Math.round(mano.flujo * 100); }
    if (e.key === '-') { mano.flujo = limitar(mano.flujo - 0.05, 0, 1); flujo.value = Math.round(mano.flujo * 100); }
    teclas.add(e.key);
  };
  const arriba = e => {
    if (e.key === 'Shift') { mano.teclaCerca = false; pintarAltura(); }
    if (e.key === ' ') mano.vertiendo = false;
    teclas.delete(e.key);
  };
  addEventListener('keydown', abajo);
  addEventListener('keyup', arriba);

  function reiniciar() {
    s = crearSuperficie();
    grabacion = [];
    terminado = false; quieto = 0; repitiendo = null;
    resultado.replaceChildren();
  }

  function repetir() {
    if (!grabacion.length) return;
    const copia = grabacion.slice();
    s = crearSuperficie();
    terminado = true;
    repitiendo = { cuadros: copia, i: 0 };
  }

  // ---------- bucle ----------
  const parar = bucle(dt => {
    dt = Math.min(dt, 1 / 30);
    let entrada;
    if (repitiendo) {
      const q = repitiendo.cuadros[repitiendo.i++];
      if (!q) { repitiendo = null; } else { entrada = q.e; dt = q.dt; mano.x = q.e.x; mano.y = q.e.y; }
    }
    if (!entrada) {
      // teclado mueve el objetivo; la mano lo sigue con algo de inercia (como un brazo real)
      const v = 0.9 * dt;
      if (teclas.has('ArrowLeft')) mano.objX -= v;
      if (teclas.has('ArrowRight')) mano.objX += v;
      if (teclas.has('ArrowUp')) mano.objY -= v;
      if (teclas.has('ArrowDown')) mano.objY += v;
      const r = Math.hypot(mano.objX, mano.objY);
      if (r > 1.15) { mano.objX *= 1.15 / r; mano.objY *= 1.15 / r; }
      mano.ox = mano.x; mano.oy = mano.y;
      const k = 1 - Math.exp(-dt * 18);
      mano.x += (mano.objX - mano.x) * k;
      mano.y += (mano.objY - mano.y) * k;
      entrada = {
        vertiendo: mano.vertiendo && !terminado && Math.hypot(mano.x, mano.y) < 1, x: mano.x, y: mano.y,
        flujo: mano.flujo, altura: ALTURAS[alturaActual()].v, mx: (mano.x - mano.ox) / Math.max(1e-3, dt), my: (mano.y - mano.oy) / Math.max(1e-3, dt), calidad: 1,
      };
      if (!terminado) grabacion.push({ dt, e: entrada });
    }
    paso(s, dt, entrada);
    // sonido del vertido
    if (entrada.vertiendo && !sonido) sonido = siseo(0.006, 700);
    if (!entrada.vertiendo && sonido) { sonido.parar(); sonido = null; }
    sonido?.set(0.004 + entrada.flujo * 0.01, 500 + entrada.flujo * 600);
    // fin automático: taza llena y el chorro cortado
    if (L && !terminado && !repitiendo) {
      quieto = !entrada.vertiendo && s.nivel > 0.95 ? quieto + dt : 0;
      if (quieto > 0.7 || s.rebalso > 6) evaluar();
    }
    dibujar(entrada);
    lectura.textContent = `Taza ${Math.round(s.nivel * 100)} % · flujo ${Math.round(entrada.flujo * 100)} % · jarra ${entrada.altura < 0.3 ? 'cerca' : entrada.altura < 0.7 ? 'media' : 'alta'}${s.tVertiendo ? ` · ${s.tVertiendo.toFixed(1)} s vertiendo` : ''}`;
  });

  function dibujar(e) {
    // superficie
    const d = img.data;
    for (let k = 0; k < N * N; k++) {
      const cr = s.C[k], w = s.W[k], t = textura[k];
      const r = (107 + 69 * (1 - cr)) * t, g = (58 + 64 * (1 - cr)) * t, b = (29 + 45 * (1 - cr)) * t;
      d[k * 4] = r + (251 - r) * w; d[k * 4 + 1] = g + (246 - g) * w; d[k * 4 + 2] = b + (238 - b) * w; d[k * 4 + 3] = 255;
    }
    offG.putImageData(img, 0, 0);
    const { g, w, h } = ajustar(cv);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
    g.fillStyle = '#1c1410'; g.fillRect(0, 0, w, h);
    // plato y taza
    g.fillStyle = '#e9e1d3'; g.beginPath(); g.arc(cx, cy, R * 1.22, 0, 7); g.fill();
    g.fillStyle = '#00000022'; g.beginPath(); g.arc(cx + 4, cy + 6, R * 1.1, 0, 7); g.fill();
    g.fillStyle = '#fbf8f2'; g.beginPath(); g.arc(cx, cy, R * 1.09, 0, 7); g.fill();
    g.fillStyle = '#fbf8f2'; g.fillRect(cx + R * 1.05, cy - R * 0.12, R * 0.32, R * 0.24); // asa
    // líquido: más abajo (más oscuro y chico) cuando la taza está vacía
    const lleno = limitar((s.nivel - NIVEL_INICIAL) / (1 - NIVEL_INICIAL), 0, 1);
    const rl = R * (0.82 + 0.18 * lleno);
    radioLiquido = rl;
    g.save(); g.beginPath(); g.arc(cx, cy, rl, 0, 7); g.clip();
    g.imageSmoothingEnabled = true;
    g.filter = `blur(${(rl / N) * 0.55}px)`; // suaviza el borde pixelado de la grilla
    g.drawImage(off, cx - rl, cy - rl, rl * 2, rl * 2);
    g.filter = 'none';
    g.fillStyle = `rgba(20,10,5,${0.35 * (1 - lleno)})`; g.fillRect(cx - rl, cy - rl, rl * 2, rl * 2);
    g.restore();
    g.strokeStyle = '#d8cfc0'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * 1.09, 0, 7); g.stroke();
    // figura guía
    if (guia && mask) {
      g.fillStyle = '#f2c14e55';
      for (let j = 1; j < N - 1; j += 1) for (let i = 1; i < N - 1; i += 1) {
        const k = j * N + i;
        if (mask[k] && (!mask[k - 1] || !mask[k + 1] || !mask[k - N] || !mask[k + N])) g.fillRect(cx + coord(i) * rl - 1, cy + coord(j) * rl - 1, 2.5, 2.5);
      }
    }
    // jarra (sombra del pico) y chorro
    const px = cx + e.x * rl, py = cy + e.y * rl;
    const alto = 4 + e.altura * 26;
    g.fillStyle = `rgba(0,0,0,${0.3 - e.altura * 0.15})`;
    g.beginPath(); g.ellipse(px + alto * 0.4, py + alto * 0.4, 9 + e.altura * 10, 6 + e.altura * 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#b8b2ad'; g.lineWidth = 2;
    g.beginPath(); g.arc(px, py - alto, 9, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
    if (e.vertiendo) {
      g.strokeStyle = '#fbf6ee'; g.lineWidth = 1.5 + e.flujo * 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(px, py - alto); g.lineTo(px, py); g.stroke();
      if (!reducido) { g.strokeStyle = '#ffffff55'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 6 + (performance.now() / 40) % 10, 0, 7); g.stroke(); }
    }
    dibujarMedidores(e);
  }

  function dibujarMedidores(e) {
    const { g, w, h } = ajustar(medidores);
    g.clearRect(0, 0, w, h);
    const barra = (x, etiqueta, valor, zonas) => {
      const y0 = 14, y1 = h - 18, bw = 18;
      g.fillStyle = '#0005'; g.fillRect(x, y0, bw, y1 - y0);
      for (const [a, b, col] of zonas) { g.fillStyle = col; g.fillRect(x, y1 - b * (y1 - y0), bw, (b - a) * (y1 - y0)); }
      g.fillStyle = '#f6eedb'; g.fillRect(x - 3, y1 - valor * (y1 - y0) - 1.5, bw + 6, 3);
      g.fillStyle = '#a99fc6'; g.font = '10px DotGothic16, monospace'; g.textAlign = 'center'; g.fillText(etiqueta, x + bw / 2, h - 5);
    };
    barra(w * 0.15, 'taza', limitar(s.nivel, 0, 1), [[0.9, 1, '#4caf6a66'], [0.45, 0.55, '#f2c14e44']]);
    barra(w * 0.45, 'flujo', e.flujo, L && !L.fig ? [[0.35, 0.65, '#4caf6a44']] : []);
    barra(w * 0.75, 'altura', e.altura, [[0, 0.3, '#5b7bd544']]);
  }

  function evaluar() {
    if (terminado || !L) return;
    terminado = true;
    mano.vertiendo = false;
    sonido?.parar(); sonido = null;
    const ev = evaluarLatte(s, L);
    const aprob = ev.puntaje >= APRUEBA;
    const est = ev.puntaje >= 95 ? 3 : ev.puntaje >= 88 ? 2 : aprob ? 1 : 0;
    registrarAcademia({ comp: 'latte', leccion: L.id, puntaje: ev.puntaje, estrellas: est, aprobada: aprob, errores: [] }, aprob ? 'latte art' : 'práctica de latte art');
    if (aprob) { sfx.subir(); evento('latte_' + (L.fig || 'flujo')); } else sfx.mal();
    resultado.replaceChildren(el('div.panel',
      el('div.fila', el('span.mediano', `${ev.puntaje}`), el('span.suave', '/100'), estrellas(est), el('span', aprob ? '✅ ¡Aprobada!' : `Aprobás con ${APRUEBA}`)),
      barras(Object.fromEntries(Object.entries(ev.partes).map(([k, v]) => [k, v * 10])), ETIQUETAS),
      ev.notas.map(n => el('div', n)),
      el('div.fila', el('button.btn.prim', { onclick: reiniciar }, '↻ Otra taza'), el('button.btn', { onclick: repetir }, '▶ Ver repetición'),
        aprob ? el('button.btn', { onclick: () => ctx.volver() }, 'Siguiente lección ▶') : null)));
    resultado.scrollIntoView({ block: 'nearest', behavior: reducido ? 'auto' : 'smooth' });
  }

  return () => { parar(); sonido?.parar(); removeEventListener('keydown', abajo); removeEventListener('keyup', arriba); };
}
