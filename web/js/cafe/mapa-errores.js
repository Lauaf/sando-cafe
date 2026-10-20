// Errores que se repiten → qué módulo o lección practicar (lo usan las recomendaciones de la Academia).

/** errorId -> a dónde mandar a practicar cuando se repite. */
export const MAPA_ERRORES = {
  canalizacion: { modulo: 'espresso', leccion: 'esp-5', texto: 'Practicá la preparación del puck (lección 5 de espresso)' },
  subextraido: { modulo: 'espresso', leccion: 'esp-2', texto: 'Repasá molienda gruesa → agrio (lección 2 de espresso)' },
  sobreextraido: { modulo: 'espresso', leccion: 'esp-3', texto: 'Repasá molienda fina → amargo (lección 3 de espresso)' },
  ratio_corto: { modulo: 'espresso', leccion: 'esp-1', texto: 'Mirá la balanza y cortá a tiempo (lección 1 de espresso)' },
  ratio_largo: { modulo: 'espresso', leccion: 'esp-1', texto: 'Mirá la balanza y cortá a tiempo (lección 1 de espresso)' },
  proporcion: { modulo: 'taza', texto: 'Repasá proporciones en "¿Qué café preparaste?"' },
  orden: { modulo: 'taza', leccion: 'taza-3', texto: 'Repasá las bebidas donde importa el orden' },
  leche_temp: { modulo: 'pedido', leccion: 'ped-2', texto: 'Practicá cortar el vapor entre 55 y 65 °C' },
  leche_textura: { modulo: 'pedido', leccion: 'ped-3', texto: 'Practicá airear temprano y texturizar con la punta hundida' },
  shot: { modulo: 'espresso', leccion: 'esp-1', texto: 'Practicá cortar el shot a tiempo' },
  rebalse: { modulo: 'taza', texto: 'Medí los volúmenes: elegí bien el recipiente' },
  taza: { modulo: 'taza', texto: 'Repasá qué recipiente va con cada bebida' },
  espresso_muerto: { modulo: 'rush', texto: 'Ordená el flujo: sacá el shot cuando la leche ya está casi lista' },
  cliente_perdido: { modulo: 'rush', leccion: 'rush-1', texto: 'Priorizá a los clientes con la barra de paciencia en rojo' },
};

export const MAPA_ERRORES_RUSH = MAPA_ERRORES;
