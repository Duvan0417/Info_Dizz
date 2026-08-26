import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/axiosConfig';
import PivotResultTable from '../components/PivotResultTable';
import PageHeader from '../components/PageHeader';
import { IconChevronDown, IconTag } from '../components/icons';

const SIN_PROVEEDOR = 'Sin proveedor específico';

const buttonSmallClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-h transition-all hover:not-disabled:border-accent-border hover:not-disabled:text-accent-500 active:not-disabled:scale-95 disabled:opacity-60';
const buttonPrimaryClass =
  'inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-500 transition-all hover:not-disabled:border-accent-border hover:not-disabled:-translate-y-0.5 active:not-disabled:scale-95 disabled:opacity-60';

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
  const [updatingId, setUpdatingId] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  // Grupos (proveedores) desplegados: colapsados por defecto, para que la
  // pagina siga viendose ordenada aunque se acumulen muchas tablas.
  const [openGroups, setOpenGroups] = useState(() => new Set());

  function toggleGroup(proveedor) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(proveedor)) next.delete(proveedor);
      else next.add(proveedor);
      return next;
    });
  }

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

  // Agrupadas por el proveedor con el que se filtro cada tabla al armarla
  // (config.proveedorFiltro, ver Concursos.jsx): un mismo proveedor
  // normalmente tiene varias tablas, asi que verlas juntas da una vista mas
  // clara que la lista plana. Las que no tienen proveedor filtrado (tablas
  // creadas antes de ese filtro, o armadas sin elegir uno) van en un grupo
  // aparte al final.
  const groupedViews = useMemo(() => {
    const groups = new Map();
    for (const view of savedViews) {
      const proveedor = view.config?.proveedorFiltro || SIN_PROVEEDOR;
      if (!groups.has(proveedor)) groups.set(proveedor, []);
      groups.get(proveedor).push(view);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === SIN_PROVEEDOR) return 1;
      if (b === SIN_PROVEEDOR) return -1;
      return a.localeCompare(b, 'es');
    });
  }, [savedViews]);

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

  async function handleActualizar(id) {
    setUpdatingId(String(id));
    setError('');
    try {
      const { data } = await api.post(`/mirror/ventas-detalle/pivot/vistas/${id}/actualizar/`);
      setSavedViews((current) => current.map((v) => (v.id === id ? data : v)));
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'No se pudo actualizar el concurso.');
    } finally {
      setUpdatingId('');
    }
  }

  const openViews = savedViews.filter((v) => !v.cerrado);

  async function handleActualizarTodo() {
    if (openViews.length === 0) return;
    setBulkUpdating(true);
    setError('');
    const results = await Promise.allSettled(
      openViews.map((v) => api.post(`/mirror/ventas-detalle/pivot/vistas/${v.id}/actualizar/`)),
    );
    setSavedViews((current) => {
      const updatedById = new Map();
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') updatedById.set(openViews[i].id, r.value.data);
      });
      return current.map((v) => updatedById.get(v.id) || v);
    });
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) setError(`No se pudieron actualizar ${failed} de ${openViews.length} tablas.`);
    setBulkUpdating(false);
  }

  return (
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <PageHeader
        title="Tablas guardadas"
        subtitle="Tablas de pivot generadas y guardadas desde Concursos. Puedes ver el resultado guardado, modificarlo (vuelve al constructor con esos filtros cargados) o eliminarlo."
        actions={
          <>
            <button
              type="button"
              onClick={handleActualizarTodo}
              disabled={openViews.length === 0 || bulkUpdating}
              className={buttonPrimaryClass}
            >
              {bulkUpdating ? 'Actualizando todo...' : `Actualizar todo (${openViews.length})`}
            </button>
            <Link
              to="/concursos"
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-1.5 text-sm font-medium text-text-h no-underline transition-all hover:border-accent-border hover:text-accent-500"
            >
              Volver a Concursos
            </Link>
          </>
        }
      />

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
          {groupedViews.map(([proveedor, views]) => {
            const isOpen = openGroups.has(proveedor);
            const enCurso = views.filter((v) => !v.cerrado).length;
            return (
              <section key={proveedor} className="rounded-lg border border-border bg-surface shadow-soft">
                <button
                  type="button"
                  onClick={() => toggleGroup(proveedor)}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-500">
                    <IconTag className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-base font-semibold text-text-h">{proveedor}</span>
                  <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-text">
                    {views.length} tabla{views.length === 1 ? '' : 's'}
                  </span>
                  {enCurso > 0 && (
                    <span className="rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-500">
                      {enCurso} en curso
                    </span>
                  )}
                  <IconChevronDown
                    className={`ml-auto h-4 w-4 shrink-0 text-text transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="animate-fade-in-up flex flex-col gap-3 border-t border-border p-4">
                    {views.map((view, index) => (
                      <ConcursoGuardadoCard
                        key={view.id}
                        view={view}
                        index={index}
                        isExpanded={expandedId === String(view.id)}
                        onToggleExpand={() => setExpandedId(expandedId === String(view.id) ? '' : String(view.id))}
                        onActualizar={() => handleActualizar(view.id)}
                        onDelete={() => handleDelete(view.id)}
                        updating={updatingId === String(view.id)}
                        bulkUpdating={bulkUpdating}
                        dimensionLabel={dimensionLabel}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConcursoGuardadoCard({
  view,
  index,
  isExpanded,
  onToggleExpand,
  onActualizar,
  onDelete,
  updating,
  bulkUpdating,
  dimensionLabel,
}) {
  const rowsFieldLabels = view.result ? view.result.rows_fields.map((f) => dimensionLabel[f] || f) : [];
  return (
    <div
      className={`animate-fade-in-up rounded-lg border border-l-4 border-border bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg${view.cerrado ? ' border-l-border opacity-75' : ' border-l-accent-500'}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-base font-medium text-text-h">{view.name}</h3>
            {view.cerrado ? (
              <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-text">
                Cerrado
              </span>
            ) : (
              <span className="rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-500">
                En curso
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text">
            {view.fecha_inicio && view.fecha_fin && (
              <span>
                Periodo: {view.fecha_inicio} → {view.fecha_fin}
              </span>
            )}
            <span>Actualizado: {new Date(view.updated_at).toLocaleString('es-CO')}</span>
            {view.result && (
              <span>
                {view.result.measure_label} total:{' '}
                <span className="font-medium text-text-h">
                  {formatValue(view.result.grand_total, view.config?.measure)}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onToggleExpand} disabled={!view.result} className={buttonSmallClass}>
            {isExpanded ? 'Ocultar tabla' : 'Ver tabla'}
          </button>
          {!view.cerrado && (
            <button type="button" onClick={onActualizar} disabled={updating || bulkUpdating} className={buttonSmallClass}>
              {updating ? 'Actualizando...' : 'Actualizar'}
            </button>
          )}
          <Link to={`/concursos?view=${view.id}`} className={buttonPrimaryClass}>
            Modificar
          </Link>
          <button type="button" onClick={onDelete} className={buttonSmallClass}>
            Eliminar
          </button>
        </div>
      </div>

      {!view.result && <p className="mt-3 text-sm text-text">Sin tabla generada todavía.</p>}

      {isExpanded && view.result && (
        <div className="animate-fade-in-up mt-4">
          <PivotResultTable result={view.result} measure={view.config?.measure} rowsFieldLabels={rowsFieldLabels} />
        </div>
      )}
    </div>
  );
}
