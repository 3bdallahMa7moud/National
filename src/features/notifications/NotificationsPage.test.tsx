import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from './NotificationsPage';

const notificationMocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  deleteNotification: vi.fn(),
  prepareNotificationOpen: vi.fn(),
  notifications: [
    {
      id: 'notification-page-1',
      type: 'general' as const,
      title: 'Policy update',
      message: 'Review the updated scheduling policy.',
      isRead: false,
      isUrgent: true,
      createdAt: '2026-07-26T08:00:00.000Z',
    },
  ],
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => notificationMocks,
}));

describe('NotificationsPage semantics', () => {
  afterEach(cleanup);

  it('renders notifications as a list with separate open and delete buttons', () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    const title = screen.getByText('Policy update');
    const openButton = title.closest('button');
    expect(openButton).not.toBeNull();
    expect(openButton).toHaveAccessibleName(
      /Policy update.*Review the updated scheduling policy/,
    );

    const deleteButton = screen.getByRole('button', {
      name: 'Delete notification: Policy update',
    });
    expect(deleteButton).not.toBe(openButton);

    openButton?.focus();
    fireEvent.click(openButton as HTMLButtonElement, { detail: 0 });
    expect(notificationMocks.prepareNotificationOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notification-page-1' }),
    );

    fireEvent.click(deleteButton, { detail: 0 });
    expect(notificationMocks.deleteNotification).toHaveBeenCalledWith('notification-page-1');
  });

  it('exposes filter state through native toggle buttons', () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );

    const allFilter = screen.getByRole('button', { name: /All notifications/ });
    const unreadFilter = screen.getByRole('button', { name: /Unread/ });
    expect(allFilter).toHaveAttribute('aria-pressed', 'true');
    expect(unreadFilter).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(unreadFilter);
    expect(unreadFilter).toHaveAttribute('aria-pressed', 'true');
    expect(allFilter).toHaveAttribute('aria-pressed', 'false');
  });
});
