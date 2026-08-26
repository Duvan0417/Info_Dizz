import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import PasswordInput from '../components/PasswordInput';
import ThemeToggle from '../components/ThemeToggle';

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    </svg>
  );
}

const fieldClass =
  'w-full box-border rounded-xl border border-border bg-surface-muted py-3.5 pr-10 pl-11 text-base text-text-h placeholder-text/50 outline-none transition-colors focus:border-accent-500 focus:bg-surface focus:ring-2 focus:ring-accent-500/30';

// El login siempre usa la paleta rojo/negro/blanco (.theme-noir): el rol
// todavia no se conoce en este punto, asi que no puede scoparse por rol como
// el resto del Dashboard/Concursos/Administracion.
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      if (!err.response) {
        setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      } else if (err.response.status === 401) {
        setError('Usuario o contrasena incorrectos.');
      } else {
        setError(err.response.data?.detail || 'Ocurrio un error al iniciar sesion.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="theme-noir relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-6 py-12">
      <ThemeToggle className="absolute top-4 right-4 z-10" />
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-accent-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-16 -bottom-32 h-96 w-96 rounded-full bg-accent-600/15 blur-[100px]" />

      <div className="animate-fade-in-up relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-border bg-surface shadow-2xl md:min-h-[600px] md:grid-cols-2">
        <div className="relative m-3 hidden overflow-hidden rounded-2xl bg-gradient-to-br from-accent-600 via-black to-black p-8 md:flex md:flex-col md:justify-end">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_60%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3.5 py-2 text-sm font-medium text-white backdrop-blur">
              DIZFRANCO
            </span>
            <p className="mt-3 max-w-xs text-base text-white/70">Gestión de ventas, cierres y proveedores.</p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-6 p-10 sm:p-14">
          <div>
            <h1 className="m-0 text-3xl font-semibold text-text-h">Bienvenido de nuevo</h1>
            <p className="mt-2 text-base text-text">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-4 text-text/70">
                <UserIcon />
              </span>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                aria-label="Usuario"
                placeholder="Usuario"
                required
                className={fieldClass}
              />
            </div>

            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-4 z-10 text-text/70">
                <LockIcon />
              </span>
              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-label="Contraseña"
                placeholder="Contraseña"
                required
                inputClassName={`${fieldClass} pr-9`}
              />
            </div>

            {error && (
              <p role="alert" className="m-0 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-accent-500 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent-500/20 transition-all hover:not-disabled:bg-accent-600 hover:not-disabled:-translate-y-0.5 active:not-disabled:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-1 text-center text-xs text-text">¿No tienes acceso? Contacta a tu administrador.</p>
        </div>
      </div>
    </div>
  );
}
