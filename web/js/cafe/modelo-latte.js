// Latte art: simulación 2D de la superficie de la taza (sin DOM, se testea con Node).
//
// Modelo (simplificado, documentado en docs/academia-barismo.md):
// - La superficie es una grilla N×N dentro de un círculo. Cada celda guarda el espesor de espuma blanca (h)
//   y qué tan intacta está la crema (C: 1 = marrón, baja cuando la leche se mezcla por debajo).
// - Vertido ALTO: la leche se hunde bajo la crema; no aparece blanco, la crema se aclara un poco.
// - Vertido CERCA y con la taza con suficiente líquido: la espuma aflora y se acumula donde cae el chorro.
// - La espuma se esparce desde donde es más gruesa (como una mancha que se abre): el área blanca crece con la
//   espuma vertida y el borde queda nítido.
// - El movimiento de la jarra arrastra la superficie (cortar atravesando arma la punta del corazón y el tallo).
// - Cada pulso de espuma (un nuevo empujón, o cada vuelta del vaivén) forma su propia capa; donde dos capas se
//   tocan queda una línea fina de crema. Así aparecen los anillos del tulipán y las hojas de la rosetta.
// - h y C se transportan con un campo de velocidades (advección semi-lagrangiana) que se amortigua.

export const N = 80;
export const CAPACIDAD = 300;       // ml de la taza
export const NIVEL_INICIAL = 0.14;  // el espresso ya está en la taza
const QMAX = 30;                    // ml/s con la jarra inclinada al máximo
// Parámetros del chorro (ajustados a mano para que las figuras clásicas salgan con la técnica real).
export const PARAM = { r0: 0.025, r1: 0.02, aporte: 6, esparce: 0.003, arrastre: 26, amort: 4.5, vref: 1.2, empuje: 2.5, adelante: 0.1 };

const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const suave = (a, b, x) => { const t = limitar((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const coord = i => ((i + 0.5) / N) * 2 - 1;
const DX = 2 / N;

export function crearSuperficie() {
  const n = N * N;
  return {
    h: new Float32Array(n), W: new Float32Array(n), C: new Float32Array(n).fill(1), E: new Float32Array(n), tmp3: new Float32Array(n),
    capa: 0, signoX: 0,
    vx: new Float32Array(n), vy: new Float32Array(n),
    ux: new Float32Array(n), uy: new Float32Array(n), tmp: new Float32Array(n), tmp2: new Float32Array(n),
    nivel: NIVEL_INICIAL, t: 0, vertido: 0, tVertiendo: 0, cortes: 0, vertiaAntes: false, rebalso: 0,
    flujos: [], blancoTemprano: 0,
  };
}

/**
 * Avanza la superficie dt segundos.
 * entrada: {vertiendo, x, y (−1..1, posición del pico sobre la taza), flujo (0..1), altura (0 = rozando, 1 = alto),
 *           mx, my (velocidad de la jarra en unidades de taza/s), calidad (0..1 microespuma)}
 */
export function paso(s, dt, e) {
  s.t += dt;
  const vierte = e.vertiendo && e.flujo > 0.03;
  if (vierte) {
    if (!s.vertiaAntes && s.vertido > 0) { s.cortes++; s.capa++; }
    // cada vuelta del vaivén lateral empieza una capa nueva
    const sx = Math.abs(e.mx || 0) > 0.4 ? Math.sign(e.mx) : 0;
    if (sx && s.signoX && sx !== s.signoX && e.altura < 0.5) s.capa++;
    if (sx) s.signoX = sx;
    const q = e.flujo * QMAX * dt;
    s.vertido += q;
    s.tVertiendo += dt;
    s.flujos.push(e.flujo);
    if (s.nivel >= 1) s.rebalso += q;
    s.nivel = Math.min(1.02, s.nivel + q / CAPACIDAD);
    aplicarChorro(s, dt, e);
  }
  s.vertiaAntes = vierte;
  esparcirYAdvectar(s, dt);
  const amort = Math.exp(-PARAM.amort * dt);
  for (let k = 0; k < s.vx.length; k++) { s.vx[k] *= amort; s.vy[k] *= amort; }
  calcularBlanco(s);
  return s;
}

function aplicarChorro(s, dt, e) {
  const cerca = suave(0.25, 0.75, 1 - e.altura);              // 1 = pico rozando la superficie
  const hondo = suave(0.38, 0.6, s.nivel);                     // con poca leche en la taza el blanco no flota
  const calidad = e.calidad ?? 1;
  // la espuma aflora sobre todo donde la jarra va lenta (en los extremos de un vaivén); al pasar rápido, arrastra
  const vel = Math.hypot(e.mx || 0, e.my || 0);
  const lento = 1 / (1 + (vel / PARAM.vref) ** 2);
  const aporte = e.flujo * cerca * hondo * (0.35 + 0.65 * calidad) * lento * PARAM.aporte;
  const R = PARAM.r0 + PARAM.r1 * e.flujo;
  // el chorro entra inclinado (la jarra está del lado de arriba): toda la mancha que alimenta avanza (hacia abajo)
  if (PARAM.adelante > 0 && cerca > 0.05) {
    const fa = PARAM.adelante * e.flujo * cerca * dt * 10;
    for (let k = 0; k < s.h.length; k++) {
      if (s.h[k] < 0.05) continue;
      const x = coord(k % N), y = coord(Math.floor(k / N));
      s.vy[k] += fa * Math.exp(-(((x - e.x) ** 2 + (y - e.y) ** 2) / 0.12));
    }
  }
  const alcance = R * 4;
  const i0 = Math.max(0, Math.floor(((e.x - alcance + 1) / 2) * N)), i1 = Math.min(N - 1, Math.ceil(((e.x + alcance + 1) / 2) * N));
  const j0 = Math.max(0, Math.floor(((e.y - alcance + 1) / 2) * N)), j1 = Math.min(N - 1, Math.ceil(((e.y + alcance + 1) / 2) * N));
  for (let j = j0; j <= j1; j++) {
    const y = coord(j);
    for (let i = i0; i <= i1; i++) {
      const x = coord(i);
      if (x * x + y * y > 1) continue;
      const dx = x - e.x, dy = y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > alcance) continue;
      const k = j * N + i;
      const g = Math.exp(-((d / R) ** 2));
      const nuevo = aporte * g * dt;
      // donde la espuma nueva domina, la celda pasa a la capa actual (sin mezclar: los bordes quedan nítidos)
      if (nuevo > 0 && nuevo * 8 > s.h[k] * 0.5) s.E[k] = s.capa;
      s.h[k] += nuevo;
      s.C[k] = Math.max(0.3, s.C[k] - (1 - cerca) * e.flujo * g * dt * 0.9);
      if (aporte > 0 && s.nivel < 0.5) s.blancoTemprano += aporte * g * dt;
      // el chorro empuja un poco hacia afuera y la jarra arrastra la superficie en su dirección
      const g2 = Math.exp(-((d / (R * 1.8)) ** 2));
      // el chorro que choca empuja la superficie en anillo (cero justo donde cae, como un chorro real)
      if (d > 1e-4) { const f = PARAM.empuje * e.flujo * cerca * (d / R) * g2 * dt * 10; s.vx[k] += (dx / d) * f; s.vy[k] += (dy / d) * f; }
      // la superficie tiende a la velocidad de la jarra (nunca la supera)
      const arr = Math.min(1, g2 * dt * PARAM.arrastre * (0.3 + 0.7 * e.flujo) * (0.25 + 0.75 * cerca));
      s.vx[k] += ((e.mx || 0) * 0.8 - s.vx[k]) * arr; s.vy[k] += ((e.my || 0) * 0.8 - s.vy[k]) * arr;
    }
  }
}

function muestrear(campo, x, y, fuera) {
  const fx = ((x + 1) / 2) * N - 0.5, fy = ((y + 1) / 2) * N - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  const tx = fx - i, ty = fy - j;
  const v = (a, b) => (a < 0 || b < 0 || a >= N || b >= N) ? fuera : campo[b * N + a];
  return (v(i, j) * (1 - tx) + v(i + 1, j) * tx) * (1 - ty) + (v(i, j + 1) * (1 - tx) + v(i + 1, j + 1) * tx) * ty;
}

function esparcirYAdvectar(s, dt) {
  const { h, C, E, vx, vy, ux, uy, tmp, tmp2, tmp3 } = s;
  // velocidad total = esparcimiento (desde donde hay más espuma) + impulso del chorro y la jarra
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const hl = i > 0 ? h[k - 1] : h[k], hr = i < N - 1 ? h[k + 1] : h[k];
    const hu = j > 0 ? h[k - N] : h[k], hd = j < N - 1 ? h[k + N] : h[k];
    ux[k] = vx[k] - PARAM.esparce * (hr - hl) / (2 * DX);
    uy[k] = vy[k] - PARAM.esparce * (hd - hu) / (2 * DX);
  }
  for (let j = 0; j < N; j++) {
    const y = coord(j);
    for (let i = 0; i < N; i++) {
      const x = coord(i), k = j * N + i;
      if (x * x + y * y > 1) { tmp[k] = 0; tmp2[k] = 1; tmp3[k] = 0; continue; }
      let u = ux[k], v = uy[k];
      const r = Math.hypot(x, y);
      if (r > 0.9) { // la pared frena lo que va hacia afuera
        const nx = x / r, ny = y / r, vn = u * nx + v * ny;
        if (vn > 0) { const fr = suave(0.9, 1, r); u -= vn * nx * fr; v -= vn * ny * fr; }
      }
      // límite CFL suave: no mover más de 1,5 celdas por paso
      const m = Math.hypot(u, v) * dt / DX;
      if (m > 1.5) { u *= 1.5 / m; v *= 1.5 / m; }
      let bx = x - u * dt, by = y - v * dt;
      const rb = Math.hypot(bx, by);
      if (rb > 0.995) { bx *= 0.995 / rb; by *= 0.995 / rb; }
      // divergencia: si la espuma se abre, se afina (conserva aproximadamente el volumen)
      const ul = i > 0 ? ux[k - 1] : u, ur = i < N - 1 ? ux[k + 1] : u, vu = j > 0 ? uy[k - N] : v, vd = j < N - 1 ? uy[k + N] : v;
      const div = (ur - ul) / (2 * DX) + (vd - vu) / (2 * DX);
      tmp[k] = Math.min(3, Math.max(0, muestrear(h, bx, by, 0) * Math.exp(limitar(-div * dt, -0.1, 0.1))));
      tmp2[k] = muestrear(C, bx, by, 1);
      tmp3[k] = muestrearCercano(E, bx, by);
    }
  }
  h.set(tmp); C.set(tmp2); E.set(tmp3);
}

// la capa no se interpola (si no, los bordes entre capas se borronean)
function muestrearCercano(campo, x, y) {
  const i = limitar(Math.round(((x + 1) / 2) * N - 0.5), 0, N - 1), j = limitar(Math.round(((y + 1) / 2) * N - 0.5), 0, N - 1);
  return campo[j * N + i];
}

/** Blanco visible: espesor suficiente de espuma, menos las líneas entre capas. */
function calcularBlanco(s) {
  const { h, E, W } = s;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    let w = suave(0.12, 0.3, h[k]);
    if (w > 0 && i > 0 && j > 0 && i < N - 1 && j < N - 1) {
      // borde entre capas distintas (solo donde hay espuma de los dos lados)
      let salto = 0;
      for (const o of [1, -1, N, -N]) if (h[k + o] > 0.12) salto = Math.max(salto, Math.abs(E[k + o] - E[k]));
      if (salto > 0.5) w *= 0.15;
    }
    W[k] = w;
  }
}

// ---------- Figuras objetivo (coordenadas de pantalla: y crece hacia abajo; la jarra entra desde abajo) ----------
export const FIGURAS = {
  circulo: (x, y) => x * x + (y - 0.2) ** 2 < 0.38 ** 2,
  corazon: (x, y) => {
    const X = x / 0.42, Y = -(y - 0.22) / 0.42;
    return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
  },
  tulipan: (x, y) => {
    const el = (cy, rx, ry) => (x / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
    return el(0.32, 0.4, 0.3) || el(-0.05, 0.32, 0.2) || el(-0.3, 0.2, 0.13);
  },
  // silueta de la rosetta (las hojas se cuentan aparte)
  rosetta: (x, y) => (x / 0.36) ** 2 + ((y - 0.12) / 0.58) ** 2 < 1,
};

/**
 * Rasgos de la figura: proporción alto/ancho, muesca arriba (corazón), punta abajo, capas sobre el eje y hojas.
 * La silueta sale del espesor de espuma; las muescas y capas, del blanco visible.
 */
export function rasgos(s) {
  const fila = [];
  let top = -1, bot = -1, anchoMax = 0;
  for (let j = 0; j < N; j++) {
    let izq = -1, der = -1;
    for (let i = 0; i < N; i++) if (s.h[j * N + i] > 0.18) { if (izq < 0) izq = i; der = i; }
    const ancho = izq < 0 ? 0 : der - izq + 1;
    fila.push(ancho);
    if (ancho > 2) { if (top < 0) top = j; bot = j; }
    anchoMax = Math.max(anchoMax, ancho);
  }
  if (top < 0) return { aspecto: 0, muesca: 0, punta: 0, capas: 0, hojas: 0 };
  const alto = bot - top + 1;
  const c = Math.floor(N / 2);
  // muesca: en el cuarto de arriba, el centro oscuro con blanco a los dos lados
  let conMuesca = 0, filasArriba = 0;
  for (let j = top; j < top + Math.max(2, Math.round(alto * 0.3)); j++) {
    filasArriba++;
    const centro = Math.min(s.W[j * N + c], s.W[j * N + c - 1]);
    let izq = 0, der = 0;
    for (let d = 2; d < N / 2; d++) { izq = Math.max(izq, s.W[j * N + c - d]); der = Math.max(der, s.W[j * N + c + d - 1]); }
    if (centro < 0.35 && izq > 0.6 && der > 0.6) conMuesca++;
  }
  // punta: qué tan angosta es la silueta cerca del final
  const anchoBajo = fila[Math.max(top, bot - Math.round(alto * 0.12))];
  const punta = 1 - Math.min(1, anchoBajo / (anchoMax * 0.55));
  // capas: alternancias blanco/crema sobre el eje central (de arriba a abajo)
  let estado = 0, cambios = 0;
  for (let j = top; j <= bot; j++) {
    const w = Math.max(s.W[j * N + c], s.W[j * N + c - 1]);
    const b2 = w > 0.55 ? 1 : w < 0.3 ? -1 : 0;
    if (!b2) continue;
    if (estado && b2 !== estado) cambios++;
    estado = b2;
  }
  return { aspecto: alto / Math.max(1, anchoMax), muesca: conMuesca / filasArriba, punta, capas: Math.floor(cambios / 2), hojas: contarHojas(s) };
}

/** Cuenta las hojas: alternancias blanco/crema a lo largo de dos líneas verticales a los costados del tallo. */
export function contarHojas(s) {
  let total = 0;
  for (const xc of [-0.16, 0.16]) {
    const i = Math.round(((xc + 1) / 2) * N - 0.5);
    let estado = 0, cambios = 0, enFigura = false;
    for (let j = 0; j < N; j++) {
      const w = s.W[j * N + i];
      const b = w > 0.55 ? 1 : w < 0.3 ? -1 : 0;
      if (b === 1) enFigura = true;
      if (!enFigura || b === 0) continue;
      if (estado && b !== estado) cambios++;
      estado = b;
    }
    total += Math.max(0, Math.floor((cambios - 1) / 2));
  }
  return Math.round(total / 2);
}

/** Máscara (N×N, 0/1) de una figura. */
export function mascara(fig) {
  const m = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = coord(i), y = coord(j);
    if (x * x + y * y <= 1 && FIGURAS[fig](x, y)) m[j * N + i] = 1;
  }
  return m;
}

// ---------- Evaluación ----------
const desvio = a => { if (a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };

/** Métricas de forma comparando la espuma con una figura (suavizadas para tolerar pequeñas diferencias). */
export function metricasForma(s, fig) {
  const m = mascara(fig);
  let inter = 0, union = 0, blanco = 0, borroso = 0, dentro = 0, sx = 0, sy = 0, sw = 0, sim = 0, simN = 0;
  let mx = 0, my = 0, mn = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = coord(i), y = coord(j);
    if (x * x + y * y > 1) continue;
    const k = j * N + i;
    dentro++;
    // la silueta se mide con el espesor de espuma (las líneas finas entre capas no la cortan)
    const w = s.W[k], sil = s.h[k] > 0.18 ? 1 : 0;
    const b = sil;
    blanco += b;
    if (w > 0.2 && w < 0.8) borroso++;
    if (b && m[k]) inter++;
    if (b || m[k]) union++;
    if (b) { sx += x; sy += y; sw++; }
    if (m[k]) { mx += x; my += y; mn++; }
    const espejo = j * N + (N - 1 - i);
    const silE = s.h[espejo] > 0.18 ? 1 : 0;
    if (i < N / 2 && (sil || silE)) { sim += Math.abs(sil - silE); simN++; }
  }
  const iou = union ? inter / union : 0;
  const cx = sw ? sx / sw : 0, cy = sw ? sy / sw : 0;
  const tx = mn ? mx / mn : 0, ty = mn ? my / mn : 0;
  return {
    iou,
    simetria: simN ? 1 - sim / simN : 0,
    centrado: sw ? Math.max(0, 1 - Math.hypot(cx - tx, cy - ty) / 0.4) : 0,
    definicion: blanco ? Math.max(0, 1 - (borroso / Math.max(1, blanco)) * 0.8) : 0,
    cobertura: blanco / dentro,
    coberturaObjetivo: mn / dentro,
  };
}

export const LECCIONES = [
  { id: 'la-1', t: 'Control del flujo', fig: null, aprender: 'Antes de dibujar hay que llenar la base: jarra alta y un chorro finito y constante, para que la leche se hunda bajo la crema sin manchar de blanco.',
    meta: 'Llená la taza hasta el 90–100 % con la jarra ALTA, sin cortar el chorro y sin que aparezca blanco.', ayuda: 'Mantené apretado sobre la taza y no cambies la inclinación.' },
  { id: 'la-2', t: 'Círculo', fig: 'circulo', aprender: 'Con la taza a la mitad, bajá la jarra hasta casi tocar y subí el flujo en el centro: la espuma flota y se abre en un círculo blanco.',
    meta: 'Dibujá un círculo blanco centrado y llená la taza.', ayuda: 'Alto hasta ~50 %, después cerca y quieto en el centro.' },
  { id: 'la-3', t: 'Corazón', fig: 'corazon', cortesPermitidos: 1, aprender: 'Un corazón es un círculo cortado: al final, con la jarra a media altura y poco flujo, atravesá el círculo desde su borde de arriba hacia abajo. El chorro arrastra la crema y arma la muesca y la punta.',
    meta: 'Dibujá un corazón simétrico.', ayuda: 'Círculo grande (cerca, en el centro). Después: altura media, flujo bajo, y un corte recto y rápido desde el borde de arriba hasta pasar el de abajo.' },
  { id: 'la-4', t: 'Tulipán', fig: 'tulipan', cortesPermitidos: 3, aprender: 'El tulipán apila círculos: cada "empujón" nuevo empuja al anterior hacia arriba. Cortá entre empujones y terminá atravesando todo.',
    meta: 'Apilá 2–3 bloques y cortalos con un tallo.', ayuda: 'Primer empujón cerca, un poco abajo del centro; cortá el chorro, el siguiente empujón un poco más arriba (detrás), y así. Al final, altura media y corte hacia abajo.' },
  { id: 'la-5', t: 'Rosetta', fig: 'rosetta', hojas: 5, cortesPermitidos: 1, aprender: 'La rosetta nace de un vaivén lateral mientras la jarra retrocede: cada vaivén deja una hoja. Al final, el corte arma el tallo.',
    meta: 'Hojas en zigzag y un tallo central.', ayuda: 'Base alta hasta la mitad. Cerca y con buen flujo, vaivén lateral mientras retrocedés hacia arriba. Al final, altura media y corte hacia abajo por el medio.' },
];

/** Puntaje 0..100 con desglose y comentarios para una lección. */
export function evaluarLatte(s, leccion) {
  const notas = [], partes = {};
  const llenado = s.nivel;
  partes.nivel = s.rebalso > 2 ? 0.2 : llenado >= 0.88 ? 1 : Math.max(0, 1 - (0.88 - llenado) * 4);
  if (s.rebalso > 2) notas.push('💦 Rebalsó: cortá el chorro cuando la taza esté casi llena.');
  else if (llenado < 0.85) notas.push(`🥛 Quedó a ${Math.round(llenado * 100)} %: falta llenar la taza.`);
  const cortesDeMas = Math.max(0, s.cortes - (leccion.cortesPermitidos || 0));
  partes.continuidad = Math.max(0, 1 - cortesDeMas * 0.25);
  if (cortesDeMas > 0) notas.push(`✂️ Cortaste el chorro ${s.cortes} ${s.cortes === 1 ? 'vez' : 'veces'}: ${leccion.cortesPermitidos ? 'más de lo necesario' : 'cada corte rompe el dibujo'}.`);
  if (!leccion.fig) {
    const cv = desvio(s.flujos) / Math.max(0.05, s.flujos.reduce((a, b) => a + b, 0) / Math.max(1, s.flujos.length));
    partes.constancia = Math.max(0, 1 - cv * 2);
    let blanco = 0; for (let k = 0; k < s.W.length; k++) blanco += s.W[k] > 0.5 ? 1 : 0;
    partes.limpio = Math.max(0, 1 - blanco / (N * N * 0.05));
    if (partes.constancia < 0.7) notas.push('〰️ El flujo varió mucho: buscá una inclinación y mantenela.');
    if (partes.limpio < 0.8) notas.push('⚪ Apareció blanco: la jarra estuvo demasiado cerca. Para la base, vertí desde arriba.');
    const pts = Math.round(100 * (0.35 * partes.constancia + 0.3 * partes.nivel + 0.2 * partes.continuidad + 0.15 * partes.limpio));
    if (!notas.length) notas.push('✨ Base perfecta: crema intacta y taza llena.');
    return { puntaje: pts, partes, notas };
  }
  const m = metricasForma(s, leccion.fig);
  const r = rasgos(s);
  // rasgos que distinguen cada figura (un círculo no es un corazón aunque ocupe el mismo lugar)
  let rasgo = 1;
  if (leccion.fig === 'circulo') rasgo = 1 - Math.min(1, Math.max(r.muesca * 2.5, Math.abs(r.aspecto - 1) * 1.5, r.capas > 0 ? 0.4 : 0));
  if (leccion.fig === 'corazon') {
    rasgo = Math.min(1, r.muesca / 0.45) * (r.aspecto < 1.35 ? 1 : 0.3);
    if (r.muesca < 0.25) notas.push('💔 Falta el corte: al final poné la jarra a media altura, bajá el flujo y atravesá el círculo desde su borde de arriba hacia abajo, rápido y recto.');
  }
  if (leccion.fig === 'tulipan') {
    rasgo = (Math.min(1, r.capas / 3) * 0.6 + (r.aspecto >= 1.3 ? 0.4 : 0.1)) * (r.hojas >= 4 ? 0.6 : 1);
    if (r.capas < 2) notas.push('🌷 No se ven capas: cortá el chorro entre empujones y empezá cada uno un poco más atrás (arriba) que el anterior.');
  }
  if (leccion.fig === 'rosetta') rasgo = r.aspecto >= 1.25 ? 1 : 0.4;
  Object.assign(partes, { forma: 0.5 * Math.min(1, m.iou / 0.6) + 0.5 * rasgo, simetria: limitar((m.simetria - 0.5) / 0.45, 0, 1), centrado: m.centrado, definicion: m.definicion });
  if (m.cobertura < m.coberturaObjetivo * 0.5) notas.push('⚪ Muy poco blanco: bajá más la jarra (casi rozando) y subí el flujo cuando la taza esté a la mitad.');
  else if (m.cobertura > m.coberturaObjetivo * 1.7) notas.push('⚪ Demasiado blanco: empezaste a dibujar muy temprano o con mucho flujo.');
  if (s.blancoTemprano > 0.5) notas.push('⏱️ Bajaste la jarra con la taza casi vacía: el blanco se hunde y queda borroso. Esperá a ~50 %.');
  if (partes.simetria < 0.6) notas.push('↔️ Poco simétrico: vertí sobre el eje central y cortá recto.');
  if (partes.centrado < 0.6) notas.push('🎯 Descentrado: apuntá al centro de la taza.');
  if (partes.forma < 0.6 && notas.length < 2) notas.push('✏️ La forma todavía no se parece a la figura: mirá la guía y probá de nuevo.');
  partes.rasgos = r;
  let pts;
  if (leccion.hojas) {
    const hojas = r.hojas;
    partes.hojas = Math.min(1, hojas / leccion.hojas);
    if (hojas < leccion.hojas) notas.push(`🌿 Se ven ${hojas} hojas (buscá ${leccion.hojas} o más): hacé el vaivén más amplio y retrocedé más despacio.`);
    pts = Math.round(100 * (0.3 * partes.forma + 0.3 * partes.hojas + 0.1 * partes.simetria + 0.1 * partes.centrado + 0.05 * partes.definicion + 0.075 * partes.nivel + 0.075 * partes.continuidad) * (0.6 + 0.4 * partes.hojas));
  } else {
    pts = Math.round(100 * (0.6 * partes.forma + 0.1 * partes.simetria + 0.1 * partes.centrado + 0.05 * partes.definicion + 0.075 * partes.nivel + 0.075 * partes.continuidad));
  }
  if (!notas.length) notas.push('✨ ¡Precioso! Contraste limpio y buena forma.');
  const { rasgos: rr, ...num } = partes;
  return { puntaje: pts, partes: num, rasgos: rr, notas, metricas: m };
}
