// Diagnóstico de espresso: escenarios con defectos generados por el MISMO modelo del simulador.
// Así, los síntomas (tiempo, peso, sabor) y el efecto de cada corrección son coherentes con lo que
// el jugador ve en "El espresso perfecto". Cada corrección se evalúa simulando el shot corregido.
import { RECETA_BASE, OBJETIVOS_LECCION, simularHasta, evaluar, sabor, rng } from './modelo-espresso.js';

export const CAUSAS = {
  sub: { n: 'Subextracción', desc: 'Se disolvió poco: el agua pasó rápido o con poca energía.' },
  sobre: { n: 'Sobreextracción', desc: 'Se disolvió de más: el agua tardó mucho o estaba muy caliente.' },
  canal: { n: 'Extracción despareja (canalización)', desc: 'Parte del puck se lavó y parte casi no se tocó.' },
  diluido: { n: 'Ratio demasiado largo', desc: 'Demasiada agua en la taza para esa dosis: queda diluido.' },
  concentrado: { n: 'Ratio demasiado corto', desc: 'Muy poca agua en la taza: concentrado y, en general, poco extraído.' },
};

export const CORRECCIONES = {
  fino: { n: 'Moler 2 puntos más fino', por: 'Más fino = más superficie y más resistencia: el agua tarda más y disuelve más.', aplicar: e => ({ ...e, p: { ...e.p, molienda: e.p.molienda - 2 } }) },
  grueso: { n: 'Moler 2 puntos más grueso', por: 'Más grueso = menos resistencia: el agua pasa antes y disuelve menos.', aplicar: e => ({ ...e, p: { ...e.p, molienda: e.p.molienda + 2 } }) },
  calor: { n: 'Subir la temperatura 2 °C', por: 'Agua más caliente disuelve más rápido: sube la extracción sin cambiar mucho el tiempo.', aplicar: e => ({ ...e, p: { ...e.p, temp: Math.min(97, e.p.temp + 2) } }) },
  frio: { n: 'Bajar la temperatura 2 °C', por: 'Agua menos caliente disuelve más lento: baja la extracción y el amargor.', aplicar: e => ({ ...e, p: { ...e.p, temp: e.p.temp - 2 } }) },
  corto: { n: 'Cortar antes (−25 % de salida)', por: 'Menos agua: más concentrado y un poco menos extraído.', aplicar: e => ({ ...e, salida: e.salida * 0.75 }) },
  largo: { n: 'Dejar correr más (+25 % de salida)', por: 'Más agua: menos concentrado y más extraído.', aplicar: e => ({ ...e, salida: e.salida * 1.25 }) },
  puck: { n: 'Distribuir con WDT y tampear nivelado', por: 'Un puck parejo no tiene caminos fáciles: toda la cama se extrae igual.', aplicar: e => ({ ...e, p: { ...e.p, distribucion: 0.95, nivelado: 0.97 } }) },
  menosDosis: { n: 'Bajar la dosis 1,5 g (mismo ratio)', por: 'Menos café = puck más corto y menos resistente: más rápido.', aplicar: e => ({ ...e, p: { ...e.p, dosis: e.p.dosis - 1.5 }, salida: e.salida * (e.p.dosis - 1.5) / e.p.dosis }) },
  masDosis: { n: 'Subir la dosis 1,5 g (mismo ratio)', por: 'Más café = puck más alto y resistente: más lento.', aplicar: e => ({ ...e, p: { ...e.p, dosis: e.p.dosis + 1.5 }, salida: e.salida * (e.p.dosis + 1.5) / e.p.dosis }) },
  preinfusion: { n: 'Usar preinfusión', por: 'Mojar a baja presión asienta el puck antes de los 9 bar: menos canales.', aplicar: e => ({ ...e, p: { ...e.p, perfil: 'preinfusion' } }) },
};

/**
 * Plantillas de escenario. `causas`: respuestas correctas; `parcial`: razonables pero no las principales.
 * `queja`: lo que dice el cliente (o el jefe de barra).
 */
export const PLANTILLAS = [
  { id: 'acido', nivel: 1, queja: 'Está ácido, casi agrio, y se termina enseguida en la boca.', causas: ['sub'], parcial: [],
    gen: r => ({ p: { molienda: 16 + r() * 2.5 }, salida: 36 }) },
  { id: 'amargo', nivel: 1, queja: 'Es amarguísimo y me deja la boca seca.', causas: ['sobre'], parcial: [],
    gen: r => ({ p: { molienda: 6.5 + r() * 1.5 }, salida: 36 }) },
  { id: 'rapido', nivel: 1, queja: 'El shot salió volando: en 15 segundos ya estaba hecho.', causas: ['sub'], parcial: [],
    gen: r => ({ p: { molienda: 18 + r() * 3 }, salida: 36 }) },
  { id: 'diluido', nivel: 1, queja: 'Parece aguado, sin cuerpo, y con un amargor raro al final.', causas: ['diluido'], parcial: ['sobre'],
    gen: r => ({ p: {}, salida: 56 + r() * 10 }) },
  { id: 'concentrado', nivel: 2, queja: 'Es un golpe: espeso, salado y agrio. Casi no hay líquido en la taza.', causas: ['concentrado'], parcial: ['sub'],
    gen: r => ({ p: { molienda: 12.5 }, salida: 20 + r() * 3 }) },
  { id: 'irregular', nivel: 2, queja: 'El chorro salpicó para los costados y el sabor es agrio y amargo a la vez.', causas: ['canal'], parcial: [],
    gen: r => ({ p: { distribucion: 0.15 + r() * 0.2, nivelado: 0.4 + r() * 0.2 }, salida: 36 }) },
  { id: 'oscuro', nivel: 2, queja: 'Con este tueste oscuro sale amargo y a quemado, aunque el tiempo parece normal.', causas: ['sobre'], parcial: [],
    gen: r => ({ p: { tueste: 'oscuro', temp: 96, molienda: 11.5 + r() }, salida: 36 }) },
  { id: 'claro', nivel: 3, queja: 'Tarda 27 s como siempre, pero este tueste claro sabe a limón verde.', causas: ['sub'], parcial: [],
    gen: r => ({ p: { tueste: 'claro', molienda: 12.5 + r(), temp: 91 }, salida: 36 }) },
  { id: 'dosis', nivel: 3, queja: 'Desde que cambiamos a una canasta llena (21 g) todo sale lento y amargo.', causas: ['sobre'], parcial: [],
    gen: r => ({ p: { dosis: 21, molienda: 9 + r() }, salida: 42 }) },
];

const objetivoDe = e => e.p.tueste === 'claro' ? OBJETIVOS_LECCION.claro : e.p.tueste === 'oscuro' ? OBJETIVOS_LECCION.oscuro : OBJETIVOS_LECCION.normale;

/** Corre el shot de un escenario y devuelve resultado + evaluación. */
export function correr(e) {
  const p = { ...RECETA_BASE, ...e.p };
  const r = simularHasta(p, e.salida);
  return { r, ev: evaluar(r, objetivoDe({ p })) };
}

/** Lo que se percibe en la taza, con palabras de barista (a partir del perfil estimado). */
export function notasDeCata(r) {
  const s = sabor(r), n = [];
  if (s.acidez >= 6) n.push('agrio, punzante');
  else if (s.acidez >= 4.5) n.push('acidez marcada');
  if (s.dulzor <= 3.5) n.push('poco dulce');
  else if (s.dulzor >= 6.5) n.push('dulce');
  if (s.amargor >= 5.5) n.push('amargo');
  if (s.astringencia >= 3.5) n.push('seca la boca');
  if (s.intensidad <= 2.5) n.push('aguado');
  else if (s.intensidad >= 7) n.push('espeso, intenso');
  if (r.canal > 0.2) n.push('sabores mezclados, poco limpio');
  return n.length ? n : ['equilibrado'];
}

/** Pistas visuales del shot, como las vería alguien parado al lado de la máquina. */
export function pistasVisuales(r) {
  const v = [];
  if (r.primeraGota != null && r.primeraGota < 5.5) v.push('las primeras gotas cayeron casi enseguida');
  if (r.primeraGota != null && r.primeraGota > 13) v.push('tardó muchísimo en caer la primera gota');
  if (r.canal > 0.2) v.push('el chorro salpicó y el puck usado tiene agujeritos');
  if (r.tiempo < 18) v.push('el chorro fue grueso y claro (rubio) muy temprano');
  if (r.tiempo > 38) v.push('el chorro fue finito, oscuro, casi un goteo');
  return v;
}

/** Simula cada corrección y la clasifica por cuánto mejora el puntaje. */
export function evaluarCorrecciones(e, ids = Object.keys(CORRECCIONES)) {
  const base = correr(e);
  const lista = ids.map(id => {
    const corr = CORRECCIONES[id].aplicar(e);
    const { r, ev } = correr(corr);
    return { id, ...CORRECCIONES[id], r, ev, delta: ev.puntaje - base.ev.puntaje };
  });
  const mejor = Math.max(...lista.map(x => x.ev.puntaje));
  for (const x of lista) {
    x.clase = x.delta >= 10 && x.ev.puntaje >= mejor - 4 ? 'mejor'
      : x.delta >= 10 ? 'valida'
        : x.delta >= 4 ? 'poco'
          : x.delta > -4 ? 'neutra' : 'empeora';
  }
  return { base, lista };
}

/** Arma un escenario jugable: síntomas + 4 opciones de corrección (al menos una buena y una que empeora). */
export function generar(plantilla, semilla) {
  const r = rng(semilla);
  const g = plantilla.gen(r);
  const e = { ...g, p: { ...RECETA_BASE, ...g.p } };
  const ev = evaluarCorrecciones(e);
  const por = c => ev.lista.filter(x => x.clase === c);
  const elegir = arr => arr.length ? arr[Math.floor(r() * arr.length)] : null;
  const opciones = [];
  const meter = x => { if (x && !opciones.includes(x)) opciones.push(x); };
  meter(elegir(por('mejor')));
  meter(elegir(por('valida')) || elegir(por('poco')));
  meter(elegir(por('empeora')));
  for (const x of [...por('empeora'), ...por('neutra'), ...por('poco'), ...por('valida')].sort(() => r() - 0.5)) if (opciones.length < 4) meter(x);
  const orden = opciones.map(x => ({ x, k: r() })).sort((a, b) => a.k - b.k).map(o => o.x);
  return { plantilla, escenario: e, base: ev.base, opciones: orden, todas: ev.lista };
}

/** Puntaje de una respuesta: diagnóstico (50) + corrección (50). */
export function puntuar(gen, causa, correccion) {
  const P = gen.plantilla;
  const diag = P.causas.includes(causa) ? 50 : P.parcial.includes(causa) ? 25 : 0;
  const c = gen.todas.find(x => x.id === correccion);
  const corr = { mejor: 50, valida: 35, poco: 20, neutra: 5, empeora: 0 }[c?.clase] ?? 0;
  return { diag, corr, total: diag + corr, clase: c?.clase };
}

export const RONDAS = [
  { id: 'diag-1', t: 'Ronda básica', niveles: [1], n: 4, aprueba: 70, aprender: 'Agrio = poca extracción, amargo = demasiada. El tiempo y el peso te dicen por qué.' },
  { id: 'diag-2', t: 'Ronda intermedia', niveles: [1, 2], n: 5, aprueba: 70, aprender: 'Sumamos ratio y canalización: no todo defecto se arregla con la molienda.' },
  { id: 'diag-3', t: 'Ronda avanzada', niveles: [2, 3], n: 5, aprueba: 70, aprender: 'Tuestes y dosis: el mismo tiempo puede esconder problemas distintos.' },
];

/** Escenarios de una ronda, sin repetir plantillas. */
export function armarRonda(ronda, semilla) {
  const r = rng(semilla);
  const pool = PLANTILLAS.filter(p => ronda.niveles.includes(p.nivel)).map(p => ({ p, k: r() })).sort((a, b) => a.k - b.k).map(x => x.p);
  return pool.slice(0, ronda.n).map((p, i) => generar(p, semilla + i * 7919));
}
