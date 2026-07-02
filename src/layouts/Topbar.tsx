import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import NotificationCenter from '@/components/common/NotificationCenter';
import { mockNotifications } from '@/mocks/mockData';
import { useState } from 'react';
import type { AppNotification } from '@/types';

export default function Topbar() {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>(mockNotifications);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const today = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 lg:px-8">
        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="rounded-btn p-2 transition-colors hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-5 w-5 text-text-secondary" />
          </button>
          <div className="hidden sm:block">
            <p className="rounded-pill border border-border bg-gray-50 px-3 py-1 text-xs text-text-secondary">{today}</p>
          </div>
        </div>

        {/* Left side */}
        <div className="flex items-center gap-2">
          {user?.role !== 'admin' && (
            <NotificationCenter
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />
          )}

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-btn border border-transparent p-1.5 transition-colors hover:border-border hover:bg-gray-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-primary-50">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="hidden sm:block text-start">
                <p className="text-sm font-medium text-text-primary leading-tight">{user?.name}</p>
                <p className="text-[10px] text-text-secondary">{user?.role === 'admin' ? 'مسؤول' : 'موظف'}</p>
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute end-0 top-full z-50 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown">
                  <button
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-gray-50"
                  >
                    <User className="w-4 h-4" />
                    الملف الشخصي
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger-50"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج
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
