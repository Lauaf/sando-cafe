// Puente entre la Academia y la partida: guarda resultados en P.cafe.academia y da XP con el sistema existente.
import { hoy } from '../util.js';
import { P, ganarXP, evento } from '../progreso.js';
import { normalizar, registrar } from './modelo-academia.js';

export function academia() {
  P.cafe.academia = normalizar(P.cafe.academia);
  return P.cafe.academia;
}

/** r: {comp, leccion?, puntaje, estrellas?, aprobada?, errores?, evaluado?}; motivo = texto del toast de XP. */
export function registrarAcademia(r, motivo = '') {
  const res = registrar(academia(), { ...r, fecha: hoy() });
  ganarXP('cafe', res.xp, motivo);
  evento('academia');
  return res;
}
