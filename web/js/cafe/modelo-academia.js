// Academia de barismo: competencias, lecciones, dominio y recomendaciones (lógica pura, sin DOM).
// El estado vive en P.cafe.academia; acá solo hay funciones que lo leen y lo actualizan.

export const COMPETENCIAS = {
  extraccion: { n: 'Extracción', ico: '☕', desc: 'Molienda, dosis, ratio, temperatura y preparación del puck.' },
  diagnostico: { n: 'Diagnóstico', ico: '🩺', desc: 'Leer un sabor y saber qué variable tocar.' },
  recetas: { n: 'Recetas', ico: '📐', desc: 'Proporciones de espresso, leche, espuma y agua.' },
  leche: { n: 'Leche', ico: '🥛', desc: 'Airear, texturizar y llegar a la temperatura justa.' },
  latte: { n: 'Latte art', ico: '🎨', desc: 'Control del flujo, altura y trayectoria del vertido.' },
  servicio: { n: 'Servicio', ico: '⏱️', desc: 'Priorizar, trabajar en paralelo y no equivocarse bajo presión.' },
  filtrado: { n: 'Filtrados', ico: '🫖', desc: 'Ratio, molienda, bloom, vertido y tiempo en métodos de filtro.' },
  cata: { n: 'Cata y blends', ico: '🌱', desc: 'Origen, proceso y tueste: cómo suma cada café a una mezcla.' },
};

const VENTANA = 8;          // dominio = promedio de los últimos N puntajes de esa competencia
const ERRORES_RECIENTES = 30;

export function nuevaAcademia() {
  return { lecciones: {}, comp: {}, recientes: [], diario: {}, ab: 0 };
}

/** Garantiza la forma del estado (partidas viejas no tienen academia). */
export function normalizar(a) {
  const base = nuevaAcademia();
  if (!a || typeof a !== 'object') return base;
  for (const k of Object.keys(base)) if (a[k] == null) a[k] = base[k];
  return a;
}

export function dominio(a, comp) {
  const c = a.comp[comp];
  if (!c || !c.ultimos.length) return null;
  return Math.round(c.ultimos.reduce((s, x) => s + x, 0) / c.ultimos.length);
}

export function estrellasDe(a, leccion) {
  return a.lecciones[leccion]?.estrellas || 0;
}

export const aprobada = (a, leccion) => !!a.lecciones[leccion]?.aprobada;

/** Una lección se desbloquea cuando la anterior de la misma lista está aprobada. */
export function desbloqueada(a, lista, id) {
  const i = lista.findIndex(l => l.id === id);
  if (i <= 0) return true;
  return aprobada(a, lista[i - 1].id);
}

/** XP por un intento: proporcional al puntaje, con bonus solo la primera vez que se aprueba o se mejora. */
export function xpPor({ puntaje, aprobadaPorPrimeraVez, mejoro, evaluado = true }) {
  let xp = Math.max(1, Math.round((puntaje / 100) * (evaluado ? 8 : 4)));
  if (aprobadaPorPrimeraVez) xp += 15;
  else if (mejoro) xp += 3;
  return xp;
}

/**
 * Registra un resultado. Devuelve qué cambió para que la UI lo pueda contar.
 * r: {comp, leccion?, puntaje (0..100), estrellas?, aprobada?: bool, errores?: [ids], evaluado?: bool, fecha}
 */
export function registrar(a, r) {
  const comp = (a.comp[r.comp] ??= { n: 0, ultimos: [] });
  comp.n++;
  comp.ultimos.push(Math.round(r.puntaje));
  if (comp.ultimos.length > VENTANA) comp.ultimos.shift();
  let aprobadaPorPrimeraVez = false, mejoro = false;
  if (r.leccion) {
    const l = (a.lecciones[r.leccion] ??= { mejor: 0, estrellas: 0, intentos: 0, aprobada: false });
    l.intentos++;
    if (r.puntaje > l.mejor) { mejoro = l.mejor > 0; l.mejor = Math.round(r.puntaje); }
    l.estrellas = Math.max(l.estrellas, r.estrellas ?? 0);
    if (r.aprobada && !l.aprobada) { l.aprobada = true; aprobadaPorPrimeraVez = true; }
  }
  for (const e of r.errores || []) a.recientes.push({ e, c: r.comp, f: r.fecha || '' });
  if (a.recientes.length > ERRORES_RECIENTES) a.recientes.splice(0, a.recientes.length - ERRORES_RECIENTES);
  const xp = xpPor({ puntaje: r.puntaje, aprobadaPorPrimeraVez, mejoro, evaluado: r.evaluado !== false });
  return { xp, aprobadaPorPrimeraVez, mejoro, dominio: dominio(a, r.comp) };
}

/**
 * Qué practicar después. `mapaErrores`: errorId -> {modulo, leccion?, texto}.
 * `ruta`: [{id, comp, n}] en el orden sugerido de la academia.
 */
export function recomendar(a, ruta, mapaErrores = {}, max = 3) {
  const out = [];
  const ya = new Set();
  const poner = (rec) => {
    const clave = rec.modulo + (rec.leccion || '');
    if (ya.has(clave) || out.length >= max) return;
    ya.add(clave);
    out.push(rec);
  };
  // 1) errores que se repiten en los últimos intentos
  const cuenta = {};
  for (const { e } of a.recientes.slice(-12)) cuenta[e] = (cuenta[e] || 0) + 1;
  Object.entries(cuenta).filter(([e, n]) => n >= 2 && mapaErrores[e]).sort((x, y) => y[1] - x[1])
    .forEach(([e, n]) => poner({ ...mapaErrores[e], motivo: `Se repitió ${n} veces en tus últimos intentos` }));
  // 2) la competencia más floja que ya practicaste
  const flojas = ruta.map(m => ({ m, d: dominio(a, m.comp) })).filter(x => x.d != null && x.d < 70).sort((x, y) => x.d - y.d);
  for (const { m, d } of flojas) poner({ modulo: m.id, texto: `Reforzá «${m.n}»`, motivo: `Tu dominio en ${COMPETENCIAS[m.comp].n} es ${d}/100` });
  // 3) lo próximo que no probaste en la ruta
  for (const m of ruta) if (!a.comp[m.comp]) poner({ modulo: m.id, texto: `Probá «${m.n}»`, motivo: 'Todavía no lo practicaste' });
  return out;
}
