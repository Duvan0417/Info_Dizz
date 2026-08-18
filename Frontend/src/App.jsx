import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import ThemeToggle from './components/ThemeToggle';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminClosings from './pages/AdminClosings';
import ProviderExports from './pages/ProviderExports';
import VentasDetalle from './pages/VentasDetalle';
import AdminProveedores from './pages/AdminProveedores';
import Concursos from './pages/Concursos';
import ConcursosGuardados from './pages/ConcursosGuardados';

function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  return children;
}

function ChromeThemeToggle() {
  const location = useLocation();
  if (location.pathname === '/login') return null;
  return <ThemeToggle className="absolute top-4 right-4 z-10" />;
}

function App() {
  return (
    <AuthProvider>
      <div className="relative flex min-h-svh w-full flex-1 flex-col">
        <ChromeThemeToggle />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/closings"
            element={
              <ProtectedRoute allowedRoles={['SUPERVISOR', 'DIRECTOR']}>
                <AdminClosings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/provider/exports"
            element={
              <ProtectedRoute allowedRoles={['PROVEEDOR']}>
                <ProviderExports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas"
            element={
              <ProtectedRoute>
                <VentasDetalle />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/proveedores"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminProveedores />
              </ProtectedRoute>
            }
          />
          <Route
            path="/concursos"
            element={
              <ProtectedRoute allowedRoles={['SUPERVISOR']}>
                <Concursos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/concursos/guardados"
            element={
              <ProtectedRoute allowedRoles={['SUPERVISOR']}>
                <ConcursosGuardados />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
