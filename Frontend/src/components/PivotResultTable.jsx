import { Fragment } from 'react';
import { computeCompletion, computePremio } from '../utils/concursoMath';
import { computeProyeccion } from '../utils/diasHabiles';
import { statusColorFor } from '../utils/plotlyTheme';

const thClass = 'sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h';
const tdClass = 'border-b border-border px-3 py-2 text-left';

function formatValue(value, measure) {
  if (value == null) return '0';
  const options =
    measure === 'sum' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return Number(value).toLocaleString('es-CO', options);
}

function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 2 })}%`;
}

function formatMoney(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Renderiza la tabla resultado de un pivot (Concursos). Si `showBudget` es
 * true y `vendedor_nombre` esta entre las filas, inserta una columna
 * "Presupuesto" justo despues (editable si `budgetEditable`, requiere
 * `presupuestos` + `onPresupuestoChange`/`onPresupuestoSave`; de solo lectura
 * si `budgetEditable=false`, para vistas como el Dashboard) y agrega al final
 * "% Cumplimiento" (valor / presupuesto), "Faltante" (presupuesto - valor) y,
 * si hay `premioTiers`, "Premio" (cuanto gana el vendedor segun el tramo
 * alcanzado); si no, se omiten.
 *
 * Con `fechaInicio`/`fechaFin` y `diasHabilesMap` (calendario global de dias
 * habiles, ver utils/diasHabiles.js) tambien agrega "Proyección": a que %
 * del presupuesto llegaria cada vendedor si mantiene su ritmo de venta hasta
 * hoy durante el resto de dias habiles del periodo. Sin esos tres datos, la
 * columna simplemente no aparece. Con eso Y `premioTiers`, agrega ademas
 * "Premio proyectado": el premio que ganaria segun ESE cumplimiento
 * proyectado (no el real) — un tramo distinto de "Premio", no se suman entre
 * si. */
export default function PivotResultTable({
  result,
  measure,
  rowsFieldLabels,
  showBudget = false,
  presupuestos = {},
  onPresupuestoChange,
  onPresupuestoSave,
  premioTiers = [],
  budgetEditable = true,
  fechaInicio,
  fechaFin,
  diasHabilesMap,
}) {
  const vendedorIndex = showBudget ? result.rows_fields.indexOf('vendedor_nombre') : -1;
  const showPremio = vendedorIndex >= 0 && premioTiers.length > 0;
  const showProyeccion = vendedorIndex >= 0 && Boolean(fechaInicio) && Boolean(fechaFin) && Boolean(diasHabilesMap);
  const showPremioProyectado = showPremio && showProyeccion;

  const budgetTotalPresupuesto =
    vendedorIndex >= 0
      ? result.data.reduce((sum, entry) => {
          const raw = presupuestos[entry.row[vendedorIndex]];
          return raw === '' || raw == null ? sum : sum + (Number(raw) || 0);
        }, 0)
      : 0;
  const budgetGrandTotal = vendedorIndex >= 0 ? computeCompletion(budgetTotalPresupuesto || null, result.grand_total) : null;

  const premioGrandTotal = showPremio
    ? result.data.reduce((sum, entry) => {
        const { cumplimiento } = computeCompletion(presupuestos[entry.row[vendedorIndex]], entry.total || 0);
        return sum + (computePremio(cumplimiento, premioTiers) || 0);
      }, 0)
    : null;

  const proyeccionGrandTotal = showProyeccion
    ? computeProyeccion({
        fechaInicio,
        fechaFin,
        valor: result.grand_total || 0,
        presupuesto: budgetTotalPresupuesto || null,
        mapa: diasHabilesMap,
      })
    : null;

  const premioProyectadoGrandTotal = showPremioProyectado
    ? result.data.reduce((sum, entry) => {
        const { cumplimientoProyectado } = computeProyeccion({
          fechaInicio,
          fechaFin,
          valor: entry.total || 0,
          presupuesto: presupuestos[entry.row[vendedorIndex]],
          mapa: diasHabilesMap,
        });
        return sum + (computePremio(cumplimientoProyectado, premioTiers) || 0);
      }, 0)
    : null;

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border shadow-soft">
      <table className="w-full border-collapse text-sm whitespace-nowrap">
        <thead>
          <tr>
            {rowsFieldLabels.map((label, i) => (
              <Fragment key={label}>
                <th className={thClass}>{label}</th>
                {i === vendedorIndex && <th className={`${thClass} text-text`}>Presupuesto</th>}
              </Fragment>
            ))}
            {result.columns_field ? (
              result.column_values.map((col) => (
                <th key={col} className={thClass}>
                  {col}
                </th>
              ))
            ) : (
              <th className={thClass}>{result.measure_label || 'Valor'}</th>
            )}
            <th className={`${thClass} text-accent-500`}>Total</th>
            {vendedorIndex >= 0 && (
              <>
                <th className={`${thClass} text-text`}>% Cumplimiento</th>
                <th className={`${thClass} text-text`}>Faltante</th>
              </>
            )}
            {showProyeccion && <th className={`${thClass} text-text`}>Proyección</th>}
            {showPremio && <th className={`${thClass} text-text`}>Premio</th>}
            {showPremioProyectado && <th className={`${thClass} text-text`}>Premio proyectado</th>}
          </tr>
        </thead>
        <tbody>
          {result.data.length === 0 ? (
            <tr>
              <td colSpan={rowsFieldLabels.length + 2} className={tdClass}>
                Sin resultados.
              </td>
            </tr>
          ) : (
            result.data.map((entry, index) => (
              <tr key={index} className="hover:bg-accent-soft">
                {entry.row.map((value, i) => (
                  <Fragment key={i}>
                    <td className={tdClass}>{value}</td>
                    {i === vendedorIndex &&
                      (budgetEditable ? (
                        <td className={`${tdClass} text-text`}>
                          <input
                            type="number"
                            step="0.01"
                            value={presupuestos[value] ?? ''}
                            onChange={(event) => onPresupuestoChange?.(value, event.target.value)}
                            onBlur={() => onPresupuestoSave?.(value)}
                            placeholder="0.00"
                            className="w-28 rounded border border-border bg-surface px-2 py-1 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1"
                          />
                        </td>
                      ) : (
                        <td className={`${tdClass} text-text`}>{formatMoney(presupuestos[value] ?? null)}</td>
                      ))}
                  </Fragment>
                ))}
                {result.columns_field ? (
                  result.column_values.map((col) => (
                    <td key={col} className={tdClass}>
                      {formatValue(entry.values[col], measure)}
                    </td>
                  ))
                ) : (
                  <td className={tdClass}>{formatValue(entry.value, measure)}</td>
                )}
                <td className={`${tdClass} text-base font-semibold text-accent-500`}>
                  {formatValue(entry.total, measure)}
                </td>
                {(vendedorIndex >= 0 || showPremio) &&
                  (() => {
                    const presupuestoVendedor = presupuestos[entry.row[vendedorIndex]];
                    const { cumplimiento, faltante } = computeCompletion(presupuestoVendedor, entry.total || 0);
                    const proyeccion = showProyeccion
                      ? computeProyeccion({
                          fechaInicio,
                          fechaFin,
                          valor: entry.total || 0,
                          presupuesto: presupuestoVendedor,
                          mapa: diasHabilesMap,
                        })
                      : null;
                    return (
                      <>
                        {vendedorIndex >= 0 && (
                          <>
                            <td className={tdClass}>{formatPercent(cumplimiento)}</td>
                            <td className={tdClass}>{faltante == null ? '—' : formatValue(faltante, measure)}</td>
                          </>
                        )}
                        {showProyeccion && (
                          <td className={tdClass}>
                            {proyeccion.cumplimientoProyectado == null ? (
                              '—'
                            ) : (
                              <span style={{ color: statusColorFor(proyeccion.cumplimientoProyectado) }}>
                                {formatPercent(proyeccion.cumplimientoProyectado)}
                              </span>
                            )}
                          </td>
                        )}
                        {showPremio && <td className={tdClass}>{formatMoney(computePremio(cumplimiento, premioTiers))}</td>}
                        {showPremioProyectado && (
                          <td className={tdClass}>
                            {formatMoney(computePremio(proyeccion.cumplimientoProyectado, premioTiers))}
                          </td>
                        )}
                      </>
                    );
                  })()}
              </tr>
            ))
          )}
        </tbody>
        {result.columns_field && result.data.length > 0 && (
          <tfoot>
            <tr>
              <td
                colSpan={rowsFieldLabels.length + (vendedorIndex >= 0 ? 1 : 0)}
                className={`${tdClass} font-medium text-text-h`}
              >
                Total
              </td>
              {result.column_values.map((col) => (
                <td key={col} className={`${tdClass} font-medium text-text-h`}>
                  {formatValue(result.column_totals[col], measure)}
                </td>
              ))}
              <td className={`${tdClass} text-base font-semibold text-accent-500`}>
                {formatValue(result.grand_total, measure)}
              </td>
              {vendedorIndex >= 0 && (
                <>
                  <td className={`${tdClass} font-medium text-text-h`}>{formatPercent(budgetGrandTotal.cumplimiento)}</td>
                  <td className={`${tdClass} font-medium text-text-h`}>
                    {budgetGrandTotal.faltante == null ? '—' : formatValue(budgetGrandTotal.faltante, measure)}
                  </td>
                </>
              )}
              {showProyeccion && (
                <td className={`${tdClass} font-medium text-text-h`}>
                  {proyeccionGrandTotal.cumplimientoProyectado == null ? (
                    '—'
                  ) : (
                    <span style={{ color: statusColorFor(proyeccionGrandTotal.cumplimientoProyectado) }}>
                      {formatPercent(proyeccionGrandTotal.cumplimientoProyectado)}
                    </span>
                  )}
                </td>
              )}
              {showPremio && (
                <td className={`${tdClass} font-medium text-text-h`}>{formatMoney(premioGrandTotal)}</td>
              )}
              {showPremioProyectado && (
                <td className={`${tdClass} font-medium text-text-h`}>{formatMoney(premioProyectadoGrandTotal)}</td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
