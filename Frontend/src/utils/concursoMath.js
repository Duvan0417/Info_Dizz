/** Calculos compartidos de un concurso (Dashboard, PivotResultTable): a
 * partir del presupuesto (string editable, puede venir vacio) y el valor
 * vendido, el % de cumplimiento y cuanto falta para llegar al presupuesto.
 * Sin presupuesto valido devuelve ambos en null. */
export function computeCompletion(presupuestoRaw, valor) {
  if (presupuestoRaw === '' || presupuestoRaw == null) return { cumplimiento: null, faltante: null };
  const presupuesto = Number(presupuestoRaw);
  if (!presupuesto) return { cumplimiento: null, faltante: null };
  return { cumplimiento: (valor / presupuesto) * 100, faltante: presupuesto - valor };
}

/** Dado un % de cumplimiento y la lista de tramos {porcentaje, valor}, elige
 * el tramo de mayor porcentaje que el cumplimiento alcance (no acumulable).
 * Sin cumplimiento o sin tramos que alcance, devuelve 0; sin tramos
 * configurados devuelve null (para no mostrar la columna/serie como "$0"). */
export function computePremio(cumplimiento, tiers) {
  if (!tiers || tiers.length === 0) return null;
  if (cumplimiento == null) return 0;
  const tier = [...tiers].sort((a, b) => Number(b.porcentaje) - Number(a.porcentaje)).find((t) => cumplimiento >= Number(t.porcentaje));
  return tier ? Number(tier.valor) : 0;
}

// Campos numericos que representan dinero (ver Backend/apps/mirror/pivot.py
// NUMERIC_FIELDS): el resto (cantidad, total_cant_final) son unidades, no
// pesos. Con measure count/distinct_count nunca es dinero (es un conteo).
const MONEY_FIELDS = new Set(['line_total_final', 'venta_bruta', 'total_iva_final', 'iva']);

/** A partir de la config guardada de un concurso (measure/measureField) y su
 * `result.measure_label`, decide si el "valor" de esa tabla es dinero (para
 * formatear con $) y que etiqueta usar (ej. "Venta neta", "Impactos",
 * "Cantidad") — evita mostrar "$" sobre un conteo de impactos o tratar
 * "Impactos" como si fuera "Venta": son medidas distintas. */
export function describeMeasure(view, numericFieldLabel = {}) {
  const config = view.config || {};
  const fallbackLabel = view.result?.measure_label || 'Valor';
  if (config.measure === 'sum') {
    const field = config.measureField;
    return { isMonetary: MONEY_FIELDS.has(field), label: numericFieldLabel[field] || fallbackLabel };
  }
  return { isMonetary: false, label: fallbackLabel };
}

export function formatMetricValue(value, isMonetary) {
  if (value == null) return '—';
  const formatted = Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  return isMonetary ? `$${formatted}` : formatted;
}

/** Resumen de un concurso (pivot result) para las tarjetas del Dashboard:
 * venta y presupuesto totales, % de cumplimiento global y premio total
 * repartido entre los vendedores visibles. `null` en `cumplimiento` cuando
 * el pivot no tiene `vendedor_nombre` en las filas o nadie tiene presupuesto
 * cargado todavia. */
export function summarizeConcurso(result, presupuestos, premioTiers) {
  const vendedorIndex = result.rows_fields.indexOf('vendedor_nombre');
  if (vendedorIndex < 0) {
    return { vendedorIndex, totalVenta: result.grand_total || 0, totalPresupuesto: null, cumplimiento: null, totalPremio: null };
  }

  let totalVenta = 0;
  let totalPresupuesto = 0;
  let totalPremio = 0;
  let anyPresupuesto = false;

  for (const entry of result.data) {
    const valor = entry.total || 0;
    totalVenta += valor;
    const raw = presupuestos[entry.row[vendedorIndex]];
    const { cumplimiento } = computeCompletion(raw, valor);
    if (raw !== '' && raw != null) {
      anyPresupuesto = true;
      totalPresupuesto += Number(raw) || 0;
    }
    const premio = computePremio(cumplimiento, premioTiers);
    if (premio != null) totalPremio += premio;
  }

  const cumplimiento = anyPresupuesto ? (totalVenta / totalPresupuesto) * 100 : null;
  return {
    vendedorIndex,
    totalVenta,
    totalPresupuesto: anyPresupuesto ? totalPresupuesto : null,
    cumplimiento,
    totalPremio: premioTiers.length > 0 ? totalPremio : null,
  };
}
