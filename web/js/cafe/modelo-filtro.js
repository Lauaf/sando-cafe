// Métodos de filtro: V60 (percolación), AeroPress y prensa francesa (inmersión). Lógica pura, sin DOM.
//
// Modelo educativo (simplificado, documentado en docs/academia-barismo.md):
// - Dos "reservas" de sólidos solubles: una rápida (superficie y finos, se disuelve en segundos) y una lenta
//   (interior de las partículas, se disuelve por difusión). Moler más fino agranda la rápida y acelera la lenta
//   (el tiempo de difusión crece con el tamaño de partícula al cuadrado).
// - La velocidad de disolución cae a medida que el agua alrededor se concentra (por eso la inmersión extrae menos
//   que la percolación con la misma agua: en el V60 siempre llega agua nueva).
// - Temperatura: más caliente, más rápido. El slurry está unos grados por debajo de la pava y se enfría.
// - V60: el agua drena por la cama; la cama es más permeable cuanto más gruesa la molienda, y se tapa de a poco
//   con finos (más agitación = más finos migrando). Sin bloom, el CO₂ del café fresco hace que el agua moje
//   peor al principio y deja zonas secas (canales).
// - La cama retiene ~2 g de agua por gramo de café (algo menos en la AeroPress, que se prensa).
// Todos los resultados son estimaciones del modelo, no mediciones.

export const METODOS = {
  v60: { n: 'V60', tipo: 'percolacion', retiene: 2.1, perdidaT: 4, tds: [1.15, 1.45],
    base: { dosis: 15, agua: 250, molienda: 650, temp: 94, bloom: 40, bloomT: 40, vertidos: 2, velocidad: 6, patron: 'espiral', reposo: 0, prensa: 0 } },
  aeropress: { n: 'AeroPress', tipo: 'inmersion', retiene: 1.4, perdidaT: 6, tds: [1.2, 1.6],
    base: { dosis: 15, agua: 220, molienda: 550, temp: 88, bloom: 0, bloomT: 0, vertidos: 1, velocidad: 10, patron: 'centro', reposo: 90, prensa: 25 } },
  prensa: { n: 'Prensa francesa', tipo: 'inmersion', retiene: 2.2, perdidaT: 5, tds: [1.15, 1.5],
    base: { dosis: 30, agua: 500, molienda: 950, temp: 94, bloom: 0, bloomT: 0, vertidos: 1, velocidad: 12, patron: 'centro', reposo: 240, prensa: 15 } },
};

export const VARIABLES = {
  dosis: { n: 'Café', u: 'g', min: 8, max: 40, paso: 0.5 },
  agua: { n: 'Agua', u: 'g', min: 120, max: 600, paso: 10 },
  molienda: { n: 'Molienda', u: 'µm', min: 300, max: 1300, paso: 25 },
  temp: { n: 'Temperatura', u: '°C', min: 80, max: 100, paso: 1 },
  bloom: { n: 'Bloom (agua)', u: 'g', min: 0, max: 80, paso: 5, solo: 'percolacion' },
  bloomT: { n: 'Bloom (espera)', u: 's', min: 0, max: 75, paso: 5, solo: 'percolacion' },
  vertidos: { n: 'Vertidos', u: '', min: 1, max: 5, paso: 1, solo: 'percolacion' },
  velocidad: { n: 'Velocidad de vertido', u: 'g/s', min: 2, max: 12, paso: 1 },
  reposo: { n: 'Infusión', u: 's', min: 30, max: 480, paso: 10, solo: 'inmersion' },
  prensa: { n: 'Prensado', u: 's', min: 5, max: 60, paso: 5, solo: 'inmersion' },
};
export const PATRONES = { centro: 'Al centro', espiral: 'Espiral' };

const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
// constantes del modelo (calibradas para que las recetas de referencia caigan en la zona dulce)
export const K = { finos: 0.4, rap: 0.1, len: 0.0075, expLen: 1.5, sat: 0.09, perm: 0.026 };

/** Plan de vertidos: [{desde, hasta, caudal}] en segundos. */
export function planVertido(m, p) {
  const M = METODOS[m];
  const plan = [];
  if (M.tipo === 'inmersion') { plan.push({ desde: 0, hasta: p.agua / p.velocidad, caudal: p.velocidad }); return plan; }
  let t = 0, resto = p.agua;
  if (p.bloom > 0) {
    const b = Math.min(p.bloom, resto);
    plan.push({ desde: 0, hasta: b / p.velocidad, caudal: p.velocidad });
    resto -= b;
    t = Math.max(b / p.velocidad, p.bloomT);
  }
  const n = Math.max(1, p.vertidos);
  const cada = resto / n;
  for (let i = 0; i < n; i++) {
    const dur = cada / p.velocidad;
    plan.push({ desde: t, hasta: t + dur, caudal: p.velocidad });
    t += dur + (i < n - 1 ? 12 : 0); // pausa corta entre vertidos
  }
  return plan;
}

/**
 * Simula la preparación. Devuelve {curva:[{t, ey, taza, nivel, tds}], resultado}.
 * `paso` en segundos (0.25 alcanza; los tests usan lo mismo).
 */
export function simular(m, entrada, paso = 0.25) {
  const M = METODOS[m];
  const p = { ...M.base, ...entrada };
  const plan = planVertido(m, p);
  const d = p.molienda / 650;                                    // tamaño relativo de partícula
  const solubles = 0.3 * p.dosis;                                // ~30 % del café es soluble
  const finos = limitar(K.finos * Math.pow(1 / d, 0.5), 0.2, 0.65); // fracción "rápida"
  let rapida = solubles * finos, lenta = solubles * (1 - finos);
  const kRap = K.rap / d, kLen = K.len / Math.pow(d, K.expLen);
  const agit = (p.patron === 'espiral' ? 1.08 : 1) * (1 + (p.velocidad - 6) * 0.02);
  // café fresco sin bloom: el CO₂ repele el agua al principio
  const bloomOk = M.tipo === 'inmersion' || (p.bloom >= p.dosis * 1.8 && p.bloomT >= 25);
  let canal = 0;
  if (M.tipo === 'percolacion') {
    if (!bloomOk) canal += 0.12;
    if (p.patron === 'centro' && p.velocidad > 7) canal += 0.06;
    if (p.vertidos === 1 && p.velocidad > 8) canal += 0.04;
  }
  // estado
  let t = 0, vertido = 0, slurry = 0, disuelto = 0, enSlurry = 0, enTaza = 0, solTaza = 0, tapado = 0;
  let temp = p.temp - M.perdidaT;
  const retiene = M.retiene * p.dosis;
  const curva = [];
  const fin = M.tipo === 'inmersion' ? (plan[0].hasta + p.reposo + p.prensa) : Infinity;
  let terminado = false;
  while (!terminado && t < 900) {
    // vertido
    const v = plan.find(x => t >= x.desde && t < x.hasta);
    const entra = v ? v.caudal * paso : 0;
    vertido += entra; slurry += entra;
    // disolución: más lenta si el líquido alrededor está concentrado; la cama tiene que estar mojada
    const mojado = limitar(slurry / Math.max(1, retiene), 0, 1);
    const conc = enSlurry / Math.max(1, slurry + enSlurry);
    const gradiente = Math.max(0, 1 - conc / K.sat);
    const kT = Math.exp(0.035 * (temp - 93)) * agit;
    const efic = (bloomOk || t > 50 ? 1 : 0.75) * (1 - canal);
    const dR = rapida * Math.min(1, kRap * kT * gradiente * mojado * efic * paso);
    const dL = lenta * Math.min(1, kLen * kT * gradiente * mojado * efic * paso);
    rapida -= dR; lenta -= dL; disuelto += dR + dL; enSlurry += dR + dL;
    // drenaje
    let sale = 0;
    if (M.tipo === 'percolacion') {
      const libre = Math.max(0, slurry - retiene);
      const perm = K.perm * d * d * (1 - tapado) * (1 + canal * 2);
      sale = Math.min(libre, perm * Math.sqrt(libre) * 10 * paso);
      tapado = Math.min(0.6, tapado + paso * 0.0016 * agit / d);
      if (vertido >= p.agua - 0.01 && libre < 0.5) terminado = true;
    } else {
      const tPrensa = plan[0].hasta + p.reposo;
      if (t >= tPrensa) {
        const libre = Math.max(0, slurry - retiene * (m === 'aeropress' ? 1 : 1));
        sale = Math.min(libre, (libre / Math.max(paso, fin - t)) * paso * 1.0 + 0.001);
      }
      if (t >= fin) {
        const libre = Math.max(0, slurry - retiene);
        sale += libre;
        terminado = true;
      }
    }
    if (sale > 0) {
      const frac = sale / Math.max(1e-6, slurry);
      const s = enSlurry * frac;
      enSlurry -= s; slurry -= sale; enTaza += sale; solTaza += s;
    }
    temp -= paso * (M.tipo === 'percolacion' ? 0.012 : 0.02) * (temp - 22) / 70;
    t += paso;
    if (curva.length === 0 || t - curva[curva.length - 1].t >= 1) {
      // ey: lo disuelto (también lo que queda en la cama); eyTaza: lo que ya llegó a la taza
      curva.push({ t, ey: (disuelto / p.dosis) * 100, eyTaza: (solTaza / p.dosis) * 100, taza: enTaza + solTaza, nivel: slurry, tds: enTaza > 0 ? (solTaza / (enTaza + solTaza)) * 100 : 0 });
    }
  }
  const bebida = enTaza + solTaza;
  // lo que queda disuelto en el agua retenida no llega a la taza: la EY se mide sobre lo que sí llegó
  const ey = (solTaza / p.dosis) * 100;
  const tds = bebida > 0 ? (solTaza / bebida) * 100 : 0;
  return { curva, resultado: { ey, tds, tiempo: t, bebida, canal, bloomOk, ratio: p.agua / p.dosis, p, metodo: m } };
}

/** Sabor estimado y consejos (no es una cata real: son las tendencias de la tabla de control). */
export function evaluarFiltro(r, objetivo = {}) {
  const M = METODOS[r.metodo];
  const [tMin, tMax] = objetivo.tds || M.tds;
  const [eMin, eMax] = objetivo.ey || [18, 22];
  const notas = [], defectos = [];
  let pen = 0;
  if (r.ey < eMin) { pen += (eMin - r.ey) * 12; defectos.push('subextraido'); notas.push(`🍋 Subextraído (≈${r.ey.toFixed(1)} %): agrio y corto. Molé más fino, subí la temperatura o alargá el contacto${M.tipo === 'inmersion' ? ' (más infusión)' : ''}.`); }
  if (r.ey > eMax) { pen += (r.ey - eMax) * 12; defectos.push('sobreextraido'); notas.push(`🪵 Sobreextraído (≈${r.ey.toFixed(1)} %): amargo y secante. Molé más grueso, bajá la temperatura o acortá el contacto.`); }
  if (r.tds < tMin) { pen += ((tMin - r.tds) / (tMax - tMin)) * 40; defectos.push('debil'); notas.push(`💧 Débil (TDS ≈${r.tds.toFixed(2)} %): usá más café para la misma agua (ratio más concentrado).`); }
  if (r.tds > tMax) { pen += ((r.tds - tMax) / (tMax - tMin)) * 40; defectos.push('fuerte'); notas.push(`🧱 Muy intenso (TDS ≈${r.tds.toFixed(2)} %): más agua para el mismo café.`); }
  if (r.canal > 0.1) { pen += r.canal * 80; defectos.push('canal'); notas.push(r.bloomOk ? '💥 Extracción despareja: verté más suave o en espiral.' : '💨 Sin bloom el CO₂ del café fresco repele el agua: mojá con ~2–3× la dosis y esperá 30–45 s.'); }
  if (M.tipo === 'percolacion' && r.tiempo > 300) notas.push('⏳ Drenó muy lento: la cama se tapó (molienda fina o mucha agitación).');
  if (!notas.length) notas.push('☕ Dentro de la zona dulce: balanceado y con buena intensidad.');
  const puntaje = Math.round(limitar(100 - pen, 0, 100));
  return { puntaje, notas, defectos };
}

/** Qué variables cambiaron entre dos recetas. */
export function diferencias(a, b) {
  return Object.keys(VARIABLES).concat(['patron']).filter(k => a[k] !== b[k]);
}

export const LECCIONES = [
  { id: 'fil-1', t: 'Molienda y tiempo', metodo: 'v60', p: { molienda: 1050 }, controles: ['molienda'],
    aprender: 'En el V60 la molienda controla a la vez cuánto se extrae y cuánto tarda en drenar: más fino = más superficie y más resistencia.',
    meta: 'Este V60 drena en 2 minutos y sale agrio. Llevalo a la zona dulce.' },
  { id: 'fil-2', t: 'Bloom', metodo: 'v60', p: { bloom: 0, bloomT: 0 }, controles: ['bloom', 'bloomT'],
    aprender: 'El café recién tostado tiene CO₂. Si no lo dejás escapar (bloom), el gas empuja el agua y la cama se moja desparejo.',
    meta: 'Café fresco sin bloom: extracción despareja. Agregá un bloom adecuado.' },
  { id: 'fil-3', t: 'Ratio e intensidad', metodo: 'v60', p: { agua: 180 }, controles: ['agua', 'dosis'],
    aprender: 'El ratio decide la intensidad (TDS). La extracción decide el sabor (agrio/dulce/amargo). Son dos ejes distintos.',
    meta: 'Sale muy intenso. Ajustá el ratio sin romper la extracción.' },
  { id: 'fil-4', t: 'Inmersión: AeroPress', metodo: 'aeropress', p: { reposo: 30, molienda: 700 }, controles: ['reposo', 'molienda', 'temp'],
    aprender: 'En la inmersión el agua no se renueva: a medida que se concentra, extrae más lento. El tiempo de infusión es la palanca principal.',
    meta: 'Esta AeroPress de 30 s sale agria. Corregila.' },
  { id: 'fil-5', t: 'Prensa francesa', metodo: 'prensa', p: { molienda: 600, reposo: 420 }, controles: ['molienda', 'reposo'],
    aprender: 'La prensa necesita molienda gruesa: el filtro de metal deja pasar finos y el contacto es largo.',
    meta: 'Molienda fina y 7 minutos: amargo y barroso. Arreglala.' },
];
