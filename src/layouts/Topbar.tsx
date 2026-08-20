import { useNavigate } from 'react-router-dom';
import { useId, useRef, useState } from 'react';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import NotificationCenter from '@/components/common/NotificationCenter';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import ThemeSwitcher from '@/components/common/ThemeSwitcher';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from 'react-i18next';
import { usePopoverFocus } from '@/hooks/usePopoverFocus';
import type { UserRole } from '@/types';

function roleLabelKey(role?: UserRole): string {
  if (role === 'super_admin') return 'common:role.superAdmin';
  if (role === 'admin') return 'common:role.admin';
  return 'common:role.employee';
}

export default function Topbar() {
  const { t } = useTranslation(['common']);
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const { dateLocale } = useLanguage();
  const {
    notifications,
    markAllRead,
    prepareNotificationOpen,
    refreshNotifications,
  } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuId = `user-menu-${useId()}`;

  usePopoverFocus({
    isOpen: showUserMenu,
    onClose: () => setShowUserMenu(false),
    triggerRef: userMenuTriggerRef,
    popoverRef: userMenuRef,
  });

  const handleLogout = () => {
    setShowUserMenu(false);
    void logout().finally(() => {
      navigate('/login');
    });
  };

  const today = new Date().toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 max-w-full border-b border-border bg-surface/95 backdrop-blur print:hidden">
      <div className="flex h-14 min-w-0 items-center justify-between gap-2 px-3 sm:px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex h-11 w-11 items-center justify-center rounded-btn transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30 lg:hidden"
            aria-label={t('common:topbar.openNavigation')}
          >
            <Menu className="h-5 w-5 text-text-secondary" />
          </button>
          <div className="hidden sm:block">
            <p className="rounded-pill border border-border bg-surface-muted px-3 py-1 text-xs text-text-secondary">{today}</p>
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeSwitcher variant="icon" />

          <NotificationCenter
            notifications={notifications}
            onOpenNotification={prepareNotificationOpen}
            onRefresh={refreshNotifications}
            onMarkAllRead={markAllRead}
          />

          <div className="relative">
            <button
              ref={userMenuTriggerRef}
              type="button"
              onClick={() => setShowUserMenu((current) => !current)}
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-btn border border-transparent p-1.5 transition-colors hover:border-border hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-w-0"
              aria-label={t('common:topbar.userMenu')}
              aria-expanded={showUserMenu}
              aria-controls={userMenuId}
              aria-haspopup="dialog"
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
                  {t(roleLabelKey(user?.role), { defaultValue: user?.role === 'super_admin' ? 'Super Admin' : 'Employee' })}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} aria-hidden="true" />
                <div
                  ref={userMenuRef}
                  id={userMenuId}
                  role="dialog"
                  aria-label={t('common:topbar.userMenu')}
                  tabIndex={-1}
                  className="absolute end-0 top-full z-50 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown"
                >
                  <button
                    type="button"
                    data-popover-autofocus
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-hover"
                  >
                    <User className="w-4 h-4" aria-hidden="true" />
                    {t('common:topbar.profile')}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger-50"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
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
