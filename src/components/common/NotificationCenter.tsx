import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Bell } from 'lucide-react';
import type { AppNotification } from '@/types';
import dayjs from '@/lib/dayjs';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationCenter({ notifications, onMarkRead, onMarkAllRead }: NotificationCenterProps) {
  const { t } = useTranslation(['notifications']);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-hover transition-colors"
        aria-label={t('notifications:center.title')}
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -start-0.5 bg-danger text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute end-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 bg-surface rounded-card shadow-dropdown border border-border z-50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-text-primary">{t('notifications:center.title')}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  {t('notifications:center.markAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
              {notifications.length === 0 ? (
                <p className="p-6 text-center text-sm text-text-secondary">{t('notifications:center.empty')}</p>
              ) : (
                notifications.slice(0, 8).map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'p-3 hover:bg-hover cursor-pointer transition-colors',
                      !notif.isRead && 'bg-primary-50/30',
                      notif.isUrgent && !notif.isRead && 'bg-danger-50/30 border-s-2 border-danger'
                    )}
                    onClick={() => onMarkRead(notif.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', !notif.isRead ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{notif.message}</p>
                        {(notif.oldShiftType || notif.newShiftType) && (
                          <div className="flex items-center gap-1 mt-1 text-[10px]">
                            {notif.oldShiftType && (
                              <span className="px-1.5 py-0.5 rounded bg-surface-muted text-text-secondary">{notif.oldShiftType}</span>
                            )}
                            {notif.oldShiftType && notif.newShiftType && <span className="text-text-secondary">←</span>}
                            {notif.newShiftType && (
                              <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary font-medium">{notif.newShiftType}</span>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-text-secondary mt-1">{dayjs(notif.createdAt).fromNow()}</p>
                      </div>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
