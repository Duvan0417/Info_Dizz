import { useEffect, useMemo, useState } from 'react';
import api from '../utils/axiosConfig';
import PageHeader from '../components/PageHeader';
import { IconChevronDown } from '../components/icons';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toIso(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Offset del dia 1 del mes contra una semana que empieza en lunes
// (Date#getDay() devuelve 0 para domingo).
function mondayFirstOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/** Calendario global de dias habiles de venta, editado por ADMIN. Un dia sin
 * excepcion guardada se asume habil (ver Backend.apps.mirror.models.DiaHabil):
 * esta pantalla solo necesita mostrar y guardar las excepciones puntuales
 * (festivos, dias sin ruta, etc.), no cada dia del año uno por uno. Lo va a
 * consumir la proyeccion de cumplimiento de Concursos. */
export default function DiasHabiles() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [overrides, setOverrides] = useState({});
  const [pending, setPending] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setMessage('');
    const desde = toIso(year, month, 1);
    const hasta = toIso(year, month, daysInMonth(year, month));
    api
      .get('/mirror/dias-habiles/', { params: { desde, hasta } })
      .then(({ data }) => {
        const next = {};
        for (const item of data) next[item.fecha] = item.es_habil;
        setOverrides(next);
        setPending({});
      })
      .catch(() => setError('No se pudo cargar el calendario.'))
      .finally(() => setLoading(false));
  }, [year, month]);

  function changeMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setYear(y);
    setMonth(m);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  function isHabil(fecha) {
    if (fecha in pending) return pending[fecha];
    if (fecha in overrides) return overrides[fecha];
    return true;
  }

  function toggleDay(fecha) {
    const next = !isHabil(fecha);
    setPending((current) => {
      const updated = { ...current };
      const savedValue = fecha in overrides ? overrides[fecha] : true;
      if (next === savedValue) {
        delete updated[fecha];
      } else {
        updated[fecha] = next;
      }
      return updated;
    });
    setMessage('');
  }

  const pendingCount = Object.keys(pending).length;

  async function handleGuardar() {
    if (pendingCount === 0) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const dias = Object.entries(pending).map(([fecha, es_habil]) => ({ fecha, es_habil }));
      const { data } = await api.put('/mirror/dias-habiles/', { dias });
      setOverrides((current) => {
        const next = { ...current };
        for (const item of data) next[item.fecha] = item.es_habil;
        return next;
      });
      setPending({});
      setMessage('Cambios guardados.');
    } catch {
      setError('No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  function handleDescartar() {
    setPending({});
    setMessage('');
  }

  const celdas = useMemo(() => {
    const total = daysInMonth(year, month);
    const offset = mondayFirstOffset(year, month);
    const list = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= total; day += 1) list.push(day);
    return list;
  }, [year, month]);

  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <PageHeader
        title="Días hábiles"
        subtitle="Calendario global de días de venta: marca las excepciones (festivos, días sin ruta, etc.). Un día sin marcar se asume hábil."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            disabled={loading}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-h transition-all hover:border-accent-border hover:text-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <span className="min-w-[160px] text-center text-base font-medium text-text-h capitalize">
            {MESES[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            disabled={loading}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-h transition-all hover:border-accent-border hover:text-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconChevronDown className="h-4 w-4 -rotate-90" />
          </button>
          <button
            type="button"
            onClick={goToday}
            disabled={loading}
            className="ml-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-h transition-all hover:border-accent-border hover:text-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-text">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-accent-border bg-accent-soft" /> Hábil
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-danger bg-danger-soft" /> No hábil
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 mb-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_SEMANA.map((label) => (
            <div key={label} className="pb-1 text-center text-xs font-medium tracking-wide text-text uppercase">
              {label}
            </div>
          ))}

          {celdas.map((day, index) => {
            if (day == null) return <div key={`blank-${index}`} />;
            const fecha = toIso(year, month, day);
            const habil = isHabil(fecha);
            const isDirty = fecha in pending;
            const isToday = fecha === todayIso;
            return (
              <button
                key={fecha}
                type="button"
                onClick={() => toggleDay(fecha)}
                disabled={loading}
                title={habil ? 'Hábil — clic para marcar como no hábil' : 'No hábil — clic para marcar como hábil'}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-md border text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  habil
                    ? 'border-accent-border bg-accent-soft text-accent-500 hover:-translate-y-0.5'
                    : 'border-danger/40 bg-danger-soft text-danger hover:-translate-y-0.5'
                } ${isToday ? 'ring-2 ring-offset-1 ring-accent-500' : ''}`}
              >
                {day}
                {isDirty && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-text-h" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGuardar}
          disabled={saving || pendingCount === 0}
          className="inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-all hover:not-disabled:border-accent-border hover:not-disabled:-translate-y-0.5 active:not-disabled:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando...' : pendingCount > 0 ? `Guardar cambios (${pendingCount})` : 'Guardar cambios'}
        </button>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={handleDescartar}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1 text-[13px] font-medium text-text-h transition-all hover:border-accent-border hover:text-accent-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Descartar cambios
          </button>
        )}
        {message && <p className="m-0 text-sm text-text">{message}</p>}
      </div>
    </div>
  );
}
