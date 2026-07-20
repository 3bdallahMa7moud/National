import { useState, useMemo, useEffect } from 'react';
import { useMockData } from '@/hooks/useMockData';
import { useAuthStore } from '@/stores/authStore';
import { isNotificationForUser, useTargetedNotificationStore } from '@/stores/targetedNotificationStore';

export function useNotifications() {
  const { notifications: baseNotifications } = useMockData();
  const user = useAuthStore((state) => state.user);
  const targeted = useTargetedNotificationStore((state) => state.notifications);
  const markTargetedRead = useTargetedNotificationStore((state) => state.markRead);
  const markAllTargetedRead = useTargetedNotificationStore((state) => state.markAllRead);
  const removeTargeted = useTargetedNotificationStore((state) => state.remove);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedMockIds, setDeletedMockIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    useTargetedNotificationStore.getState().reloadFromStorage();
  }, [user]);

  const notifications = useMemo(
    () => [
      ...(user ? targeted.filter((notification) => isNotificationForUser(notification, user)) : []),
      ...baseNotifications
        .filter((notification) => !deletedMockIds.has(notification.id))
        .map((notification) => ({
          ...notification,
          isRead: notification.isRead || readIds.has(notification.id),
        })),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [baseNotifications, deletedMockIds, readIds, targeted, user],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = (id: string) => {
    if (targeted.some((notification) => notification.id === id)) {
      markTargetedRead(id);
      return;
    }
    setReadIds((prev) => new Set(prev).add(id));
  };

  const markAllRead = () => {
    setReadIds(new Set(baseNotifications.map((n) => n.id)));
    if (user) markAllTargetedRead(user);
  };

  const deleteNotification = (id: string) => {
    if (targeted.some((notification) => notification.id === id)) {
      removeTargeted(id);
      return;
    }
    setDeletedMockIds((prev) => new Set(prev).add(id));
  };

  return { notifications, unreadCount, markRead, markAllRead, deleteNotification };
}
