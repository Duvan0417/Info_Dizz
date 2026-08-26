import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import api from '../utils/axiosConfig';
import PageHeader from '../components/PageHeader';

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
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <PageHeader
        title="Venta neta por vendedor"
        subtitle="Base espejo (venta_detalle): venta neta agregada por vendedor para el rango de fechas seleccionado."
      />

      <form
        className="mb-5 flex flex-row flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3.5"
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
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-muted px-5 py-4">
            <div>
              <p className="m-0 text-xs tracking-wide text-text uppercase">Vendedores</p>
              <p className="m-0 mt-0.5 text-xl font-semibold text-text-h">{rows.length.toLocaleString('es-CO')}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="m-0 text-xs tracking-wide text-text uppercase">Venta neta acumulada</p>
              <p className="m-0 mt-0.5 text-xl font-semibold text-accent-500">{formatMoney(totalGeneral)}</p>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-lg border border-border shadow-soft">
            <table className="w-full border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                    Vendedor
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                    Cantidad neta
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                    Venta neta
                  </th>
                  <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                    Líneas
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="border-b border-border px-3 py-2 text-left text-text">
                      Cargando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border-b border-border px-3 py-2 text-left text-text">
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.vendedor_nombre} className="transition-colors hover:bg-accent-soft">
                      <td className="border-b border-border px-3 py-2 text-left font-medium text-text-h">
                        {row.vendedor_nombre}
                      </td>
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
