import { useEffect, useState } from 'react';
import api from '../utils/axiosConfig';
import PageHeader from '../components/PageHeader';

export default function AdminClosings() {
  const [closings, setClosings] = useState([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [error, setError] = useState('');

  function loadClosings() {
    api
      .get('/closings/')
      .then(({ data }) => setClosings(data))
      .catch(() => setClosings([]));
  }

  useEffect(loadClosings, []);

  async function handleFreeze(event) {
    event.preventDefault();
    setError('');
    try {
      await api.post('/closings/', { period_label: periodLabel });
      setPeriodLabel('');
      loadClosings();
    } catch {
      setError('No se pudo congelar el periodo.');
    }
  }

  return (
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <PageHeader
        title="Congelación de cierres"
        subtitle="Congela un periodo para dejar sus ventas como definitivas y evitar que sigan cambiando."
      />

      <form
        onSubmit={handleFreeze}
        className="animate-fade-in-up mb-6 flex flex-row flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3.5"
        style={{ animationDelay: '60ms' }}
      >
        <label htmlFor="period" className="flex flex-col items-start gap-1.5 text-sm text-text-h">
          Periodo (ej: 2026-08)
          <input
            id="period"
            value={periodLabel}
            onChange={(event) => setPeriodLabel(event.target.value)}
            required
            className="w-auto rounded-md border border-border bg-surface px-3 py-2 text-text-h focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-all hover:border-accent-border hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        >
          Congelar cierre
        </button>
      </form>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      {closings.length === 0 ? (
        <p className="animate-fade-in-up text-sm text-text" style={{ animationDelay: '120ms' }}>
          Aún no hay periodos congelados.
        </p>
      ) : (
        <div
          className="animate-fade-in-up w-full overflow-x-auto rounded-lg border border-border shadow-soft"
          style={{ animationDelay: '120ms' }}
        >
          <table className="w-full border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                  Periodo
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                  Congelado en
                </th>
                <th className="sticky top-0 border-b border-border bg-surface-muted px-3 py-2 text-left font-medium text-text-h">
                  Congelado por
                </th>
              </tr>
            </thead>
            <tbody>
              {closings.map((closing) => (
                <tr key={closing.id} className="transition-colors hover:bg-accent-soft">
                  <td className="border-b border-border px-3 py-2 text-left">{closing.period_label}</td>
                  <td className="border-b border-border px-3 py-2 text-left">
                    {new Date(closing.closed_at).toLocaleString()}
                  </td>
                  <td className="border-b border-border px-3 py-2 text-left">{closing.closed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
