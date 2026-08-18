import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../utils/axiosConfig';

const formatMoney = (value) =>
  value == null ? '' : Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatNumber = (value) => (value == null ? '' : Number(value).toLocaleString('es-CO'));

export default function VentasDetalle() {
  const { role } = useAuth();
  // El PROVEEDOR ya tiene un unico proveedor asignado por defecto (ver
  // Backend.apps.users.scoping): el filtro no aplica para el.
  const showProveedorFilter = role !== 'PROVEEDOR';
  const [proveedores, setProveedores] = useState([]);
  const [proveedorInput, setProveedorInput] = useState('');
  const [fechaDesdeInput, setFechaDesdeInput] = useState('');
  const [fechaHastaInput, setFechaHastaInput] = useState('');
  // null hasta que se envie el formulario por primera vez: fecha_desde/fecha_hasta
  // son obligatorios en el backend, asi que no se consulta nada de entrada.
  const [filters, setFilters] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = Boolean(fechaDesdeInput && fechaHastaInput);

  useEffect(() => {
    if (!showProveedorFilter) return;
    api
      .get('/mirror/proveedores/')
      .then(({ data }) => setProveedores(data))
      .catch(() => setProveedores([]));
  }, [showProveedorFilter]);

  useEffect(() => {
    if (!filters) return;

    setLoading(true);
    setError('');
    api
      .get('/mirror/ventas-detalle/por-vendedor/', {
        params: {
          fecha_desde: filters.fechaDesde,
          fecha_hasta: filters.fechaHasta,
          ...(filters.proveedor && { proveedor: filters.proveedor }),
        },
      })
      .then(({ data }) => setRows(data))
      .catch(() => setError('No se pudieron cargar las ventas.'))
      .finally(() => setLoading(false));
  }, [filters]);

  function handleFilterSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setFilters({
      proveedor: proveedorInput.trim(),
      fechaDesde: fechaDesdeInput,
      fechaHasta: fechaHastaInput,
    });
  }

  const totalGeneral = rows.reduce((sum, row) => sum + Number(row.total_venta || 0), 0);

  return (
    <div className="w-full flex-1 px-6 py-8 text-left">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3 pr-14">
        <h1 className="m-0 text-2xl font-medium tracking-tight text-text-h sm:text-3xl">
          Venta neta por vendedor (base espejo)
        </h1>
        <Link to="/dashboard" className="text-sm text-accent-500 hover:underline">
          Volver
        </Link>
      </header>

      <form
        className="mb-4 flex flex-row flex-wrap items-end gap-3"
        onSubmit={handleFilterSubmit}
      >
        <label className="flex flex-col items-start gap-1.5 text-xs text-text-h">
          Desde *
          <input
            type="date"
            value={fechaDesdeInput}
            onChange={(event) => setFechaDesdeInput(event.target.value)}
            required
            className="w-auto rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          />
        </label>
        <label className="flex flex-col items-start gap-1.5 text-xs text-text-h">
          Hasta *
          <input
            type="date"
            value={fechaHastaInput}
            onChange={(event) => setFechaHastaInput(event.target.value)}
            required
            className="w-auto rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          />
        </label>
        {showProveedorFilter && (
          <label className="flex flex-col items-start gap-1.5 text-xs text-text-h">
            Proveedor
            <select
              value={proveedorInput}
              onChange={(event) => setProveedorInput(event.target.value)}
              className="w-auto rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
            >
              <option value="">Todos</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor} value={proveedor}>
                  {proveedor}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-colors hover:not-disabled:border-accent-border disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        >
          Filtrar
        </button>
      </form>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!filters ? (
        <p className="mb-3 text-sm text-text">Selecciona el rango de fechas (obligatorio) y presiona Filtrar para consultar.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-text">
            {rows.length.toLocaleString('es-CO')} vendedores &middot; venta neta acumulada: {formatMoney(totalGeneral)}
          </p>

          <div className="w-full overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Vendedor
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Cantidad neta
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Venta neta
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                    Líneas
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="border-b border-border px-3 py-2 text-left">
                      Cargando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border-b border-border px-3 py-2 text-left">
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.vendedor_nombre} className="hover:bg-accent-soft">
                      <td className="border-b border-border px-3 py-2 text-left">{row.vendedor_nombre}</td>
                      <td className="border-b border-border px-3 py-2 text-left">{formatNumber(row.total_cantidad)}</td>
                      <td className="border-b border-border px-3 py-2 text-left">{formatMoney(row.total_venta)}</td>
                      <td className="border-b border-border px-3 py-2 text-left">{formatNumber(row.num_lineas)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
