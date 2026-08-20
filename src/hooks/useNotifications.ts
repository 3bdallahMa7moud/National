import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/axios';
import {
  fetchAndHydrateBootstrap,
  fetchAndHydrateOperationalInbox,
} from '@/lib/backendBootstrap';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import { notificationForUser, useTargetedNotificationStore } from '@/stores/targetedNotificationStore';

export function useNotifications() {
  const { t, i18n } = useTranslation(['notifications', 'shiftRequests']);
  const user = useAuthStore((state) => state.user);
  const directory = useEmployeeDirectoryStore((state) => state.records);
  const targeted = useTargetedNotificationStore((state) => state.notifications);

  const notifications = useMemo(
    () => (user ? targeted
      .map((notification) => notificationForUser(notification, user))
      .filter((notification): notification is NonNullable<typeof notification> => Boolean(notification)) : [])
      .map((notification) => {
        const requester = directory.find((record) => record.accountId === notification.params?.requesterAccountId);
        const recipient = directory.find((record) => record.accountId === notification.params?.recipientAccountId);
        const params = {
          ...notification.params,
          requester: requester?.name[i18n.language.startsWith('ar') ? 'ar' : 'en'] || notification.params?.requester,
          recipient: recipient?.name[i18n.language.startsWith('ar') ? 'ar' : 'en'] || notification.params?.recipient,
          adminRejectionReason: typeof notification.params?.adminRejectionReasonKey === 'string'
            && notification.params.adminRejectionReasonKey
            ? notification.params.adminRejectionReason || t(`shiftRequests:reasons.${notification.params.adminRejectionReasonKey}`)
            : notification.params?.adminRejectionReason,
        };
        return {
          ...notification,
          title: notification.titleKey ? t(notification.titleKey, params) : notification.title,
          message: notification.messageKey ? t(notification.messageKey, params) : notification.message,
        };
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [directory, i18n.language, t, targeted, user],
  );

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const markRead = async (id: string) => {
    if (!user) return;
    useTargetedNotificationStore.getState().markRead(id, user);
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      await fetchAndHydrateOperationalInbox().catch(() => undefined);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    useTargetedNotificationStore.getState().markAllRead(user);
    await api.post('/notifications/read-all')
      .then(() => fetchAndHydrateOperationalInbox())
      .catch(() => fetchAndHydrateOperationalInbox().catch(() => undefined));
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    useTargetedNotificationStore.getState().remove(id, user);
    await api.delete(`/notifications/${id}`)
      .then(() => fetchAndHydrateOperationalInbox())
      .catch(() => fetchAndHydrateOperationalInbox().catch(() => undefined));
  };

  const refreshNotifications = async () => {
    if (!user) return;
    await fetchAndHydrateOperationalInbox().catch(() => undefined);
  };

  const prepareNotificationOpen = async (notification: (typeof notifications)[number]) => {
    if (!user) return;
    if (!notification.isRead) await markRead(notification.id);
    await fetchAndHydrateBootstrap().catch(() => undefined);
  };

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    refreshNotifications,
    prepareNotificationOpen,
  };
}
