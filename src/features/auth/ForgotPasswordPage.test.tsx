import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { changeLanguage } from '@/i18n';
import ForgotPasswordPage from './ForgotPasswordPage';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    post: mocks.post,
  },
}));

function renderRecovery() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ForgotPasswordPage recovery flow', () => {
  beforeEach(async () => {
    await changeLanguage('en');
    mocks.post.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reports an unknown account without advancing the recovery flow', async () => {
    mocks.post.mockResolvedValue({
      data: {
        ok: true,
        accountFound: false,
      },
    });
    renderRecovery();

    fireEvent.change(screen.getByLabelText('Email / Employee Number'), {
      target: { value: 'missing@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));

    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent(
      'No account found with this employee number or email.',
    );
    expect(screen.queryByText('Enter Verification Code')).not.toBeInTheDocument();
  });

  it('advances to password creation after a valid server-backed verification flow', async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: {
          ok: true,
          accountFound: true,
          hasEmail: true,
          maskedEmail: 'ad*****@hospital.sa',
          userId: 'user-admin',
          displayName: { en: 'Admin User', ar: 'مدير النظام' },
          devCode: '246810',
        },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
        },
      });
    renderRecovery();

    fireEvent.change(screen.getByLabelText('Email / Employee Number'), {
      target: { value: 'admin@hospital.sa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));

    expect(
      await screen.findByText('Your verification code:', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('246810')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '246810' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('Create New Password')).toBeInTheDocument();
    expect(mocks.post).toHaveBeenNthCalledWith(1, '/auth/forgot-password/request', {
      identifier: 'admin@hospital.sa',
    });
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/auth/forgot-password/verify', {
      identifier: 'admin@hospital.sa',
      code: '246810',
    });
  });

  it('shows safe guidance when the account has no email address on file', async () => {
    mocks.post.mockResolvedValue({
      data: {
        ok: true,
        accountFound: true,
        hasEmail: false,
        displayName: { en: 'Omar', ar: 'عمر' },
      },
    });
    renderRecovery();

    fireEvent.change(screen.getByLabelText('Email / Employee Number'), {
      target: { value: 'EMP-903' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));

    expect(await screen.findByText('No Email Registered')).toBeInTheDocument();
    expect(screen.getByText(/does not have an email address on file/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send Request to Admin' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Back to Login' }).length).toBeGreaterThan(0);
  });
});
