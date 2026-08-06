import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/i18n';
import { mapApiEmployeeToDirectoryRecord } from '@/lib/backendAdapters';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import DepartmentsPage from './DepartmentsPage';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
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
}));

vi.mock('@/lib/backendBootstrap', () => ({
  fetchAndHydrateBootstrap: mocks.fetchAndHydrateBootstrap,
}));

const existingDepartment = {
  id: 'dept-existing',
  name: {
    en: 'Existing Department',
    ar: 'قسم حالي',
  },
  description: {
    en: 'Existing description',
    ar: 'وصف حالي',
  },
};

const managerRecord = mapApiEmployeeToDirectoryRecord({
  id: 'user-manager',
  name: {
    en: 'Noura Admin',
    ar: 'نورة',
  },
  email: 'noura.admin@hospital.sa',
  phone: '0501111111',
  role: 'admin',
  departmentId: 'dept-existing',
  departmentName: {
    en: 'Existing Department',
    ar: 'قسم حالي',
  },
  position: {
    en: 'Supervisor',
    ar: 'مشرف',
  },
  employeeNumber: 'EMP-777',
  code: 'NAD',
  isActive: true,
  createdAt: '2026-08-01',
});

function renderPage() {
  return render(
    <MemoryRouter>
      <DepartmentsPage />
    </MemoryRouter>,
  );
}

describe('DepartmentsPage', () => {
  beforeEach(async () => {
    await changeLanguage('en');
    mocks.addToast.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.fetchAndHydrateBootstrap.mockReset();
    mocks.fetchAndHydrateBootstrap.mockResolvedValue(undefined);

    useDepartmentStore.setState({
      records: [existingDepartment],
      setRecords: useDepartmentStore.getState().setRecords,
    });
    useEmployeeDirectoryStore.setState((state) => ({
      ...state,
      records: [managerRecord],
    }));
  });

  afterEach(() => {
    cleanup();
    useDepartmentStore.setState({
      records: [],
      setRecords: useDepartmentStore.getState().setRecords,
    });
    useEmployeeDirectoryStore.setState((state) => ({
      ...state,
      records: [],
    }));
  });

  it('creates a department with an empty description, refreshes bootstrap, and shows it immediately', async () => {
    mocks.post.mockResolvedValue({
      data: {
        department: {
          id: 'dept-new',
          name: { en: 'Interventional CT', ar: 'Interventional CT' },
          description: { en: '', ar: '' },
          managerId: null,
        },
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Add New Department' }));
    fireEvent.change(screen.getByLabelText('Department name'), {
      target: { value: 'Interventional CT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/departments', {
        name: 'Interventional CT',
        description: '',
        managerId: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Interventional CT')).toBeInTheDocument();
    });
    expect(mocks.fetchAndHydrateBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.addToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      message: 'Department created successfully',
    }));
  });

  it('shows a meaningful validation message instead of the generic error on failed creation', async () => {
    mocks.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid department payload.',
            details: {
              fieldErrors: {
                name: ['Department name is required.'],
              },
            },
          },
        },
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Add New Department' }));
    fireEvent.change(screen.getByLabelText('Department name'), {
      target: { value: 'Interventional CT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Department name is required.')).toBeInTheDocument();
    expect(screen.queryByText('This section failed to load properly without affecting the rest of the page.')).not.toBeInTheDocument();
  });
});
