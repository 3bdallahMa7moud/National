import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { changeLanguage } from '@/i18n';
import type { AuthUser } from '@/types';
import LoginPage from './LoginPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  post: vi.fn(),
  fetchAndHydrateBootstrap: vi.fn(),
  syncAuthUserLocale: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (
    selector: (state: { login: typeof mocks.login }) => unknown,
  ) => selector({ login: mocks.login }),
  syncAuthUserLocale: mocks.syncAuthUserLocale,
}));

vi.mock('@/lib/axios', () => ({
  default: {
    post: mocks.post,
  },
}));

vi.mock('@/lib/backendBootstrap', () => ({
  fetchAndHydrateBootstrap: mocks.fetchAndHydrateBootstrap,
}));

const adminUser: AuthUser = {
  id: 'admin-test',
  name: 'Admin Test',
  email: 'admin@example.com',
  role: 'admin',
  departmentId: 'dept-1',
  departmentName: 'CT',
};

function renderLogin() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<p>Recovery destination</p>} />
          <Route path="/admin/dashboard" element={<p>Admin destination</p>} />
          <Route path="/employee/dashboard" element={<p>Employee destination</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LoginPage', () => {
  beforeEach(async () => {
    await changeLanguage('en');
    mocks.login.mockReset();
    mocks.post.mockReset();
    mocks.fetchAndHydrateBootstrap.mockReset();
    mocks.syncAuthUserLocale.mockReset();
  });

  afterEach(cleanup);

  it('fills a demo account and signs an administrator into the admin area', async () => {
    mocks.post.mockResolvedValue({
      data: {
        user: {
          id: adminUser.id,
          employeeNumber: 'EMP-003',
          code: 'ADM',
          role: 'admin',
          email: adminUser.email,
          phone: '0500000000',
          isActive: true,
          name: { en: adminUser.name, ar: 'مشرف' },
          department: { id: adminUser.departmentId, name: { en: adminUser.departmentName, ar: 'القسم' } },
          position: { en: 'Admin', ar: 'مشرف' },
          access: null,
        },
      },
    });
    mocks.fetchAndHydrateBootstrap.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.click(screen.getByText('EMP-003').closest('button') as HTMLButtonElement);

    expect(screen.getByLabelText('Email or Username')).toHaveValue('EMP-003');
    expect(screen.getByLabelText('Password')).toHaveValue('123456');

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Admin destination', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith('/auth/login', { identifier: 'EMP-003', password: '123456' });
    expect(mocks.fetchAndHydrateBootstrap).toHaveBeenCalledTimes(1);
    expect(mocks.login).toHaveBeenCalledWith(expect.objectContaining(adminUser));
  });

  it('navigates immediately after login without waiting for bootstrap hydration to finish', async () => {
    const bootstrap = deferred<void>();
    mocks.post.mockResolvedValue({
      data: {
        user: {
          id: adminUser.id,
          employeeNumber: 'EMP-003',
          code: 'ADM',
          role: 'admin',
          email: adminUser.email,
          phone: '0500000000',
          isActive: true,
          name: { en: adminUser.name, ar: 'مشرف' },
          department: { id: adminUser.departmentId, name: { en: adminUser.departmentName, ar: 'القسم' } },
          position: { en: 'Admin', ar: 'مشرف' },
          access: null,
        },
      },
    });
    mocks.fetchAndHydrateBootstrap.mockReturnValue(bootstrap.promise);
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email or Username'), {
      target: { value: 'EMP-003' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Admin destination', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(mocks.fetchAndHydrateBootstrap).toHaveBeenCalledTimes(1);

    bootstrap.resolve();
  });

  it('shows invalid-credential feedback and does not authenticate', async () => {
    mocks.post.mockRejectedValue(new Error('Invalid credentials'));
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email or Username'), {
      target: { value: 'unknown-user' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(
      await screen.findByText(
        'Invalid email/username or password',
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows the verification-required message for unverified accounts', async () => {
    mocks.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          error: {
            code: 'EMAIL_VERIFICATION_REQUIRED',
          },
        },
      },
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email or Username'), {
      target: { value: 'new.employee@hospital.sa' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'setup-pass-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(
      await screen.findByText(
        'You must verify your email before signing in.',
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('supports password disclosure and the recovery navigation', () => {
    renderLogin();

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forgot Password?' }));
    expect(screen.getByText('Recovery destination')).toBeInTheDocument();
  });

  it('does not show a public registration link', () => {
    renderLogin();
    expect(screen.queryByRole('link', { name: 'Create account' })).not.toBeInTheDocument();
  });
});
