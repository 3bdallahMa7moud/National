import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types';
import CalendarSyncPage from './CalendarSyncPage';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: mocks.get,
  },
  setUnauthorizedHandler: mocks.setUnauthorizedHandler,
}));

const employee: AuthUser = {
  id: 'calendar-employee',
  name: 'Calendar Employee',
  email: 'calendar@example.com',
  role: 'employee',
  departmentId: 'dept-1',
  departmentName: 'CT',
};

describe('CalendarSyncPage', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = vi.fn();

  beforeEach(async () => {
    await changeLanguage('en');
    writeText.mockReset();
    mocks.get.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    act(() => {
      useAuthStore.setState({ user: employee, isAuthenticated: true });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
    });
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('shows the signed-in employee link and copies exactly what is displayed', async () => {
    mocks.get.mockResolvedValue({
      data: {
        feedUrl: 'https://localhost/api/calendar-sync/feed/secure-token.ics',
      },
    });
    render(<CalendarSyncPage />);

    const expectedUrl =
      'https://localhost/api/calendar-sync/feed/secure-token.ics';
    expect(await screen.findByDisplayValue(expectedUrl)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedUrl));
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('switches between calendar-provider instructions', async () => {
    mocks.get.mockResolvedValue({
      data: {
        feedUrl: 'https://localhost/api/calendar-sync/feed/secure-token.ics',
      },
    });
    render(<CalendarSyncPage />);

    expect(await screen.findByText('Open Google Calendar on your computer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apple Calendar' }));

    expect(screen.getByText('Open the Calendar app on iPhone or Mac')).toBeInTheDocument();
    expect(screen.queryByText('Open Google Calendar on your computer')).not.toBeInTheDocument();
  });
});
