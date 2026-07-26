import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/hooks/useTheme';
import { changeLanguage } from '@/i18n';
import ForgotPasswordPage from './ForgotPasswordPage';

function renderRecovery() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ForgotPasswordPage mock recovery flow', () => {
  beforeEach(async () => {
    await changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reports an unknown account without advancing the recovery flow', async () => {
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

  it('keeps the demo OTP deterministic and visibly exposes it as mock UI', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderRecovery();

    fireEvent.change(screen.getByLabelText('Email / Employee Number'), {
      target: { value: 'admin@hospital.sa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Verification Code' }));

    expect(
      await screen.findByText('Your verification code:', {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('100000')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '100000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByText('Create New Password')).toBeInTheDocument();
  });
});
