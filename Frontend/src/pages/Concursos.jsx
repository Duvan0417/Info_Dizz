import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/axiosConfig';
import PivotResultTable from '../components/PivotResultTable';
import PageHeader from '../components/PageHeader';

const OPERATOR_LABELS = {
  eq: 'Igual a',
  icontains: 'Contiene',
  in: 'En lista (varios)',
  gt: 'Mayor que',
  gte: 'Mayor o igual que',
  lt: 'Menor que',
  lte: 'Menor o igual que',
};

const inputClass =
  'w-full box-border rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';
const labelClass = 'flex flex-col items-start gap-1.5 text-xs text-text-h';
const buttonPrimaryClass =
  'inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-all hover:not-disabled:border-accent-border hover:not-disabled:-translate-y-0.5 active:not-disabled:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';
const buttonSmallClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-text-h transition-all hover:not-disabled:border-accent-border hover:not-disabled:text-accent-500 active:not-disabled:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
let nextConditionId = 1;

function formatValue(value, measure) {
  if (value == null) return '0';
  const options =
    measure === 'sum' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return Number(value).toLocaleString('es-CO', options);
}

function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Primer y ultimo dia del mes actual, para que un concurso nuevo nazca con
 * ese rango por defecto (la mayoria dura un mes; el supervisor puede
 * desbloquear las fechas para seguimientos mas largos, hasta 3 meses). */
function currentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

const MAX_RANGE_DAYS = 93; // ~3 meses

function SectionBadge({ n }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-500">
      {n}
    </span>
  );
}

function FieldGroupLabel({ children }) {
  return <p className="m-0 mb-2 text-[11px] font-semibold tracking-wide text-text uppercase">{children}</p>;
}

export default function Concursos() {
  const [fieldsMeta, setFieldsMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const [fechaDesde, setFechaDesde] = useState(() => currentMonthBounds().start);
  const [fechaHasta, setFechaHasta] = useState(() => currentMonthBounds().end);
  const [datesLocked, setDatesLocked] = useState(true);
  const [rowField1, setRowField1] = useState('');
  const [rowField2, setRowField2] = useState('');
  const [columnField, setColumnField] = useState('');
  const [measure, setMeasure] = useState('count');
  const [measureField, setMeasureField] = useState('');
  const [conditions, setConditions] = useState([]);
  const [fieldValues, setFieldValues] = useState({});

  const [productOptions, setProductOptions] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Proveedores que puede ver este SUPERVISOR (ver Backend.apps.mirror.views.
  // ProveedoresListView / scoped_proveedores): ya viene acotado por el
  // backend, no hay que filtrar nada aca.
  const [proveedores, setProveedores] = useState([]);
  const [proveedorFiltro, setProveedorFiltro] = useState('');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // `presupuestos` es el que se muestra/edita ahora mismo: mientras no hay
  // una tabla guardada cargada (selectedViewId vacio) son los defaults
  // globales (VendedorPresupuesto, de conveniencia para armar un pivot
  // nuevo); en cuanto se carga o se guarda una tabla, pasan a ser la copia
  // propia de ESA tabla (PivotSavedView.presupuestos) y editarlos ya no
  // afecta ni el default global ni otras tablas (ver handlePresupuestoSave).
  const [presupuestos, setPresupuestos] = useState({});
  const [globalPresupuestos, setGlobalPresupuestos] = useState({});

  const [premioTiers, setPremioTiers] = useState([]);
  const [newTierPorcentaje, setNewTierPorcentaje] = useState('');
  const [newTierValor, setNewTierValor] = useState('');
  const [premioError, setPremioError] = useState('');

  const [savedViews, setSavedViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [showSaveAsForm, setShowSaveAsForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Si la URL trae ?view=, applyView() ya deja `presupuestos` en la copia
    // propia de esa tabla: esta bandera evita que el fetch de defaults
    // globales (mas abajo), si resuelve despues, la pise de vuelta.
    let appliedFromUrl = false;

    api
      .get('/mirror/ventas-detalle/pivot/campos/')
      .then(({ data }) => {
        setFieldsMeta(data);
        setRowField1(data.dimensions[0]?.field || '');
      })
      .catch(() => setMetaError('No se pudieron cargar los campos disponibles.'));

    api
      .get('/mirror/ventas-detalle/pivot/presupuestos/')
      .then(({ data }) => {
        const defaults = Object.fromEntries(data.map((p) => [p.vendedor, p.monto]));
        setGlobalPresupuestos(defaults);
        if (!appliedFromUrl) setPresupuestos(defaults);
      })
      .catch(() => {
        setGlobalPresupuestos({});
        if (!appliedFromUrl) setPresupuestos({});
      });

    api
      .get('/mirror/ventas-detalle/pivot/premios/')
      .then(({ data }) => setPremioTiers(data))
      .catch(() => setPremioTiers([]));

    api
      .get('/mirror/ventas-detalle/pivot/vistas/')
      .then(({ data }) => {
        setSavedViews(data);
        const viewIdParam = searchParams.get('view');
        if (viewIdParam) {
          const view = data.find((v) => String(v.id) === viewIdParam);
          if (view) {
            appliedFromUrl = true;
            applyView(view);
          }
        }
      })
      .catch(() => setSavedViews([]));

    api
      .get('/mirror/proveedores/')
      .then(({ data }) => setProveedores(data))
      .catch(() => setProveedores([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los productos que puede elegir "Productos que participan" dependen del
  // proveedor filtrado (seccion 3): sin proveedor, todos los que el
  // supervisor puede ver; con uno elegido, solo los que ESE proveedor
  // efectivamente vende (ver PivotFieldValuesView). Se re-consulta cada vez
  // que cambia el filtro, incluyendo al cargar una tabla guardada.
  useEffect(() => {
    api
      .get('/mirror/ventas-detalle/pivot/valores/', {
        params: { field: 'producto', ...(proveedorFiltro && { proveedor: proveedorFiltro }) },
      })
      .then(({ data }) => setProductOptions(data))
      .catch(() => setProductOptions([]));
  }, [proveedorFiltro]);

  const filteredProductOptions = useMemo(() => {
    if (!Array.isArray(productOptions)) return [];
    const term = productSearch.trim().toLowerCase();
    if (!term) return productOptions;
    return productOptions.filter((p) => p.toLowerCase().includes(term));
  }, [productOptions, productSearch]);

  function toggleProduct(product) {
    setSelectedProducts((current) =>
      current.includes(product) ? current.filter((p) => p !== product) : [...current, product],
    );
  }

  const dimensionLabel = useMemo(() => {
    if (!fieldsMeta) return {};
    return Object.fromEntries(fieldsMeta.dimensions.map((d) => [d.field, d.label]));
  }, [fieldsMeta]);

  const filterFieldByName = useMemo(() => {
    if (!fieldsMeta) return {};
    return Object.fromEntries(fieldsMeta.filter_fields.map((f) => [f.field, f]));
  }, [fieldsMeta]);

  function measureFieldOptionsFor(measureValue) {
    if (!fieldsMeta) return [];
    if (measureValue === 'distinct_count') return fieldsMeta.distinct_count_fields;
    if (measureValue === 'sum') return fieldsMeta.numeric_fields;
    return [];
  }

  const measureFieldOptions = measureFieldOptionsFor(measure);

  function handleMeasureChange(newMeasure) {
    setMeasure(newMeasure);
    setMeasureField(measureFieldOptionsFor(newMeasure)[0]?.field || '');
  }

  const rowFieldOptions2 = fieldsMeta ? fieldsMeta.dimensions.filter((d) => d.field !== rowField1) : [];
  const columnFieldOptions = fieldsMeta
    ? fieldsMeta.dimensions.filter((d) => d.field !== rowField1 && d.field !== rowField2)
    : [];

  function ensureFieldValues(field) {
    const meta = filterFieldByName[field];
    if (!meta || meta.type !== 'text') return;
    setFieldValues((current) => {
      if (current[field]) return current;
      return { ...current, [field]: 'loading' };
    });
    api
      .get('/mirror/ventas-detalle/pivot/valores/', { params: { field } })
      .then(({ data }) => setFieldValues((current) => ({ ...current, [field]: data })))
      .catch(() => setFieldValues((current) => ({ ...current, [field]: [] })));
  }

  function addCondition() {
    const firstField = fieldsMeta?.filter_fields[0];
    if (!firstField) return;
    setConditions((current) => [
      ...current,
      { id: nextConditionId++, field: firstField.field, operator: firstField.operators[0], value: '' },
    ]);
    ensureFieldValues(firstField.field);
  }

  function removeCondition(id) {
    setConditions((current) => current.filter((c) => c.id !== id));
  }

  function updateCondition(id, patch) {
    setConditions((current) =>
      current.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.field && patch.field !== c.field) {
          const meta = filterFieldByName[patch.field];
          next.operator = meta?.operators[0] || 'eq';
          next.value = '';
          ensureFieldValues(patch.field);
        }
        return next;
      }),
    );
  }

  const rangeTooLong =
    Boolean(fechaDesde && fechaHasta) &&
    (new Date(fechaHasta) - new Date(fechaDesde)) / 86400000 > MAX_RANGE_DAYS;

  const canSubmit = Boolean(
    fechaDesde && fechaHasta && rowField1 && (measure === 'count' || measureField) && !rangeTooLong,
  );

  function buildConfig() {
    return {
      fechaDesde,
      fechaHasta,
      rowField1,
      rowField2,
      columnField,
      measure,
      measureField,
      conditions: conditions.map(({ field, operator, value }) => ({ field, operator, value })),
      selectedProducts,
      proveedorFiltro,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const rows = [rowField1, rowField2].filter(Boolean);
      const { data } = await api.post('/mirror/ventas-detalle/pivot/', {
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        rows,
        columns: columnField || null,
        measure,
        measure_field: measure === 'count' ? null : measureField,
        filters: [
          ...conditions.filter((c) => c.value !== '').map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
          ...(selectedProducts.length > 0
            ? [{ field: 'producto', operator: 'in', value: selectedProducts.join(',') }]
            : []),
          ...(proveedorFiltro ? [{ field: 'proveedor', operator: 'eq', value: proveedorFiltro }] : []),
        ],
      });
      setResult(data);
    } catch (err) {
      const detail = err.response?.data;
      setError(detail ? Object.values(detail).flat().join(' ') : 'No se pudo generar el pivot.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function applyView(view) {
    setSelectedViewId(String(view.id));
    const c = view.config || {};
    setFechaDesde(c.fechaDesde || '');
    setFechaHasta(c.fechaHasta || '');
    setDatesLocked(true);
    setRowField1(c.rowField1 || fieldsMeta?.dimensions[0]?.field || '');
    setRowField2(c.rowField2 || '');
    setColumnField(c.columnField || '');
    setMeasure(c.measure || 'count');
    setMeasureField(c.measureField || '');
    const loadedConditions = (c.conditions || []).map((cond) => ({ id: nextConditionId++, ...cond }));
    setConditions(loadedConditions);
    loadedConditions.forEach((cond) => ensureFieldValues(cond.field));
    setSelectedProducts(c.selectedProducts || []);
    setProveedorFiltro(c.proveedorFiltro || '');
    setResult(view.result || null);
    // El presupuesto de una tabla guardada es propio de ella (ver
    // PivotSavedView.presupuestos): al cargarla, deja de mostrar/editar el
    // default global y pasa a mostrar/editar unicamente su propia copia.
    setPresupuestos(view.presupuestos || {});
  }

  function handleLoadView(id) {
    if (!id) {
      setSelectedViewId('');
      setPresupuestos(globalPresupuestos);
      return;
    }
    const view = savedViews.find((v) => String(v.id) === id);
    if (view) applyView(view);
  }

  function describeError(err, fallback) {
    const detail = err.response?.data;
    if (!detail) return fallback;
    if (typeof detail === 'string') return detail;
    if (detail.detail) return String(detail.detail);
    try {
      return Object.values(detail).flat().join(' ');
    } catch {
      return fallback;
    }
  }

  async function confirmSaveAsNew() {
    const name = newViewName.trim();
    if (!name || !result) return;
    try {
      // `presupuestos` (lo que se ve/edita ahora mismo, sea el default
      // global o la copia de otra tabla que se tenia cargada) se copia como
      // punto de partida de la tabla nueva; de ahi en adelante es propio de
      // ella (ver PivotSavedView.presupuestos).
      const { data } = await api.post('/mirror/ventas-detalle/pivot/vistas/', {
        name,
        config: buildConfig(),
        result,
        presupuestos,
      });
      setSavedViews((current) => [data, ...current]);
      setSelectedViewId(String(data.id));
      setPresupuestos(data.presupuestos || {});
      setShowSaveAsForm(false);
      setNewViewName('');
    } catch (err) {
      setError(describeError(err, 'No se pudo guardar la tabla.'));
    }
  }

  async function handleUpdateView() {
    if (!result || !selectedViewId) return;
    try {
      const { data } = await api.patch(`/mirror/ventas-detalle/pivot/vistas/${selectedViewId}/`, {
        config: buildConfig(),
        result,
        presupuestos,
      });
      setSavedViews((current) => current.map((v) => (String(v.id) === selectedViewId ? data : v)));
      setPresupuestos(data.presupuestos || {});
    } catch (err) {
      setError(describeError(err, 'No se pudo actualizar la tabla guardada.'));
    }
  }

  async function handleDeleteView(id) {
    if (!id || !window.confirm('¿Eliminar esta tabla guardada?')) return;
    try {
      await api.delete(`/mirror/ventas-detalle/pivot/vistas/${id}/`);
      setSavedViews((current) => current.filter((v) => String(v.id) !== id));
      if (selectedViewId === id) setSelectedViewId('');
    } catch (err) {
      setError(describeError(err, 'No se pudo eliminar la tabla.'));
    }
  }

  function handlePresupuestoInput(vendedor, value) {
    setPresupuestos((current) => ({ ...current, [vendedor]: value }));
  }

  async function handlePresupuestoSave(vendedor) {
    const monto = presupuestos[vendedor];
    if (monto === '' || monto == null) return;
    try {
      // Con una tabla guardada cargada, el presupuesto se guarda solo en
      // ESA tabla (nunca en el default global ni en otras tablas que
      // compartan el mismo vendedor). Sin tabla cargada (pivot nuevo, aun
      // sin guardar), se guarda en el default global de conveniencia.
      if (selectedViewId) {
        const { data } = await api.put(`/mirror/ventas-detalle/pivot/vistas/${selectedViewId}/presupuesto/`, {
          vendedor,
          monto,
        });
        setPresupuestos(data.presupuestos || {});
        setSavedViews((current) =>
          current.map((v) => (String(v.id) === selectedViewId ? { ...v, presupuestos: data.presupuestos } : v)),
        );
      } else {
        const { data } = await api.put('/mirror/ventas-detalle/pivot/presupuestos/', { vendedor, monto });
        setGlobalPresupuestos((current) => ({ ...current, [vendedor]: data.monto }));
        setPresupuestos((current) => ({ ...current, [vendedor]: data.monto }));
      }
    } catch {
      setError('No se pudo guardar el presupuesto.');
    }
  }

  async function handleAddPremioTier() {
    const porcentaje = newTierPorcentaje;
    const valor = newTierValor;
    if (porcentaje === '' || valor === '') return;
    setPremioError('');
    try {
      const { data } = await api.post('/mirror/ventas-detalle/pivot/premios/', { porcentaje, valor });
      setPremioTiers((current) => [...current, data].sort((a, b) => Number(b.porcentaje) - Number(a.porcentaje)));
      setNewTierPorcentaje('');
      setNewTierValor('');
    } catch (err) {
      const detail = err.response?.data;
      setPremioError(detail ? Object.values(detail).flat().join(' ') : 'No se pudo agregar el tramo.');
    }
  }

  async function handleDeletePremioTier(id) {
    try {
      await api.delete(`/mirror/ventas-detalle/pivot/premios/${id}/`);
      setPremioTiers((current) => current.filter((t) => t.id !== id));
    } catch {
      setPremioError('No se pudo eliminar el tramo.');
    }
  }

  const rowsFieldLabels = result ? result.rows_fields.map((f) => dimensionLabel[f] || f) : [];

  return (
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <PageHeader
        title="Concursos · Análisis de ventas"
        subtitle="Pivot dinámico sobre el espejo de ventas (venta_detalle): agrega condiciones, elige filas/columnas y una medida (conteo, recuento distinto o suma)."
        actions={
          <Link
            to="/concursos/guardados"
            className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4 py-2 text-sm font-medium text-accent-500 no-underline transition-all hover:border-accent-border hover:-translate-y-0.5"
          >
            Tablas guardadas
          </Link>
        }
      />

      {metaError && (
        <p role="alert" className="m-0 mb-4 text-sm text-danger">
          {metaError}
        </p>
      )}

      {fieldsMeta && (
        <>
          <div className="animate-fade-in-up mb-4 flex flex-row flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
            <label className={labelClass}>
              Vista guardada
              <select
                value={selectedViewId}
                onChange={(event) => handleLoadView(event.target.value)}
                className={`${inputClass} w-auto min-w-[180px]`}
              >
                <option value="">Sin seleccionar</option>
                {savedViews.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowSaveAsForm(true);
                setNewViewName('');
              }}
              disabled={!result}
              title={result ? undefined : 'Genera el pivot primero'}
              className={buttonSmallClass}
            >
              Guardar tabla como nueva
            </button>
            {selectedViewId && (
              <>
                <button
                  type="button"
                  onClick={handleUpdateView}
                  disabled={!result}
                  title={result ? undefined : 'Genera el pivot primero'}
                  className={buttonSmallClass}
                >
                  Guardar cambios
                </button>
                <button type="button" onClick={() => handleDeleteView(selectedViewId)} className={buttonSmallClass}>
                  Eliminar tabla
                </button>
              </>
            )}
          </div>

          {showSaveAsForm && (
            <div className="mb-4 flex flex-row flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <input
                type="text"
                autoFocus
                value={newViewName}
                onChange={(event) => setNewViewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') confirmSaveAsNew();
                  if (event.key === 'Escape') setShowSaveAsForm(false);
                }}
                placeholder="Nombre para esta tabla"
                className={`${inputClass} w-64`}
              />
              <button
                type="button"
                onClick={confirmSaveAsNew}
                disabled={!newViewName.trim()}
                className={buttonPrimaryClass}
              >
                Guardar
              </button>
              <button type="button" onClick={() => setShowSaveAsForm(false)} className={buttonSmallClass}>
                Cancelar
              </button>
            </div>
          )}

          <div className="animate-fade-in-up mb-6 rounded-lg border border-border bg-surface p-5 shadow-soft" style={{ animationDelay: "80ms" }}>
            <div className="mb-1 flex items-center gap-2">
              <SectionBadge n={1} />
              <h2 className="m-0 text-base font-semibold text-text-h">Premios por cumplimiento</h2>
            </div>
            <p className="mb-3 text-xs text-text">
              Define cuánto gana un vendedor según el % de cumplimiento que alcance frente a su presupuesto (por
              ejemplo, 100% → $1.000, 90% → $900). En la tabla se aplica el tramo de mayor porcentaje que cada
              vendedor alcance.
            </p>

            {premioError && (
              <p role="alert" className="mb-2 text-sm text-danger">
                {premioError}
              </p>
            )}

            {premioTiers.length > 0 && (
              <div className="mb-3 flex flex-col gap-1">
                {premioTiers.map((tier) => (
                  <div key={tier.id} className="flex flex-row items-center gap-3 text-sm text-text-h">
                    <span className="w-20">{Number(tier.porcentaje).toLocaleString('es-CO')}%</span>
                    <span>
                      → ${Number(tier.valor).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePremioTier(tier.id)}
                      className={buttonSmallClass}
                      aria-label={`Quitar tramo de ${tier.porcentaje}%`}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-row flex-wrap items-end gap-3">
              <label className={labelClass}>
                % Cumplimiento
                <input
                  type="number"
                  step="0.01"
                  value={newTierPorcentaje}
                  onChange={(event) => setNewTierPorcentaje(event.target.value)}
                  placeholder="100"
                  className={`${inputClass} w-28`}
                />
              </label>
              <label className={labelClass}>
                Valor ganado
                <input
                  type="number"
                  step="0.01"
                  value={newTierValor}
                  onChange={(event) => setNewTierValor(event.target.value)}
                  placeholder="1000.00"
                  className={`${inputClass} w-32`}
                />
              </label>
              <button
                type="button"
                onClick={handleAddPremioTier}
                disabled={newTierPorcentaje === '' || newTierValor === ''}
                className={buttonSmallClass}
              >
                + Agregar tramo
              </button>
            </div>
          </div>

          <div className="animate-fade-in-up mb-6 rounded-lg border-2 border-accent-border bg-accent-soft p-5 shadow-soft" style={{ animationDelay: "140ms" }}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <SectionBadge n={2} />
                <h2 className="m-0 text-base font-semibold text-text-h">Productos que participan</h2>
              </div>
              <span className="text-xs text-text">
                {selectedProducts.length === 0
                  ? 'Ninguno seleccionado: se incluyen todos los productos'
                  : `${selectedProducts.length} seleccionado(s)`}
              </span>
            </div>
            <p className="mb-3 text-xs text-text">
              No todos los productos entran a un concurso o seguimiento, normalmente solo unos cuantos. Selecciona
              aquí cuáles cuentan para la sumatoria final (venta o recuento distinto); se aplica automáticamente
              junto con el resto de filtros.
            </p>

            {productOptions === null ? (
              <p className="text-sm text-text">Cargando productos...</p>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar producto..."
                    className={`${inputClass} w-64 bg-surface`}
                  />
                  {selectedProducts.length > 0 && (
                    <button type="button" onClick={() => setSelectedProducts([])} className={buttonSmallClass}>
                      Limpiar selección
                    </button>
                  )}
                </div>
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-surface p-2">
                  {filteredProductOptions.length === 0 ? (
                    <p className="px-1 text-sm text-text">Sin coincidencias.</p>
                  ) : (
                    filteredProductOptions.map((product) => (
                      <label key={product} className="flex flex-row items-center gap-2 px-1 text-sm text-text-h">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product)}
                          onChange={() => toggleProduct(product)}
                          className="w-auto accent-accent-500"
                        />
                        {product}
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="animate-fade-in-up mb-6 flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-soft" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-2">
              <SectionBadge n={3} />
              <h2 className="m-0 text-base font-semibold text-text-h">Configura tu pivot</h2>
            </div>

            <div>
              <FieldGroupLabel>Periodo</FieldGroupLabel>
              <div className="flex flex-row flex-wrap items-end gap-3">
                <label className={labelClass}>
                  Desde *
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(event) => setFechaDesde(event.target.value)}
                    required
                    disabled={datesLocked}
                    className={`${inputClass} w-auto disabled:opacity-60`}
                  />
                </label>
                <label className={labelClass}>
                  Hasta *
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(event) => setFechaHasta(event.target.value)}
                    required
                    disabled={datesLocked}
                    className={`${inputClass} w-auto disabled:opacity-60`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!datesLocked) {
                      const bounds = currentMonthBounds();
                      setFechaDesde(bounds.start);
                      setFechaHasta(bounds.end);
                    }
                    setDatesLocked((current) => !current);
                  }}
                  className={buttonSmallClass}
                  title={
                    datesLocked
                      ? 'Por defecto el concurso corre el mes actual completo. Desbloquea para un seguimiento mas largo (hasta 3 meses).'
                      : 'Volver al mes actual'
                  }
                >
                  {datesLocked ? 'Editar fechas' : 'Bloquear fechas'}
                </button>
              </div>
            </div>

            {proveedores.length > 0 && (
              <div className="border-t border-border pt-4">
                <FieldGroupLabel>Proveedor</FieldGroupLabel>
                <select
                  value={proveedorFiltro}
                  onChange={(event) => setProveedorFiltro(event.target.value)}
                  className={`${inputClass} w-auto min-w-[220px]`}
                >
                  <option value="">Todos los tuyos</option>
                  {proveedores.map((proveedor) => (
                    <option key={proveedor} value={proveedor}>
                      {proveedor}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <FieldGroupLabel>Filas, columnas y medida</FieldGroupLabel>
              <div className="flex flex-row flex-wrap items-end gap-3">
                <label className={labelClass}>
                  Fila principal
                  <select
                    value={rowField1}
                    onChange={(event) => setRowField1(event.target.value)}
                    className={`${inputClass} w-auto`}
                  >
                    {fieldsMeta.dimensions.map((d) => (
                      <option key={d.field} value={d.field}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Fila secundaria
                  <select
                    value={rowField2}
                    onChange={(event) => setRowField2(event.target.value)}
                    className={`${inputClass} w-auto`}
                  >
                    <option value="">Ninguna</option>
                    {rowFieldOptions2.map((d) => (
                      <option key={d.field} value={d.field}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Columnas (pivot)
                  <select
                    value={columnField}
                    onChange={(event) => setColumnField(event.target.value)}
                    className={`${inputClass} w-auto`}
                  >
                    <option value="">Ninguna</option>
                    {columnFieldOptions.map((d) => (
                      <option key={d.field} value={d.field}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Medida
                  <select
                    value={measure}
                    onChange={(event) => handleMeasureChange(event.target.value)}
                    className={`${inputClass} w-auto`}
                  >
                    {fieldsMeta.measures.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                {measure !== 'count' && (
                  <label className={labelClass}>
                    Campo de la medida
                    <select
                      value={measureField}
                      onChange={(event) => setMeasureField(event.target.value)}
                      className={`${inputClass} w-auto`}
                    >
                      {measureFieldOptions.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {rangeTooLong && (
              <p role="alert" className="m-0 text-sm text-danger">
                El rango no puede superar los 3 meses (un concurso/seguimiento dura como máximo eso).
              </p>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="m-0 text-sm font-medium text-text-h">Condiciones</h2>
                <button type="button" onClick={addCondition} className={buttonSmallClass}>
                  + Agregar condición
                </button>
              </div>

              {conditions.length === 0 ? (
                <p className="text-sm text-text">Sin condiciones adicionales (se usará solo el rango de fechas).</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {conditions.map((condition) => {
                    const meta = filterFieldByName[condition.field];
                    const valueType = meta?.type === 'numeric' ? 'number' : meta?.type === 'date' ? 'date' : 'text';
                    const options = fieldValues[condition.field];
                    const hasOptions = meta?.type === 'text' && Array.isArray(options);

                    return (
                      <div key={condition.id} className="flex flex-row flex-wrap items-center gap-2">
                        <select
                          value={condition.field}
                          onChange={(event) => updateCondition(condition.id, { field: event.target.value })}
                          className={`${inputClass} w-auto`}
                        >
                          {fieldsMeta.filter_fields.map((f) => (
                            <option key={f.field} value={f.field}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={condition.operator}
                          onChange={(event) => updateCondition(condition.id, { operator: event.target.value })}
                          className={`${inputClass} w-auto`}
                        >
                          {(meta?.operators || []).map((op) => (
                            <option key={op} value={op}>
                              {OPERATOR_LABELS[op] || op}
                            </option>
                          ))}
                        </select>

                        {hasOptions && condition.operator === 'in' ? (
                          <select
                            multiple
                            value={condition.value ? condition.value.split(',') : []}
                            onChange={(event) =>
                              updateCondition(condition.id, {
                                value: Array.from(event.target.selectedOptions, (o) => o.value).join(','),
                              })
                            }
                            className={`${inputClass} h-24 w-56`}
                          >
                            {options.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : hasOptions ? (
                          <select
                            value={condition.value}
                            onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                            className={`${inputClass} w-auto min-w-[180px]`}
                          >
                            <option value="">Seleccionar {meta.label.toLowerCase()}...</option>
                            {options.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={condition.operator === 'in' ? 'text' : valueType}
                            value={condition.value}
                            onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                            placeholder={
                              meta?.type === 'text' && options === 'loading'
                                ? 'Cargando valores...'
                                : condition.operator === 'in'
                                  ? 'valor1, valor2, ...'
                                  : 'Valor'
                            }
                            disabled={options === 'loading'}
                            className={`${inputClass} w-auto`}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => removeCondition(condition.id)}
                          className={buttonSmallClass}
                          aria-label="Quitar condición"
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <button type="submit" disabled={!canSubmit || loading} className={buttonPrimaryClass}>
                {loading ? 'Generando...' : 'Generar pivot'}
              </button>
            </div>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="m-0 mb-4 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="animate-fade-in-up">
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-muted px-5 py-4 shadow-soft">
            <div>
              <p className="m-0 text-xs text-text uppercase tracking-wide">{result.measure_label} &middot; total general</p>
              <p className="m-0 mt-0.5 text-2xl font-semibold text-accent-500">
                {formatValue(result.grand_total, measure)}
              </p>
            </div>
            {result.truncated && (
              <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-medium text-danger">
                Resultado recortado a las combinaciones con mayor valor
              </span>
            )}
          </div>

          <PivotResultTable
            result={result}
            measure={measure}
            rowsFieldLabels={rowsFieldLabels}
            showBudget
            presupuestos={presupuestos}
            onPresupuestoChange={handlePresupuestoInput}
            onPresupuestoSave={handlePresupuestoSave}
            premioTiers={premioTiers}
          />
        </div>
      )}
    </div>
  );
}
