import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import ThemeToggle from './ThemeToggle';
import {
  IconCalendar,
  IconChart,
  IconClose,
  IconDownload,
  IconHome,
  IconLock,
  IconLogout,
  IconMenu,
  IconStore,
  IconTag,
  IconTrophy,
  IconUsers,
} from './icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: IconHome, roles: null },
  { to: '/ventas', label: 'Ventas', icon: IconChart, roles: ['PROVEEDOR', 'DIRECTOR', 'ADMIN'] },
  { to: '/admin/closings', label: 'Cierres', icon: IconLock, roles: ['ADMIN'] },
  { to: '/provider/exports', label: 'Exportar planos', icon: IconDownload, roles: ['PROVEEDOR'] },
  { to: '/concursos', label: 'Concursos', icon: IconTrophy, roles: ['SUPERVISOR'] },
  { to: '/concursos/guardados', label: 'Tablas guardadas', icon: IconTag, roles: ['SUPERVISOR'] },
  { to: '/clientes-sin-venta', label: 'Clientes sin venta', icon: IconStore, roles: ['VENDEDOR', 'SUPERVISOR'] },
  { to: '/admin/proveedores', label: 'Administración', icon: IconUsers, roles: ['ADMIN'] },
  { to: '/admin/dias-habiles', label: 'Días hábiles', icon: IconCalendar, roles: ['ADMIN'] },
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-accent-soft text-accent-500'
      : 'text-text hover:bg-surface-muted hover:text-text-h'
  }`;

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-sm font-bold text-white">
        D
      </span>
      <span className="text-base font-semibold tracking-tight text-text-h">DIZFRANCO</span>
    </div>
  );
}

function NavList({ items, onNavigate }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} onClick={onNavigate} className={linkClass}>
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserCard({ user, role, logout }) {
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-text-h">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-medium text-text-h">{user?.username}</p>
          <p className="m-0 truncate text-xs text-text">{role}</p>
        </div>
        <ThemeToggle />
      </div>
      <button
        type="button"
        onClick={logout}
        className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <IconLogout />
        Cerrar sesión
      </button>
    </div>
  );
}

/** Shell de navegación persistente para usuarios autenticados: sidebar fija en
 * escritorio, drawer deslizable en móvil (el mismo contenido, distinta
 * presentación). Vive dentro del contenedor que ya aplica .theme-noir para
 * SUPERVISOR/ADMIN, así que hereda esa paleta sin lógica adicional. */
export default function Sidebar() {
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-h hover:bg-surface-muted"
        >
          <IconMenu />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-500 text-xs font-bold text-white">
            D
          </span>
          <span className="text-sm font-semibold tracking-tight text-text-h">DIZFRANCO</span>
        </div>
        <ThemeToggle />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="mr-4 flex h-8 w-8 items-center justify-center rounded-md text-text hover:bg-surface-muted md:hidden"
          >
            <IconClose />
          </button>
        </div>
        <NavList items={items} onNavigate={() => setOpen(false)} />
        <UserCard user={user} role={role} logout={logout} />
      </aside>
    </>
  );
}
