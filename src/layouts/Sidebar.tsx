import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { useUIStore } from '@/stores/uiStore';
import { resolveEffectiveEmployeeAccess, type EmployeePermission } from '@/types/employeeAccess';
import { isAdminOrSuperAdmin, isSuperAdmin } from '@/types';
import {
  LayoutDashboard, Calendar, Users, Building2, BarChart3, FileText,
  RefreshCw, Bell, User, Menu, X, Clock, ArrowLeftRight, FileBarChart2,
  Palmtree, ExternalLink,
} from 'lucide-react';
import HospitalLogo from '@/components/common/HospitalLogo';

interface SidebarLink {
  to?: string;
  href?: string;
  external?: boolean;
  icon: typeof LayoutDashboard;
  labelKey: string;
  permissions?: EmployeePermission[];
  superAdminOnly?: boolean;
}

const adminLinks: SidebarLink[] = [
  { to: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'common:nav.dashboard' },
  { to: '/admin/schedule', icon: Calendar, labelKey: 'common:nav.scheduleAdmin' },
  { to: '/admin/late-schedule', icon: Clock, labelKey: 'common:nav.lateSchedule' },
  { to: '/admin/employees', icon: Users, labelKey: 'common:nav.employees' },
  { to: '/admin/departments', icon: Building2, labelKey: 'common:nav.departments' },
  { to: '/admin/reports', icon: BarChart3, labelKey: 'common:nav.reports' },
  { to: '/admin/audit-log', icon: FileText, labelKey: 'common:nav.auditLog' },
  { to: '/admin/shift-requests', icon: ArrowLeftRight, labelKey: 'common:nav.shiftRequests' },
  { to: '/admin/employee-justification', icon: FileBarChart2, labelKey: 'common:nav.employeeJustification' },
  { to: '/admin/calendar-sync', icon: RefreshCw, labelKey: 'common:nav.calendarSync', superAdminOnly: true },
  { href: 'https://www.ctgate.cc', external: true, icon: Palmtree, labelKey: 'common:nav.ctGate' },
  { to: '/profile', icon: User, labelKey: 'common:nav.profile' },
];

const employeeLinks: SidebarLink[] = [
  { to: '/employee/dashboard', icon: LayoutDashboard, labelKey: 'common:nav.dashboard' },
  {
    to: '/schedule/me', icon: Calendar, labelKey: 'common:nav.mySchedule',
    permissions: ['schedule.own.view', 'schedule.ot.own.view'],
  },
  {
    to: '/schedule/department', icon: Users, labelKey: 'common:nav.departmentSchedule',
    permissions: ['schedule.department.view', 'schedule.ot.department.view'],
  },
  {
    to: '/shift-requests', icon: ArrowLeftRight, labelKey: 'common:nav.shiftRequests',
    permissions: [
      'schedule.exchange.create',
      'schedule.replace.create',
      'schedule.requests.respond',
      'schedule.requests.cancelOwn',
      'schedule.department.requests.view',
    ],
  },
  {
    to: '/calendar-sync', icon: RefreshCw, labelKey: 'common:nav.calendarSync',
    permissions: ['schedule.calendar.sync'],
  },
  { href: 'https://www.ctgate.cc', external: true, icon: Palmtree, labelKey: 'common:nav.ctGate' },
  { to: '/notifications', icon: Bell, labelKey: 'common:nav.notifications' },
  { to: '/profile', icon: User, labelKey: 'common:nav.profile' },
];

export default function Sidebar() {
  const { t } = useTranslation(['common']);
  const { user } = useAuthStore();
  const accessProfile = useEmployeeAccessStore((state) => user ? state.profiles[user.id] : undefined);
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen, toggleSidebarCollapse } = useUIStore();
  const location = useLocation();
  const employeeAccess = user?.role === 'employee'
    ? resolveEffectiveEmployeeAccess(user, accessProfile)
    : null;
  const links = isAdminOrSuperAdmin(user)
    ? adminLinks.filter((link) => !link.superAdminOnly || isSuperAdmin(user))
    : employeeLinks.filter((link) => !link.permissions?.length
      || (employeeAccess?.active && link.permissions.some((permission) => employeeAccess.permissions[permission])));
  const isCollapsed = sidebarCollapsed && !sidebarOpen;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center justify-between border-b border-border px-3.5', isCollapsed && 'justify-center px-2')}>
        {!isCollapsed ? (
          <>
            <HospitalLogo size="sm" showText={true} subtitle={t('common:sidebar.subtitle')} />
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex items-center justify-center rounded-btn p-1.5 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              title={t('common:sidebar.collapse')}
              aria-label={t('common:sidebar.collapse')}
            >
              <Menu className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebarCollapse}
              className="hidden lg:flex items-center justify-center rounded-btn p-2 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              title={t('common:sidebar.expand')}
              aria-label={t('common:sidebar.expand')}
          >
            <Menu className="h-6 w-6 text-primary" />
          </button>
        )}
        <button
          className="ms-auto inline-flex h-11 w-11 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('common:sidebar.close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((link) => {
          const Icon = link.icon;
          const label = t(link.labelKey);

          if (link.external && link.href) {
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors duration-150 text-text-secondary hover:bg-hover hover:text-text-primary',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="flex-1 truncate flex items-center justify-between gap-2">
                    <span className="truncate">{label}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-50 flex-shrink-0 rtl:-scale-x-100" />
                  </span>
                )}
              </a>
            );
          }

          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to!}
              to={link.to!}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary-50 text-primary ring-1 ring-primary/15'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed start-0 top-0 z-50 h-full max-w-[85vw] border-e border-border bg-surface transition-all duration-300 print:hidden',
          isCollapsed ? 'w-[72px]' : 'w-64',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 lg:rtl:translate-x-0'
        )}
        aria-label={t('common:sidebar.navigation')}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
