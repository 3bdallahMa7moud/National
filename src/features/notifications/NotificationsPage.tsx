import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bell, CheckCheck, Filter, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/stores/authStore';
import dayjs from '@/lib/dayjs';
import type { AppNotification } from '@/types';
import { cn } from '@/lib/utils';
import { getNotificationTargetUrl } from '@/lib/notificationNavigation';

type NotificationFilter = 'all' | 'unread' | 'urgent';

export default function NotificationsPage() {
  const { t } = useTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const {
    notifications,
    markAllRead,
    deleteNotification,
    prepareNotificationOpen,
  } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const filtered = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'urgent') return notification.isUrgent;
    return true;
  });

  const filterTabs = [
    {
      id: 'all' as const,
      label: t('notifications:page.filters.all'),
      count: notifications.length,
    },
    {
      id: 'unread' as const,
      label: t('notifications:page.filters.unread'),
      count: notifications.filter((notification) => !notification.isRead).length,
    },
    {
      id: 'urgent' as const,
      label: t('notifications:page.filters.urgent'),
      count: notifications.filter((notification) => notification.isUrgent).length,
    },
  ];

  const openNotification = async (notification: AppNotification) => {
    const user = useAuthStore.getState().user;
    const targetUrl = getNotificationTargetUrl(notification, user);
    await prepareNotificationOpen(notification);
    navigate(targetUrl);
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
            {t('notifications:page.title')}
          </h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {t('notifications:page.subtitle')}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={markAllRead}
          icon={<CheckCheck className="h-4 w-4" aria-hidden="true" />}
        >
          {t('notifications:page.markAllRead')}
        </Button>
      </div>

      <Card>
        <div
          className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-border pb-4"
          role="group"
          aria-label={t('notifications:page.title')}
        >
          <Filter className="h-4 w-4 flex-shrink-0 text-text-secondary" aria-hidden="true" />
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={cn(
                'flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-btn px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === tab.id
                  ? 'bg-primary-50 text-primary ring-1 ring-primary/15'
                  : 'bg-surface-muted text-text-secondary hover:bg-hover',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  filter === tab.id
                    ? 'bg-surface text-primary'
                    : 'bg-surface-muted text-text-primary',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-text-secondary">
            <Bell className="mx-auto mb-2 h-10 w-10 text-text-muted" aria-hidden="true" />
            <p className="text-base font-medium">{t('notifications:page.empty')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((notification) => (
              <li
                key={notification.id}
                className={cn(
                  'flex items-start justify-between gap-1 rounded-card transition-colors',
                  !notification.isRead ? 'bg-primary-50/40 font-medium' : 'hover:bg-hover',
                  notification.isUrgent
                    && !notification.isRead
                    && 'border-s-4 border-danger bg-danger-50/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => { void openNotification(notification); }}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-card px-3 py-4 text-start focus-visible:z-10"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex flex-shrink-0 rounded-btn p-2',
                      notification.isUrgent
                        ? 'bg-danger text-white'
                        : 'bg-primary-50 text-primary',
                    )}
                  >
                    {notification.isUrgent
                      ? <AlertTriangle className="h-5 w-5" />
                      : <Bell className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">
                        {notification.title}
                      </span>
                      {notification.isUrgent && (
                        <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {t('notifications:page.urgentBadge')}
                        </span>
                      )}
                      {!notification.isRead && (
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                      {notification.message}
                    </span>

                    {(notification.oldShiftType || notification.newShiftType) && (
                      <span className="mt-2 flex w-fit items-center gap-2 rounded border border-border/60 bg-surface p-2 text-xs">
                        {notification.oldShiftType && (
                          <span className="font-medium text-text-secondary">
                            {t('common:labels.from')} {notification.oldShiftType}
                          </span>
                        )}
                        {notification.oldShiftType && notification.newShiftType && (
                          <span className="text-text-secondary">←</span>
                        )}
                        {notification.newShiftType && (
                          <span className="font-bold text-primary">
                            {t('common:labels.to')} {notification.newShiftType}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="mt-2 block text-[10px] text-text-secondary">
                      {dayjs(notification.createdAt).fromNow()}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteNotification(notification.id)}
                  className="m-1.5 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-danger-50 hover:text-danger"
                  aria-label={`${t('notifications:page.deleteTitle')}: ${notification.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
