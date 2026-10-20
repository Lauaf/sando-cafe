// Bebidas con espresso: recetas por proporciones (con rangos, porque hay variantes válidas),
// clasificador "¿a qué se parece lo que preparé?", consejos de corrección y capas para dibujar la taza.
// Lógica pura (sin DOM).

export const COMPONENTES = {
  espresso: { n: 'Espresso', color: '#3b1f12' },
  leche: { n: 'Leche vaporizada', color: '#f1e6d2' },
  espuma: { n: 'Espuma', color: '#fbf6ee' },
  agua: { n: 'Agua caliente', color: '#b98a5c' },
};
export const CLAVES = Object.keys(COMPONENTES);

// Volúmenes en ml. `orden`: si importa cuándo va el espresso. `taza`: recipientes típicos.
// Los rangos son orientativos: cada cafetería tiene su versión (ver `variantes`).
export const RECETAS = {
  ristretto: { n: 'Ristretto', comp: { espresso: [15, 25] }, taza: ['demitasse'], desc: 'Espresso corto y concentrado.' },
  espresso: { n: 'Espresso', comp: { espresso: [25, 45] }, taza: ['demitasse'], desc: 'Un shot de ~30 ml. La base de todo.' },
  doppio: { n: 'Doble (doppio)', comp: { espresso: [50, 75] }, taza: ['demitasse', 'cortado'], desc: 'Dos shots, ~60 ml.' },
  macchiato: { n: 'Macchiato', comp: { espresso: [25, 65], espuma: [10, 30], leche: [0, 15] }, taza: ['demitasse'], desc: 'Espresso "manchado" con una cucharada de espuma.',
    variantes: 'En algunas cadenas "macchiato" es un latte con caramelo: no tiene nada que ver con el italiano.' },
  cortado: { n: 'Cortado', comp: { espresso: [25, 65], leche: [25, 70], espuma: [0, 15] }, taza: ['cortado'], desc: '≈ mitad espresso, mitad leche, casi sin espuma.',
    variantes: 'En Argentina suele ser espresso con un chorrito de leche; en España y en specialty, mitad y mitad.' },
  piccolo: { n: 'Piccolo', comp: { espresso: [15, 30], leche: [50, 90], espuma: [5, 15] }, taza: ['cortado'], desc: 'Ristretto con leche en vaso chico: un latte en miniatura.' },
  flatwhite: { n: 'Flat white', comp: { espresso: [50, 75], leche: [90, 140], espuma: [5, 20] }, taza: ['capuchino'], desc: 'Doble espresso con leche y una capa finita de microespuma.',
    variantes: 'En Australia y Nueva Zelanda se sirve en taza de ~160 ml; en otros lados, más grande.' },
  capuchino: { n: 'Cappuccino', comp: { espresso: [25, 65], leche: [60, 120], espuma: [40, 80] }, taza: ['capuchino'], desc: 'Espresso, leche y una capa generosa de espuma (≈ 1,5 cm).',
    variantes: 'El italiano clásico ronda 150–180 ml; muchas cadenas lo sirven de 300 ml o más.' },
  latte: { n: 'Latte', comp: { espresso: [25, 65], leche: [150, 300], espuma: [10, 35] }, taza: ['latte'], desc: 'Mucha leche y una capa fina de espuma (≈ 1 cm). Ideal para latte art.' },
  lattemacchiato: { n: 'Latte macchiato', comp: { leche: [150, 250], espuma: [30, 70], espresso: [25, 45] }, orden: 'espresso_ultimo', taza: ['vaso'],
    desc: 'Leche espumada en vaso alto; el espresso se vierte al final y queda en capas.' },
  conleche: { n: 'Café con leche', comp: { espresso: [25, 65], leche: [70, 160], espuma: [0, 15] }, taza: ['capuchino', 'latte'], desc: '≈ mitad café, mitad leche, sin mucha espuma.' },
  lagrima: { n: 'Lágrima', comp: { leche: [150, 230], espresso: [5, 20], espuma: [0, 30] }, taza: ['latte', 'vaso'], desc: 'Leche con apenas una "lágrima" de café. Clásico argentino.' },
  americano: { n: 'Americano', comp: { espresso: [25, 65], agua: [90, 240] }, orden: 'espresso_primero', taza: ['americano'], desc: 'Espresso estirado con agua caliente.',
    variantes: 'La proporción agua:café va de 2:1 a 4:1 según el gusto.' },
  longblack: { n: 'Long black', comp: { agua: [90, 180], espresso: [50, 75] }, orden: 'espresso_ultimo', taza: ['capuchino', 'americano'], desc: 'Primero el agua, después el espresso: conserva la crema.' },
};

export const TAZAS = {
  demitasse: { n: 'Pocillo', cap: 90 },
  cortado: { n: 'Vaso cortado', cap: 140 },
  capuchino: { n: 'Taza capuchino', cap: 200 },
  latte: { n: 'Taza latte', cap: 330 },
  americano: { n: 'Taza americano', cap: 260 },
  vaso: { n: 'Vaso alto', cap: 330 },
};

/** ¿Se cumplió la regla de orden? orden = lista de componentes en el orden en que se vertieron. */
export function ordenCumplido(regla, orden) {
  if (!regla) return true;
  const iE = orden.indexOf('espresso');
  if (iE < 0) return true;
  const otros = orden.filter(x => x !== 'espresso');
  if (regla === 'espresso_ultimo') return otros.length > 0 && orden.slice(iE).every(x => x === 'espresso');
  if (regla === 'espresso_primero') return orden.slice(0, iE).length === 0;
  return true;
}

/** Distancia de un contenido a una receta (0 = dentro de todos los rangos). */
export function distancia(cont, receta, orden = []) {
  let d = 0;
  for (const k of CLAVES) {
    const v = cont[k] || 0;
    const [a, b] = receta.comp[k] || [0, 0];
    const esc = receta.comp[k] ? Math.max(12, (b - a) / 2 + 8) : 15;
    if (v < a) d += ((a - v) / esc) ** 2;
    else if (v > b) d += ((v - b) / esc) ** 2;
    else if (b > a) d += 0.04 * ((v - (a + b) / 2) / (b - a)) ** 2; // desempate: más cerca del centro
  }
  if (!ordenCumplido(receta.orden, orden)) d += 2.2;
  return d;
}

/** Ranking de bebidas parecidas: [{id, n, parecido 0..100, dist}] ordenado de más a menos parecida. */
export function clasificar(cont, orden = []) {
  const total = CLAVES.reduce((s, k) => s + (cont[k] || 0), 0);
  if (total < 5) return [];
  return Object.entries(RECETAS)
    .map(([id, r]) => { const dist = distancia(cont, r, orden); return { id, n: r.n, dist, parecido: Math.round(100 * Math.exp(-dist / 2)) }; })
    .sort((a, b) => a.dist - b.dist);
}

/** Qué cambiar para llegar a una receta (en ml, redondeado a 5). */
export function consejos(cont, id, orden = []) {
  const r = RECETAS[id], out = [];
  const r5 = x => Math.max(5, Math.round(x / 5) * 5);
  for (const k of CLAVES) {
    const v = cont[k] || 0;
    const [a, b] = r.comp[k] || [0, 0];
    if (v < a) out.push({ k, falta: true, txt: `Agregá ~${r5(a - v)} ml de ${COMPONENTES[k].n.toLowerCase()}` });
    else if (v > b) out.push({ k, falta: false, txt: r.comp[k] ? `Te sobran ~${r5(v - b)} ml de ${COMPONENTES[k].n.toLowerCase()}` : `${COMPONENTES[k].n} no va en un ${r.n.toLowerCase()}` });
  }
  if (!ordenCumplido(r.orden, orden)) out.push({ k: 'orden', txt: r.orden === 'espresso_ultimo' ? 'El espresso va al final, sobre lo demás' : 'El espresso va primero' });
  return out;
}

/** Proporciones en % del total (para comparar con la receta). */
export function proporciones(cont) {
  const total = CLAVES.reduce((s, k) => s + (cont[k] || 0), 0) || 1;
  return Object.fromEntries(CLAVES.map(k => [k, (cont[k] || 0) / total]));
}

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const aHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => aHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));

/** Color del líquido mezclado: el espresso tiñe mucho más que la leche; el agua solo lo aclara un poco. */
export function colorLiquido(e, l, a) {
  if (e + l + a <= 0) return '#00000000';
  if (l <= 0) return mix('#2a1409', '#6e3f1e', a / (a + e * 1.2 || 1));
  const t = l / (l + e * 2.4 + a * 0.4);
  return mix(mix('#3b1f12', '#7a4a2a', a / (a + e || 1) * 0.6), '#efe2cc', Math.pow(t, 0.85));
}

/**
 * Capas para dibujar la taza (de abajo hacia arriba): [{tipo, ml, color, mancha?}].
 * Modelo visual simple: la espuma siempre flota; el espresso vertido al final sobre leche queda en capa
 * (latte macchiato) y sobre agua conserva la crema (long black); en el resto, los líquidos se mezclan.
 */
export function capas(cont, orden = []) {
  const e = cont.espresso || 0, l = cont.leche || 0, f = cont.espuma || 0, a = cont.agua || 0;
  const out = [];
  const iE = orden.indexOf('espresso');
  const ultimo = e > 0 && iE > 0 && orden.slice(iE).every(x => x === 'espresso');
  if (ultimo && l > 0) {
    out.push({ tipo: 'leche', ml: l + a, color: colorLiquido(0, l, a) });
    out.push({ tipo: 'espresso', ml: e, color: '#6b3a1d' });
  } else if (e + l + a > 0) {
    out.push({ tipo: 'liquido', ml: e + l + a, color: colorLiquido(e, l, a) });
  }
  // crema: sobrevive arriba si el espresso no se rompió con agua o leche vertidas encima
  if (e > 0 && f <= 0 && (iE === orden.length - 1 || orden.every(x => x === 'espresso') || (ultimo && a > 0 && l === 0))) {
    out.push({ tipo: 'crema', ml: Math.min(8, 2 + e * 0.1), color: '#c98a4b' });
  }
  if (f > 0) out.push({ tipo: 'espuma', ml: f, color: '#fbf6ee', mancha: ultimo });
  return out;
}
