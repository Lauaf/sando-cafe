// Vaporizado de leche: airear (punta en la superficie) y texturizar (punta hundida, remolino).
// Modelo educativo simple:
// - La temperatura sube más rápido cuanto menos leche hay en la jarra.
// - El aire que entra con la punta en la superficie aumenta el volumen (espuma). Mientras la leche
//   está fría (< ~40 °C) las proteínas arman burbujas chicas y estables; airear tarde da burbujas grandes.
// - Con la punta hundida el remolino rompe burbujas grandes y las integra (microespuma), sin sumar aire.
// - Con la punta muy afuera la leche "grita": entra mucho aire en burbujas grandes.
// - Arriba de ~70 °C la leche pierde dulzor; arriba de ~76 °C se quema.

export const POSICIONES = {
  hundida: { n: 'Hundida (texturizar)', desc: 'Sin aire nuevo: el remolino integra y afina las burbujas.' },
  superficie: { n: 'En la superficie (airear)', desc: 'Suave "chsss": entra aire y crece el volumen.' },
  alta: { n: 'Muy afuera', desc: 'Chillido y salpicadura: burbujas grandes.' },
};

export function crearJarra(leche = 200) {
  // burbuja: burbujas medianas (el remolino las integra); gruesa: burbujas grandes (casi no se arreglan)
  return { leche, temp: 5, espuma: 0, burbuja: 0.15, gruesa: 0, t: 0, tVapor: 0, maxTemp: 5 };
}

export function pasoJarra(j, dt, vapor, posicion = 'hundida') {
  j.t += dt;
  if (vapor && j.leche > 0) {
    j.tVapor += dt;
    j.temp += dt * 2.1 * (200 / Math.max(60, j.leche));
    const fria = j.temp < 40;
    if (posicion === 'superficie') {
      j.espuma += dt * 7.5 * (j.leche / 200) * (fria ? 1 : 0.45);
      j.burbuja += dt * 0.012;
      if (!fria) j.gruesa += dt * 0.07;
    } else if (posicion === 'alta') {
      j.espuma += dt * 11 * (j.leche / 200);
      j.gruesa += dt * 0.2;
    } else {
      j.burbuja -= dt * 0.085;
      j.gruesa -= dt * 0.012;
    }
  } else {
    j.temp -= dt * 0.04 * (j.temp - 22) / 40;   // se enfría despacio
    j.burbuja += dt * 0.006;                       // la espuma se separa si espera
  }
  j.burbuja = Math.max(0.03, Math.min(1, j.burbuja));
  j.gruesa = Math.max(0, Math.min(1, j.gruesa));
  j.maxTemp = Math.max(j.maxTemp, j.temp);
  return j;
}

export function resultadoLeche(j) {
  const expansion = j.leche > 0 ? j.espuma / j.leche : 0;
  const textura = Math.max(0, 1 - j.burbuja - j.gruesa);
  const tipo = expansion < 0.04 ? 'sin espuma' : textura >= 0.7 ? 'microespuma' : textura >= 0.45 ? 'espuma media' : 'espuma gruesa';
  return { temp: j.temp, maxTemp: j.maxTemp, espuma: j.espuma, expansion, textura, tipo, quemada: j.maxTemp > 76 };
}

// Objetivos de espuma por bebida (expansión de volumen). Son orientativos: varían por casa.
export const ESPUMA_OBJETIVO = {
  flatwhite: [0.05, 0.15], latte: [0.1, 0.2], capuchino: [0.3, 0.5], cortado: [0, 0.12], piccolo: [0.05, 0.15],
  macchiato: [0.25, 0.6], lattemacchiato: [0.25, 0.45], conleche: [0, 0.12], lagrima: [0.05, 0.25],
};

/** Puntaje 0..100 del vaporizado para una bebida + comentarios. tempObj por defecto 55–65 °C. */
export function evaluarLeche(res, bebida, tempObj = [55, 65]) {
  const [eMin, eMax] = ESPUMA_OBJETIVO[bebida] || [0.1, 0.3];
  const notas = [];
  let pen = 0;
  if (res.quemada) { pen += 65; notas.push('🔥 Se quemó (>76 °C): sabor a cocido, sin dulzor.'); }
  else if (res.maxTemp > tempObj[1] + 4) { pen += (res.maxTemp - tempObj[1]) * 3; notas.push(`🌡️ Muy caliente (${Math.round(res.maxTemp)} °C): la lactosa se percibe menos dulce arriba de ~65–70 °C.`); }
  if (res.temp < tempObj[0] - 3) { pen += (tempObj[0] - res.temp) * 2.5; notas.push(`🌡️ Quedó tibia (${Math.round(res.temp)} °C).`); }
  if (res.expansion < eMin - 0.02) { pen += (eMin - res.expansion) * 140; notas.push(`☁️ Poca espuma (+${Math.round(res.expansion * 100)} % de volumen; buscá ${Math.round(eMin * 100)}–${Math.round(eMax * 100)} %): aireá más tiempo al principio.`); }
  if (res.expansion > eMax + 0.02) { pen += (res.expansion - eMax) * 140; notas.push(`☁️ Demasiada espuma (+${Math.round(res.expansion * 100)} %; buscá ${Math.round(eMin * 100)}–${Math.round(eMax * 100)} %): aireá menos.`); }
  if (res.expansion > 0.04 && res.textura < 0.65) { pen += (0.65 - res.textura) * 70; notas.push('🫧 Burbujas grandes: aireaste tarde (leche ya caliente) o con la punta muy afuera. Hundí la punta para texturizar.'); }
  if (!notas.length) notas.push('✨ Leche sedosa, brillante y a buena temperatura.');
  return { puntaje: Math.round(Math.max(0, Math.min(100, 100 - pen))), notas };
}
