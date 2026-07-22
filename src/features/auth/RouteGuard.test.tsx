import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RouteGuard from './RouteGuard';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import type { AuthUser } from '@/types';
import { defaultEmployeeAccessProfile } from '@/types/employeeAccess';

const employee: AuthUser = {
  id: 'account-employee',
  name: 'Employee',
  email: '',
  role: 'employee',
  departmentId: 'dept-1',
  departmentName: 'CT',
  scheduleEmployeeId: 'roster-1',
};

function renderProtected(requiredPermission: 'schedule.own.view') {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<RouteGuard allowedRoles={['employee']} requiredPermission={requiredPermission} />}>
          <Route path="/protected" element={<p>protected content</p>} />
        </Route>
        <Route path="/403" element={<p>forbidden</p>} />
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useEmployeeAccessStore.setState({ profiles: {}, storageError: null });
  useAuthStore.setState({ user: employee, isAuthenticated: true });
});

afterEach(cleanup);

describe('RouteGuard employee permissions', () => {
  it('keeps authentication in the current tab while shared workflow data stays cross-tab', () => {
    useAuthStore.getState().login(employee, 'tab-token');
    expect(sessionStorage.getItem('token')).toBe('tab-token');
    expect(JSON.parse(sessionStorage.getItem('user') || 'null')).toMatchObject({ id: employee.id });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('allows the direct route when the effective permission is enabled', () => {
    renderProtected('schedule.own.view');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects the direct route when an employee override disables access', () => {
    const profile = defaultEmployeeAccessProfile(employee);
    useEmployeeAccessStore.setState({
      profiles: {
        [employee.id]: {
          ...profile,
          overrides: { 'schedule.own.view': false },
        },
      },
    });

    renderProtected('schedule.own.view');
    expect(screen.getByText('forbidden')).toBeInTheDocument();
  });
});
