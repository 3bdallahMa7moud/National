import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import type { AppNotification } from '@/types';
import dayjs from '@/lib/dayjs';
import { usePopoverFocus } from '@/hooks/usePopoverFocus';
import { cn } from '@/lib/utils';
import { getNotificationTargetUrl } from '@/lib/notificationNavigation';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationCenterProps) {
  const { t } = useTranslation(['notifications']);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = `notification-center-${useId()}`;
  const titleId = `${popoverId}-title`;
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  usePopoverFocus({
    isOpen,
    onClose: () => setIsOpen(false),
    triggerRef,
    popoverRef,
  });

  const openNotification = (notification: AppNotification) => {
    onMarkRead(notification.id);
    setIsOpen(false);
    const user = useAuthStore.getState().user;
    const targetUrl = getNotificationTargetUrl(notification, user);
    navigate(targetUrl);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-hover"
        aria-label={t('notifications:center.title')}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5 text-text-secondary" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -start-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute end-0 top-full z-50 mt-2 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown sm:w-80 sm:max-w-80"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 id={titleId} className="font-semibold text-text-primary">
                {t('notifications:center.title')}
              </h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  data-popover-autofocus
                  onClick={onMarkAllRead}
                  className="min-h-11 rounded-btn px-2 text-xs text-primary hover:underline"
                >
                  {t('notifications:center.markAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-6 text-center text-sm text-text-secondary">
                  {t('notifications:center.empty')}
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {notifications.slice(0, 8).map((notification, index) => (
                    <li
                      key={notification.id}
                      className={cn(
                        !notification.isRead && 'bg-primary-50/30',
                        notification.isUrgent
                          && !notification.isRead
                          && 'border-s-2 border-danger bg-danger-50/30',
                      )}
                    >
                      <button
                        type="button"
                        data-popover-autofocus={unreadCount === 0 && index === 0 ? true : undefined}
                        className="w-full p-3 text-start transition-colors hover:bg-hover"
                        onClick={() => openNotification(notification)}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-sm',
                                !notification.isRead
                                  ? 'font-semibold text-text-primary'
                                  : 'text-text-secondary',
                              )}
                            >
                              {notification.title}
                            </span>
                            <span className="mt-0.5 block line-clamp-2 text-xs text-text-secondary">
                              {notification.message}
                            </span>
                            {(notification.oldShiftType || notification.newShiftType) && (
                              <span className="mt-1 flex items-center gap-1 text-[10px]">
                                {notification.oldShiftType && (
                                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-text-secondary">
                                    {notification.oldShiftType}
                                  </span>
                                )}
                                {notification.oldShiftType && notification.newShiftType && (
                                  <span className="text-text-secondary">←</span>
                                )}
                                {notification.newShiftType && (
                                  <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary">
                                    {notification.newShiftType}
                                  </span>
                                )}
                              </span>
                            )}
                            <span className="mt-1 block text-[10px] text-text-secondary">
                              {dayjs(notification.createdAt).fromNow()}
                            </span>
                          </span>
                          {!notification.isRead && (
                            <span
                              aria-hidden="true"
                              className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
                            />
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
