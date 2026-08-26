import { useEffect, useMemo, useState } from 'react';
import PlotlyChart from './PlotlyChart';
import ProgressBar from './ProgressBar';
import { computeCompletion, computePremio, describeMeasure, formatMetricValue, summarizeConcurso } from '../utils/concursoMath';
import { CATEGORICAL, STATUS, baseLayout, statusColorFor } from '../utils/plotlyTheme';
import { IconChart, IconCoin, IconStore, IconTarget, IconTrophy, IconUsers } from './icons';

const MAX_ATENCION = 10;
const RANK_MEDAL = { 0: '🥇', 1: '🥈', 2: '🥉' };

function formatMoney(value) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (value == null) return '—';
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
}

function StatTile({ label, value, valueColor, icon: Icon, delay = 0 }) {
  return (
    <div
      className="animate-fade-in-up rounded-lg border border-border bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-500"
            style={valueColor ? { color: valueColor } : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <p className="m-0 text-xs text-text">{label}</p>
      </div>
      <p className="m-0 mt-2 text-2xl font-semibold" style={{ color: valueColor }}>
        <span className={valueColor ? '' : 'text-text-h'}>{value}</span>
      </p>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h3 className="m-0 mb-3 flex items-center gap-2 text-sm font-medium text-text-h">
      <Icon className="h-4 w-4 text-text" />
      {children}
    </h3>
  );
}

/** Vision unica y consolidada de TODOS los concursos vigentes, para que el
 * SUPERVISOR tome decisiones sin tener que abrir uno por uno: KPIs
 * agregados, cumplimiento por concurso (para ver cuales van mal) y los
 * vendedores con menor cumplimiento entre todos los concursos combinados
 * (para saber a quien atender primero).
 *
 * "Venta" e "Impactos" (o cualquier otra medida) son conceptos distintos: los
 * totales en dinero solo se suman entre concursos que miden lo mismo (ver
 * `describeMeasure`/agrupacion por `label`) — nunca se mezclan pesos con
 * conteos. El % de cumplimiento y el premio si son comparables siempre (son
 * ratios/dinero de premio, no la unidad de la medida). */
// Extremos redondeados en las barras horizontales (soportado por Plotly.js
// desde 2.27; este proyecto usa 3.x), a juego con ProgressBar.
const BAR_CORNER_RADIUS = 6;
const REVEAL_DELAY_MS = 80;
const REVEAL_DURATION_MS = 800;

// Plotly's layout.transition no interpola bien los paths de barras
// redondeadas (con marker.cornerradius): el "d" del rectangulo redondeado
// salta directo al valor final en vez de animarse, aunque el resto de la
// transicion (ejes, etc) si se anime. Por eso el 0 -> valor real de estas
// barras se maneja a mano con rAF (mismo approach "carga de bateria" que
// ProgressBar) en vez de delegarselo a Plotly.
function useRevealProgress(delay = REVEAL_DELAY_MS, duration = REVEAL_DURATION_MS) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf;
    let start;
    const step = (now) => {
      if (start == null) start = now;
      const t = Math.min(1, (now - start) / duration);
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [delay, duration]);
  return progress;
}

function scaleBy(values, progress) {
  return values.map((v) => v * progress);
}

export default function ConcursosOverview({
  concursos,
  premioTiers,
  numericFieldLabel,
  theme,
  totalClientes = null,
  clientesSinCompra = null,
}) {
  const cat = CATEGORICAL[theme] || CATEGORICAL.light;

  // Los charts arrancan con las barras en 0 y, apenas montan, crecen hasta
  // el valor real (ver `useRevealProgress`, arriba). Solo pasa una vez al
  // entrar a la pagina (deps vacias adentro del hook), no cada vez que se
  // refrescan los datos (ej. despues de "Actualizar").
  const progress = useRevealProgress();
  const revealed = progress >= 1;

  const porConcurso = useMemo(
    () =>
      concursos.map((view) => ({
        view,
        summary: summarizeConcurso(view.result, view.presupuestos || {}, premioTiers),
        ...describeMeasure(view, numericFieldLabel),
      })),
    [concursos, premioTiers, numericFieldLabel],
  );

  const conCumplimiento = porConcurso.filter((c) => c.summary.cumplimiento != null);

  const cumplimientoGlobal = conCumplimiento.length
    ? conCumplimiento.reduce((sum, c) => sum + c.summary.cumplimiento, 0) / conCumplimiento.length
    : null;

  const totalPremio = porConcurso.some((c) => c.summary.totalPremio != null)
    ? porConcurso.reduce((sum, c) => sum + (c.summary.totalPremio || 0), 0)
    : null;

  // Agrupa por medida (label): sumar "Venta" con "Impactos" no tiene sentido,
  // asi que cada grupo saca su propio total y, si aplica, su propio chart de
  // "valor vs presupuesto". En el caso comun (un solo tipo de medida) esto es
  // exactamente un grupo, igual que antes.
  const grupos = useMemo(() => {
    const byLabel = new Map();
    for (const item of porConcurso) {
      if (!byLabel.has(item.label)) {
        byLabel.set(item.label, { label: item.label, isMonetary: item.isMonetary, items: [] });
      }
      byLabel.get(item.label).items.push(item);
    }
    return Array.from(byLabel.values()).map((group) => {
      let totalValor = 0;
      let totalPresupuesto = 0;
      let anyPresupuesto = false;
      for (const { summary } of group.items) {
        totalValor += summary.totalVenta || 0;
        if (summary.totalPresupuesto != null) {
          anyPresupuesto = true;
          totalPresupuesto += summary.totalPresupuesto;
        }
      }
      return { ...group, totalValor, totalPresupuesto: anyPresupuesto ? totalPresupuesto : null };
    });
  }, [porConcurso]);

  // Una fila por combinacion vendedor+concurso (si un vendedor esta en mas
  // de un concurso, cada uno cuenta aparte: son metas distintas, no se
  // promedian). Base compartida para el ranking completo (mejor a peor) y
  // para el chart de "requiere atencion" (los peores N), asi no se repite el
  // mismo recorrido dos veces.
  const vendedorRows = useMemo(() => {
    const rows = [];
    for (const view of concursos) {
      const vendedorIndex = view.result.rows_fields.indexOf('vendedor_nombre');
      if (vendedorIndex < 0) continue;
      const viewPresupuestos = view.presupuestos || {};
      for (const entry of view.result.data) {
        const vendedor = entry.row[vendedorIndex];
        const valor = entry.total || 0;
        const raw = viewPresupuestos[vendedor];
        const { cumplimiento } = computeCompletion(raw, valor);
        if (cumplimiento == null) continue;
        rows.push({
          vendedor,
          concurso: view.name,
          label: concursos.length > 1 ? `${vendedor} · ${view.name}` : vendedor,
          cumplimiento,
          premio: computePremio(cumplimiento, premioTiers),
        });
      }
    }
    return rows;
  }, [concursos, premioTiers]);

  // Cuanto se repartiria en total si CADA vendedor (en cada concurso donde
  // participa) llegara al 100% de cumplimiento. Se cuenta por vendedorRows
  // (una fila por vendedor x concurso), no por concurso: un concurso con 50
  // vendedores puede repartir hasta 50 premios, no 1. El premio de un tramo
  // es un monto fijo por tramo, no proporcional a la venta, asi que es el
  // mismo valor para cualquiera que lo alcance: basta multiplicar por
  // cuantos podrian.
  const potencialAl100 =
    premioTiers.length > 0 && vendedorRows.length > 0
      ? vendedorRows.length * (computePremio(100, premioTiers) || 0)
      : null;

  // Ranking: UNA fila por vendedor, combinando TODOS sus concursos vigentes
  // (no por separado como vendedorRows). El cumplimiento agregado es el
  // promedio simple de su cumplimiento en cada concurso donde participa
  // (igual criterio que cumplimientoGlobal, arriba): no se suma venta/venta
  // entre concursos porque pueden medir cosas distintas (venta vs
  // impactos), pero el % de cumplimiento y el premio si son comparables
  // siempre, asi que si se combinan.
  const ranking = useMemo(() => {
    const porVendedor = new Map();
    for (const row of vendedorRows) {
      if (!porVendedor.has(row.vendedor)) {
        porVendedor.set(row.vendedor, { vendedor: row.vendedor, cumplimientos: [], premio: 0, concursos: [] });
      }
      const entry = porVendedor.get(row.vendedor);
      entry.cumplimientos.push(row.cumplimiento);
      entry.premio += row.premio || 0;
      entry.concursos.push(row.concurso);
    }
    return Array.from(porVendedor.values())
      .map((v) => ({
        vendedor: v.vendedor,
        cumplimiento: v.cumplimientos.reduce((sum, c) => sum + c, 0) / v.cumplimientos.length,
        premio: v.premio,
        concursos: v.concursos,
      }))
      .sort((a, b) => b.cumplimiento - a.cumplimiento);
  }, [vendedorRows]);

  const enAtencion = useMemo(
    () => [...vendedorRows].sort((a, b) => a.cumplimiento - b.cumplimiento).slice(0, MAX_ATENCION),
    [vendedorRows],
  );

  const showConcursoChart = conCumplimiento.length > 0;
  const showAtencionChart = enAtencion.length > 0;
  const showConcursosColumn = concursos.length > 1;

  const tiles = [
    { key: 'count', label: 'Concursos vigentes', value: concursos.length, icon: IconTrophy },
    ...grupos.map((group) => ({
      key: `valor-${group.label}`,
      label: `${group.label} total`,
      value: formatMetricValue(group.totalValor, group.isMonetary),
      icon: IconChart,
    })),
    ...grupos
      .filter((g) => g.totalPresupuesto != null)
      .map((group) => ({
        key: `presupuesto-${group.label}`,
        label: grupos.length > 1 ? `Presupuesto (${group.label})` : 'Presupuesto total',
        value: formatMetricValue(group.totalPresupuesto, group.isMonetary),
        icon: IconTarget,
      })),
    {
      key: 'cumplimiento',
      label: '% Cumplimiento global',
      value: formatPercent(cumplimientoGlobal),
      valueColor: statusColorFor(cumplimientoGlobal),
      icon: IconTarget,
    },
    ...(totalClientes != null
      ? [
          {
            key: 'clientes-totales',
            label: 'Clientes totales',
            value: totalClientes.toLocaleString('es-CO'),
            icon: IconStore,
          },
        ]
      : []),
    ...(clientesSinCompra != null
      ? [
          {
            key: 'clientes-sin-compra',
            label: 'Clientes sin compra',
            value: clientesSinCompra.toLocaleString('es-CO'),
            valueColor: clientesSinCompra > 0 ? STATUS.critical : undefined,
            icon: IconUsers,
          },
        ]
      : []),
    ...(totalPremio != null
      ? [{ key: 'premio', label: 'Dinero ganado a la fecha', value: formatMoney(totalPremio), icon: IconCoin }]
      : []),
    ...(potencialAl100 != null
      ? [{ key: 'potencial', label: 'Si todos llegan al 100%', value: formatMoney(potencialAl100), icon: IconCoin }]
      : []),
  ];

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile, index) => (
          <StatTile
            key={tile.key}
            label={tile.label}
            value={tile.value}
            valueColor={tile.valueColor}
            icon={tile.icon}
            delay={index * 60}
          />
        ))}
      </div>

      {ranking.length > 0 && (
        <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-4 shadow-soft">
          <SectionTitle icon={IconUsers}>Ranking de vendedores</SectionTitle>
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr>
                  <th className="sticky top-0 w-12 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    #
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Vendedor
                  </th>
                  {showConcursosColumn && (
                    <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                      Concursos
                    </th>
                  )}
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Cumplimiento
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Premio
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => {
                  const color = statusColorFor(row.cumplimiento);
                  return (
                    <tr key={row.vendedor} className={`transition-colors hover:bg-accent-soft${index < 3 ? ' bg-accent-soft/40' : ''}`}>
                      <td className="border-b border-border px-3 py-2 text-left">
                        {RANK_MEDAL[index] ? (
                          <span className="text-base leading-none">{RANK_MEDAL[index]}</span>
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-text">
                            {index + 1}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-border px-3 py-2 text-left font-medium text-text-h">{row.vendedor}</td>
                      {showConcursosColumn && (
                        <td className="border-b border-border px-3 py-2 text-left text-text" title={row.concursos.join(', ')}>
                          {row.concursos.length > 1 ? `${row.concursos.length} concursos` : row.concursos[0]}
                        </td>
                      )}
                      <td className="border-b border-border px-3 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color }}>
                            {formatPercent(row.cumplimiento)}
                          </span>
                          <ProgressBar value={row.cumplimiento} color={color} />
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-2 text-left text-text-h">{formatMoney(row.premio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showConcursoChart || showAtencionChart) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {showConcursoChart && (
            <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lg">
              <SectionTitle icon={IconTarget}>Cumplimiento por concurso</SectionTitle>
              <div style={{ height: Math.max(160, conCumplimiento.length * 40) }}>
                <PlotlyChart
                  data={[
                    {
                      x: scaleBy([...conCumplimiento].reverse().map((c) => c.summary.cumplimiento), progress),
                      y: [...conCumplimiento].reverse().map((c) => c.view.name),
                      type: 'bar',
                      orientation: 'h',
                      marker: {
                        color: [...conCumplimiento].reverse().map((c) => statusColorFor(c.summary.cumplimiento)),
                        cornerradius: BAR_CORNER_RADIUS,
                      },
                      text: revealed ? [...conCumplimiento].reverse().map((c) => formatPercent(c.summary.cumplimiento)) : [],
                      textposition: 'outside',
                      hovertemplate: '%{y}<br>Cumplimiento: %{x:.1f}%<extra></extra>',
                    },
                  ]}
                  layout={baseLayout(theme, {
                    xaxis: { title: '', ticksuffix: '%' },
                    yaxis: { title: '', automargin: true },
                    margin: { l: 8, r: 40, t: 8, b: 32 },
                    showlegend: false,
                    transition: { duration: 0 },
                    shapes: [
                      {
                        type: 'line',
                        x0: 100,
                        x1: 100,
                        y0: -0.5,
                        y1: conCumplimiento.length - 0.5,
                        line: { color: STATUS.good, width: 1, dash: 'dot' },
                      },
                    ],
                  })}
                />
              </div>
            </div>
          )}

          {showAtencionChart && (
            <div className="animate-fade-in-up rounded-lg border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lg">
              <SectionTitle icon={IconUsers}>Vendedores que requieren atención</SectionTitle>
              <div style={{ height: Math.max(160, enAtencion.length * 32) }}>
                <PlotlyChart
                  data={[
                    {
                      x: scaleBy([...enAtencion].reverse().map((r) => r.cumplimiento), progress),
                      y: [...enAtencion].reverse().map((r) => r.label),
                      type: 'bar',
                      orientation: 'h',
                      marker: {
                        color: [...enAtencion].reverse().map((r) => statusColorFor(r.cumplimiento)),
                        cornerradius: BAR_CORNER_RADIUS,
                      },
                      text: revealed ? [...enAtencion].reverse().map((r) => formatPercent(r.cumplimiento)) : [],
                      textposition: 'outside',
                      hovertemplate: '%{y}<br>Cumplimiento: %{x:.1f}%<extra></extra>',
                    },
                  ]}
                  layout={baseLayout(theme, {
                    xaxis: { title: '', ticksuffix: '%' },
                    yaxis: { title: '', automargin: true },
                    margin: { l: 8, r: 40, t: 8, b: 32 },
                    showlegend: false,
                    transition: { duration: 0 },
                    shapes: [
                      {
                        type: 'line',
                        x0: 100,
                        x1: 100,
                        y0: -0.5,
                        y1: enAtencion.length - 0.5,
                        line: { color: STATUS.good, width: 1, dash: 'dot' },
                      },
                    ],
                  })}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {grupos
        .filter((g) => g.totalPresupuesto != null)
        .map((group) => {
          const items = group.items.filter((i) => i.summary.cumplimiento != null);
          if (items.length === 0) return null;
          return (
            <div key={`chart-${group.label}`} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lg">
              <SectionTitle icon={IconChart}>{group.label} vs. presupuesto por concurso</SectionTitle>
              <div style={{ height: Math.max(160, items.length * 40) }}>
                <PlotlyChart
                  data={[
                    {
                      x: scaleBy([...items].reverse().map((c) => c.summary.totalVenta), progress),
                      y: [...items].reverse().map((c) => c.view.name),
                      name: group.label,
                      type: 'bar',
                      orientation: 'h',
                      marker: { color: cat[0], cornerradius: BAR_CORNER_RADIUS },
                      hovertemplate: `%{y}<br>${group.label}: ${group.isMonetary ? '$' : ''}%{x:,.0f}<extra></extra>`,
                    },
                    {
                      x: scaleBy([...items].reverse().map((c) => c.summary.totalPresupuesto || 0), progress),
                      y: [...items].reverse().map((c) => c.view.name),
                      name: 'Presupuesto',
                      type: 'bar',
                      orientation: 'h',
                      marker: { color: cat[1], cornerradius: BAR_CORNER_RADIUS },
                      hovertemplate: `%{y}<br>Presupuesto: ${group.isMonetary ? '$' : ''}%{x:,.0f}<extra></extra>`,
                    },
                  ]}
                  layout={baseLayout(theme, {
                    barmode: 'group',
                    xaxis: { title: '', tickprefix: group.isMonetary ? '$' : '', tickformat: '~s' },
                    yaxis: { title: '', automargin: true },
                    margin: { l: 8, r: 8, t: 8, b: 32 },
                    showlegend: true,
                    transition: { duration: 0 },
                  })}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
