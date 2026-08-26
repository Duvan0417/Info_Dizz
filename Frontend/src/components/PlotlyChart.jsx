import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { PLOT_CONFIG } from '../utils/plotlyTheme';

const Plot = createPlotlyComponent(Plotly);

/** Wrapper delgado sobre react-plotly.js: fuerza `useResizeHandler` (el
 * contenedor manda el tamano) y el `config` compartido (sin toolbar). */
export default function PlotlyChart({ style, className, ...props }) {
  return (
    <Plot
      useResizeHandler
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      config={PLOT_CONFIG}
      {...props}
    />
  );
}
