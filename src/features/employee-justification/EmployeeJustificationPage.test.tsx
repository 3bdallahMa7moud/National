import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToastProvider from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY } from '@/lib/employeeJustificationDrafts';
import type { AuthUser } from '@/types';
import { DEFAULT_JUSTIFICATION_STATE } from '@/types/employeeJustification';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { OfficialEmployee } from '@/types/officialEmployee';
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

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function sourceEmployee(overrides: Partial<OfficialEmployee> = {}): OfficialEmployee {
  return {
    employeeId: 'late-source-employee',
    employeeNumber: 'BN-001',
    code: 'ESHRA',
    fullName: 'Ahmed One',
    fullNameEn: 'Ahmed One',
    origin: 'directory',
    ...overrides,
  };
}

function otRow(employeeId = 'late-source-employee'): OTShiftRow {
  return {
    id: 'row-ot-1',
    title: 'Late shift',
    location: 'CT',
    timeRange: '17:00 - 21:00',
    hours: 4,
    assignments: {
      1: [{ kind: 'employee', employeeId }],
    },
  };
}

function readPersistedMonthRows(monthKey: string) {
  const persisted = JSON.parse(localStorage.getItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY) || '{}');
  return persisted.reportsByMonth?.[monthKey]?.rows ?? [];
}

describe('EmployeeJustificationPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useEmployeeRosterStore.setState({ employees: [] });
    useLateScheduleStore.setState({
      rowsByMonth: {},
      publishedRowsByMonth: {},
    });
    useScheduleMatrixStore.setState({
      data: null,
      matricesByMonth: {},
    });
    exporterMock.exportJustificationToDocx.mockReset();
    exporterMock.exportJustificationToDocx.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    vi.restoreAllMocks();
  });

  it('refreshes generated employee BN when roster data arrives after the first render', async () => {
    const monthKey = currentMonthKey();
    setAuthUser(adminUser);
    act(() => {
      useLateScheduleStore.setState({
        rowsByMonth: { [monthKey]: [otRow()] },
        publishedRowsByMonth: {},
      });
      useEmployeeRosterStore.setState({ employees: [] });
    });

    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(await screen.findByDisplayValue('late-')).toBeInTheDocument();

    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee({ employeeNumber: 'BN-777' })] });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('BN-777')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('late-')).not.toBeInTheDocument();
    expect(localStorage.getItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('persists deleted generated employees so they do not return after remount', async () => {
    const monthKey = currentMonthKey();
    setAuthUser(adminUser);
    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee()] });
      useLateScheduleStore.setState({
        rowsByMonth: { [monthKey]: [otRow()] },
        publishedRowsByMonth: {},
      });
    });

    const view = render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(await screen.findByDisplayValue('BN-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Employee Roster|tabs\.employees/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete|row\.delete/i }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue('BN-001')).not.toBeInTheDocument();
    });

    view.unmount();
    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(screen.queryByDisplayValue('BN-001')).not.toBeInTheDocument();
    const persisted = JSON.parse(localStorage.getItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY) || '{}');
    expect(persisted.reportsByMonth[monthKey].rows).toHaveLength(0);
  });

  it('persists manual BN edits and does not overwrite them with later roster changes', async () => {
    const monthKey = currentMonthKey();
    setAuthUser(adminUser);
    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee()] });
      useLateScheduleStore.setState({
        rowsByMonth: { [monthKey]: [otRow()] },
        publishedRowsByMonth: {},
      });
    });

    const view = render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    fireEvent.change(await screen.findByDisplayValue('BN-001'), {
      target: { value: 'BN-MANUAL' },
    });
    expect(screen.getByDisplayValue('BN-MANUAL')).toBeInTheDocument();

    view.unmount();
    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(await screen.findByDisplayValue('BN-MANUAL')).toBeInTheDocument();

    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee({ employeeNumber: 'BN-777' })] });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('BN-MANUAL')).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue('BN-777')).not.toBeInTheDocument();
  });

  it('replaces saved linked hours with the employee overtime hours from source data', async () => {
    const monthKey = currentMonthKey();
    setAuthUser(adminUser);
    localStorage.setItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY, JSON.stringify({
      version: 1,
      reportsByMonth: {
        [monthKey]: {
          ...DEFAULT_JUSTIFICATION_STATE,
          month: 'AUG 2026',
          numberOfStaff: '1',
          rows: [{
            id: 'row-linked-hours',
            employeeId: 'late-source-employee',
            bn: 'BN-001',
            manualBn: false,
            name: 'Ahmed One',
            manualName: false,
            branch: 'General',
            totalShifts: 9,
            claimedHours: 99,
          }],
        },
      },
    }));

    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee()] });
      useLateScheduleStore.setState({
        rowsByMonth: { [monthKey]: [otRow()] },
        publishedRowsByMonth: {},
      });
    });

    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(readPersistedMonthRows(monthKey)[0]).toMatchObject({
        employeeId: 'late-source-employee',
        totalShifts: 1,
        claimedHours: 4,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /Employee Roster|tabs\.employees/i }));
    expect(await screen.findByText(/1 shifts · 4h/i)).toBeInTheDocument();
    expect(screen.queryByText(/9 shifts · 99h/i)).not.toBeInTheDocument();
  });

  it('keeps linked employee hours synced when the overtime source hours change later', async () => {
    const monthKey = currentMonthKey();
    setAuthUser(adminUser);
    localStorage.setItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY, JSON.stringify({
      version: 1,
      reportsByMonth: {
        [monthKey]: {
          ...DEFAULT_JUSTIFICATION_STATE,
          month: 'AUG 2026',
          numberOfStaff: '1',
          rows: [{
            id: 'row-linked-live-sync',
            employeeId: 'late-source-employee',
            bn: 'BN-001',
            manualBn: false,
            name: 'Ahmed One',
            manualName: false,
            branch: 'General',
            totalShifts: 1,
            claimedHours: 4,
          }],
        },
      },
    }));

    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee()] });
      useLateScheduleStore.setState({
        rowsByMonth: { [monthKey]: [otRow()] },
        publishedRowsByMonth: {},
      });
    });

    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Employee Roster|tabs\.employees/i }));
    expect(await screen.findByText(/1 shifts · 4h/i)).toBeInTheDocument();

    act(() => {
      useLateScheduleStore.setState({
        rowsByMonth: {
          [monthKey]: [{
            ...otRow(),
            hours: 7.5,
            timeRange: '17:00 - 00:30',
          }],
        },
        publishedRowsByMonth: {},
      });
    });

    await waitFor(() => {
      expect(readPersistedMonthRows(monthKey)[0]).toMatchObject({
        employeeId: 'late-source-employee',
        totalShifts: 1,
        claimedHours: 7.5,
      });
    });

    expect(await screen.findByText(/1 shifts · 7.5h/i)).toBeInTheDocument();
  });

  it('relinks legacy saved rows by employee name and applies BN changes from Employees', async () => {
    const monthKey = currentMonthKey();
    setAuthUser(adminUser);
    localStorage.setItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY, JSON.stringify({
      version: 1,
      reportsByMonth: {
        [monthKey]: {
          ...DEFAULT_JUSTIFICATION_STATE,
          month: 'AUG 2026',
          numberOfStaff: '1',
          rows: [{
            id: 'row-legacy',
            bn: 'ESHRA',
            name: 'Ahmed One',
            branch: 'General',
            totalShifts: 1,
            claimedHours: 4,
          }],
        },
      },
    }));
    act(() => {
      useEmployeeRosterStore.setState({ employees: [sourceEmployee({ employeeNumber: '5555555' })] });
    });

    render(
      <ToastProvider>
        <EmployeeJustificationPage />
      </ToastProvider>,
    );

    expect(await screen.findByDisplayValue('5555555')).toBeInTheDocument();
    const persisted = JSON.parse(localStorage.getItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY) || '{}');
    expect(persisted.reportsByMonth[monthKey].rows[0]).toMatchObject({
      employeeId: 'late-source-employee',
      bn: '5555555',
    });
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
