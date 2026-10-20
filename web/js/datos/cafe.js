// Datos de café: métodos (con modelo de extracción), bebidas, quiz y guías de preparación real.

// molienda: escala 1 (extra fina, espresso) … 10 (extra gruesa, cold brew)
export const MOLIENDA = ['', 'extra fina (espresso)', 'muy fina', 'fina (moka)', 'media-fina (aeropress)', 'media (V60)', 'media-gruesa (chemex)', 'gruesa', 'gruesa (prensa)', 'muy gruesa', 'extra gruesa (cold brew)'];

export const METODOS = {
  v60: { n: 'V60 / filtro', ico: '🫖', k0: 0.0061, retiene: 2, tds: [1.15, 1.45],
    def: { dosis: 15, agua: 250, molienda: 5, temp: 93, tiempo: 180, agitacion: 1 },
    rango: { dosis: [10, 30], agua: [150, 500], molienda: [2, 9], temp: [80, 100], tiempo: [90, 360] } },
  prensa: { n: 'Prensa francesa', ico: '🥛', k0: 0.01183, retiene: 2, tds: [1.15, 1.5],
    def: { dosis: 30, agua: 500, molienda: 8, temp: 94, tiempo: 240, agitacion: 1 },
    rango: { dosis: [15, 45], agua: [250, 800], molienda: [4, 10], temp: [80, 100], tiempo: [120, 600] } },
  aeropress: { n: 'Aeropress', ico: '🧪', k0: 0.00897, retiene: 1.6, tds: [1.2, 1.6],
    def: { dosis: 15, agua: 220, molienda: 4, temp: 85, tiempo: 120, agitacion: 1 },
    rango: { dosis: [10, 25], agua: [120, 260], molienda: [2, 8], temp: [75, 100], tiempo: [45, 300] } },
  moka: { n: 'Moka / italiana', ico: '⚗️', k0: 0.0018, retiene: 1.4, tds: [3.0, 6.0], moka: true,
    def: { dosis: 15, agua: 150, molienda: 3, fuego: 'medio', agitacion: 1 },
    rango: { dosis: [10, 22], agua: [100, 250], molienda: [1, 7] } },
  espresso: { n: 'Espresso', ico: '☕', tds: [8, 12], espresso: true,
    def: { dosis: 18, salida: 36, molienda: 1.8, temp: 93 },
    rango: { dosis: [14, 22], salida: [18, 70], molienda: [1, 4], temp: [86, 98] } },
  coldbrew: { n: 'Cold brew', ico: '🧊', k0: 0.000094, retiene: 2, tds: [2.0, 3.5], frio: true,
    def: { dosis: 100, agua: 800, molienda: 9, horas: 14, agitacion: 1 },
    rango: { dosis: [40, 150], agua: [400, 1200], molienda: [5, 10], horas: [4, 30] } },
};

/** Modelo de extracción simplificado (pero con la física correcta en tendencia). */
export function extraer(metodo, p) {
  const M = METODOS[metodo];
  let ey, tds, tiempo = p.tiempo, bebida, extra = [];
  if (M.espresso) {
    // la molienda y la dosis determinan el tiempo; vos cortás al llegar a la salida (g)
    tiempo = 28 * Math.exp(-0.9 * (p.molienda - 1.8)) * (p.dosis / 18) ** 1.4 * (p.salida / 36) ** 0.8;
    const ratio = p.salida / p.dosis;
    ey = 20 + 4.2 * Math.log(tiempo / 28) + 3.2 * Math.log(ratio / 2) + 0.25 * (p.temp - 93);
    bebida = p.salida;
    tds = p.dosis * ey / 100 / bebida * 100;
    if (tiempo < 18) extra.push('el agua pasó demasiado rápido (canalización)');
    if (tiempo > 40) extra.push('goteo lentísimo, la máquina sufre');
  } else {
    let temp = p.temp, t = p.tiempo;
    if (M.moka) {
      ({ temp, t } = { bajo: { temp: 92, t: 300 }, medio: { temp: 96, t: 240 }, alto: { temp: 101, t: 150 } }[p.fuego]);
      tiempo = t;
      if (p.fuego === 'alto') extra.push('el fuego alto quema el café al final (gusto a quemado)');
    }
    if (M.frio) { t = p.horas * 3600; tiempo = t; temp = 93; }
    const kg = Math.exp(-0.38 * (p.molienda - 5));
    const kt = M.frio ? 1 : Math.exp(0.045 * (temp - 93));
    const ka = [0.87, 1, 1.15][p.agitacion ?? 1] || 1;
    const k = M.k0 * kg * kt * ka;
    ey = 30 * (1 - Math.exp(-k * t));
    if (M.moka && p.fuego === 'alto') ey += 1.5;
    bebida = (M.moka ? p.agua * 0.75 : p.agua) - p.dosis * M.retiene; // en la moka queda agua en la base
    tds = p.dosis * ey / 100 / Math.max(10, bebida) * 100;
    if (!M.frio && !M.moka && p.molienda <= 2) extra.push('molienda tan fina que tapa el filtro');
  }
  ey = Math.max(8, Math.min(30, ey));
  return { ey, tds, tiempo, bebida, extra, objetivo: M.tds };
}

/** Diagnóstico de sabor + consejo de ajuste (lo que diría un barista). */
export function diagnostico(metodo, r) {
  const [tmin, tmax] = METODOS[metodo].tds;
  const sabores = [], consejos = [];
  if (r.ey < 18) {
    sabores.push('ácido agrio, salado, se corta enseguida (subextraído)');
    consejos.push(metodo === 'espresso' ? 'molé más fino (sube el tiempo de extracción)' : 'molé más fino, o más tiempo / agua más caliente');
  } else if (r.ey > 22) {
    sabores.push('amargo, astringente, te seca la boca (sobreextraído)');
    consejos.push(metodo === 'espresso' ? 'molé más grueso (baja el tiempo)' : 'molé más grueso, o menos tiempo / agua menos caliente');
  } else sabores.push('dulce y balanceado');
  if (r.tds < tmin) { sabores.push('aguado, poco cuerpo'); consejos.push(metodo === 'espresso' ? 'menos salida en la taza (ratio más corto)' : 'más café para la misma agua (ratio más concentrado)'); }
  else if (r.tds > tmax) { sabores.push('muy intenso, pesado'); consejos.push(metodo === 'espresso' ? 'más salida en taza (ratio más largo)' : 'más agua para la misma dosis (o diluí)'); }
  const dEY = r.ey < 18 ? 18 - r.ey : r.ey > 22 ? r.ey - 22 : 0;
  const dT = r.tds < tmin ? (tmin - r.tds) / (tmax - tmin) * 4 : r.tds > tmax ? (r.tds - tmax) / (tmax - tmin) * 4 : 0;
  const puntaje = Math.max(0, Math.round(100 - dEY * 12 - dT * 12 - r.extra.length * 10));
  return { sabores, consejos, puntaje, perfecto: dEY === 0 && dT === 0 && !r.extra.length };
}

// ---------- Barra: bebidas ----------
// ingredientes: shot (30 ml espresso), chorrito (10 ml café), agua (ml), leche (vaporizada ml), espuma (cm),
// fria (leche fría ml), choco, helado, hielo, condensada, cacao
export const INGREDIENTES = [
  { id: 'shot', n: 'Shot espresso', paso: 1, max: 3, ico: '☕', ml: 30, color: '#3b2314' },
  { id: 'chorrito', n: 'Chorrito de café', paso: 1, max: 2, ico: '💧', ml: 10, color: '#4a2c1a' },
  { id: 'agua', n: 'Agua caliente', paso: 30, max: 240, ico: '♨️', ml: 1, color: '#7a5032' },
  { id: 'leche', n: 'Leche vaporizada', paso: 30, max: 270, ico: '🥛', ml: 1, color: '#e8d2b0' },
  { id: 'espuma', n: 'Espuma (cm)', paso: 0.5, max: 4, ico: '☁️', ml: 15, color: '#fff8ec' },
  { id: 'fria', n: 'Leche fría', paso: 30, max: 240, ico: '🧃', ml: 1, color: '#f4ead5' },
  { id: 'choco', n: 'Chocolate', paso: 1, max: 2, ico: '🍫', ml: 20, color: '#5a341f' },
  { id: 'condensada', n: 'Leche condensada', paso: 1, max: 2, ico: '🍯', ml: 20, color: '#f2dcb0' },
  { id: 'hielo', n: 'Hielo', paso: 1, max: 1, ico: '🧊', ml: 60, color: '#cfe8ff' },
  { id: 'helado', n: 'Bocha de helado', paso: 1, max: 2, ico: '🍨', ml: 60, color: '#fff4c2' },
];

// req: ingrediente -> [min, max]; los no listados deben ser 0
export const BEBIDAS = [
  { id: 'espresso', n: 'Espresso', nivel: 1, req: { shot: [1, 1] }, desc: 'Un shot solo, ~30 ml. La base de todo.', ja: '[エスプレッソ|espresso][を|(objeto)][ください|por favor]' },
  { id: 'doble', n: 'Doble (doppio)', nivel: 1, req: { shot: [2, 2] }, desc: 'Dos shots, ~60 ml.' },
  { id: 'americano', n: 'Americano', nivel: 1, req: { shot: [1, 2], agua: [90, 180] }, desc: 'Espresso estirado con agua caliente. Suave pero con cuerpo.', ja: '[アメリカーノ|americano][を|(objeto)][ください|por favor]' },
  { id: 'cortado', n: 'Cortado', nivel: 1, req: { shot: [1, 1], leche: [30, 60], espuma: [0, 0.5] }, desc: 'Espresso "cortado" con un poco de leche. Clásico argentino.' },
  { id: 'lagrima', n: 'Lágrima', nivel: 2, req: { chorrito: [1, 1], leche: [150, 240], espuma: [0, 1] }, desc: 'Leche con apenas una "lágrima" de café.' },
  { id: 'macchiato', n: 'Macchiato', nivel: 2, req: { shot: [1, 1], espuma: [1, 2] }, desc: 'Espresso "manchado" con una cucharada de espuma.' },
  { id: 'capuchino', n: 'Capuchino', nivel: 2, req: { shot: [1, 2], leche: [60, 120], espuma: [2, 3] }, opc: ['cacao'], desc: 'Tercios: espresso, leche y mucha espuma.', ja: '[カプチーノ|capuchino][を|(objeto)][ください|por favor]' },
  { id: 'conleche', n: 'Café con leche', nivel: 2, req: { shot: [1, 1], leche: [60, 150], espuma: [0, 1] }, desc: 'Mitad y mitad, el de la mañana.' },
  { id: 'flatwhite', n: 'Flat white', nivel: 3, req: { shot: [2, 2], leche: [90, 150], espuma: [0, 0.5] }, desc: 'Doble shot con leche y microespuma finita. Más café que un latte.' },
  { id: 'latte', n: 'Latte', nivel: 3, req: { shot: [1, 2], leche: [180, 270], espuma: [0.5, 1] }, desc: 'Mucha leche, 1 cm de espuma. Ideal para latte art.', ja: '[ラテ|latte][を|(objeto)][ください|por favor]' },
  { id: 'mocha', n: 'Mocha', nivel: 3, req: { shot: [1, 2], choco: [1, 2], leche: [120, 210], espuma: [0, 1.5] }, desc: 'Latte con chocolate.' },
  { id: 'bombon', n: 'Café bombón', nivel: 3, req: { shot: [1, 1], condensada: [1, 2] }, desc: 'Espresso sobre leche condensada (de Valencia).' },
  { id: 'icedlatte', n: 'Iced latte', nivel: 4, req: { hielo: [1, 1], shot: [1, 2], fria: [120, 210] }, desc: 'Hielo, leche fría y espresso arriba.', ja: '[アイスラテ|latte helado][を|(objeto)][ください|por favor]' },
  { id: 'affogato', n: 'Affogato', nivel: 4, req: { helado: [1, 1], shot: [1, 1] }, desc: 'Bocha de helado "ahogada" en espresso.' },
];

export const CLIENTES = ['Doña Rosa', 'Facu', 'Mica', 'el profe Tanaka', 'Yuki', 'Kenta (con su mamá)', 'una turista', 'el cartero', 'Hana', 'un oficinista apurado'];

// ---------- Quiz ----------
export const QUIZ = [
  { p: '¿Qué ratio café:agua es típico para filtro (V60)?', o: ['1:16', '1:2', '1:5', '1:40'], ok: 0, e: 'Entre 1:15 y 1:17 es el rango clásico para filtro.' },
  { p: '¿Qué ratio es típico para un espresso "normale"?', o: ['1:2 (18 g → 36 g)', '1:16', '1:8', '1:1'], ok: 0, e: 'Un espresso clásico ronda 1:2 en ~25-30 s.' },
  { p: 'Tu café sale ácido-agrio y se corta enseguida. ¿Qué hacés?', o: ['Moler más fino', 'Moler más grueso', 'Agua más fría', 'Menos tiempo'], ok: 0, e: 'Agrio = subextraído: molienda más fina, más tiempo o más temperatura.' },
  { p: 'Tu café sale amargo y astringente. ¿Qué cambiás primero?', o: ['Moler más grueso', 'Moler más fino', 'Más tiempo', 'Agua hirviendo'], ok: 0, e: 'Amargo/astringente = sobreextraído: molienda más gruesa o menos tiempo.' },
  { p: '¿A qué temperatura de agua se suele preparar filtro?', o: ['90–96 °C', '60–70 °C', '100 °C hirviendo siempre', '40 °C'], ok: 0, e: 'Entre 90 y 96 °C. Tuestes oscuros toleran (y prefieren) algo menos.' },
  { p: '¿Para qué sirve el "bloom" (preinfusión)?', o: ['Liberar CO₂ para que el agua moje parejo', 'Enfriar el café', 'Hacer espuma', 'Filtrar los aceites'], ok: 0, e: 'El café recién tostado libera CO₂; el bloom evita que el gas repela el agua.' },
  { p: '¿Qué molienda va con la prensa francesa?', o: ['Gruesa', 'Extra fina', 'Fina como harina', 'Da igual'], ok: 0, e: 'Gruesa: el contacto es largo (4 min) y el filtro metálico deja pasar polvo fino.' },
  { p: '¿Qué diferencia un flat white de un latte?', o: ['Menos leche, microespuma fina, doble shot', 'Lleva chocolate', 'Es frío', 'No lleva café'], ok: 0, e: 'Flat white: más café en proporción y una capa de espuma muy fina.' },
  { p: '¿A qué temperatura se vaporiza la leche para que sea dulce?', o: ['55–65 °C', '90–100 °C', '30 °C', '75–85 °C'], ok: 0, e: 'Arriba de ~70 °C la leche pierde dulzor y la proteína se "cocina".' },
  { p: '¿Qué proceso suele dar sabores frutados y vinosos?', o: ['Natural (secado en cereza)', 'Lavado', 'Descafeinado', 'Instantáneo'], ok: 0, e: 'En el natural el grano se seca dentro de la fruta: más dulzor y fruta.' },
  { p: '¿Qué proceso suele dar tazas más limpias y ácidas?', o: ['Lavado', 'Natural', 'Honey', 'Torrado'], ok: 0, e: 'El lavado quita la pulpa antes de secar: taza limpia, acidez brillante.' },
  { p: '"Torrado" (típico en Argentina) significa…', o: ['Tostado con azúcar', 'Tostado claro', 'Café de especialidad', 'Molido fino'], ok: 0, e: 'Torrado = tostado con azúcar caramelizada. Tapa los defectos y amarga.' },
  { p: '¿Arabica o robusta: cuál tiene más cafeína?', o: ['Robusta', 'Arabica', 'Igual', 'Ninguna'], ok: 0, e: 'Robusta tiene casi el doble de cafeína y es más amarga.' },
  { p: '¿Cuánto dura más o menos un café en grano tostado en su mejor momento?', o: ['2–6 semanas después del tueste', '1 día', '2 años', 'Para siempre'], ok: 0, e: 'Los primeros días desgasifica; entre la semana 1 y 6 suele estar ideal.' },
  { p: '¿Dónde conviene guardar el café en grano?', o: ['Frasco hermético, oscuro y fresco', 'Heladera abierta', 'Al sol', 'En el molinillo'], ok: 0, e: 'Enemigos: oxígeno, luz, humedad y calor.' },
  { p: '¿Por qué conviene moler justo antes de preparar?', o: ['El café molido pierde aroma en minutos', 'Es más barato', 'Pesa menos', 'No importa'], ok: 0, e: 'Moler multiplica la superficie: los aromáticos se van muy rápido.' },
  { p: '¿Qué mide el TDS?', o: ['La concentración (qué tan fuerte es)', 'La temperatura', 'La acidez (pH)', 'La cafeína'], ok: 0, e: 'Total Dissolved Solids: % de café disuelto en la bebida.' },
  { p: '¿Qué es el porcentaje de extracción (EY)?', o: ['Qué parte del café molido terminó en la taza', 'La cantidad de agua', 'El tiempo', 'La temperatura'], ok: 0, e: 'Lo ideal ronda 18–22 %: menos es agrio, más es amargo.' },
  { p: 'En la moka, ¿qué agua conviene poner en la base?', o: ['Caliente, hasta la válvula', 'Fría, hasta arriba de todo', 'Leche', 'Nada'], ok: 0, e: 'Agua caliente acorta el tiempo al fuego y evita que el café se "cocine".' },
  { p: 'En la moka, ¿con qué fuego?', o: ['Medio-bajo y retirar al empezar a burbujear', 'Máximo', 'Lo más bajo posible 20 min', 'Microondas'], ok: 0, e: 'Fuego alto quema el final y sale amargo; cortá cuando escuches el borboteo.' },
  { p: '¿Qué hace un tueste oscuro respecto a uno claro?', o: ['Más amargor y cuerpo, menos acidez', 'Más acidez', 'Más cafeína seguro', 'Nada'], ok: 0, e: 'Tueste oscuro: notas a chocolate/tostado, menos acidez y origen.' },
  { p: 'Un cortado lleva…', o: ['Espresso + un poco de leche', 'Leche + gotitas de café', 'Espresso + agua', 'Espresso + helado'], ok: 0, e: 'La lágrima es al revés: casi todo leche.' },
  { p: '¿Qué agua es mejor para el café?', o: ['Filtrada, ni muy dura ni destilada', 'Destilada pura', 'Agua con mucha cal', 'Agua con gas'], ok: 0, e: 'Los minerales (Mg, Ca) ayudan a extraer; demasiados tapan sabor y la máquina.' },
  { p: '¿Qué es la "canalización" en espresso?', o: ['El agua encuentra un camino fácil y extrae desparejo', 'Un tipo de taza', 'La crema', 'Un molinillo'], ok: 0, e: 'Se corrige con buena distribución, tamper parejo y molienda adecuada.' },
];

// ---------- Guías para preparar de verdad (con temporizador) ----------
// paso: [segundo de inicio, texto, gramos objetivo en la balanza (opcional)]
export const GUIAS = {
  v60: { n: 'V60 · 15 g / 250 g', receta: { dosis: 15, agua: 250, molienda: 5, temp: 93 },
    antes: ['Calentá agua a 92–94 °C', 'Molé 15 g de café a molienda media (como sal gruesa fina)', 'Enjuagá el filtro de papel con agua caliente y tirá esa agua', 'Poné el café, hacé un pocito en el centro, tará la balanza'],
    pasos: [[0, 'Bloom: verté 45 g de agua mojando todo el café', 45], [10, 'Revolvé suave o hacé un swirl', 45], [45, 'Verté en espiral hasta 150 g', 150], [75, 'Verté hasta 250 g, despacio por el centro', 250], [105, 'Swirl suave para aplanar la cama', 250], [110, 'Dejá que drene…', null], [180, '¡Listo! Debería terminar entre 2:45 y 3:30', null]] },
  prensa: { n: 'Prensa · 30 g / 500 g', receta: { dosis: 30, agua: 500, molienda: 8, temp: 94 },
    antes: ['Calentá agua a 94 °C', 'Molé 30 g grueso (como sal gruesa)', 'Poné el café en la prensa y tará la balanza'],
    pasos: [[0, 'Verté los 500 g de agua de una', 500], [10, 'Revolvé apenas para mojar todo', null], [240, 'Rompé la costra con una cuchara y sacá la espuma de arriba', null], [270, 'Poné la tapa sin bajar el émbolo del todo y serví despacio', null], [300, '¡Listo! Serví todo para que no siga extrayendo', null]] },
  aeropress: { n: 'Aeropress · 15 g / 220 g', receta: { dosis: 15, agua: 220, molienda: 4, temp: 85 },
    antes: ['Agua a ~85 °C', 'Molé 15 g medio-fino', 'Aeropress invertida o normal con filtro enjuagado'],
    pasos: [[0, 'Verté 220 g de agua', 220], [10, 'Revolvé 3 veces', null], [60, 'Poné el filtro y prepará para presionar', null], [80, 'Presioná suave y parejo ~30 s', null], [110, 'Pará cuando sisea. ¡Listo!', null]] },
  moka: { n: 'Moka · 3 tazas', receta: { dosis: 15, agua: 150, molienda: 3, fuego: 'medio' },
    antes: ['Llená la base con agua CALIENTE hasta la válvula', 'Llená el filtro con café fino sin apretar, enrasá con el dedo', 'Enroscá con un trapo (está caliente)', 'Fuego medio, tapa abierta'],
    pasos: [[0, 'Esperá a que empiece a salir el café', null], [60, 'Cuando salga color miel, bajá el fuego al mínimo', null], [100, 'Cuando empiece a borbotear: ¡sacala del fuego!', null], [105, 'Enfriá la base con un trapo húmedo para cortar la extracción', null], [110, 'Revolvé el café en la jarra y serví', null]] },
  espresso: { n: 'Espresso · 18 g → 36 g', receta: { dosis: 18, salida: 36, molienda: 1.8, temp: 93 },
    antes: ['Purgá el grupo', 'Molé 18 g fino, distribuí y tampeá parejo', 'Taza sobre la balanza, tará'],
    pasos: [[0, 'Arrancá el shot', null], [6, 'Primeras gotas entre 5 y 8 s', null], [25, 'Cortá cerca de 36 g en la balanza (25–30 s)', 36], [30, 'Si tardó mucho más: molé más grueso. Si salió rápido: más fino.', null]] },
  coldbrew: { n: 'Cold brew · 100 g / 800 g', receta: { dosis: 100, agua: 800, molienda: 9, horas: 14 },
    antes: ['Molé 100 g muy grueso', 'Mezclá con 800 g de agua fría en un frasco', 'Revolvé para mojar todo'],
    pasos: [[0, 'Tapá y a la heladera 12–16 horas', null], [3, 'Después filtrá con papel o tela', null], [6, 'Es un concentrado: serví 1 parte con 1 de agua o leche y hielo', null]] },
};
