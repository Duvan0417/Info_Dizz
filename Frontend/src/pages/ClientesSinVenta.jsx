import { useEffect, useState } from 'react';
import api from '../utils/axiosConfig';
import PageHeader from '../components/PageHeader';
import { IconPrinter } from '../components/icons';
import { useAuth } from '../context/useAuth';

const DIA_LABEL = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado' };
const DIA_ORDEN = { L: 0, M: 1, X: 2, J: 3, V: 4, S: 5 };

function ordenarPorDiaVisita(clientes) {
  return [...clientes].sort((a, b) => {
    const ordenA = DIA_ORDEN[a.dia_visita] ?? 99;
    const ordenB = DIA_ORDEN[b.dia_visita] ?? 99;
    return ordenA - ordenB;
  });
}

function formatMesMaestra(mes) {
  if (!mes || mes.length !== 6) return '—';
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const anio = mes.slice(0, 4);
  const mesIndex = Number(mes.slice(4, 6)) - 1;
  return `${meses[mesIndex] || mes} ${anio}`;
}

function formatTelefono(value) {
  if (value == null) return '—';
  return String(value);
}

/** Clientes asignados a los vendedores de VENDEDOR o SUPERVISOR (segun
 * maestra_clientes, siempre el mes mas reciente disponible en la base
 * espejo) que todavia no tienen ninguna venta registrada ese mes — o, con un
 * proveedor seleccionado, que no le compraron nada a ESE proveedor puntual.
 * SUPERVISOR ve la union de todos sus vendedores por defecto y puede acotar
 * con el filtro de vendedor (uno, varios, o todos). Unico apartado de
 * VENDEDOR ademas de sus concursos
 * (ver Backend.apps.mirror.views.ClientesSinVentaView). */
export default function ClientesSinVenta() {
  const { role } = useAuth();
  const [data, setData] = useState(null);
  const [proveedorInput, setProveedorInput] = useState('');
  const [vendedoresSeleccionados, setVendedoresSeleccionados] = useState([]);
  const [vendedorMenuOpen, setVendedorMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load(proveedor, vendedores) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (proveedor) params.set('proveedor', proveedor);
    vendedores.forEach((vendedor) => params.append('vendedor', vendedor));
    api
      .get('/mirror/clientes-sin-venta/', { params })
      .then(({ data }) => setData(data))
      .catch(() => setError('No se pudieron cargar los clientes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load('', []);
  }, []);

  function handleFilterChange(event) {
    const proveedor = event.target.value;
    setProveedorInput(proveedor);
    load(proveedor, vendedoresSeleccionados);
  }

  function toggleVendedor(vendedor) {
    const next = vendedoresSeleccionados.includes(vendedor)
      ? vendedoresSeleccionados.filter((v) => v !== vendedor)
      : [...vendedoresSeleccionados, vendedor];
    setVendedoresSeleccionados(next);
    load(proveedorInput, next);
  }

  function selectTodosVendedores() {
    setVendedoresSeleccionados([]);
    load(proveedorInput, []);
  }

  const clientes = ordenarPorDiaVisita(data?.clientes || []);
  const vendedoresDisponibles = data?.vendedores || [];
  const mostrarFiltroVendedor = role === 'SUPERVISOR' && vendedoresDisponibles.length > 0;
  const vendedorResumen =
    vendedoresSeleccionados.length === 0
      ? 'Todos'
      : vendedoresSeleccionados.length === 1
        ? vendedoresSeleccionados[0]
        : `${vendedoresSeleccionados.length} vendedores`;
  const totalClientes = data?.total_clientes ?? 0;
  const conVenta = totalClientes - clientes.length;

  return (
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <PageHeader
        title="Clientes sin venta"
        subtitle={
          role === 'SUPERVISOR'
            ? data?.mes_maestra
              ? `Clientes de ${formatMesMaestra(data.mes_maestra)} que todavía no le han comprado a tus vendedores este mes.`
              : 'Clientes que todavía no le han comprado a tus vendedores este mes.'
            : data?.mes_maestra
              ? `Clientes de ${formatMesMaestra(data.mes_maestra)} que todavía no te han comprado este mes.`
              : 'Clientes que todavía no te han comprado este mes.'
        }
        actions={
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || clientes.length === 0}
            className="inline-flex items-center gap-2 rounded-md border-2 border-transparent bg-accent-soft px-4 py-2 text-sm font-medium text-accent-500 transition-all hover:not-disabled:border-accent-border hover:not-disabled:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconPrinter className="h-4 w-4" />
            Imprimir
          </button>
        }
      />

      <div className="no-print mb-5 flex flex-row flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3.5">
        <label className="flex flex-col items-start gap-1.5 text-xs text-text-h">
          Proveedor
          <select
            value={proveedorInput}
            onChange={handleFilterChange}
            disabled={loading || !data}
            className="w-auto min-w-[220px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-60"
          >
            <option value="">Todos (sin ninguna venta este mes)</option>
            {(data?.proveedores || []).map((proveedor) => (
              <option key={proveedor} value={proveedor}>
                {proveedor}
              </option>
            ))}
          </select>
        </label>

        {mostrarFiltroVendedor && (
          <div className="relative flex flex-col items-start gap-1.5 text-xs text-text-h">
            Vendedor
            <button
              type="button"
              onClick={() => setVendedorMenuOpen((open) => !open)}
              disabled={loading || !data}
              className="w-auto min-w-[220px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {vendedorResumen}
            </button>
            {vendedorMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setVendedorMenuOpen(false)} aria-hidden="true" />
                <div className="absolute top-full z-20 mt-1 flex max-h-[320px] w-64 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface px-3 py-2.5 shadow-soft">
                  <label className="flex flex-row items-center gap-2 border-b border-border pb-1.5 text-sm font-medium text-text-h">
                    <input
                      type="checkbox"
                      checked={vendedoresSeleccionados.length === 0}
                      onChange={selectTodosVendedores}
                      className="w-auto accent-accent-500"
                    />
                    Todos
                  </label>
                  {vendedoresDisponibles.map((vendedor) => (
                    <label key={vendedor} className="flex flex-row items-center gap-2 text-sm text-text-h">
                      <input
                        type="checkbox"
                        checked={vendedoresSeleccionados.includes(vendedor)}
                        onChange={() => toggleVendedor(vendedor)}
                        className="w-auto accent-accent-500"
                      />
                      {vendedor}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="print-area">
        <div className="mb-4 hidden print:block">
          <h2 className="m-0 text-lg font-semibold text-text-h">
            Clientes sin venta — {formatMesMaestra(data?.mes_maestra)}
          </h2>
          <p className="m-0 mt-1 text-sm text-text">
            Proveedor: {proveedorInput || 'Todos (sin ninguna venta este mes)'}
            {mostrarFiltroVendedor && <> · Vendedor: {vendedorResumen}</>} · Generado el{' '}
            {new Date().toLocaleDateString('es-CO')}
          </p>
        </div>

        {!loading && data && (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-muted px-5 py-4">
            <div>
              <p className="m-0 text-xs tracking-wide text-text uppercase">Clientes asignados</p>
              <p className="m-0 mt-0.5 text-xl font-semibold text-text-h">{totalClientes.toLocaleString('es-CO')}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="m-0 text-xs tracking-wide text-text uppercase">Con venta</p>
              <p className="m-0 mt-0.5 text-xl font-semibold text-text-h">{conVenta.toLocaleString('es-CO')}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="m-0 text-xs tracking-wide text-text uppercase">Sin venta</p>
              <p className="m-0 mt-0.5 text-xl font-semibold text-danger">{clientes.length.toLocaleString('es-CO')}</p>
            </div>
          </div>
        )}

        <div className="w-full overflow-x-auto rounded-lg border border-border shadow-soft">
          <table className="w-full border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Código
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Cliente
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Negocio
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Dirección
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Teléfono
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Unidad
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2.5 text-left font-medium text-text-h">
                  Día de visita
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="border-b border-border px-3 py-2 text-left text-text">
                    Cargando...
                  </td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border-b border-border px-3 py-2 text-left text-text">
                    {totalClientes === 0
                      ? role === 'SUPERVISOR'
                        ? 'No hay clientes asignados este mes en la maestra de clientes para el filtro seleccionado.'
                        : 'No tienes clientes asignados este mes en la maestra de clientes.'
                      : role === 'SUPERVISOR'
                        ? 'Todos los clientes ya tienen venta registrada este mes.'
                        : 'Todos tus clientes ya tienen venta registrada este mes.'}
                  </td>
                </tr>
              ) : (
                clientes.map((cliente) => (
                  <tr key={cliente.cod_cliente} className="transition-colors hover:bg-accent-soft">
                    <td className="border-b border-border px-3 py-2 text-left text-text">{cliente.cod_cliente}</td>
                    <td className="border-b border-border px-3 py-2 text-left font-medium text-text-h">
                      {cliente.nombre || cliente.cod_cliente}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-left text-text">{cliente.negocio || '—'}</td>
                    <td className="border-b border-border px-3 py-2 text-left text-text">{cliente.direccion || '—'}</td>
                    <td className="border-b border-border px-3 py-2 text-left text-text">
                      {formatTelefono(cliente.telefono)}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-left text-text">{cliente.unidad || '—'}</td>
                    <td className="border-b border-border px-3 py-2 text-left text-text">
                      {DIA_LABEL[cliente.dia_visita] || cliente.dia_visita || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
