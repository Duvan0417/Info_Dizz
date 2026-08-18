import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/axiosConfig';
import PivotResultTable from '../components/PivotResultTable';

const buttonSmallClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-h transition-colors hover:border-accent-border hover:text-accent-500';
const buttonPrimaryClass =
  'inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-500 transition-colors hover:border-accent-border';

function formatValue(value, measure) {
  if (value == null) return '0';
  const options =
    measure === 'sum' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return Number(value).toLocaleString('es-CO', options);
}

export default function ConcursosGuardados() {
  const [fieldsMeta, setFieldsMeta] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/mirror/ventas-detalle/pivot/campos/').then(({ data }) => setFieldsMeta(data)),
      api.get('/mirror/ventas-detalle/pivot/vistas/').then(({ data }) => setSavedViews(data)),
    ])
      .catch(() => setError('No se pudieron cargar las tablas guardadas.'))
      .finally(() => setLoading(false));
  }, []);

  const dimensionLabel = useMemo(() => {
    if (!fieldsMeta) return {};
    return Object.fromEntries(fieldsMeta.dimensions.map((d) => [d.field, d.label]));
  }, [fieldsMeta]);

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta tabla guardada? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/mirror/ventas-detalle/pivot/vistas/${id}/`);
      setSavedViews((current) => current.filter((v) => v.id !== id));
      if (expandedId === String(id)) setExpandedId('');
    } catch {
      setError('No se pudo eliminar la tabla.');
    }
  }

  return (
    <div className="w-full flex-1 px-6 py-8 text-left">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-medium tracking-tight text-text-h sm:text-3xl">Tablas guardadas</h1>
          <p className="mt-1 text-sm text-text">
            Tablas de pivot generadas y guardadas desde Concursos. Puedes ver el resultado guardado, modificarlo
            (vuelve al constructor con esos filtros cargados) o eliminarlo.
          </p>
        </div>
        <Link to="/concursos" className="text-sm text-accent-500 hover:underline">
          Volver a Concursos
        </Link>
      </header>

      {error && (
        <p role="alert" className="m-0 mb-4 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-text">Cargando...</p>
      ) : savedViews.length === 0 ? (
        <p className="text-sm text-text">
          Aún no has guardado ninguna tabla. Genera un pivot en Concursos y usa "Guardar tabla como nueva".
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {savedViews.map((view) => {
            const isExpanded = expandedId === String(view.id);
            const rowsFieldLabels = view.result ? view.result.rows_fields.map((f) => dimensionLabel[f] || f) : [];
            return (
              <div key={view.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-base font-medium text-text-h">{view.name}</h2>
                    <p className="mt-1 text-xs text-text">
                      Actualizado: {new Date(view.updated_at).toLocaleString('es-CO')}
                      {view.result && (
                        <>
                          {' '}
                          &middot; {view.result.measure_label} &middot; total:{' '}
                          <span className="font-medium text-text-h">
                            {formatValue(view.result.grand_total, view.config?.measure)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? '' : String(view.id))}
                      disabled={!view.result}
                      className={buttonSmallClass}
                    >
                      {isExpanded ? 'Ocultar tabla' : 'Ver tabla'}
                    </button>
                    <Link to={`/concursos?view=${view.id}`} className={buttonPrimaryClass}>
                      Modificar
                    </Link>
                    <button type="button" onClick={() => handleDelete(view.id)} className={buttonSmallClass}>
                      Eliminar
                    </button>
                  </div>
                </div>

                {!view.result && <p className="mt-3 text-sm text-text">Sin tabla generada todavía.</p>}

                {isExpanded && view.result && (
                  <div className="mt-4">
                    <PivotResultTable result={view.result} measure={view.config?.measure} rowsFieldLabels={rowsFieldLabels} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
