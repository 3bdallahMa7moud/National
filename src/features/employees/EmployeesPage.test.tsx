import { cleanup, fireEvent, render, screen, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/i18n';
import type { ApiEmployee } from '@/lib/backendAdapters';
import { mapApiEmployeeToDirectoryRecord } from '@/lib/backendAdapters';
import { useAuthStore } from '@/stores/authStore';
import {
  buildPendingEmployeeRosterId,
  EMPLOYEE_DIRECTORY_STORAGE_KEY,
  useEmployeeDirectoryStore,
} from '@/stores/employeeDirectoryStore';
import EmployeesPage from './EmployeesPage';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  fetchAndHydrateBootstrap: vi.fn(),
}));

vi.mock('@/components/ui/Toast', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/Toast')>('@/components/ui/Toast');
  return {
    ...actual,
    useToast: () => ({
      addToast: mocks.addToast,
    }),
  };
});

vi.mock('@/lib/axios', () => ({
  default: {
    post: mocks.post,
    patch: mocks.patch,
  },
  setUnauthorizedHandler: mocks.setUnauthorizedHandler,
}));

vi.mock('@/lib/backendBootstrap', () => ({
  fetchAndHydrateBootstrap: mocks.fetchAndHydrateBootstrap,
}));

function makeEmployee(overrides: Partial<ApiEmployee> & Pick<ApiEmployee, 'id' | 'name' | 'departmentId' | 'departmentName' | 'position' | 'employeeNumber' | 'code'>): ApiEmployee {
  return {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email ?? `${overrides.id}@hospital.sa`,
    phone: overrides.phone ?? '0501000000',
    role: overrides.role ?? 'employee',
    departmentId: overrides.departmentId,
    departmentName: overrides.departmentName,
    position: overrides.position,
    employeeNumber: overrides.employeeNumber,
    code: overrides.code,
    avatar: overrides.avatar ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? '2026-08-08',
    scheduleEmployeeId: overrides.scheduleEmployeeId === undefined ? `sched-${overrides.id}` : overrides.scheduleEmployeeId,
  };
}

function renderPage(entry = '/admin/employees') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <EmployeesPage />
    </MemoryRouter>,
  );
}

function getEmployeeTable() {
  return screen.getByRole('table');
}

function getTableRowByName(name: string) {
  const row = within(getEmployeeTable()).getByText(name).closest('tr');
  expect(row).not.toBeNull();
  return row as HTMLTableRowElement;
}

describe('EmployeesPage', () => {
  let serverEmployees: ApiEmployee[];

  const syncDirectoryFromServer = () => {
    useEmployeeDirectoryStore.getState().replaceRecords(
      serverEmployees.map((employee) => mapApiEmployeeToDirectoryRecord(employee)),
      ['backend-bootstrap'],
    );
  };

  beforeEach(async () => {
    await changeLanguage('en');
    mocks.addToast.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.fetchAndHydrateBootstrap.mockReset();

    window.localStorage.removeItem(EMPLOYEE_DIRECTORY_STORAGE_KEY);
    window.sessionStorage.clear();

    useAuthStore.setState((state) => ({
      ...state,
      user: {
        id: 'viewer-super-admin',
        name: 'Dr. Ishraq',
        email: 'admin@hospital.sa',
        role: 'super_admin',
        departmentId: 'dept-ct',
        departmentName: 'CT Department',
      },
      isAuthenticated: true,
    }));

    serverEmployees = [
      makeEmployee({
        id: 'emp-ali',
        name: { en: 'Ali CT', ar: 'علي' },
        departmentId: 'dept-ct',
        departmentName: { en: 'CT Department', ar: 'قسم الأشعة المقطعية' },
        position: { en: 'CT Technologist', ar: 'فني أشعة مقطعية' },
        employeeNumber: 'EMP-001',
        code: 'ALI',
      }),
      makeEmployee({
        id: 'emp-sara',
        name: { en: 'Sara CT', ar: 'سارة' },
        departmentId: 'dept-ct',
        departmentName: { en: 'CT Department', ar: 'قسم الأشعة المقطعية' },
        position: { en: 'CT Technologist', ar: 'فني أشعة مقطعية' },
        employeeNumber: 'EMP-002',
        code: 'SAR',
      }),
      makeEmployee({
        id: 'emp-mina',
        name: { en: 'Mina MRI', ar: 'مينا' },
        departmentId: 'dept-mri',
        departmentName: { en: 'MRI Department', ar: 'قسم الرنين' },
        position: { en: 'MRI Technologist', ar: 'فني رنين' },
        employeeNumber: 'EMP-003',
        code: 'MIN',
      }),
    ];

    mocks.fetchAndHydrateBootstrap.mockImplementation(async () => {
      syncDirectoryFromServer();
      return undefined;
    });

    mocks.post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url === '/employees') {
        serverEmployees = [
          ...serverEmployees,
          makeEmployee({
            id: 'emp-jad',
            name: { en: String(body.name), ar: String(body.name) },
            email: String(body.email),
            phone: String(body.phone ?? ''),
            role: (body.role as ApiEmployee['role']) ?? 'employee',
            departmentId: String(body.departmentId ?? 'dept-ct'),
            departmentName: { en: 'CT Department', ar: 'قسم الأشعة المقطعية' },
            position: { en: String(body.position), ar: String(body.position) },
            employeeNumber: String(body.employeeNumber),
            code: String(body.code),
          }),
        ];
        return { data: { employee: serverEmployees[serverEmployees.length - 1], defaultPassword: '123456' } };
      }
      if (url.endsWith('/reset-password')) {
        return { data: { ok: true } };
      }
      throw new Error(`Unhandled POST ${url}`);
    });

    mocks.patch.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      const employeeId = url.split('/')[2];
      serverEmployees = serverEmployees.map((employee) => {
        if (employee.id !== employeeId) return employee;
        return {
          ...employee,
          name: body.name ? { en: String(body.name), ar: String(body.name) } : employee.name,
          email: body.email === undefined ? employee.email : String(body.email),
          role: body.role ? body.role as ApiEmployee['role'] : employee.role,
          employeeNumber: body.employeeNumber ? String(body.employeeNumber) : employee.employeeNumber,
          code: body.code ? String(body.code) : employee.code,
          isActive: body.active === undefined ? employee.isActive : Boolean(body.active),
          position: body.position
            ? { en: String(body.position), ar: String(body.position) }
            : employee.position,
        };
      });
      return {
        data: {
          employee: serverEmployees.find((employee) => employee.id === employeeId),
        },
      };
    });

    syncDirectoryFromServer();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(EMPLOYEE_DIRECTORY_STORAGE_KEY);
    window.sessionStorage.clear();
    useAuthStore.setState((state) => ({
      ...state,
      user: null,
      isAuthenticated: false,
    }));
    useEmployeeDirectoryStore.setState((state) => ({
      ...state,
      records: [],
      storageError: null,
    }));
  });

  it('shows the full authoritative employee count on initial load and keeps it stable across focus refresh and navigation back', async () => {
    const view = renderPage();

    expect(screen.getByText('3 employees in department')).toBeInTheDocument();
    expect(within(getEmployeeTable()).getByText('Ali CT')).toBeInTheDocument();
    expect(within(getEmployeeTable()).getByText('Sara CT')).toBeInTheDocument();
    expect(within(getEmployeeTable()).getByText('Mina MRI')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByText('3 employees in department')).toBeInTheDocument();
    });
    expect(within(getEmployeeTable()).getByText('Ali CT')).toBeInTheDocument();

    view.unmount();
    renderPage();

    expect(screen.getByText('3 employees in department')).toBeInTheDocument();
    expect(within(getEmployeeTable()).getByText('Mina MRI')).toBeInTheDocument();
  });

  it('filters by department consistently on initial load and after navigation back', () => {
    const view = renderPage('/admin/employees?departmentId=dept-ct');

    expect(screen.getByText('2 employees in department')).toBeInTheDocument();
    expect(within(getEmployeeTable()).getByText('Ali CT')).toBeInTheDocument();
    expect(within(getEmployeeTable()).getByText('Sara CT')).toBeInTheDocument();
    expect(within(getEmployeeTable()).queryByText('Mina MRI')).not.toBeInTheDocument();

    view.unmount();
    renderPage('/admin/employees?departmentId=dept-ct');

    expect(screen.getByText('2 employees in department')).toBeInTheDocument();
    expect(within(getEmployeeTable()).queryByText('Mina MRI')).not.toBeInTheDocument();
  });

  it('adds a new employee and refreshes the list from backend state', async () => {
    renderPage('/admin/employees?departmentId=dept-ct');

    fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Employee' });

    fireEvent.change(within(dialog).getByLabelText('Employee Name'), { target: { value: 'Jad CT' } });
    fireEvent.change(within(dialog).getByLabelText('Badge Number (BN)'), { target: { value: 'EMP-010' } });
    fireEvent.change(within(dialog).getByLabelText('Abbreviation (Code)'), { target: { value: 'JAD' } });

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Add Employee' })[0]);

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/employees', expect.objectContaining({
        name: 'Jad CT',
        employeeNumber: 'EMP-010',
        departmentId: 'dept-ct',
      }));
    });
    await waitFor(() => {
      expect(screen.getByText('3 employees in department')).toBeInTheDocument();
    });
    expect(within(getEmployeeTable()).getByText('Jad CT')).toBeInTheDocument();
    expect(mocks.fetchAndHydrateBootstrap).toHaveBeenCalledTimes(1);
  });

  it('updates employee edits, deactivation, and role changes through backend refreshes', async () => {
    renderPage('/admin/employees?departmentId=dept-ct');

    const aliRow = getTableRowByName('Ali CT');
    fireEvent.click(within(aliRow).getByRole('button', { name: 'Edit employee Ali CT' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit Employee' });
    const nameInputs = within(dialog).getAllByLabelText('Employee Name');
    fireEvent.change(nameInputs[0], { target: { value: 'Ali Updated' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith('/employees/emp-ali', expect.objectContaining({
        name: 'Ali Updated',
      }));
    });
    await waitFor(() => {
      expect(within(getEmployeeTable()).getByText('Ali Updated')).toBeInTheDocument();
    });

    const saraRow = getTableRowByName('Sara CT');
    const saraRoleSelect = within(saraRow).getByRole('combobox');
    fireEvent.change(saraRoleSelect, { target: { value: 'admin' } });

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith('/employees/emp-sara', { role: 'admin' });
    });
    await waitFor(() => {
      expect(within(getTableRowByName('Sara CT')).getByRole('combobox')).toHaveValue('admin');
    });

    const updatedAliRow = getTableRowByName('Ali Updated');
    fireEvent.click(within(updatedAliRow).getByRole('button', { name: 'Delete employee Ali Updated' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith('/employees/emp-ali', { active: false });
    });
    await waitFor(() => {
      expect(within(getEmployeeTable()).queryByText('Ali Updated')).not.toBeInTheDocument();
    });
    expect(screen.getByText('1 employees in department')).toBeInTheDocument();
    expect(mocks.fetchAndHydrateBootstrap).toHaveBeenCalledTimes(3);
  });

  it('shows super admins as active staff but does not offer role changes or deletion for them', () => {
    serverEmployees = [
      makeEmployee({
        id: 'emp-root',
        name: { en: 'Root Admin', ar: 'Root Admin' },
        role: 'super_admin',
        departmentId: 'dept-ct',
        departmentName: { en: 'CT Department', ar: 'CT Department' },
        position: { en: 'Department Head', ar: 'Department Head' },
        employeeNumber: 'EMP-000',
        code: 'SUP',
        scheduleEmployeeId: 'sched-root-admin',
      }),
      makeEmployee({
        id: 'emp-ali',
        name: { en: 'Ali CT', ar: 'Ali CT' },
        departmentId: 'dept-ct',
        departmentName: { en: 'CT Department', ar: 'CT Department' },
        position: { en: 'CT Technologist', ar: 'CT Technologist' },
        employeeNumber: 'EMP-001',
        code: 'ALI',
      }),
    ];
    syncDirectoryFromServer();

    renderPage('/admin/employees?departmentId=dept-ct');

    expect(screen.getByText('2 employees in department')).toBeInTheDocument();
    const superAdminRow = getTableRowByName('Root Admin');
    expect(within(superAdminRow).queryByRole('button', { name: 'Delete employee Root Admin' })).not.toBeInTheDocument();
    expect(within(superAdminRow).queryByRole('combobox')).not.toBeInTheDocument();

    const aliRow = getTableRowByName('Ali CT');
    expect(within(aliRow).getByRole('button', { name: 'Delete employee Ali CT' })).toBeInTheDocument();
    expect(within(aliRow).getByRole('combobox')).toBeInTheDocument();
  });

  it('offers backend-derived pending roster links and hides roster links already owned by another account', async () => {
    serverEmployees = [
      makeEmployee({
        id: 'emp-ali',
        name: { en: 'Ali CT', ar: 'علي' },
        departmentId: 'dept-ct',
        departmentName: { en: 'CT Department', ar: 'قسم الأشعة المقطعية' },
        position: { en: 'CT Technologist', ar: 'فني أشعة مقطعية' },
        employeeNumber: 'EMP-001',
        code: 'ALI',
        scheduleEmployeeId: 'emp-m-1',
      }),
      makeEmployee({
        id: 'emp-sara',
        name: { en: 'Sara CT', ar: 'سارة' },
        departmentId: 'dept-ct',
        departmentName: { en: 'CT Department', ar: 'قسم الأشعة المقطعية' },
        position: { en: 'CT Technologist', ar: 'فني أشعة مقطعية' },
        employeeNumber: 'EMP-002',
        code: 'SAR',
        scheduleEmployeeId: null,
      }),
    ];
    syncDirectoryFromServer();

    renderPage('/admin/employees?departmentId=dept-ct');

    const saraRow = getTableRowByName('Sara CT');
    fireEvent.click(within(saraRow).getByRole('button', { name: 'Employee access' }));

    const dialog = await screen.findByRole('dialog', { name: 'Employee access' });
    const rosterSelect = await within(dialog).findByRole('combobox', { name: 'Official schedule employee' }) as HTMLSelectElement;
    const options = Array.from(rosterSelect.options).map((option) => ({
      value: option.value,
      label: option.textContent || '',
    }));

    expect(options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: buildPendingEmployeeRosterId('emp-sara') }),
    ]));
    expect(options.some((option) => option.value === 'emp-m-1')).toBe(false);
    expect(options.some((option) => option.value === 'emp-m-2')).toBe(false);
    expect(options.some((option) => option.value === buildPendingEmployeeRosterId('emp-ali'))).toBe(false);
  });
});
