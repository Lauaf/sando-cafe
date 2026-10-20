// Academia de barismo de Kenji: la ruta de minijuegos, las competencias y qué practicar después.
import { el } from '../util.js';
import { COMPETENCIAS, dominio, recomendar } from './modelo-academia.js';
import { academia } from './progreso-academia.js';
import { LECCIONES as LECCIONES_ESPRESSO } from './modelo-espresso.js';
import { hubEspresso } from './espresso.js';
import { RONDAS } from './modelo-diagnostico.js';
import { MAPA_ERRORES } from './mapa-errores.js';
import { hubRush } from './rush.js';
import { hubFiltro } from './filtro.js';
import { LECCIONES as LECCIONES_FILTRO } from './modelo-filtro.js';
import { hubBlend } from './blend.js';
import { PEDIDOS as PEDIDOS_BLEND } from './modelo-blend.js';
import { LECCIONES as LECCIONES_RUSH } from './modelo-rush.js';
import { hubDiagnostico } from './diagnostico.js';
import { hubTaza, LECCIONES_TAZA } from './taza.js';
import { hubPedido, LECCIONES_PEDIDO } from './pedido.js';
import { hubLatte } from './latte.js';
import { LECCIONES as LECCIONES_LATTE } from './modelo-latte.js';

// Orden sugerido: primero entender la extracción, después la leche y el servicio, al final filtrados y cata.
export const RUTA = [
  { id: 'espresso', n: 'El espresso perfecto', ico: '☕', comp: 'extraccion', render: hubEspresso, lecciones: LECCIONES_ESPRESSO,
    desc: 'Molé, dosificá, distribuí, tampeá y extraé en tiempo real. Carrera de 9 lecciones y desafío diario.' },
  { id: 'diagnostico', n: 'Diagnóstico de espresso', ico: '🩺', comp: 'diagnostico', render: hubDiagnostico, lecciones: RONDAS,
    desc: 'Un cliente se queja: leé el tiempo, el peso y el sabor, nombrá la causa y elegí la corrección.' },
  { id: 'taza', n: '¿Qué café preparaste?', ico: '🥤', comp: 'recetas', render: hubTaza, lecciones: LECCIONES_TAZA,
    desc: 'Verté espresso, leche, espuma y agua arrastrando las jarras. Un clasificador te dice qué bebida armaste.' },
  { id: 'pedido', n: 'Prepará el pedido', ico: '🧾', comp: 'leche', render: hubPedido, lecciones: LECCIONES_PEDIDO,
    desc: 'Taza, shots, vaporizado (airear y texturizar) y vertido en el orden correcto. Exactitud, técnica, orden y presentación.' },
  { id: 'latte', n: 'Latte Art Academy', ico: '🎨', comp: 'latte', render: hubLatte, lecciones: LECCIONES_LATTE,
    desc: 'Dibujá con el vertido: posición, inclinación y altura de la jarra. Flujo, círculo, corazón, tulipán y rosetta.' },
  { id: 'rush', n: 'Rush Hour', ico: '⏱️', comp: 'servicio', render: hubRush, lecciones: LECCIONES_RUSH,
    desc: 'La hora pico: clientes con paciencia, dos grupos y un vaporizador compartidos. Priorizá, trabajá en paralelo y no te equivoques.' },
  { id: 'filtro', n: 'Laboratorio de filtrados', ico: '🫖', comp: 'filtrado', render: hubFiltro, lecciones: LECCIONES_FILTRO,
    desc: 'V60, AeroPress y prensa: ratio, molienda, temperatura, bloom, vertidos e infusión. Comparación A/B de una variable.' },
  { id: 'blend', n: 'Laboratorio de blends', ico: '🌱', comp: 'cata', render: hubBlend, lecciones: PEDIDOS_BLEND,
    desc: 'Mezclá orígenes, variedades, procesos y tuestes. Perfil sensorial estimado con el aporte de cada café.' },
];


const modulo = id => RUTA.find(m => m.id === id);
export const abrirModulo = (ctx, id) => { const m = modulo(id); if (m) ctx.ir(m.n, m.render); };

function progresoModulo(a, m) {
  if (!m.lecciones) return null;
  const hechas = m.lecciones.filter(l => a.lecciones[l.id]?.aprobada).length;
  return { hechas, total: m.lecciones.length };
}

/** Bloque que va arriba en el hub del kissaten. */
export function seccionAcademia(ctx) {
  const a = academia();
  const recs = recomendar(a, RUTA, MAPA_ERRORES, 2);
  return el('div.ac-seccion',
    el('div.fila',
      el('h3.ac-h3', '🎓 Academia de barismo'),
      el('button.btn.chico', { onclick: () => ctx.ir('Mi progreso en la Academia', progresoAcademia) }, '📊 Mi progreso')),
    recs.length ? el('div.ac-recs', recs.map(r => el('button.ac-rec', { onclick: () => abrirModulo(ctx, r.modulo) },
      el('span', '👉 ', r.texto), el('span.suave', r.motivo)))) : null,
    el('div.rejilla', RUTA.map((m, i) => {
      const pr = progresoModulo(a, m);
      const d = dominio(a, m.comp);
      return el('button.tarjeta.ac-modulo', { onclick: () => ctx.ir(m.n, m.render) },
        el('div.fila', el('span.t-ico', m.ico), el('span.suave', `${i + 1}`)),
        el('div.t-tit', m.n), el('div.t-desc', m.desc),
        el('div.hp', el('i', { style: { width: `${pr ? (pr.hechas / pr.total) * 100 : d ?? 0}%`, background: 'var(--oro)' } })),
        el('div.t-tag', pr ? `${pr.hechas}/${pr.total} lecciones${d != null ? ` · dominio ${d}` : ''}` : d != null ? `dominio ${d}/100` : 'sin empezar'));
    })));
}

/** Estadísticas por competencia + recomendaciones. */
function progresoAcademia(c, ctx) {
  const a = academia();
  c.append(
    el('div.suave', 'El dominio es el promedio de tus últimos 8 resultados en cada competencia: sube si mejorás, no por jugar más.'),
    el('div.ac-comps', Object.entries(COMPETENCIAS).map(([k, comp]) => {
      const d = dominio(a, k);
      const n = a.comp[k]?.n || 0;
      return el('div.panel',
        el('div.fila', el('span', `${comp.ico} ${comp.n}`), el('span.suave', n ? `${n} intentos` : 'sin practicar')),
        el('div.hp', el('i', { style: { width: `${d ?? 0}%`, background: d == null ? 'transparent' : d >= 80 ? 'var(--bien)' : d >= 60 ? 'var(--oro)' : 'var(--mal)' } })),
        el('div.suave', d != null ? `Dominio ${d}/100` : comp.desc));
    })),
    el('h3.ac-h3', 'Qué practicar después'),
    el('div.ac-recs', recomendar(a, RUTA, MAPA_ERRORES, 4).map(r => el('button.ac-rec', { onclick: () => abrirModulo(ctx, r.modulo) }, el('span', '👉 ', r.texto), el('span.suave', r.motivo)))),
  );
}
