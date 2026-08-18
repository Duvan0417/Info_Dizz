import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/axiosConfig';
import PivotResultTable from '../components/PivotResultTable';

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
  'inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-colors hover:not-disabled:border-accent-border disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';
const buttonSmallClass =
  'inline-flex items-center justify-center rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-text-h transition-colors hover:not-disabled:border-accent-border hover:not-disabled:text-accent-500 disabled:cursor-not-allowed disabled:opacity-50';
let nextConditionId = 1;

function formatValue(value, measure) {
  if (value == null) return '0';
  const options =
    measure === 'sum' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return Number(value).toLocaleString('es-CO', options);
}

export default function Concursos() {
  const [fieldsMeta, setFieldsMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
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

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [presupuestos, setPresupuestos] = useState({});

  const [savedViews, setSavedViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [showSaveAsForm, setShowSaveAsForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    api
      .get('/mirror/ventas-detalle/pivot/campos/')
      .then(({ data }) => {
        setFieldsMeta(data);
        setRowField1(data.dimensions[0]?.field || '');
      })
      .catch(() => setMetaError('No se pudieron cargar los campos disponibles.'));

    api
      .get('/mirror/ventas-detalle/pivot/presupuestos/')
      .then(({ data }) => setPresupuestos(Object.fromEntries(data.map((p) => [p.vendedor, p.monto]))))
      .catch(() => setPresupuestos({}));

    api
      .get('/mirror/ventas-detalle/pivot/vistas/')
      .then(({ data }) => {
        setSavedViews(data);
        const viewIdParam = searchParams.get('view');
        if (viewIdParam) {
          const view = data.find((v) => String(v.id) === viewIdParam);
          if (view) applyView(view);
        }
      })
      .catch(() => setSavedViews([]));

    api
      .get('/mirror/ventas-detalle/pivot/valores/', { params: { field: 'producto' } })
      .then(({ data }) => setProductOptions(data))
      .catch(() => setProductOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const canSubmit = Boolean(fechaDesde && fechaHasta && rowField1 && (measure === 'count' || measureField));

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
    setRowField1(c.rowField1 || fieldsMeta?.dimensions[0]?.field || '');
    setRowField2(c.rowField2 || '');
    setColumnField(c.columnField || '');
    setMeasure(c.measure || 'count');
    setMeasureField(c.measureField || '');
    const loadedConditions = (c.conditions || []).map((cond) => ({ id: nextConditionId++, ...cond }));
    setConditions(loadedConditions);
    loadedConditions.forEach((cond) => ensureFieldValues(cond.field));
    setSelectedProducts(c.selectedProducts || []);
    setResult(view.result || null);
  }

  function handleLoadView(id) {
    if (!id) {
      setSelectedViewId('');
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
      const { data } = await api.post('/mirror/ventas-detalle/pivot/vistas/', {
        name,
        config: buildConfig(),
        result,
      });
      setSavedViews((current) => [data, ...current]);
      setSelectedViewId(String(data.id));
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
      });
      setSavedViews((current) => current.map((v) => (String(v.id) === selectedViewId ? data : v)));
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
      const { data } = await api.put('/mirror/ventas-detalle/pivot/presupuestos/', { vendedor, monto });
      setPresupuestos((current) => ({ ...current, [vendedor]: data.monto }));
    } catch {
      setError('No se pudo guardar el presupuesto.');
    }
  }

  const rowsFieldLabels = result ? result.rows_fields.map((f) => dimensionLabel[f] || f) : [];

  return (
    <div className="w-full flex-1 px-6 py-8 text-left">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3 pr-14">
        <div>
          <h1 className="m-0 text-2xl font-medium tracking-tight text-text-h sm:text-3xl">
            Concursos &middot; Análisis de ventas
          </h1>
          <p className="mt-1 text-sm text-text">
            Pivot dinámico sobre el espejo de ventas (venta_detalle): agrega condiciones, elige filas/columnas y una
            medida (conteo, recuento distinto o suma).
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link to="/concursos/guardados" className="text-accent-500 hover:underline">
            Tablas guardadas
          </Link>
          <Link to="/dashboard" className="text-accent-500 hover:underline">
            Volver
          </Link>
        </div>
      </header>

      {metaError && (
        <p role="alert" className="m-0 mb-4 text-sm text-danger">
          {metaError}
        </p>
      )}

      {fieldsMeta && (
        <>
          <div className="mb-4 flex flex-row flex-wrap items-end gap-3">
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

          <div className="mb-6 rounded-lg border-2 border-accent-border bg-accent-soft p-5">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-semibold text-text-h">Productos que participan</h2>
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

          <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-5 rounded-lg border border-border p-5">
            <div className="flex flex-row flex-wrap items-end gap-3">
              <label className={labelClass}>
                Desde *
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(event) => setFechaDesde(event.target.value)}
                  required
                  className={`${inputClass} w-auto`}
                />
              </label>
              <label className={labelClass}>
                Hasta *
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(event) => setFechaHasta(event.target.value)}
                  required
                  className={`${inputClass} w-auto`}
                />
              </label>

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
        <>
          {result.truncated && (
            <p className="mb-3 text-sm text-text">
              El resultado es muy grande y fue recortado a las combinaciones con mayor valor.
            </p>
          )}
          <p className="mb-3 text-sm text-text">
            {result.measure_label} &middot; total general:{' '}
            <span className="text-base font-semibold text-accent-500">{formatValue(result.grand_total, measure)}</span>
          </p>

          <PivotResultTable
            result={result}
            measure={measure}
            rowsFieldLabels={rowsFieldLabels}
            showBudget
            presupuestos={presupuestos}
            onPresupuestoChange={handlePresupuestoInput}
            onPresupuestoSave={handlePresupuestoSave}
          />
        </>
      )}
    </div>
  );
}
