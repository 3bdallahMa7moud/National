import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser, UserRole } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import {
  AuthenticatedLandingRedirect,
  LoginRouteGuard,
} from './AuthEntryRoutes';

function userWithRole(role: UserRole): AuthUser {
  return {
    id: `account-${role}`,
    name: role,
    email: '',
    role,
    departmentId: 'dept-1',
    departmentName: 'CT',
  };
}

function renderEntry(path: '/' | '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AuthenticatedLandingRedirect />} />
        <Route
          path="/login"
          element={<LoginRouteGuard><p>login page</p></LoginRouteGuard>}
        />
        <Route path="/admin/dashboard" element={<p>admin dashboard</p>} />
        <Route path="/employee/dashboard" element={<p>employee dashboard</p>} />
        <Route path="/403" element={<p>forbidden</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function setAuthenticatedUser(user: AuthUser) {
  useAuthStore.setState({ user, isAuthenticated: true });
}

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

afterEach(cleanup);

describe('authenticated entry routes', () => {
  it('redirects unauthenticated root access to login', () => {
    renderEntry('/');

    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it.each<UserRole>(['admin', 'super_admin'])(
    'redirects an authenticated %s from root to the admin dashboard',
    (role) => {
      setAuthenticatedUser(userWithRole(role));

      renderEntry('/');

      expect(screen.getByText('admin dashboard')).toBeInTheDocument();
    },
  );

  it('redirects an authenticated employee from root to the employee dashboard', () => {
    setAuthenticatedUser(userWithRole('employee'));

    renderEntry('/');

    expect(screen.getByText('employee dashboard')).toBeInTheDocument();
  });

  it.each([
    ['admin', 'admin dashboard'],
    ['employee', 'employee dashboard'],
  ] as const)(
    'redirects an authenticated %s away from login',
    (role, expectedDashboard) => {
      setAuthenticatedUser(userWithRole(role));

      renderEntry('/login');

      expect(screen.getByText(expectedDashboard)).toBeInTheDocument();
      expect(screen.queryByText('login page')).not.toBeInTheDocument();
    },
  );

  it.each([
    ['unknown', 'auditor'],
    ['missing', undefined],
  ] as const)(
    'redirects an authenticated user with an %s role to forbidden',
    (_label, role) => {
      setAuthenticatedUser({
        ...userWithRole('employee'),
        role,
      } as unknown as AuthUser);

      renderEntry('/');

      expect(screen.getByText('forbidden')).toBeInTheDocument();
    },
  );

  it('renders login when authentication state has no user', () => {
    useAuthStore.setState({ user: null, isAuthenticated: true });

    renderEntry('/');

    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
