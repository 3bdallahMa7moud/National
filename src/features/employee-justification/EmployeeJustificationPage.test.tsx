import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToastProvider from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types';
import EmployeeJustificationPage from './EmployeeJustificationPage';

const exporterMock = vi.hoisted(() => ({
  onLoad: vi.fn(),
  exportJustificationToDocx: vi.fn(),
}));

vi.mock('@/lib/justificationDocxExport', () => {
  exporterMock.onLoad();
  return {
    exportJustificationToDocx: exporterMock.exportJustificationToDocx,
  };
});

const HOOK_DIAGNOSTIC =
  /Rendered more hooks|Rendered fewer hooks|change in the order of Hooks/i;

const adminUser: AuthUser = {
  id: 'admin-1',
  name: 'Admin One',
  email: 'admin@example.com',
  role: 'admin',
  departmentId: 'dept-1',
  departmentName: 'CT',
};

const employeeUser: AuthUser = {
  ...adminUser,
  id: 'employee-1',
  name: 'Employee One',
  email: 'employee@example.com',
  role: 'employee',
};

function setAuthUser(user: AuthUser | null) {
  act(() => {
    useAuthStore.setState({
      user,
      isAuthenticated: user !== null,
    });
  });
}

describe('EmployeeJustificationPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    exporterMock.exportJustificationToDocx.mockReset();
    exporterMock.exportJustificationToDocx.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.restoreAllMocks();
  });

  it('safely mounts and removes content across auth and role transitions', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { container } = render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(container.querySelector('header')).not.toBeInTheDocument();

    expect(() => setAuthUser(adminUser)).not.toThrow();
    expect(container.querySelector('header')).toBeInTheDocument();

    expect(() => setAuthUser(null)).not.toThrow();
    expect(container.querySelector('header')).not.toBeInTheDocument();

    expect(() => setAuthUser(adminUser)).not.toThrow();
    expect(container.querySelector('header')).toBeInTheDocument();

    expect(() => setAuthUser(employeeUser)).not.toThrow();
    expect(container.querySelector('header')).not.toBeInTheDocument();

    expect(() => setAuthUser(adminUser)).not.toThrow();
    expect(container.querySelector('header')).toBeInTheDocument();

    const diagnostics = [...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map(String)
      .filter((message) => HOOK_DIAGNOSTIC.test(message));

    expect(diagnostics).toEqual([]);
  });

  it('loads and invokes the DOCX exporter only after export is requested', async () => {
    setAuthUser(adminUser);

    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(exporterMock.onLoad).not.toHaveBeenCalled();
    expect(exporterMock.exportJustificationToDocx).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /exportDocx|Export Word/i }),
    );

    await waitFor(() => {
      expect(exporterMock.onLoad).toHaveBeenCalledTimes(1);
      expect(exporterMock.exportJustificationToDocx).toHaveBeenCalledTimes(1);
    });

    expect(exporterMock.exportJustificationToDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        departmentName: 'MEDICAL IMAGING DEPARTMENT',
        rows: expect.any(Array),
      }),
    );
  });

  it('preserves export failure feedback from the deferred exporter', async () => {
    const exportError = new Error('DOCX generation failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exporterMock.exportJustificationToDocx.mockRejectedValue(exportError);
    setAuthUser(adminUser);

    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /exportDocx|Export Word/i }),
    );

    expect(
      await screen.findByText(/Failed to export the document/i),
    ).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith('Failed to export docx:', exportError);
  });
});
