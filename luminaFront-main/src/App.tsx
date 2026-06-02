import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/LoginPage/LoginPage';
import { DashboardPage } from './components/DashboardPage/DashboardPage';
import { NewReservationPage } from './components/NewReservationPage/NewReservationPage';
import { MyReservationsPage } from './components/MyReservationsPage/MyReservationsPage';
import { BadgesPage } from './components/BadgesPage/BadgesPage';
import { ProfilePage } from './components/ProfilePage/ProfilePage';
import { AdminPage } from './components/AdminPage/AdminPage';
import { AdminManagementPage } from './components/AdminPage/AdminManagementPage';
import { AdminBlocksPage } from './components/AdminPage/AdminBlocksPage';
import { GuardPage } from './components/GuardPage/GuardPage';
import { getSession, isSessionValid } from './services/tokenStore';
import { getRoleHomePath, isAdminRole, isGuardRole, normalizeRole } from './utils/roleRouting';

function ProtectedRoute({ children }: { children: JSX.Element }): JSX.Element {
  if (!isSessionValid()) return <Navigate to="/login" replace />;

  const role = getSession()?.user.role;
  if (isGuardRole(role)) return <Navigate to="/guardia" replace />;
  if (isAdminRole(role)) return <Navigate to="/admin" replace />;

  return children;
}

function RoleRoute({ children, roles }: { children: JSX.Element; roles: string[] }): JSX.Element {
  const session = getSession();
  if (!isSessionValid()) return <Navigate to="/login" replace />;

  const role = normalizeRole(session?.user.role);
  if (roles.includes(role)) return children;

  return <Navigate to={getRoleHomePath(role)} replace />;
}

function DefaultRedirect(): JSX.Element {
  if (!isSessionValid()) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleHomePath(getSession()?.user.role)} replace />;
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/nueva-reserva" element={<ProtectedRoute><NewReservationPage /></ProtectedRoute>} />
        <Route path="/mis-reservas" element={<ProtectedRoute><MyReservationsPage /></ProtectedRoute>} />
        <Route path="/logros" element={<ProtectedRoute><BadgesPage /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<RoleRoute roles={['admin', 'administrador']}><AdminPage /></RoleRoute>} />
        <Route path="/admin/gestion" element={<RoleRoute roles={['admin', 'administrador']}><AdminManagementPage /></RoleRoute>} />
        <Route path="/admin/bloqueos" element={<RoleRoute roles={['admin', 'administrador']}><AdminBlocksPage /></RoleRoute>} />
        <Route path="/guardia" element={<RoleRoute roles={['guard', 'guardia']}><GuardPage /></RoleRoute>} />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
