import { useState, useMemo } from 'react';
import { useMockData } from '@/hooks/useMockData';
import type { AppNotification } from '@/types';

export function useNotifications() {
  const { notifications: baseNotifications } = useMockData();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const notifications = useMemo(
    () => baseNotifications.map((n) => ({
      ...n,
      isRead: n.isRead || readIds.has(n.id),
    })),
    [baseNotifications, readIds],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const markAllRead = () => {
    setReadIds(new Set(baseNotifications.map((n) => n.id)));
  };

  return { notifications, unreadCount, markRead, markAllRead };
}
