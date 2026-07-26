import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

function authenticatedLandingPath(role: unknown): string | null {
  if (role === 'admin' || role === 'super_admin') return '/admin/dashboard';
  if (role === 'employee') return '/employee/dashboard';
  return null;
}

export function AuthenticatedLandingRedirect() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={authenticatedLandingPath(user.role) ?? '/403'} replace />;
}

export function LoginRouteGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    return children;
  }

  return <Navigate to={authenticatedLandingPath(user.role) ?? '/403'} replace />;
}
