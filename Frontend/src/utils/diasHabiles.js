/** Calendario global de dias habiles de venta (ver
 * Backend.apps.mirror.models.DiaHabil, editado por ADMIN en /admin/dias-habiles):
 * un dia sin excepcion guardada se asume habil. Estas funciones combinan ese
 * calendario con el rango de un concurso para proyectar, a partir del ritmo
 * de venta hasta hoy, cuanto se venderia si el periodo completo mantuviera
 * ese mismo ritmo por dia habil. */

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** [{fecha, es_habil}] (respuesta de GET /api/mirror/dias-habiles/) -> Map
 * fecha (YYYY-MM-DD) -> boolean. */
export function buildDiasHabilesMap(list) {
  const map = new Map();
  for (const item of list || []) map.set(item.fecha, item.es_habil);
  return map;
}

export function esDiaHabil(fechaIso, mapa) {
  if (mapa && mapa.has(fechaIso)) return mapa.get(fechaIso);
  return true;
}

/** Cuenta dias habiles entre desdeIso y hastaIso, ambos incluidos. */
export function contarDiasHabiles(desdeIso, hastaIso, mapa) {
  if (!desdeIso || !hastaIso) return 0;
  const desde = new Date(`${desdeIso}T00:00:00`);
  const hasta = new Date(`${hastaIso}T00:00:00`);
  if (hasta < desde) return 0;
  let count = 0;
  const cursor = new Date(desde);
  while (cursor <= hasta) {
    if (esDiaHabil(toIsoDate(cursor), mapa)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Proyeccion de cierre de un concurso a partir de su ritmo de venta hasta
 * hoy: (valor actual / dias habiles transcurridos) x dias habiles totales
 * del periodo. Devuelve null en valorProyectado/cumplimientoProyectado si
 * falta fecha_inicio/fecha_fin, si el concurso todavia no arranca, o si no
 * hubo ningun dia habil transcurrido (division por cero). Con `hoy` despues
 * de fecha_fin, la proyeccion se recorta al periodo completo: ya no hay nada
 * que extrapolar, el proyectado es el valor final. */
export function computeProyeccion({ fechaInicio, fechaFin, valor, presupuesto, mapa, hoy = new Date() }) {
  if (!fechaInicio || !fechaFin) {
    return { diasTranscurridos: null, diasTotales: null, valorProyectado: null, cumplimientoProyectado: null };
  }

  const diasTotales = contarDiasHabiles(fechaInicio, fechaFin, mapa);
  const hoyIso = toIsoDate(hoy);
  const hastaEfectivo = hoyIso < fechaInicio ? null : hoyIso > fechaFin ? fechaFin : hoyIso;
  const diasTranscurridos = hastaEfectivo ? contarDiasHabiles(fechaInicio, hastaEfectivo, mapa) : 0;

  if (diasTranscurridos <= 0 || diasTotales <= 0) {
    return { diasTranscurridos, diasTotales, valorProyectado: null, cumplimientoProyectado: null };
  }

  const valorProyectado = (valor / diasTranscurridos) * diasTotales;
  const presupuestoNum = presupuesto === '' || presupuesto == null ? null : Number(presupuesto);
  const cumplimientoProyectado = presupuestoNum ? (valorProyectado / presupuestoNum) * 100 : null;

  return { diasTranscurridos, diasTotales, valorProyectado, cumplimientoProyectado };
}
