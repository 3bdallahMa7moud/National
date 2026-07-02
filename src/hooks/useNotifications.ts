import { useState } from 'react';
import { mockNotifications } from '@/mocks/mockData';
import type { AppNotification } from '@/types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return { notifications, unreadCount, markRead, markAllRead };
}
