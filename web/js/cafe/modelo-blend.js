// Laboratorio de blends: perfil sensorial ESTIMADO de una mezcla (lógica pura, sin DOM).
//
// Importante: esto es una predicción educativa. Los perfiles de cada café son "típicos" de su origen, variedad y
// proceso (generalizaciones de manual, no fichas de un lote real) y la mezcla se calcula con reglas simples:
// - Cada atributo es el promedio ponderado por proporción.
// - Lo delicado (floral, frutado) se tapa cuando hay mucho amargor o notas terrosas.
// - El tueste corre el perfil: más oscuro = menos acidez y origen, más cuerpo, amargor y notas tostadas.
// - Demasiados componentes o tuestes muy distintos restan claridad (la taza pierde definición).
// Un blend real se valida catando; los números de acá orientan, no reemplazan la cata.

export const ATRIBUTOS = {
  acidez: 'Acidez', dulzor: 'Dulzor', cuerpo: 'Cuerpo', amargor: 'Amargor',
  frutado: 'Frutado', floral: 'Floral', chocolate: 'Chocolate / nuez', terroso: 'Terroso / especiado', claridad: 'Claridad',
};
export const CLAVES = Object.keys(ATRIBUTOS);

// perfiles típicos a tueste medio (0–10). cafeina y crema son relativas (1 = arábica promedio).
export const CAFES = [
  { id: 'eti-lav', origen: 'Etiopía', variedad: 'Landraces etíopes', proceso: 'Lavado', color: '#e8c547', cafeina: 1, crema: 1,
    p: { acidez: 8, dulzor: 6, cuerpo: 3, amargor: 2, frutado: 6, floral: 8, chocolate: 2, terroso: 1, claridad: 9 }, nota: 'Jazmín, bergamota y cítricos. Taza liviana y muy limpia.' },
  { id: 'eti-nat', origen: 'Etiopía', variedad: 'Landraces etíopes', proceso: 'Natural', color: '#c94f6d', cafeina: 1, crema: 1,
    p: { acidez: 6, dulzor: 8, cuerpo: 5, amargor: 2, frutado: 9, floral: 5, chocolate: 3, terroso: 2, claridad: 6 }, nota: 'Frutos rojos y vino: el grano se seca dentro de la fruta.' },
  { id: 'ken', origen: 'Kenia', variedad: 'SL28 / SL34', proceso: 'Lavado', color: '#a33b4c', cafeina: 1, crema: 1,
    p: { acidez: 9, dulzor: 6, cuerpo: 5, amargor: 3, frutado: 8, floral: 3, chocolate: 2, terroso: 1, claridad: 8 }, nota: 'Acidez intensa, grosella y pomelo.' },
  { id: 'col', origen: 'Colombia', variedad: 'Caturra / Castillo', proceso: 'Lavado', color: '#d39a62', cafeina: 1, crema: 1,
    p: { acidez: 6, dulzor: 7, cuerpo: 5, amargor: 3, frutado: 5, floral: 3, chocolate: 5, terroso: 2, claridad: 7 }, nota: 'Caramelo, fruta amarilla y acidez media. Muy versátil.' },
  { id: 'gua', origen: 'Guatemala', variedad: 'Bourbon', proceso: 'Lavado', color: '#b5793f', cafeina: 1, crema: 1,
    p: { acidez: 6, dulzor: 7, cuerpo: 6, amargor: 3, frutado: 4, floral: 2, chocolate: 6, terroso: 3, claridad: 7 }, nota: 'Chocolate con leche, especias suaves y buena estructura.' },
  { id: 'cri', origen: 'Costa Rica', variedad: 'Caturra', proceso: 'Honey', color: '#e0a23a', cafeina: 1, crema: 1,
    p: { acidez: 6, dulzor: 8, cuerpo: 6, amargor: 2, frutado: 5, floral: 2, chocolate: 4, terroso: 1, claridad: 7 }, nota: 'Proceso "miel": parte del mucílago se seca con el grano. Muy dulce.' },
  { id: 'bra', origen: 'Brasil', variedad: 'Bourbon / Mundo Novo', proceso: 'Natural', color: '#7b4a2e', cafeina: 1, crema: 1.1,
    p: { acidez: 3, dulzor: 7, cuerpo: 7, amargor: 4, frutado: 2, floral: 1, chocolate: 8, terroso: 3, claridad: 6 }, nota: 'Nuez, cacao y poca acidez. Clásica base de espresso.' },
  { id: 'sum', origen: 'Sumatra', variedad: 'Varias', proceso: 'Semilavado (Giling Basah)', color: '#4e5a3a', cafeina: 1, crema: 1.1,
    p: { acidez: 2, dulzor: 5, cuerpo: 9, amargor: 5, frutado: 1, floral: 0, chocolate: 4, terroso: 8, claridad: 4 }, nota: 'Mucho cuerpo, notas terrosas y herbales.' },
  { id: 'gei', origen: 'Panamá', variedad: 'Geisha', proceso: 'Lavado', color: '#f2e2a0', cafeina: 1, crema: 0.9,
    p: { acidez: 8, dulzor: 7, cuerpo: 3, amargor: 1, frutado: 7, floral: 10, chocolate: 1, terroso: 0, claridad: 10 }, nota: 'Floral extremo, té y durazno. Delicadísimo y caro.' },
  { id: 'rob', origen: 'Vietnam / India', variedad: 'Robusta (C. canephora)', proceso: 'Natural', color: '#3a2a22', cafeina: 2, crema: 1.8,
    p: { acidez: 1, dulzor: 2, cuerpo: 9, amargor: 8, frutado: 0, floral: 0, chocolate: 4, terroso: 7, claridad: 3 }, nota: '~2× cafeína, mucha crema y cuerpo; amargo y terroso. Se usa en pequeñas dosis.' },
];

export const TUESTES = { claro: -1, medio: 0, oscuro: 1 };

/** Perfil de un café a un tueste dado. */
export function perfilTostado(cafe, tueste = 'medio') {
  const d = TUESTES[tueste] ?? 0;
  const p = { ...cafe.p };
  p.acidez = p.acidez - 2 * d;
  p.frutado *= d > 0 ? 0.6 : d < 0 ? 1.1 : 1;
  p.floral *= d > 0 ? 0.5 : d < 0 ? 1.15 : 1;
  p.cuerpo += d;
  p.amargor += 2 * d;
  p.chocolate += d > 0 ? 1.5 : d < 0 ? -1 : 0;
  p.dulzor += d > 0 ? -0.5 : d < 0 ? -0.5 : 0;   // el dulzor máximo suele estar en tuestes medios
  p.claridad -= d > 0 ? 1 : 0;
  for (const k of CLAVES) p[k] = Math.max(0, Math.min(10, p[k]));
  return p;
}

/**
 * componentes: [{id, pct (0..100), tueste}]. Devuelve perfil 0..10, contribuciones, cafeína, crema y notas.
 */
export function mezclar(componentes) {
  const activos = componentes.filter(c => c.pct > 0);
  const total = activos.reduce((s, c) => s + c.pct, 0);
  if (!total) return null;
  const perfil = Object.fromEntries(CLAVES.map(k => [k, 0]));
  const aportes = Object.fromEntries(CLAVES.map(k => [k, []]));
  let cafeina = 0, crema = 0;
  for (const c of activos) {
    const cafe = CAFES.find(x => x.id === c.id);
    const w = c.pct / total;
    const p = perfilTostado(cafe, c.tueste);
    for (const k of CLAVES) { perfil[k] += p[k] * w; aportes[k].push({ id: c.id, v: p[k] * w, propio: p[k] }); }
    cafeina += cafe.cafeina * w; crema += cafe.crema * w;
  }
  const notas = [];
  // enmascaramiento: lo delicado se pierde con amargor y notas terrosas fuertes
  const fuerte = perfil.amargor + perfil.terroso;
  const tapa = Math.max(0.4, 1 - 0.07 * Math.max(0, fuerte - 6));
  if (tapa < 0.95 && (perfil.floral > 2 || perfil.frutado > 2)) notas.push(`🫥 El amargor y lo terroso tapan parte de lo floral y frutado (−${Math.round((1 - tapa) * 100)} %).`);
  perfil.floral *= tapa; perfil.frutado *= tapa;
  // claridad: muchos componentes o tuestes distintos ensucian la taza
  const tuestes = new Set(activos.map(c => c.tueste));
  if (activos.length > 3) { perfil.claridad -= (activos.length - 3) * 0.8; notas.push(`🌫️ ${activos.length} componentes: cuantos más, menos definida queda la taza.`); }
  if (tuestes.has('claro') && tuestes.has('oscuro')) { perfil.claridad -= 1.5; notas.push('⚖️ Mezclar tuestes claro y oscuro: cada uno se extrae distinto y la taza queda despareja (sobre todo en espresso).'); }
  // complejidad: diversidad de atributos dominantes entre componentes
  const dominantes = new Set(activos.map(c => { const p = perfilTostado(CAFES.find(x => x.id === c.id), c.tueste); return Object.entries(p).filter(([k]) => !['claridad', 'dulzor'].includes(k)).sort((a, b) => b[1] - a[1])[0][0]; }));
  const complejidad = Math.min(10, 3 + dominantes.size * 2 + (activos.length >= 2 ? 1 : 0) - Math.max(0, activos.length - 4));
  for (const k of CLAVES) perfil[k] = Math.max(0, Math.min(10, perfil[k]));
  return { perfil, aportes, cafeina, crema: Math.min(10, 3 + crema * 3.5 + perfil.cuerpo * 0.2), complejidad, notas };
}

/** Explica qué aporta cada componente (los 2 atributos donde más pesa en la mezcla). */
export function explicarAportes(m) {
  const porCafe = {};
  // se destaca lo que el café tiene alto Y de lo que aporta buena parte en la mezcla
  for (const k of CLAVES) {
    const suma = m.aportes[k].reduce((s, a) => s + a.v, 0) || 1;
    for (const a of m.aportes[k]) (porCafe[a.id] ??= []).push([k, a.v / suma, a.propio]);
  }
  return Object.entries(porCafe).map(([id, lista]) => {
    const top = lista.filter(([k]) => k !== 'claridad').sort((a, b) => b[1] * b[2] - a[1] * a[2]).slice(0, 2).map(([k, f]) => `${ATRIBUTOS[k].toLowerCase()} (${Math.round(Math.min(1, f) * 100)} % del total)`);
    return { id, txt: top.join(' y ') };
  });
}

// ---------- pedidos del tostador ----------
// req: atributo -> [min, max]; extra: cafeina/crema/robustaMax/componentesMin
export const PEDIDOS = [
  { id: 'bl-1', t: 'Espresso para leche', req: { cuerpo: [6.5, 10], chocolate: [6, 10], acidez: [0, 4.5], amargor: [0, 6] },
    aprender: 'Con leche, la acidez se pierde y el cuerpo y el chocolate se lucen. Las bases clásicas son Brasil o Guatemala.',
    meta: 'Un blend con cuerpo y chocolate que no amargue de más.' },
  { id: 'bl-2', t: 'Filtro frutal y limpio', req: { acidez: [7, 10], frutado: [6, 10], claridad: [7, 10], cuerpo: [0, 5.5] },
    aprender: 'Para filtro se buscan claridad y notas de origen. Lavados de Etiopía o Kenia, tuestes claros.',
    meta: 'Frutal, brillante y limpio.' },
  { id: 'bl-3', t: 'Espresso con robusta', req: { cuerpo: [8, 10], amargor: [0, 7], dulzor: [5, 10] }, extra: { crema: [7.5, 10], robustaMin: 10, robustaMax: 30 },
    aprender: 'Un poco de robusta suma crema, cuerpo y cafeína. Demasiada, amargor y notas terrosas.',
    meta: 'Mucha crema y cuerpo con 10–30 % de robusta, sin amargar.' },
  { id: 'bl-4', t: 'Equilibrio de la casa', req: { acidez: [5, 7], dulzor: [6.5, 10], cuerpo: [5, 7], claridad: [6, 10] }, extra: { complejidadMin: 7, componentesMin: 3 },
    aprender: 'Un blend "de la casa" suele combinar 2–4 cafés: uno da estructura, otro dulzor y otro un toque de acidez o fruta.',
    meta: 'Balanceado y complejo: al menos 3 componentes.' },
];

export function evaluarBlend(m, pedido, componentes) {
  const fallas = [];
  let pen = 0;
  for (const [k, [a, b]] of Object.entries(pedido.req)) {
    const v = m.perfil[k];
    if (v < a) { pen += (a - v) * 12; fallas.push(`${ATRIBUTOS[k]}: ${v.toFixed(1)} (buscá ≥ ${a})`); }
    if (v > b) { pen += (v - b) * 12; fallas.push(`${ATRIBUTOS[k]}: ${v.toFixed(1)} (buscá ≤ ${b})`); }
  }
  const x = pedido.extra || {};
  const total = componentes.reduce((s, c) => s + c.pct, 0) || 1;
  if (x.crema) { if (m.crema < x.crema[0]) { pen += (x.crema[0] - m.crema) * 12; fallas.push(`Crema: ${m.crema.toFixed(1)} (buscá ≥ ${x.crema[0]})`); } }
  if (x.robustaMax != null) {
    const rob = (componentes.find(c => c.id === 'rob')?.pct || 0) / total * 100;
    if (rob > x.robustaMax) { pen += (rob - x.robustaMax) * 2; fallas.push(`Robusta: ${Math.round(rob)} % (máximo ${x.robustaMax} %)`); }
    if (x.robustaMin && rob < x.robustaMin) { pen += (x.robustaMin - rob) * 3; fallas.push(`Robusta: ${Math.round(rob)} % (mínimo ${x.robustaMin} %)`); }
  }
  if (x.complejidadMin && m.complejidad < x.complejidadMin) { pen += (x.complejidadMin - m.complejidad) * 10; fallas.push(`Complejidad: ${m.complejidad.toFixed(0)} (buscá ≥ ${x.complejidadMin})`); }
  if (x.componentesMin && componentes.filter(c => c.pct > 0).length < x.componentesMin) { pen += 25; fallas.push(`Usá al menos ${x.componentesMin} cafés`); }
  return { puntaje: Math.round(Math.max(0, Math.min(100, 100 - pen))), fallas };
}
