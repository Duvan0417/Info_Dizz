import { useMemo, useState } from 'react';
import PivotResultTable from './PivotResultTable';
import ProgressBar from './ProgressBar';
import { describeMeasure, formatMetricValue, summarizeConcurso } from '../utils/concursoMath';
import { STATUS, statusColorFor } from '../utils/plotlyTheme';

const buttonSmallClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-text-h transition-all hover:border-accent-border hover:text-accent-500 active:scale-95';

function formatMoney(value) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
}

/** Fila de un concurso vigente para el drill-down individual (la vision
 * consolidada de todos los concursos vive en ConcursosOverview, arriba de
 * esta lista): punto de estado, totales en una linea y la tabla detallada
 * por vendedor colapsada por defecto. */
export default function ConcursoCard({ view, presupuestos, premioTiers, numericFieldLabel, rowsFieldLabels, diasHabilesMap }) {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(
    () =>
      summarizeConcurso(
        view.result,
        presupuestos,
        premioTiers,
        diasHabilesMap ? { fechaInicio: view.fecha_inicio, fechaFin: view.fecha_fin, mapa: diasHabilesMap } : null,
      ),
    [view.result, view.fecha_inicio, view.fecha_fin, presupuestos, premioTiers, diasHabilesMap],
  );
  const { isMonetary, label: valorLabel } = describeMeasure(view, numericFieldLabel);

  const accentColor = statusColorFor(summary.cumplimiento);
  const needsAttention = accentColor !== STATUS.good;

  return (
    <div className="rounded-lg border border-border bg-surface shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            {needsAttention && (
              <span
                className="animate-soft-pulse absolute inline-flex h-full w-full rounded-full"
                style={{ backgroundColor: accentColor }}
              />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          </span>
          <div>
            <h3 className="m-0 text-sm font-medium text-text-h">{view.name}</h3>
            {view.fecha_inicio && view.fecha_fin && (
              <p className="m-0 mt-0.5 text-xs text-text">
                {view.fecha_inicio} → {view.fecha_fin}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="m-0 text-[10px] font-medium tracking-wide text-text/70 uppercase">{valorLabel}</p>
            <p className="m-0 text-sm font-semibold text-text-h">{formatMetricValue(summary.totalVenta, isMonetary)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-medium tracking-wide text-text/70 uppercase">Presupuesto</p>
            <p className="m-0 text-sm font-semibold text-text-h">{formatMetricValue(summary.totalPresupuesto, isMonetary)}</p>
          </div>
          <div>
            <p className="m-0 text-[10px] font-medium tracking-wide text-text/70 uppercase">Cumplimiento</p>
            <div className="flex items-center gap-1.5">
              <p className="m-0 text-sm font-semibold" style={{ color: accentColor }}>
                {formatPercent(summary.cumplimiento)}
              </p>
              {summary.cumplimiento != null && (
                <ProgressBar value={summary.cumplimiento} color={accentColor} trackClassName="h-1.5 w-12" />
              )}
            </div>
          </div>
          {summary.cumplimientoProyectado != null && (
            <div>
              <p className="m-0 text-[10px] font-medium tracking-wide text-text/70 uppercase">Proyección de cierre</p>
              <p className="m-0 text-sm font-semibold" style={{ color: statusColorFor(summary.cumplimientoProyectado) }}>
                {formatPercent(summary.cumplimientoProyectado)}
              </p>
            </div>
          )}
          {summary.totalPremio != null && (
            <div>
              <p className="m-0 text-[10px] font-medium tracking-wide text-text/70 uppercase">Premio</p>
              <p className="m-0 text-sm font-semibold text-text-h">{formatMoney(summary.totalPremio)}</p>
            </div>
          )}
          {summary.totalPremioProyectado != null && (
            <div>
              <p className="m-0 text-[10px] font-medium tracking-wide text-text/70 uppercase">Premio proyectado</p>
              <p className="m-0 text-sm font-semibold text-text-h">{formatMoney(summary.totalPremioProyectado)}</p>
            </div>
          )}
          <button type="button" onClick={() => setExpanded((v) => !v)} className={`${buttonSmallClass} ml-auto`}>
            {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in-up border-t border-border p-4">
          <PivotResultTable
            result={view.result}
            measure={view.config?.measure}
            rowsFieldLabels={rowsFieldLabels}
            showBudget
            presupuestos={presupuestos}
            premioTiers={premioTiers}
            budgetEditable={false}
            fechaInicio={view.fecha_inicio}
            fechaFin={view.fecha_fin}
            diasHabilesMap={diasHabilesMap}
          />
        </div>
      )}
    </div>
  );
}
