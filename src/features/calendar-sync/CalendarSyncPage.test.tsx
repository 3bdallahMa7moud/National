import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/i18n';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types';
import CalendarSyncPage from './CalendarSyncPage';

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
    render(<CalendarSyncPage />);

    const expectedUrl =
      'https://hospital.sa/api/v1/schedule/sync/ical/calendar-employee/ct-department.ics';
    expect(screen.getByDisplayValue(expectedUrl)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedUrl));
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('switches between calendar-provider instructions', () => {
    render(<CalendarSyncPage />);

    expect(screen.getByText('Open Google Calendar on your computer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apple Calendar' }));

    expect(screen.getByText('Open the Calendar app on iPhone or Mac')).toBeInTheDocument();
    expect(screen.queryByText('Open Google Calendar on your computer')).not.toBeInTheDocument();
  });
});
