import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const APPLICATION_NAME_KEY = 'common:sidebar.subtitle';
const LOADING_TITLE_KEY = 'common:loading';
const UNKNOWN_ROUTE_TITLE_KEY = 'auth:notFound.title';
const PUBLIC_DESCRIPTION_KEY = 'auth:login.heroDescription';
const INDEXABLE_ROUTES = new Set(['/', '/login']);

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

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function updateCanonicalLink(pathname: string, indexable: boolean): void {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!indexable) {
    canonical?.remove();
    return;
  }

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  const canonicalPath = pathname === '/' ? '/login' : pathname;
  canonical.href = new URL(canonicalPath, window.location.origin).toString();
}

interface DocumentTitleProps {
  children: ReactNode;
}

export default function DocumentTitle({ children }: DocumentTitleProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation(['common', 'auth']);
  const applicationName = t(APPLICATION_NAME_KEY);
  const routeTitle = t(getRouteTitleKey(pathname));
  const description = t(PUBLIC_DESCRIPTION_KEY);
  const normalizedPathname = normalizePathname(pathname);

  useEffect(() => {
    const fullTitle = `${routeTitle} | ${applicationName}`;
    document.title = fullTitle;
    const isIndexableRoute = INDEXABLE_ROUTES.has(normalizedPathname);
    upsertMeta(
      'name',
      'robots',
      isIndexableRoute
        ? 'index, follow'
        : 'noindex, nofollow, noarchive',
    );
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', applicationName);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:locale', document.documentElement.lang === 'ar' ? 'ar_SA' : 'en_US');
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    updateCanonicalLink(normalizedPathname, isIndexableRoute);
    const attribution = document.getElementById('app-attribution');
    if (attribution) attribution.hidden = !isIndexableRoute;
  }, [applicationName, description, normalizedPathname, routeTitle]);

  return children;
}
