// Modelo educativo de extracción de espresso, paso a paso en el tiempo (sin DOM: se testea con Node).
//
// Simplificaciones (documentadas en docs/academia-barismo.md):
// - El puck es una resistencia hidráulica (tipo Darcy): caudal = presión / resistencia.
//   Molienda más fina y más dosis = más resistencia. La resistencia baja a medida que el café
//   se disuelve (por eso el caudal sube hacia el final, como en una máquina real).
// - La bomba tiene un caudal máximo: con molienda muy gruesa la presión no llega a 9 bar.
// - Extracción de primer orden: los sólidos solubles salen más rápido al principio y cada vez
//   más lento. La velocidad depende de la superficie (molienda), la temperatura, el tueste y
//   cuánta agua atraviesa el puck.
// - La canalización es determinista: se calcula un riesgo a partir de la preparación del puck
//   (distribución, nivelado, dosis vs canasta), la molienda y el perfil de presión. Si aparece,
//   parte del agua pasa por un canal (extrae poco) y el resto sobreextrae: agrio + amargo + astringente.
// - Todos los números son estimaciones de un modelo didáctico calibrado para que las tendencias
//   sean correctas (18 g → 36 g en ~28 s ≈ 20 % EY), no mediciones de una máquina real.

export const CANASTA = 18;          // gramos nominales de la canasta
export const MOLIENDA_RANGO = [1, 30];
export const TEMP_RANGO = [86, 97];
export const DOSIS_RANGO = [14, 22];

export const TUESTES = {
  claro: { n: 'Claro', smax: 0.27, k: 0.72, acidez: 2, amargor: -1, desc: 'Más denso y menos soluble: cuesta extraerlo. Pide molienda más fina, más temperatura o ratios más largos.' },
  medio: { n: 'Medio', smax: 0.28, k: 1, acidez: 0, amargor: 0, desc: 'El punto de partida clásico.' },
  oscuro: { n: 'Oscuro', smax: 0.30, k: 1.18, acidez: -2, amargor: 2, desc: 'Poroso y muy soluble: se extrae rápido y amarga fácil. Pide menos temperatura y ratios más cortos.' },
};

export const PERFILES = {
  plano: { n: '9 bar plano', desc: 'Presión completa desde el principio. Simple, pero un puck desparejo canaliza más fácil.' },
  preinfusion: { n: 'Preinfusión 3 bar · 8 s', desc: 'Moja el puck a baja presión antes de subir a 9 bar: se asienta parejo y canaliza menos.' },
  declinante: { n: '9 → 6 bar', desc: 'Empieza a 9 bar y baja hacia el final: menos amargor tardío, flujo más estable.' },
};

export const RECETA_BASE = {
  dosis: 18, molienda: 12, temp: 93, perfil: 'plano', tueste: 'medio',
  distribucion: 0.9, // 0..1 (0 = grumos, 1 = WDT perfecto)
  nivelado: 0.95,    // 0..1 (1 = tampeo perfectamente horizontal)
};

const PMAX_BOMBA = 9.4;     // bar
const QMAX_BOMBA = 7;       // g/s que la bomba puede empujar sin restricción
const R_BASE = 5.4;         // bar / (g/s) con molienda 12, 18 g
const K_BASE = 0.068;       // 1/s
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

/** Presión objetivo del perfil en el segundo t (antes de los límites de la bomba). */
export function presionPerfil(perfil, t) {
  if (perfil === 'preinfusion') return t < 8 ? 3 : 9;
  if (perfil === 'declinante') return t < 12 ? 9 : Math.max(6, 9 - (t - 12) * (3 / 18));
  return 9;
}

/** Riesgo de canalización (0..1) y sus causas, a partir de la preparación. */
export function riesgoCanal(p) {
  const causas = [];
  let r = 0;
  const dist = (1 - limitar(p.distribucion, 0, 1)) * 0.55;
  if (dist > 0.12) causas.push('distribucion');
  r += dist;
  const niv = (1 - limitar(p.nivelado, 0, 1)) * 0.6;
  if (niv > 0.12) causas.push('nivelado');
  r += niv;
  const sobre = p.dosis - (CANASTA + 2);
  const sub = (CANASTA - 2.5) - p.dosis;
  if (sobre > 0) { r += sobre * 0.12; causas.push('sobredosis'); }
  if (sub > 0) { r += sub * 0.1; causas.push('subdosis'); }
  const fino = Math.max(0, 9 - p.molienda) * 0.05;
  if (fino > 0.05) causas.push('muy_fino');
  r += fino;
  // la preinfusión asienta el puck y reduce el riesgo; el golpe de 9 bar lo aumenta un poco
  if (p.perfil === 'preinfusion') r *= 0.5;
  else r += 0.04;
  return { riesgo: limitar(r, 0, 1), causas };
}

/**
 * Crea una simulación de shot. Se avanza con paso(dt) y se corta con cortar().
 * Devuelve un objeto con el estado instantáneo (para dibujar) y la historia (para el gráfico).
 */
export function crearShot(entrada) {
  const p = { ...RECETA_BASE, ...entrada };
  const T = TUESTES[p.tueste] || TUESTES.medio;
  const { riesgo, causas } = riesgoCanal(p);
  const severidad = limitar((riesgo - 0.18) / 0.55, 0, 1);
  const smax = T.smax * p.dosis;                 // sólidos que se pueden disolver (g)
  const absorber = p.dosis * 1.1 + 3;            // agua para saturar puck + espacio de cabeza (g)
  const rFinura = Math.exp(-0.115 * (p.molienda - 12));
  const r0 = R_BASE * rFinura * (p.dosis / 18) ** 1.3;
  const kSuperficie = Math.exp(0.05 * (12 - p.molienda));
  const kTemp = Math.exp(0.035 * (p.temp - 93));

  const s = {
    p, riesgo, causas, severidad,
    t: 0, presion: 0, caudal: 0, concentracion: 0,
    agua: 0, saturado: 0, extraido: 0, enTaza: 0,
    primeraGota: null, canalEn: null, canalActivo: false,
    terminado: false, historia: [],
  };

  s.paso = function paso(dt) {
    if (s.terminado) return s;
    s.t += dt;
    const progreso = s.extraido / smax;
    // erosión del puck: a medida que se disuelve, ofrece menos resistencia
    let r = r0 * (1 - 0.32 * progreso) * Math.pow(Math.max(0.5, s.presion) / 9, 0.25);
    if (s.canalEn != null && s.t >= s.canalEn) { r *= 1 - 0.45 * severidad; s.canalActivo = true; }
    const objetivo = presionPerfil(p.perfil, s.t);
    // la bomba no puede empujar más que QMAX: con puck muy permeable la presión no sube
    const pBomba = Math.min(objetivo, PMAX_BOMBA, QMAX_BOMBA * r);
    // la presión sube con una pequeña inercia (se llena el espacio de cabeza)
    s.presion += (pBomba - s.presion) * Math.min(1, dt * 2.2);
    const q = s.presion / r;

    if (s.saturado < absorber) {
      // primero el agua moja el puck: todavía no cae nada
      const entra = Math.min(absorber - s.saturado, Math.min(QMAX_BOMBA, q * 1.6) * dt);
      s.saturado += entra;
      s.agua += entra;
      s.caudal = 0;
      s.concentracion = 0;
      if (s.saturado >= absorber - 1e-9) {
        s.primeraGota = s.t;
        if (severidad > 0) s.canalEn = s.t + 2 + 9 * (1 - severidad);
      }
    } else {
      const fCanal = s.canalActivo ? 0.5 * severidad : 0;
      const kq = Math.sqrt(Math.max(0.05, q) / 1.7);
      const k = K_BASE * kSuperficie * kTemp * T.k * kq;
      // el agua que pasa por el canal casi no extrae; el resto sobreextrae un poco
      const kEf = k * ((1 - fCanal) * (1 + 0.35 * severidad * (s.canalActivo ? 1 : 0)) + fCanal * 0.2);
      const disuelve = Math.min(smax - s.extraido, kEf * (smax - s.extraido) * dt);
      s.extraido += disuelve;
      const sale = q * dt;
      s.agua += sale;
      s.enTaza += sale + disuelve;
      s.caudal = (sale + disuelve) / dt;
      s.concentracion = disuelve / Math.max(1e-6, sale + disuelve);
    }
    const ultimo = s.historia[s.historia.length - 1];
    if (!ultimo || s.t - ultimo.t >= 0.25 - 1e-9) {
      s.historia.push({ t: s.t, presion: s.presion, caudal: s.caudal, enTaza: s.enTaza, conc: s.concentracion });
    }
    // un shot ahogado o eterno se corta solo a los 75 s
    if (s.t >= 75) s.cortar();
    return s;
  };

  s.cortar = function cortar() {
    s.terminado = true;
    s.caudal = 0;
    return s;
  };

  s.resultado = function resultado() {
    const ey = (s.extraido / p.dosis) * 100;
    const tds = s.enTaza > 0 ? (s.extraido / s.enTaza) * 100 : 0;
    return {
      ey, tds, enTaza: s.enTaza, tiempo: s.t, primeraGota: s.primeraGota,
      ratio: s.enTaza / p.dosis, canal: s.canalActivo ? severidad : 0, riesgo, causas,
      p: { ...p },
    };
  };
  return s;
}

/** Corre un shot completo cortando al llegar a `salida` gramos (para tests, diagnóstico y IA de escenarios). */
export function simularHasta(p, salida, dt = 0.05) {
  const s = crearShot(p);
  while (!s.terminado && s.enTaza < salida) s.paso(dt);
  s.cortar();
  return s.resultado();
}

// ---------- Sabor estimado ----------
/** Perfil de sabor 0..10 estimado a partir del resultado (no es una cata real). */
export function sabor(r) {
  const T = TUESTES[r.p.tueste] || TUESTES.medio;
  const tempAmarga = Math.max(0, r.p.temp - 94) * 0.6;
  const acidez = limitar(4 + (19 - r.ey) * 1.5 + r.canal * 2.5 + T.acidez, 0, 10);
  const amargor = limitar(2.5 + (r.ey - 20.5) * 1.5 + tempAmarga + T.amargor + r.canal * 1.5, 0, 10);
  const dulzor = limitar(8 - Math.abs(r.ey - 20) * 1.6 - r.canal * 4, 0, 10);
  const astringencia = limitar(r.canal * 7 + Math.max(0, r.ey - 22.5) * 1.6, 0, 10);
  const intensidad = limitar((r.tds - 5) * 1.0, 0, 10);
  return { acidez, dulzor, amargor, astringencia, intensidad };
}

// ---------- Evaluación ----------
export const OBJETIVOS = {
  ristretto: { n: 'Ristretto', ratio: [1.2, 1.7], ey: [17.5, 21], desc: 'Corto y concentrado (≈1:1,5). Sale con menos extracción: se suele moler un poco más fino.' },
  normale: { n: 'Normale', ratio: [1.8, 2.2], ey: [18, 22], desc: 'El clásico ≈1:2. Equilibrio entre intensidad y extracción.' },
  lungo: { n: 'Lungo', ratio: [2.5, 3.2], ey: [19, 23], desc: 'Largo (≈1:3): más extracción y menos intensidad. Se muele algo más grueso.' },
};

export const DEFECTOS = {
  subextraido: { n: 'Subextraído', ico: '🍋', exp: 'El agua no llegó a disolver lo suficiente: salen primero los ácidos y las sales; faltan azúcares y cuerpo. Sabe agrio, salado y corto.' },
  sobreextraido: { n: 'Sobreextraído', ico: '🪵', exp: 'Se disolvió de más: después de los azúcares salen compuestos amargos y secantes. Sabe amargo, hueco y te seca la boca.' },
  canalizacion: { n: 'Canalización', ico: '💥', exp: 'El agua encontró un camino fácil en el puck: por ahí pasa casi sin extraer y el resto se sobreextrae. Por eso sabe agrio y amargo a la vez.' },
  ratio_corto: { n: 'Ratio corto', ico: '📏', exp: 'Cortaste antes de la salida pedida: queda más concentrado y, en general, menos extraído.' },
  ratio_largo: { n: 'Ratio largo', ico: '📏', exp: 'Dejaste correr más de lo pedido: más diluido y con más extracción tardía (amargor).' },
  ahogado: { n: 'Ahogado', ico: '🧱', exp: 'Casi no pasa agua: la molienda es tan fina (o la dosis tan alta) que la bomba no puede atravesar el puck.' },
};

const CONSEJOS = {
  subextraido: r => r.tiempo < 22
    ? 'molé más fino: el agua tarda más y extrae más (es la palanca principal)'
    : 'subí 1–2 °C la temperatura o alargá un poco el ratio; si el tueste es claro, también molé más fino',
  sobreextraido: r => r.tiempo > 34
    ? 'molé más grueso: el agua pasa más rápido y extrae menos'
    : 'bajá 1–2 °C la temperatura o acortá el ratio (cortá antes)',
  canalizacion: r => {
    const c = r.causas;
    const partes = [];
    if (c.includes('distribucion')) partes.push('distribuí con WDT hasta romper los grumos');
    if (c.includes('nivelado')) partes.push('tampeá nivelado');
    if (c.includes('sobredosis')) partes.push('bajá la dosis: el puck toca la ducha');
    if (c.includes('subdosis')) partes.push('subí la dosis: la canasta queda demasiado vacía');
    if (c.includes('muy_fino')) partes.push('con molienda tan fina, una preinfusión ayuda');
    return partes.join(', ') || 'mejorá la preparación del puck o probá preinfusión';
  },
  ratio_corto: (r, o) => `dejá correr hasta ~${Math.round(r.p.dosis * (o.ratio[0] + o.ratio[1]) / 2)} g`,
  ratio_largo: (r, o) => `cortá antes, cerca de ${Math.round(r.p.dosis * (o.ratio[0] + o.ratio[1]) / 2)} g`,
  ahogado: () => 'molé bastante más grueso (varios puntos)',
};

/**
 * Puntaje 0..100, estrellas 0..3, defectos con explicación y consejo.
 * objetivo: {ratio:[min,max], ey:[min,max], canalMax?}
 */
export function evaluar(r, objetivo = OBJETIVOS.normale) {
  const defectos = [];
  let pen = 0;
  const [eyMin, eyMax] = objetivo.ey;
  if (r.enTaza < 8 && r.tiempo >= 60) {
    defectos.push('ahogado');
    pen += 70;
  } else {
    if (r.ey < eyMin) { defectos.push('subextraido'); pen += (eyMin - r.ey) * 14; }
    if (r.ey > eyMax) { defectos.push('sobreextraido'); pen += (r.ey - eyMax) * 14; }
  }
  if (r.canal > (objetivo.canalMax ?? 0.15)) { defectos.push('canalizacion'); pen += 12 + r.canal * 35; }
  const [rMin, rMax] = objetivo.ratio;
  if (r.ratio < rMin) { defectos.push('ratio_corto'); pen += (rMin - r.ratio) / rMin * 120; }
  if (r.ratio > rMax) { defectos.push('ratio_largo'); pen += (r.ratio - rMax) / rMax * 120; }
  const puntaje = Math.round(limitar(100 - pen, 0, 100));
  const estrellas = puntaje >= 90 ? 3 : puntaje >= 75 ? 2 : puntaje >= 55 ? 1 : 0;
  return {
    puntaje, estrellas, defectos,
    detalle: defectos.map(d => ({ id: d, ...DEFECTOS[d], consejo: CONSEJOS[d](r, objetivo) })),
    sabor: sabor(r),
  };
}

/** Explica qué cambió entre dos shots (la clave de aprender cambiando una variable por vez). */
export function comparar(antes, ahora) {
  const nombres = { dosis: 'dosis', molienda: 'molienda', temp: 'temperatura', perfil: 'perfil', tueste: 'tueste', distribucion: 'distribución', nivelado: 'nivelado' };
  const cambios = [];
  for (const k of Object.keys(nombres)) {
    const a = antes.p[k], b = ahora.p[k];
    if (typeof a === 'number' ? Math.abs(a - b) > 0.04 : a !== b) cambios.push({ k, n: nombres[k], antes: a, ahora: b });
  }
  return {
    cambios,
    dTiempo: ahora.tiempo - antes.tiempo,
    dEY: ahora.ey - antes.ey,
    dTDS: ahora.tds - antes.tds,
    dTaza: ahora.enTaza - antes.enTaza,
    unaVariable: cambios.length === 1,
  };
}

// ---------- Carrera, práctica y desafío diario ----------
// controles: qué se puede tocar en la lección (el resto queda fijo, para enfocar el aprendizaje)
export const LECCIONES = [
  { id: 'esp-1', t: 'Cortá a tiempo', obj: 'normale', intentos: 5,
    aprender: 'El espresso se mide en peso: 18 g de café molido → ~36 g en la taza (ratio 1:2). Mirá la balanza y cortá el shot cuando llegue.',
    meta: 'Sacá un normale entre 32 y 40 g.', p: {}, controles: ['extraer'] },
  { id: 'esp-2', t: 'El shot que vuela', obj: 'normale', intentos: 5,
    aprender: 'Si el agua atraviesa el café muy rápido, no alcanza a disolver los azúcares: queda agrio. La molienda controla esa velocidad.',
    meta: 'Este shot sale en ~15 s y agrio. Ajustá la molienda hasta que quede balanceado.', p: { molienda: 18 }, controles: ['molienda', 'extraer'] },
  { id: 'esp-3', t: 'El shot que no sale', obj: 'normale', intentos: 5,
    aprender: 'Al revés: con molienda demasiado fina el agua tarda una eternidad y arrastra compuestos amargos y secantes.',
    meta: 'Este shot tarda casi un minuto y amarga. Corregilo.', p: { molienda: 6.5 }, controles: ['molienda', 'extraer'] },
  { id: 'esp-4', t: 'Ristretto', obj: 'ristretto', intentos: 5,
    aprender: 'Un ristretto corta antes (≈1:1,5). Con menos agua se extrae menos: para que no quede agrio se suele moler un poco más fino.',
    meta: 'Sacá un ristretto dulce: ratio 1:1,2–1:1,7 sin quedar subextraído.', p: { molienda: 13 }, controles: ['molienda', 'extraer'] },
  { id: 'esp-5', t: 'Canalización', obj: 'normale', intentos: 5,
    aprender: 'Un puck con grumos o tampeado torcido tiene zonas más fáciles: el agua se mete por ahí. Distribuí (WDT) y tampeá nivelado.',
    meta: 'Este barista dejó grumos y tampeó torcido. Prepará bien el puck.', p: { distribucion: 0.2, nivelado: 0.45 }, controles: ['puck', 'molienda', 'extraer'] },
  { id: 'esp-6', t: 'Cambio de dosis', obj: 'normale', intentos: 5,
    aprender: 'Más café = puck más alto y más resistente. Si cambiás la dosis, cambian el tiempo y la salida que corresponde al mismo ratio.',
    meta: 'Ahora usás 20 g. Recalibrá para un 1:2 (≈40 g).', p: { dosis: 20, molienda: 9 }, controles: ['dosis', 'molienda', 'puck', 'extraer'] },
  { id: 'esp-7', t: 'Tueste claro', obj: 'claro', intentos: 6,
    aprender: 'Los tuestes claros son más densos y menos solubles. Para extraerlos bien: más fino, más temperatura y, muchas veces, ratios más largos.',
    meta: 'Con la receta de siempre sale agrio. Combiná molienda, temperatura y ratio.', p: { tueste: 'claro', molienda: 13 }, controles: ['molienda', 'temp', 'extraer'] },
  { id: 'esp-8', t: 'Tueste oscuro', obj: 'oscuro', intentos: 6,
    aprender: 'Los tuestes oscuros se disuelven muy fácil y amargan. Bajar la temperatura y acortar el ratio los hace más dulces.',
    meta: 'A 96 °C este oscuro sale amargo. Domalo.', p: { tueste: 'oscuro', temp: 96, molienda: 11 }, controles: ['molienda', 'temp', 'extraer'] },
  { id: 'esp-9', t: 'Preinfusión', obj: 'normale', intentos: 6,
    aprender: 'Mojar el puck a baja presión unos segundos lo asienta parejo antes de la presión completa: menos canalización, sobre todo con moliendas finas.',
    meta: 'Molienda fina y puck mediocre: elegí el perfil de presión y la molienda para un shot limpio.', p: { molienda: 8, distribucion: 0.6, nivelado: 0.8 }, controles: ['perfil', 'molienda', 'extraer'] },
];

export const OBJETIVOS_LECCION = {
  ...OBJETIVOS,
  claro: { n: 'Normale/largo (claro)', ratio: [1.9, 2.8], ey: [19, 23], desc: 'Para claros se aceptan ratios algo más largos.' },
  oscuro: { n: 'Normale/corto (oscuro)', ratio: [1.5, 2.2], ey: [17.5, 21.5], desc: 'Para oscuros se aceptan ratios algo más cortos.' },
};

/** RNG determinista (mulberry32) para que el desafío diario sea el mismo para todos ese día. */
export function rng(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const semillaDe = txt => [...String(txt)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Receta rota del día: siempre tiene arreglo dentro de los controles disponibles. */
export function desafioDiario(fecha) {
  const r = rng(semillaDe('espresso:' + fecha));
  const tueste = ['claro', 'medio', 'medio', 'oscuro'][Math.floor(r() * 4)];
  const fallas = [
    { molienda: 16 + r() * 4 },
    { molienda: 5 + r() * 2.5 },
    { distribucion: 0.15 + r() * 0.25, nivelado: 0.4 + r() * 0.3 },
    { temp: tueste === 'claro' ? 87 : 96.5, molienda: 13 + r() * 2 },
    { dosis: 20.5 + r(), molienda: 12 },
  ];
  const falla = fallas[Math.floor(r() * fallas.length)];
  const obj = tueste === 'claro' ? 'claro' : tueste === 'oscuro' ? 'oscuro' : 'normale';
  return { id: 'diario-' + fecha, t: 'Desafío del día', obj, intentos: 5, diagnosticoGratis: true,
    aprender: 'Una receta rota distinta cada día. El primer shot es de diagnóstico y no cuenta: probalo, pensá qué falla y corregilo.',
    meta: 'Arreglá el shot en 5 intentos. Gana el mejor puntaje.',
    p: { tueste, ...falla }, controles: ['dosis', 'molienda', 'temp', 'perfil', 'puck', 'extraer'] };
}
