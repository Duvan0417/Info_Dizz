import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../utils/axiosConfig';

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [contests, setContests] = useState([]);

  useEffect(() => {
    if (role === 'SUPERVISOR') return;
    api
      .get('/contests/')
      .then(({ data }) => setContests(data))
      .catch(() => setContests([]));
  }, [role]);

  return (
    <div className="w-full flex-1 px-6 py-8 text-left">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pr-14 pb-6">
        <div>
          <h1 className="m-0 text-3xl font-medium tracking-tight text-text-h sm:text-4xl">
            Bienvenido, {user?.username}
          </h1>
          <p className="mt-1 text-sm text-text">
            Rol: <span className="text-text-h">{role}</span>
          </p>
        </div>
        <button
          onClick={logout}
          className="ml-auto inline-flex items-center justify-center rounded-md border-2 border-transparent bg-accent-soft px-4.5 py-2 text-[15px] font-medium text-accent-500 transition-colors hover:border-accent-border focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
        >
          Cerrar sesión
        </button>
      </header>

      <nav className="my-6 flex flex-wrap gap-3">
        <Link
          to="/ventas"
          className="rounded-md bg-accent-soft px-4 py-2 text-[15px] text-accent-500 no-underline transition-shadow hover:shadow-soft"
        >
          Ver ventas
        </Link>
        {(role === 'SUPERVISOR' || role === 'DIRECTOR') && (
          <Link
            to="/admin/closings"
            className="rounded-md bg-accent-soft px-4 py-2 text-[15px] text-accent-500 no-underline transition-shadow hover:shadow-soft"
          >
            Gestionar cierres
          </Link>
        )}
        {role === 'PROVEEDOR' && (
          <Link
            to="/provider/exports"
            className="rounded-md bg-accent-soft px-4 py-2 text-[15px] text-accent-500 no-underline transition-shadow hover:shadow-soft"
          >
            Exportar planos
          </Link>
        )}
        {role === 'ADMIN' && (
          <Link
            to="/admin/proveedores"
            className="rounded-md bg-accent-soft px-4 py-2 text-[15px] text-accent-500 no-underline transition-shadow hover:shadow-soft"
          >
            Administración
          </Link>
        )}
        {role === 'SUPERVISOR' && (
          <Link
            to="/concursos"
            className="rounded-md bg-accent-soft px-4 py-2 text-[15px] text-accent-500 no-underline transition-shadow hover:shadow-soft"
          >
            Concursos
          </Link>
        )}
      </nav>

      {role !== 'SUPERVISOR' && (
        <section>
          <h2 className="mb-3 text-xl font-medium text-text-h">Concursos vigentes</h2>
          {contests.length === 0 ? (
            <p className="text-sm text-text">No hay concursos vigentes.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {contests.map((contest) => (
                <li key={contest.id} className="rounded-md border border-border px-3.5 py-2.5 text-sm text-text-h">
                  {contest.name}{' '}
                  <span className="text-text">
                    ({contest.start_date} - {contest.end_date})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
