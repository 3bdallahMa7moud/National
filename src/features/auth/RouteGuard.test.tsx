import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RouteGuard from './RouteGuard';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import type { AuthUser } from '@/types';

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
  useEmployeeAccessStore.setState({ profiles: {}, storageError: null });
  useAuthStore.setState({ user: employee, isAuthenticated: true });
});

afterEach(cleanup);

describe('RouteGuard employee permissions', () => {
  it('allows the direct route when the effective permission is enabled', () => {
    renderProtected('schedule.own.view');
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects the direct route when an employee override disables access', () => {
    localStorage.setItem('token', 'admin-test-token');
    localStorage.setItem('user', JSON.stringify({ ...employee, role: 'admin' }));
    useEmployeeAccessStore.getState().ensureProfile({
      accountId: employee.id,
      name: employee.name,
      departmentId: employee.departmentId,
      scheduleEmployeeId: employee.scheduleEmployeeId,
    });
    useEmployeeAccessStore.getState().setOverride(employee.id, 'schedule.own.view', false);
    localStorage.setItem('user', JSON.stringify(employee));

    renderProtected('schedule.own.view');
    expect(screen.getByText('forbidden')).toBeInTheDocument();
  });
});
