import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminClosings from './pages/AdminClosings';
import ProviderExports from './pages/ProviderExports';
import VentasDetalle from './pages/VentasDetalle';
import AdminProveedores from './pages/AdminProveedores';
import Concursos from './pages/Concursos';
import ConcursosGuardados from './pages/ConcursosGuardados';
import ClientesSinVenta from './pages/ClientesSinVenta';

function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  return children;
}

// SUPERVISOR y ADMIN navegan con la paleta rojo/negro/blanco (.theme-noir,
// definida en index.css); el resto de roles conserva el tema por defecto. El
// login la usa siempre (ver Login.jsx: aun no se conoce el rol al mostrarla).
function AppShell() {
  const { role, isAuthenticated } = useAuth();
  const themed = role === 'SUPERVISOR' || role === 'ADMIN';

  return (
    <div className={`flex min-h-svh w-full flex-1 flex-col md:flex-row ${themed ? 'theme-noir' : ''}`}>
      {isAuthenticated && <Sidebar />}
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
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
              <ProtectedRoute allowedRoles={['PROVEEDOR', 'SUPERVISOR', 'DIRECTOR', 'ADMIN']}>
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
          <Route
            path="/clientes-sin-venta"
            element={
              <ProtectedRoute allowedRoles={['VENDEDOR', 'SUPERVISOR']}>
                <ClientesSinVenta />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
