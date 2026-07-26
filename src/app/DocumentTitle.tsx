import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const APPLICATION_NAME_KEY = 'common:sidebar.subtitle';
const LOADING_TITLE_KEY = 'common:loading';
const UNKNOWN_ROUTE_TITLE_KEY = 'auth:notFound.title';
const INDEXABLE_ROUTES = new Set(['/', '/login', '/forgot-password']);

const ROUTE_TITLE_KEYS: Readonly<Record<string, string>> = {
  '/login': 'auth:login.title',
  '/forgot-password': 'auth:login.forgotPassword',
  '/403': 'auth:forbidden.title',
  '/admin/dashboard': 'common:nav.dashboard',
  '/admin/schedule': 'common:nav.scheduleAdmin',
  '/admin/late-schedule': 'common:nav.lateSchedule',
  '/admin/employees': 'common:nav.employees',
  '/admin/departments': 'common:nav.departments',
  '/admin/reports': 'common:nav.reports',
  '/admin/audit-log': 'common:nav.auditLog',
  '/admin/shift-requests': 'common:nav.shiftRequests',
  '/admin/employee-justification': 'common:nav.employeeJustification',
  '/employee/dashboard': 'common:nav.dashboard',
  '/schedule/me': 'common:nav.mySchedule',
  '/schedule/department': 'common:nav.departmentSchedule',
  '/late-schedule': 'common:nav.lateSchedule',
  '/calendar-sync': 'common:nav.calendarSync',
  '/shift-requests': 'common:nav.shiftRequests',
  '/notifications': 'common:nav.notifications',
  '/profile': 'common:nav.profile',
};

function normalizePathname(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '').toLowerCase();
}

function getRouteTitleKey(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === '/') return LOADING_TITLE_KEY;
  return ROUTE_TITLE_KEYS[normalizedPathname] ?? UNKNOWN_ROUTE_TITLE_KEY;
}

interface DocumentTitleProps {
  children: ReactNode;
}

export default function DocumentTitle({ children }: DocumentTitleProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation(['common', 'auth']);
  const applicationName = t(APPLICATION_NAME_KEY);
  const routeTitle = t(getRouteTitleKey(pathname));
  const normalizedPathname = normalizePathname(pathname);

  useEffect(() => {
    document.title = `${routeTitle} | ${applicationName}`;
    const isIndexableRoute = INDEXABLE_ROUTES.has(normalizedPathname);
    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute(
      'content',
      isIndexableRoute
        ? 'index, follow'
        : 'noindex, nofollow, noarchive',
    );
    const attribution = document.getElementById('app-attribution');
    if (attribution) attribution.hidden = !isIndexableRoute;
  }, [applicationName, normalizedPathname, routeTitle]);

  return children;
}
