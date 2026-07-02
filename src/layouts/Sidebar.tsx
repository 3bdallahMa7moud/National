import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import {
  LayoutDashboard, Calendar, Users, Building2, BarChart3, FileText,
  RefreshCw, Bell, User, Menu, X
} from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/admin/schedule', icon: Calendar, label: 'إدارة الجدول' },
  { to: '/admin/employees', icon: Users, label: 'الموظفون' },
  { to: '/admin/departments', icon: Building2, label: 'الأقسام' },
  { to: '/admin/reports', icon: BarChart3, label: 'التقارير' },
  { to: '/admin/audit-log', icon: FileText, label: 'سجل التغييرات' },
];

const employeeLinks = [
  { to: '/schedule/me', icon: Calendar, label: 'جدولي' },
  { to: '/schedule/department', icon: Users, label: 'جدول القسم' },
  { to: '/calendar-sync', icon: RefreshCw, label: 'مزامنة التقويم' },
  { to: '/notifications', icon: Bell, label: 'التنبيهات' },
  { to: '/profile', icon: User, label: 'ملفي الشخصي' },
];

export default function Sidebar() {
  const { user } = useAuthStore();
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen, toggleSidebarCollapse } = useUIStore();
  const location = useLocation();
  const links = user?.role === 'admin' ? adminLinks : employeeLinks;
  // On mobile (< lg), when sidebar is opened, never treat it as collapsed
  const isCollapsed = sidebarCollapsed && !sidebarOpen;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo & Collapse Button */}
      <div className={cn('flex h-16 items-center justify-between border-b border-border px-3.5', isCollapsed && 'justify-center px-2')}>
        {!isCollapsed ? (
          <>
            <HospitalLogo size="sm" showText={true} subtitle="جدولة الأشعة المقطعية" />
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex items-center justify-center rounded-btn p-1.5 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary"
              title="طي القائمة"
            >
              <Menu className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex items-center justify-center rounded-btn p-2 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary"
            title="توسيع القائمة"
          >
            <Menu className="h-6 w-6 text-primary" />
          </button>
        )}
        {/* Mobile close button */}
        <button
          className="ms-auto rounded-btn p-1.5 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary-50 text-primary ring-1 ring-primary/15'
                  : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? link.label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{link.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed start-0 top-0 z-50 h-full max-w-[85vw] border-e border-border bg-surface transition-all duration-300',
          isCollapsed ? 'w-[72px]' : 'w-64',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
