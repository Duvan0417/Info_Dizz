import { Fragment } from 'react';

const thClass = 'sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h';
const tdClass = 'border-b border-border px-3 py-2 text-left';

function formatValue(value, measure) {
  if (value == null) return '0';
  const options =
    measure === 'sum' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return Number(value).toLocaleString('es-CO', options);
}

/** Renderiza la tabla resultado de un pivot (Concursos). Si `showBudget` es
 * true y `vendedor_nombre` esta entre las filas, inserta una columna
 * "Presupuesto" editable justo despues (requiere `presupuestos` +
 * `onPresupuestoChange`/`onPresupuestoSave`); si no, se omite. */
export default function PivotResultTable({
  result,
  measure,
  rowsFieldLabels,
  showBudget = false,
  presupuestos = {},
  onPresupuestoChange,
  onPresupuestoSave,
}) {
  const vendedorIndex = showBudget ? result.rows_fields.indexOf('vendedor_nombre') : -1;

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
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
              <th className={thClass}>Valor</th>
            )}
            <th className={`${thClass} text-accent-500`}>Total</th>
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
                    {i === vendedorIndex && (
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
                    )}
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
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
