import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { expectNoAxeViolations } from '@/test/axe';
import ForgotPasswordPage from './ForgotPasswordPage';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    post: mocks.post,
  },
  setUnauthorizedHandler: mocks.setUnauthorizedHandler,
}));

describe('ForgotPasswordPage accessibility', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mocks.post.mockReset();
  });

  it('has no detectable axe violations in its initial state', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await expectNoAxeViolations(document.body);
  });

  it('names and groups OTP digits, connects errors, and names password icon buttons', async () => {
    mocks.post
      .mockResolvedValueOnce({
        data: {
          ok: true,
          accountFound: true,
          hasEmail: true,
          maskedEmail: 'ad*****@hospital.sa',
          userId: 'user-admin',
          displayName: { en: 'Admin User', ar: 'مدير النظام' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
        },
      });

    render(
      <ThemeProvider>
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email / Employee Number'), {
      target: { value: 'admin@hospital.sa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));

    const firstDigit = await screen.findByLabelText(
      'Digit 1 of 6',
      {},
      { timeout: 2500 },
    );
    const otpGroup = screen.getByRole('group', { name: '6-digit verification code' });
    const digits = Array.from({ length: 6 }, (_, index) =>
      screen.getByLabelText(`Digit ${index + 1} of 6`),
    );
    expect(otpGroup).toContainElement(firstDigit);
    expect(digits).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    const otpError = await screen.findByRole('alert');
    expect(firstDigit).toHaveAttribute('aria-invalid', 'true');
    expect(firstDigit).toHaveAttribute('aria-describedby', otpError.id);

    '100000'.split('').forEach((digit, index) => {
      fireEvent.change(digits[index], { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    const passwordToggles = await screen.findAllByRole('button', { name: 'Show password' });
    expect(passwordToggles).toHaveLength(2);
    passwordToggles[0].focus();
    fireEvent.click(passwordToggles[0], { detail: 0 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus();
    });
  });
});
