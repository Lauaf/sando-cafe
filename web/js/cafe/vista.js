// Piezas de interfaz compartidas por los minijuegos de la Academia (lienzos, bucles, paneles, sonidos).
import { el, audio, sonido, limitar } from '../util.js';

export const menosMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Canvas accesible: lleva una descripción para lectores de pantalla. */
export function lienzo(clase, descripcion) {
  return el('canvas' + (clase ? '.' + clase : ''), { role: 'img', 'aria-label': descripcion });
}

/** Ajusta la resolución del canvas a su tamaño en pantalla y devuelve el contexto listo para dibujar en px CSS. */
export function ajustar(c) {
  const r = c.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: r.width, h: r.height };
}

/** requestAnimationFrame con dt en segundos (máx 0.1). Devuelve la función para cortarlo. */
export function bucle(fn) {
  let id = 0, ant = performance.now(), vivo = true;
  const f = t => {
    if (!vivo) return;
    const dt = Math.min(0.1, (t - ant) / 1000);
    ant = t;
    fn(dt, t / 1000);
    id = requestAnimationFrame(f);
  };
  id = requestAnimationFrame(f);
  return () => { vivo = false; cancelAnimationFrame(id); };
}

/** Panel "Aprender / Objetivo" con el que arranca cada actividad. */
export function intro({ aprender, meta, extra }) {
  if (!aprender && !meta && !extra) return document.createDocumentFragment();
  return el('div.panel.ac-intro',
    aprender ? el('div', el('b', '📖 Aprender: '), aprender) : null,
    meta ? el('div', el('b', '🎯 Objetivo: '), meta) : null,
    extra || null);
}

export const estrellas = (n, max = 3) => el('span.estrellas', { 'aria-label': `${n} de ${max} estrellas` }, '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n)));

/** Barras horizontales 0..10 (perfil de sabor estimado, atributos, etc.). */
export function barras(valores, etiquetas, { max = 10, colores = {} } = {}) {
  return el('div.ac-barras', Object.entries(valores).map(([k, v]) => el('div.ac-barra',
    el('span', etiquetas[k] || k),
    el('div.hp', el('i', { style: { width: `${limitar(v / max, 0, 1) * 100}%`, background: colores[k] || 'var(--acento)' } })),
    el('span.val', (Math.round(v * 10) / 10).toString()))));
}

/** Zona de anuncios para lectores de pantalla y feedback textual. */
export const vivo = (clase = '') => el('div' + clase, { 'aria-live': 'polite' });

/** Interpolación de colores hex (#rrggbb). */
export function mezcla(a, b, t) {
  const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  t = limitar(t, 0, 1);
  const h = v => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

/**
 * Botón de "mantener apretado" (mouse, touch y teclado: Espacio/Enter).
 * alIniciar() al apretar, alSoltar() al soltar o perder el foco.
 */
export function mantener(boton, { alIniciar, alSoltar }) {
  let activo = false;
  const ini = e => { if (boton.disabled || activo) return; e?.preventDefault?.(); activo = true; boton.classList.add('apretado'); alIniciar(); };
  const fin = () => { if (!activo) return; activo = false; boton.classList.remove('apretado'); alSoltar(); };
  boton.addEventListener('pointerdown', e => { boton.setPointerCapture?.(e.pointerId); ini(e); });
  boton.addEventListener('pointerup', fin);
  boton.addEventListener('pointercancel', fin);
  boton.addEventListener('lostpointercapture', fin);
  boton.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) ini(e); });
  boton.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') fin(); });
  boton.addEventListener('blur', fin);
  boton.addEventListener('contextmenu', e => e.preventDefault());
  return boton;
}

/** Selector numérico con − / + y teclado (flechas). */
export function paso({ etiqueta, valor, min, max, delta, fmt = v => v, alCambiar, bloqueado = false, nota }) {
  const v = el('span.val', fmt(valor));
  const set = x => { valor = Math.round(limitar(x, min, max) / delta) * delta; v.textContent = fmt(valor); alCambiar(valor); };
  const menos = el('button.btn.chico', { onclick: () => set(valor - delta), disabled: bloqueado, 'aria-label': `bajar ${etiqueta}` }, '−');
  const mas = el('button.btn.chico', { onclick: () => set(valor + delta), disabled: bloqueado, 'aria-label': `subir ${etiqueta}` }, '+');
  const nodo = el('div.ac-paso' + (bloqueado ? '.bloq' : ''), el('span', etiqueta), menos, v, mas, nota ? el('span.suave', nota) : null);
  nodo.fijar = x => { valor = x; v.textContent = fmt(valor); };
  return nodo;
}

// ---------- Sonidos discretos (respetan el botón de silencio del juego) ----------
/** Zumbido continuo (bomba, molino). Devuelve la función para apagarlo. */
export function zumbido(freq = 55, vol = 0.02, tipo = 'sawtooth', corte = 380) {
  if (!sonido.activo) return () => {};
  try {
    const a = audio();
    const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    o.type = tipo; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = corte;
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, a.currentTime + 0.08);
    o.connect(f).connect(g).connect(a.destination);
    o.start();
    return () => { try { g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.08); o.stop(a.currentTime + 0.1); } catch { /* */ } };
  } catch { return () => {}; }
}

/** Ruido filtrado (vapor, vertido). Devuelve {set(vol, hz), parar()}. */
export function siseo(vol = 0.015, hz = 2500) {
  const nada = { set() {}, parar() {} };
  if (!sonido.activo) return nada;
  try {
    const a = audio();
    const buf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = 0.8;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
    return {
      set(v, h) { g.gain.setTargetAtTime(v, a.currentTime, 0.05); if (h) f.frequency.setTargetAtTime(h, a.currentTime, 0.05); },
      parar() { try { g.gain.setTargetAtTime(0.0001, a.currentTime, 0.04); src.stop(a.currentTime + 0.2); } catch { /* */ } },
    };
  } catch { return nada; }
}

/**
 * Vaso/taza en SVG con capas (de abajo hacia arriba): [{tipo, ml, color, mancha?}].
 * cap = capacidad en ml (llena el 92 % del alto). Si se pasa, chorrea por el borde.
 */
export function svgTaza(capas, cap, { ancho = 120, alto = 170, etiqueta = '' } = {}) {
  const top = 14, bot = alto - 12, izq = 14, der = ancho - 14, insetBase = 10;
  const interior = (bot - top) * 0.92;
  const total = capas.reduce((s, c) => s + c.ml, 0);
  const xAt = (y, lado) => {
    const f = (bot - y) / (bot - top);
    return lado < 0 ? izq + insetBase * (1 - f) + 2 : der - insetBase * (1 - f) - 2;
  };
  let y = bot - 3, partes = '';
  for (const c of capas) {
    const h = Math.min(y - top + 4, (c.ml / cap) * interior);
    if (h <= 0.2) continue;
    const y2 = y - h;
    if (c.tipo === 'espuma') {
      // borde superior "esponjoso"
      const n = 7, ancho2 = xAt(y2, 1) - xAt(y2, -1);
      let ondas = '';
      for (let i = 0; i <= n; i++) ondas += `${i ? 'L' : 'M'}${xAt(y2, -1) + (ancho2 * i) / n},${y2 - (i % 2 ? 2.5 : 0)} `;
      partes += `<path d="${ondas} L${xAt(y, 1)},${y} L${xAt(y, -1)},${y} Z" fill="${c.color}"/>`;
      if (c.mancha) partes += `<ellipse cx="${ancho / 2}" cy="${y2 + 2}" rx="9" ry="3" fill="#8a5530"/>`;
    } else {
      partes += `<path d="M${xAt(y2, -1)},${y2} L${xAt(y2, 1)},${y2} L${xAt(y, 1)},${y} L${xAt(y, -1)},${y} Z" fill="${c.color}"/>`;
    }
    y = y2;
  }
  const rebalsa = total > cap * 1.0;
  const chorreo = rebalsa ? `<path d="M${der - 1},${top} q4,10 2,${(bot - top) * 0.6}" stroke="#c9a77a" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="${der + 2}" cy="${bot + 4}" rx="10" ry="3" fill="#c9a77a88"/>` : '';
  return `<svg viewBox="0 0 ${ancho} ${alto + 8}" class="ac-taza-svg" role="img" aria-label="${etiqueta || 'taza'}">
<path d="M${izq},${top} L${der},${top} L${der - insetBase},${bot} L${izq + insetBase},${bot} Z" fill="#ffffff10"/>
${partes}
<path d="M${izq},${top} L${izq + insetBase},${bot} L${der - insetBase},${bot} L${der},${top}" fill="none" stroke="#f6eedbcc" stroke-width="2.5" stroke-linejoin="round"/>
<line x1="${izq - 2}" y1="${top}" x2="${der + 2}" y2="${top}" stroke="#f6eedb66" stroke-width="1.5"/>
${chorreo}
</svg>`;
}

/** Barra apilada de proporciones (para comparar lo preparado con una receta). */
export function barraProporciones(prop, colores, nombres) {
  return el('div.ac-prop', Object.entries(prop).filter(([, v]) => v > 0.001).map(([k, v]) =>
    el('div', { style: { width: `${v * 100}%`, background: colores[k] }, title: `${nombres[k]} ${Math.round(v * 100)} %` },
      v > 0.12 ? `${Math.round(v * 100)}%` : '')));
}

/**
 * Arrastrar una jarra/fuente sobre un destino para verter (mouse y táctil). Con teclado: mantener Espacio/Enter
 * sobre la fuente vierte directo. Mientras vierte llama alVerter(dt); alEmpezar/alParar marcan cada chorro.
 */
export function arrastrarParaVerter(fuente, { destino, alVerter, alEmpezar = () => {}, alParar = () => {}, color = '#f1e6d2' }) {
  let fantasma = null, chorro = null, parar = null, vertiendo = false, px = 0, py = 0;
  fuente.style.touchAction = 'none';
  const empezar = () => { if (!vertiendo) { vertiendo = true; alEmpezar(); } };
  const cortar = () => { if (vertiendo) { vertiendo = false; alParar(); } };
  const dentro = () => {
    const r = destino().getBoundingClientRect();
    return px > r.left - 30 && px < r.right + 30 && py > r.top - 140 && py < r.bottom;
  };
  const pintar = () => {
    if (!fantasma) return;
    fantasma.style.left = `${px - 28}px`;
    fantasma.style.top = `${py - 28}px`;
    const sobre = dentro();
    fantasma.classList.toggle('vierte', sobre);
    if (sobre) {
      const r = destino().getBoundingClientRect();
      const y0 = py + 14, y1 = r.top + r.height * 0.35;
      Object.assign(chorro.style, { display: 'block', left: `${px - 18}px`, top: `${y0}px`, height: `${Math.max(0, y1 - y0)}px`, background: color });
      empezar();
    } else { chorro.style.display = 'none'; cortar(); }
  };
  fuente.addEventListener('pointerdown', e => {
    if (fuente.disabled || fantasma) return;
    e.preventDefault();
    fuente.setPointerCapture(e.pointerId);
    px = e.clientX; py = e.clientY;
    fantasma = el('div.ac-fantasma', fuente.dataset.ico || '🫗');
    chorro = el('div.ac-chorro');
    document.body.append(chorro, fantasma);
    pintar();
    parar = bucle(dt => { if (vertiendo) alVerter(dt); });
  });
  fuente.addEventListener('pointermove', e => { if (fantasma) { px = e.clientX; py = e.clientY; pintar(); } });
  const soltar = () => {
    if (!fantasma) return;
    fantasma.remove(); chorro.remove(); fantasma = chorro = null;
    parar?.(); parar = null;
    cortar();
  };
  fuente.addEventListener('pointerup', soltar);
  fuente.addEventListener('pointercancel', soltar);
  fuente.addEventListener('lostpointercapture', soltar);
  // teclado: mantener apretado vierte sin arrastrar
  fuente.addEventListener('keydown', e => {
    if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || fuente.disabled) return;
    e.preventDefault();
    empezar();
    parar = bucle(dt => { if (vertiendo) alVerter(dt); });
  });
  const finTecla = () => { if (!fantasma) { parar?.(); parar = null; cortar(); } };
  fuente.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') finTecla(); });
  fuente.addEventListener('blur', finTecla);
  return () => soltar();
}
