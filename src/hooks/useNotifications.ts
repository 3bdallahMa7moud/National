import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/axios';
import { fetchAndHydrateBootstrap } from '@/lib/backendBootstrap';
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

  const markRead = (id: string) => {
    if (!user) return;
    void api.post(`/notifications/${id}/read`).then(() => fetchAndHydrateBootstrap()).catch(() => undefined);
  };

  const markAllRead = () => {
    if (!user) return;
    void api.post('/notifications/read-all').then(() => fetchAndHydrateBootstrap()).catch(() => undefined);
  };

  const deleteNotification = (id: string) => {
    if (!user) return;
    void api.delete(`/notifications/${id}`).then(() => fetchAndHydrateBootstrap()).catch(() => undefined);
  };

  return { notifications, unreadCount, markRead, markAllRead, deleteNotification };
}
