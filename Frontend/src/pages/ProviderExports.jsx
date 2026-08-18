import { useState } from 'react';
import api from '../utils/axiosConfig';

export default function ProviderExports() {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  async function handleDownload(key, filetype, params = {}) {
    const pendingKey = `${key}-${filetype}`;
    setError('');
    setPending(pendingKey);
    try {
      const response = await api.get(`/exports/${key}/`, {
        params: { ...params, filetype },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${key}.${filetype}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar el archivo.');
    } finally {
      setPending(null);
    }
  }

  function isPending(key, filetype) {
    return pending === `${key}-${filetype}`;
  }

  const canDownloadSales = Boolean(fechaDesde && fechaHasta);

  const downloadButtonClass =
    'inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-3.5 py-1.5 text-[13px] font-medium text-accent-500 transition-colors hover:not-disabled:border-accent-border disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';
  const dateInputClass =
    'w-[130px] rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2';

  return (
    <div className="w-full flex-1 px-6 py-8 text-left">
      <h1 className="mb-6 text-2xl font-medium tracking-tight text-text-h sm:text-3xl">Exportar planos</h1>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      <ul className="m-0 flex max-w-lg list-none flex-col gap-3 p-0">
        <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="mr-auto font-medium text-text-h">Inventario</span>
          <button
            type="button"
            disabled={isPending('inventory', 'csv')}
            onClick={() => handleDownload('inventory', 'csv')}
            className={downloadButtonClass}
          >
            {isPending('inventory', 'csv') ? 'Descargando...' : 'CSV'}
          </button>
          <button
            type="button"
            disabled={isPending('inventory', 'xlsx')}
            onClick={() => handleDownload('inventory', 'xlsx')}
            className={downloadButtonClass}
          >
            {isPending('inventory', 'xlsx') ? 'Descargando...' : 'Excel'}
          </button>
        </li>

        <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="mr-auto font-medium text-text-h">Ventas</span>
          <label className="flex flex-row items-center gap-1.5 text-[13px] text-text-h">
            Desde *
            <input
              type="date"
              value={fechaDesde}
              onChange={(event) => setFechaDesde(event.target.value)}
              required
              className={dateInputClass}
            />
          </label>
          <label className="flex flex-row items-center gap-1.5 text-[13px] text-text-h">
            Hasta *
            <input
              type="date"
              value={fechaHasta}
              onChange={(event) => setFechaHasta(event.target.value)}
              required
              className={dateInputClass}
            />
          </label>
          <button
            type="button"
            disabled={!canDownloadSales || isPending('sales', 'csv')}
            title={canDownloadSales ? undefined : 'Selecciona fecha desde y hasta'}
            onClick={() => handleDownload('sales', 'csv', { fecha_desde: fechaDesde, fecha_hasta: fechaHasta })}
            className={downloadButtonClass}
          >
            {isPending('sales', 'csv') ? 'Descargando...' : 'CSV'}
          </button>
          <button
            type="button"
            disabled={!canDownloadSales || isPending('sales', 'xlsx')}
            title={canDownloadSales ? undefined : 'Selecciona fecha desde y hasta'}
            onClick={() => handleDownload('sales', 'xlsx', { fecha_desde: fechaDesde, fecha_hasta: fechaHasta })}
            className={downloadButtonClass}
          >
            {isPending('sales', 'xlsx') ? 'Descargando...' : 'Excel'}
          </button>
        </li>

        <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="mr-auto font-medium text-text-h">Precios</span>
          <button
            type="button"
            disabled={isPending('prices', 'csv')}
            onClick={() => handleDownload('prices', 'csv')}
            className={downloadButtonClass}
          >
            {isPending('prices', 'csv') ? 'Descargando...' : 'CSV'}
          </button>
          <button
            type="button"
            disabled={isPending('prices', 'xlsx')}
            onClick={() => handleDownload('prices', 'xlsx')}
            className={downloadButtonClass}
          >
            {isPending('prices', 'xlsx') ? 'Descargando...' : 'Excel'}
          </button>
        </li>
      </ul>
    </div>
  );
}
