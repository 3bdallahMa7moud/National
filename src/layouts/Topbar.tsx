import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import NotificationCenter from '@/components/common/NotificationCenter';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import { useMockData } from '@/hooks/useMockData';
import type { AppNotification } from '@/types';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from 'react-i18next';

export default function Topbar() {
  const { t } = useTranslation(['common']);
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const { dateLocale } = useLanguage();
  const { notifications: baseNotifications } = useMockData();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const notifications = useMemo(
    () => baseNotifications.map((n) => ({ ...n, isRead: n.isRead || readIds.has(n.id) })),
    [baseNotifications, readIds],
  );
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const handleMarkAllRead = () => {
    setReadIds(new Set(baseNotifications.map((n) => n.id)));
  };

  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="rounded-btn p-2 transition-colors hover:bg-hover lg:hidden"
          >
            <Menu className="h-5 w-5 text-text-secondary" />
          </button>
          <div className="hidden sm:block">
            <p className="rounded-pill border border-border bg-surface-muted px-3 py-1 text-xs text-text-secondary">{today}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher variant="icon" />

          {user?.role !== 'admin' && (
            <NotificationCenter
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />
          )}

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-btn border border-transparent p-1.5 transition-colors hover:border-border hover:bg-hover"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-8 w-8 rounded-btn object-cover border border-border" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-primary-50">
                  <User className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="hidden sm:block text-start">
                <p className="text-sm font-medium text-text-primary leading-tight">{user?.name}</p>
                <p className="text-[10px] text-text-secondary">
                  {user?.role === 'admin' ? t('common:role.admin') : t('common:role.employee')}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute end-0 top-full z-50 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown">
                  <button
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-hover"
                  >
                    <User className="w-4 h-4" />
                    {t('common:topbar.profile')}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger-50"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('common:topbar.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
