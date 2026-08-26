import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import api from '../utils/axiosConfig';
import ConcursoCard from '../components/ConcursoCard';
import { IconCoin, IconTarget, IconTrophy } from '../components/icons';
import { computePremio, summarizeConcurso } from '../utils/concursoMath';

// Plotly agrega ~1.5MB gzip: separado en su propio chunk para que solo lo
// carguen los SUPERVISOR que realmente ven concursos vigentes en el Dashboard.
const ConcursosOverview = lazy(() => import('../components/ConcursosOverview'));

// VENDEDOR no tiene acceso a /pivot/campos/ (solo SUPERVISOR): sin esos
// labels del backend, usamos esta copia de solo-lectura de las dimensiones
// (ver Backend/apps/mirror/pivot.py DIMENSION_FIELDS) para que las columnas
// de su tabla no se vean como el nombre crudo del campo (ej. "vendedor_nombre").
const DIMENSION_LABEL_FALLBACK = {
  vendedor_nombre: 'Vendedor',
  proveedor: 'Proveedor',
  producto: 'Producto',
  cod_producto: 'Código de producto',
  ciudad: 'Ciudad',
  nom_cliente: 'Cliente',
  nit_cliente: 'NIT cliente',
  cod_cliente: 'Código de cliente',
  unidad_medida: 'Unidad de medida',
  tipologia_cliente: 'Tipología de cliente',
  alm: 'Almacén',
};

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-surface-muted ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <SkeletonBlock className="h-5 w-44" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-20" />
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const { theme } = useTheme();
  const [contests, setContests] = useState([]);

  const [fieldsMeta, setFieldsMeta] = useState(null);
  const [savedViews, setSavedViews] = useState([]);
  const [premioTiers, setPremioTiers] = useState([]);
  const [clientesStats, setClientesStats] = useState(null);
  // Sin esto, al entrar se alcanza a mostrar "No hay concursos vigentes"
  // (arrays todavia vacios) antes de que las peticiones resuelvan, y luego
  // el contenido real reemplaza ese mensaje de golpe. Con `loading`, se
  // muestra un esqueleto hasta que los datos de este rol efectivamente
  // llegaron (o fallaron).
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let pending;
    if (role === 'SUPERVISOR') {
      pending = Promise.allSettled([
        api.get('/mirror/ventas-detalle/pivot/campos/'),
        api.get('/mirror/ventas-detalle/pivot/vistas/'),
        // El presupuesto ya viene incluido por tabla en cada saved view
        // (PivotSavedView.presupuestos, propio de cada concurso — ver
        // ConcursoCard/ConcursosOverview), asi que aqui solo faltan los
        // tramos de premio (globales y compartidos).
        api.get('/mirror/ventas-detalle/pivot/premios/'),
        // Clientes totales / sin compra de TODOS los vendedores asignados al
        // supervisor (mismo endpoint que usa VENDEDOR, generalizado a varios
        // vendedores — ver Backend ClientesSinVentaView).
        api.get('/mirror/clientes-sin-venta/'),
      ]).then(([campos, vistas, premios, clientes]) => {
        setFieldsMeta(campos.status === 'fulfilled' ? campos.value.data : null);
        setSavedViews(vistas.status === 'fulfilled' ? vistas.value.data : []);
        setPremioTiers(premios.status === 'fulfilled' ? premios.value.data : []);
        setClientesStats(clientes.status === 'fulfilled' ? clientes.value.data : null);
      });
    } else if (role === 'VENDEDOR') {
      pending = Promise.allSettled([
        api.get('/mirror/ventas-detalle/pivot/vistas/vendedor/'),
        api.get('/mirror/ventas-detalle/pivot/premios/'),
      ]).then(([vistas, premios]) => {
        setSavedViews(vistas.status === 'fulfilled' ? vistas.value.data : []);
        setPremioTiers(premios.status === 'fulfilled' ? premios.value.data : []);
      });
    } else {
      pending = api
        .get('/contests/')
        .then(({ data }) => setContests(data))
        .catch(() => setContests([]));
    }
    pending.finally(() => setLoading(false));
  }, [role]);

  const dimensionLabel = useMemo(() => {
    if (!fieldsMeta) return DIMENSION_LABEL_FALLBACK;
    return Object.fromEntries(fieldsMeta.dimensions.map((d) => [d.field, d.label]));
  }, [fieldsMeta]);

  const numericFieldLabel = useMemo(() => {
    if (!fieldsMeta) return {};
    return Object.fromEntries(fieldsMeta.numeric_fields.map((f) => [f.field, f.label]));
  }, [fieldsMeta]);

  const concursosVigentes = savedViews.filter((v) => !v.cerrado && v.result);

  // Suma del premio ganado hasta la fecha en TODOS sus concursos vigentes
  // (el premio siempre es dinero, aunque las medidas de cada concurso sean
  // distintas — ver ConcursosOverview). null si no hay tramos de premio
  // configurados en ninguno, para no mostrar "$0" cuando en realidad no
  // aplica.
  const totalPremioVendedor =
    role === 'VENDEDOR' && premioTiers.length > 0
      ? concursosVigentes.reduce((sum, view) => {
          const { totalPremio } = summarizeConcurso(view.result, view.presupuestos || {}, premioTiers);
          return sum + (totalPremio || 0);
        }, 0)
      : null;

  // Cuanto ganaría en total si llegara al 100% de cumplimiento en cada
  // concurso que ya tiene presupuesto asignado (sin presupuesto no hay un
  // "100%" contra el cual medirse, asi que ese concurso no suma aca). El
  // premio de un tramo es un monto fijo, no proporcional a la venta: por eso
  // no depende de cuanto lleva vendido, solo de los tramos configurados.
  const potencialAl100Vendedor =
    role === 'VENDEDOR' && premioTiers.length > 0
      ? concursosVigentes.reduce((sum, view) => {
          const { cumplimiento } = summarizeConcurso(view.result, view.presupuestos || {}, premioTiers);
          if (cumplimiento == null) return sum;
          return sum + (computePremio(100, premioTiers) || 0);
        }, 0)
      : null;

  return (
    <div className="w-full flex-1 px-6 py-8 text-left sm:px-8">
      <div className="animate-fade-in-up mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent-soft via-surface to-surface p-6 shadow-soft sm:p-8">
        <p className="m-0 text-sm font-medium text-accent-500">Bienvenido de nuevo</p>
        <h1 className="m-0 mt-1 text-3xl font-semibold tracking-tight text-text-h sm:text-4xl">{user?.username}</h1>
        <p className="mt-2 text-sm text-text">
          Rol: <span className="font-medium text-text-h">{role}</span>
        </p>
      </div>

      {loading && <DashboardSkeleton />}

      {!loading && role !== 'SUPERVISOR' && role !== 'VENDEDOR' && (
        <section>
          <h2 className="mb-3 text-xl font-medium text-text-h">Concursos vigentes</h2>
          {contests.length === 0 ? (
            <p className="text-sm text-text">No hay concursos vigentes.</p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {contests.map((contest, index) => (
                <li
                  key={contest.id}
                  className="animate-fade-in-up rounded-xl border border-border bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-500">
                      <IconTrophy className="h-4 w-4" />
                    </span>
                    <h3 className="m-0 text-sm font-medium text-text-h">{contest.name}</h3>
                  </div>
                  <p className="m-0 mt-2.5 text-xs text-text">
                    {contest.start_date} → {contest.end_date}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && role === 'SUPERVISOR' && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-xl font-medium text-text-h">Concursos vigentes</h2>
            {concursosVigentes.length > 0 && (
              <span className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-500">
                {concursosVigentes.length} en curso
              </span>
            )}
          </div>
          {concursosVigentes.length === 0 ? (
            <p className="text-sm text-text">No hay concursos vigentes.</p>
          ) : (
            <>
              <Suspense fallback={null}>
                <ConcursosOverview
                  concursos={concursosVigentes}
                  premioTiers={premioTiers}
                  numericFieldLabel={numericFieldLabel}
                  theme={theme}
                  totalClientes={clientesStats?.total_clientes ?? null}
                  clientesSinCompra={clientesStats ? clientesStats.clientes.length : null}
                />
              </Suspense>
              <h3 className="m-0 mb-3 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-text uppercase">
                <IconTrophy className="h-3.5 w-3.5" />
                Detalle por concurso
              </h3>
              <div className="flex flex-col gap-3">
                {concursosVigentes.map((view, index) => (
                  <div key={view.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
                    <ConcursoCard
                      view={view}
                      presupuestos={view.presupuestos || {}}
                      premioTiers={premioTiers}
                      numericFieldLabel={numericFieldLabel}
                      rowsFieldLabels={view.result.rows_fields.map((f) => dimensionLabel[f] || f)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {!loading && role === 'VENDEDOR' && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-xl font-medium text-text-h">Mis concursos</h2>
            {concursosVigentes.length > 0 && (
              <span className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-500">
                {concursosVigentes.length} en curso
              </span>
            )}
          </div>
          {concursosVigentes.length === 0 ? (
            <p className="text-sm text-text">No estás vinculado a ningún concurso vigente.</p>
          ) : (
            <>
              {totalPremioVendedor != null && (
                <div className="animate-fade-in-up mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-gradient-to-br from-accent-soft via-surface to-surface p-5 shadow-soft">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-500">
                        <IconCoin className="h-4 w-4" />
                      </span>
                      <p className="m-0 text-xs font-medium tracking-wide text-text uppercase">
                        Dinero ganado hasta el momento
                      </p>
                    </div>
                    <p className="m-0 mt-2 text-3xl font-semibold text-accent-500">
                      ${totalPremioVendedor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="m-0 mt-1 text-xs text-text">
                      Suma del premio de tus {concursosVigentes.length} concursos vigentes.
                    </p>
                  </div>
                  {potencialAl100Vendedor != null && (
                    <div className="rounded-xl border border-border bg-surface p-5 shadow-soft">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-500">
                          <IconTarget className="h-4 w-4" />
                        </span>
                        <p className="m-0 text-xs font-medium tracking-wide text-text uppercase">Si llegas al 100%</p>
                      </div>
                      <p className="m-0 mt-2 text-3xl font-semibold text-text-h">
                        ${potencialAl100Vendedor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="m-0 mt-1 text-xs text-text">
                        Lo que ganarías si cumples el 100% del presupuesto en cada concurso.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3">
                {concursosVigentes.map((view, index) => (
                  <div key={view.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
                    <ConcursoCard
                      view={view}
                      presupuestos={view.presupuestos || {}}
                      premioTiers={premioTiers}
                      numericFieldLabel={{}}
                      rowsFieldLabels={view.result.rows_fields.map((f) => dimensionLabel[f] || f)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
