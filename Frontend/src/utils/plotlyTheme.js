// Paleta y helpers de layout para los charts de Plotly (Analytics), alineados
// con el sistema de diseño de la skill de dataviz: orden categorico fijo,
// una sola rampa secuencial (azul) para comparaciones de magnitud, y chrome
// (fondos/ejes/tipografia) que sigue el tema claro/oscuro de la app.

export const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

// Rampa secuencial azul (100->700 en palette.md), oscuro->claro para que el
// primer lugar de un ranking quede mas oscuro (mas "peso") y vaya aclarando.
export const SEQUENTIAL_BLUE = [
  '#0d366b',
  '#104281',
  '#184f95',
  '#1c5cab',
  '#256abf',
  '#2a78d6',
  '#3987e5',
  '#5598e7',
  '#6da7ec',
  '#86b6ef',
];

// Fijo, no se tematiza (igual en claro y oscuro, ver palette.md).
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
};

export const INK = {
  light: {
    primary: '#0b0b0b',
    secondary: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    surface: '#fcfcfb',
  },
  dark: {
    primary: '#ffffff',
    secondary: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    surface: '#1a1a19',
  },
};

/** Umbral de negocio: >=100% cumplido = good, >=80% = warning, resto =
 * critical. Sin cumplimiento (sin presupuesto cargado todavia) = warning
 * (info neutra, no alarmante pero visible). */
export function statusColorFor(cumplimiento) {
  if (cumplimiento == null) return STATUS.warning;
  if (cumplimiento >= 100) return STATUS.good;
  if (cumplimiento >= 80) return STATUS.warning;
  return STATUS.critical;
}

/** Colores de una rampa (secuencial u "Otros" en gris neutro) para N barras
 * ordenadas de mayor a menor: la primera (mayor valor) toma el paso mas
 * oscuro de la rampa y va aclarando. */
export function sequentialColors(n) {
  const ramp = SEQUENTIAL_BLUE;
  if (n <= 1) return [ramp[0]];
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i / (n - 1)) * (ramp.length - 1))]);
}

export function baseLayout(theme, { xaxis = {}, yaxis = {}, margin, ...rest } = {}) {
  const ink = INK[theme] || INK.light;
  return {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: ink.secondary, size: 12 },
    margin: margin || { l: 48, r: 16, t: 8, b: 40 },
    xaxis: {
      gridcolor: ink.grid,
      linecolor: ink.axis,
      zerolinecolor: ink.axis,
      tickfont: { color: ink.muted },
      ...xaxis,
    },
    yaxis: {
      gridcolor: ink.grid,
      linecolor: ink.axis,
      zerolinecolor: ink.axis,
      tickfont: { color: ink.muted },
      ...yaxis,
    },
    legend: { font: { color: ink.secondary }, orientation: 'h', y: -0.15 },
    hoverlabel: { bgcolor: ink.surface, bordercolor: ink.axis, font: { color: ink.primary } },
    ...rest,
  };
}

export const PLOT_CONFIG = { displayModeBar: false, responsive: true };
