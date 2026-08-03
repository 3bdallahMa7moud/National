import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { changeLanguage } from '@/i18n';
import RegisterPage from './RegisterPage';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: mocks.get,
    post: mocks.post,
  },
}));

function renderRegister(initialEntries: string[] = ['/register']) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<p>Login destination</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

async function fillRegistrationForm() {
  fireEvent.change(screen.getByLabelText('Full name'), {
    target: { value: 'Noura Signup' },
  });
  fireEvent.change(screen.getByLabelText('Institutional email'), {
    target: { value: 'noura.signup@hospital.sa' },
  });
  fireEvent.change(screen.getByLabelText('Employee number'), {
    target: { value: 'EMP-950' },
  });
  fireEvent.change(screen.getByLabelText('Mobile number'), {
    target: { value: '0501555555' },
  });
  fireEvent.change(screen.getByLabelText('Job title'), {
    target: { value: 'Technologist' },
  });
  fireEvent.change(screen.getByLabelText('Department'), {
    target: { value: 'dept-test-1' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'signup-pass-123' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'signup-pass-123' },
  });
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

describe('RegisterPage', () => {
  beforeEach(async () => {
    await changeLanguage('en');
    window.sessionStorage.clear();
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.get.mockResolvedValue({
      data: {
        departments: [
          {
            id: 'dept-test-1',
            name: {
              en: 'CT Testing Department',
              ar: 'قسم الاختبار',
            },
          },
        ],
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('loads departments, submits registration, and transitions to the OTP step with a disabled pending button', async () => {
    const request = deferred<{
      data: {
        ok: true;
        verificationRequired: true;
        maskedEmail: string;
        resendCooldownSeconds: number;
        expiresInMinutes: number;
        devCode: string;
        userId: string;
      };
    }>();

    mocks.post.mockReturnValueOnce(request.promise);
    renderRegister();

    expect(await screen.findByRole('option', { name: 'CT Testing Department' })).toBeInTheDocument();
    expect(screen.getByLabelText('Department')).toBeEnabled();
    await fillRegistrationForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create account & send code' }));

    expect(screen.getByRole('button', { name: 'Create account & send code' })).toBeDisabled();
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/auth/signup/request', {
        name: 'Noura Signup',
        email: 'noura.signup@hospital.sa',
        employeeNumber: 'EMP-950',
        phone: '0501555555',
        position: 'Technologist',
        departmentId: 'dept-test-1',
        password: 'signup-pass-123',
      });
    });

    await act(async () => {
      request.resolve({
        data: {
          ok: true,
          verificationRequired: true,
          maskedEmail: 'no**********@hospital.sa',
          resendCooldownSeconds: 60,
          expiresInMinutes: 10,
          devCode: '246810',
          userId: 'user-signup',
        },
      });
      await request.promise;
    });

    expect(await screen.findByText('We sent the code to no**********@hospital.sa')).toBeInTheDocument();
    expect(screen.getByText('Current development code')).toBeInTheDocument();
    expect(screen.getByText('246810')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
  });

  it('shows an explicit empty-state when no departments are returned', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        departments: [],
      },
    });

    renderRegister();

    expect(await screen.findByText('No departments available.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No departments available' })).toBeInTheDocument();
    expect(screen.getByLabelText('Department')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create account & send code' })).toBeDisabled();
  });

  it('shows a departments error instead of leaving the loader active forever', async () => {
    mocks.get.mockRejectedValueOnce(new Error('network down'));

    renderRegister();

    expect(
      await screen.findByText('Unable to load available departments. Make sure the backend is running and try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Loading departments...' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No departments available' })).toBeInTheDocument();
  });

  it('allows selecting a loaded department without refetching it', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        departments: [
          {
            id: 'dept-test-1',
            name: {
              en: 'CT Testing Department',
              ar: 'قسم الاختبار',
            },
          },
          {
            id: 'dept-test-2',
            name: {
              en: 'Emergency Imaging',
              ar: 'تصوير الطوارئ',
            },
          },
        ],
      },
    });

    renderRegister();

    const select = await screen.findByLabelText('Department');
    expect(select).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Emergency Imaging' })).toBeInTheDocument();

    fireEvent.change(select, {
      target: { value: 'dept-test-2' },
    });

    expect((select as HTMLSelectElement).value).toBe('dept-test-2');
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  });

  it('shows invalid OTP feedback and then completes verification successfully', async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: {
          ok: true,
          verificationRequired: true,
          maskedEmail: 'no**********@hospital.sa',
          resendCooldownSeconds: 60,
          expiresInMinutes: 10,
          devCode: '246810',
          userId: 'user-signup',
        },
      })
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            error: {
              code: 'INVALID_SIGNUP_OTP',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          message: 'Email verified successfully.',
        },
      });

    renderRegister();
    expect(await screen.findByRole('option', { name: 'CT Testing Department' })).toBeInTheDocument();
    await fillRegistrationForm();

    fireEvent.click(screen.getByRole('button', { name: 'Create account & send code' }));
    expect(await screen.findByText('We sent the code to no**********@hospital.sa')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code & activate account' }));

    expect(
      await screen.findByText('Incorrect verification code. Check your email and try again.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '246810' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code & activate account' }));

    expect(await screen.findByText('Your email has been verified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Sign In' })).toBeInTheDocument();
  });

  it('restores the pending verification step after refresh and resends the OTP after the cooldown', async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        ok: true,
        verificationRequired: true,
        maskedEmail: 'no**********@hospital.sa',
        resendCooldownSeconds: 60,
        expiresInMinutes: 10,
        devCode: '246810',
        userId: 'user-signup',
      },
    });

    const { unmount } = renderRegister();
    expect(await screen.findByRole('option', { name: 'CT Testing Department' })).toBeInTheDocument();
    await fillRegistrationForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account & send code' }));

    expect(await screen.findByText('We sent the code to no**********@hospital.sa')).toBeInTheDocument();
    unmount();

    window.sessionStorage.setItem('signup-pending-verification', JSON.stringify({
      email: 'noura.signup@hospital.sa',
      maskedEmail: 'no**********@hospital.sa',
      resendAvailableAt: Date.now() - 1_000,
    }));

    mocks.post.mockResolvedValueOnce({
      data: {
        ok: true,
        verificationRequired: true,
        maskedEmail: 'no**********@hospital.sa',
        resendCooldownSeconds: 60,
        devCode: '135790',
        resent: true,
      },
    });

    renderRegister();
    expect(await screen.findByText('We sent the code to no**********@hospital.sa')).toBeInTheDocument();
    expect(screen.getByText('noura.signup@hospital.sa')).toBeInTheDocument();

    const resendButton = screen.getByRole('button', { name: 'Resend code' });
    await waitFor(() => expect(resendButton).not.toBeDisabled());
    fireEvent.click(resendButton);

    expect(await screen.findByText('A new verification code has been sent to your email.')).toBeInTheDocument();
    expect(screen.getByText('135790')).toBeVisible();
    expect(mocks.post).toHaveBeenLastCalledWith('/auth/signup/resend', {
      email: 'noura.signup@hospital.sa',
    });
  });
});
