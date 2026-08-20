import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '@/types';
import NotificationCenter from './NotificationCenter';

const notification: AppNotification = {
  id: 'notification-1',
  type: 'shift_change',
  title: 'Shift changed',
  message: 'Your Sunday shift was updated.',
  isRead: false,
  isUrgent: false,
  createdAt: '2026-07-26T08:00:00.000Z',
};

describe('NotificationCenter accessibility', () => {
  afterEach(cleanup);

  it('exposes disclosure state, semantic list content, and initial popover focus', async () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          notifications={[notification]}
          onOpenNotification={vi.fn()}
          onRefresh={vi.fn()}
          onMarkAllRead={vi.fn()}
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Notifications' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark all as read' })).toHaveFocus();
    });
  });

  it('uses a native notification button and supports keyboard-equivalent activation', () => {
    const onOpenNotification = vi.fn();
    render(
      <MemoryRouter>
        <NotificationCenter
          notifications={[notification]}
          onOpenNotification={onOpenNotification}
          onRefresh={vi.fn()}
          onMarkAllRead={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    const notificationButton = screen.getByRole('button', {
      name: /Shift changed.*Your Sunday shift was updated/,
    });
    expect(notificationButton.tagName).toBe('BUTTON');

    notificationButton.focus();
    fireEvent.click(notificationButton, { detail: 0 });
    expect(onOpenNotification).toHaveBeenCalledWith(notification);
  });

  it('refreshes the list when opened and waits for authoritative state before navigating', async () => {
    let finishPreparing!: () => void;
    const preparing = new Promise<void>((resolve) => {
      finishPreparing = resolve;
    });
    const onRefresh = vi.fn();
    const onOpenNotification = vi.fn(() => preparing);

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={(
              <NotificationCenter
                notifications={[{ ...notification, actionUrl: '/shift-requests' }]}
                onOpenNotification={onOpenNotification}
                onRefresh={onRefresh}
                onMarkAllRead={vi.fn()}
              />
            )}
          />
          <Route path="/shift-requests" element={<p>Shift request destination</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', {
      name: /Shift changed.*Your Sunday shift was updated/,
    }));
    expect(screen.queryByText('Shift request destination')).not.toBeInTheDocument();

    finishPreparing();
    expect(await screen.findByText('Shift request destination')).toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          notifications={[notification]}
          onOpenNotification={vi.fn()}
          onRefresh={vi.fn()}
          onMarkAllRead={vi.fn()}
        />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole('button', { name: 'Notifications' });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
