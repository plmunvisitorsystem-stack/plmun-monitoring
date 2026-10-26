/**
 * Route guards used in App.jsx.
 *
 * <ProtectedRoute roles={['lgu']} />
 *   - not logged in       -> go to /login
 *   - logged in, wrong role -> go to that user's own home page
 *   - allowed             -> show the page (<Outlet />)
 *
 * <GuestRoute />  (for /login and /register)
 *   - already logged in   -> go to that user's home page
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ROLE_HOME } from './roles';

export function ProtectedRoute({ roles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const { user } = useAuth();
  return user ? <Navigate to={ROLE_HOME[user.role] || '/login'} replace /> : <Outlet />;
}

/** For "/" and unknown URLs: home page if logged in, otherwise /login. */
export function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? ROLE_HOME[user.role] || '/login' : '/login'} replace />;
}
