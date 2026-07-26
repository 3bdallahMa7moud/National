import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { changeLanguage } from '@/i18n';
import type { AuthUser } from '@/types';
import LoginPage from './LoginPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  mockLogin: vi.fn(),
  syncAuthUserLocale: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (
    selector: (state: { login: typeof mocks.login }) => unknown,
  ) => selector({ login: mocks.login }),
  syncAuthUserLocale: mocks.syncAuthUserLocale,
}));

vi.mock('@/mocks/mockData', () => ({
  mockLogin: mocks.mockLogin,
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

describe('LoginPage', () => {
  beforeEach(async () => {
    await changeLanguage('en');
    mocks.login.mockReset();
    mocks.mockLogin.mockReset();
    mocks.syncAuthUserLocale.mockReset();
  });

  afterEach(cleanup);

  it('fills a demo account and signs an administrator into the admin area', async () => {
    mocks.mockLogin.mockReturnValue({
      user: adminUser,
      token: 'deterministic-test-token',
    });
    renderLogin();

    fireEvent.click(screen.getByText('EMP-003').closest('button') as HTMLButtonElement);

    expect(screen.getByLabelText('Email or Username')).toHaveValue('EMP-003');
    expect(screen.getByLabelText('Password')).toHaveValue('123456');

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Admin destination', {}, { timeout: 2000 })).toBeInTheDocument();
    expect(mocks.mockLogin).toHaveBeenCalledWith('EMP-003', '123456');
    expect(mocks.login).toHaveBeenCalledWith(adminUser, 'deterministic-test-token');
  });

  it('shows invalid-credential feedback and does not authenticate', async () => {
    mocks.mockLogin.mockReturnValue(null);
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
});
