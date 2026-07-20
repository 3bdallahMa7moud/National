import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Trans } from 'react-i18next';
import RouteGuard from '@/features/auth/RouteGuard';
import RouteErrorFallback from '@/components/common/RouteErrorFallback';

const AppShell = lazy(() => import('@/layouts/AppShell'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const NotFoundPage = lazy(() => import('@/features/auth/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/features/auth/ForbiddenPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const EmployeeDashboardPage = lazy(() => import('@/features/dashboard/EmployeeDashboardPage'));
const AdminSchedulePage = lazy(() => import('@/features/schedule/AdminSchedulePage'));
const LateSchedulePage = lazy(() => import('@/features/late-schedule/LateSchedulePage'));
const EmployeesPage = lazy(() => import('@/features/employees/EmployeesPage'));
const DepartmentsPage = lazy(() => import('@/features/departments/DepartmentsPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const AuditLogPage = lazy(() => import('@/features/reports/AuditLogPage'));
const EmployeeSchedulePage = lazy(() => import('@/features/schedule/EmployeeSchedulePage'));
const DepartmentSchedulePage = lazy(() => import('@/features/schedule/DepartmentSchedulePage'));
const CalendarSyncPage = lazy(() => import('@/features/calendar-sync/CalendarSyncPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ShiftRequestsPage = lazy(() => import('@/features/shift-requests/ShiftRequestsPage'));
const AdminShiftRequestsPage = lazy(() => import('@/features/shift-requests/AdminShiftRequestsPage'));
const EmployeeShiftRequestsPage = lazy(() => import('@/features/shift-requests/EmployeeShiftRequestsPage'));
const EmployeeJustificationPage = lazy(() => import('@/features/employee-justification/EmployeeJustificationPage'));
const ProfilePage = lazy(() => import('@/features/employees/ProfilePage'));

const routeFallback = (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-text-secondary">
    <Trans ns="common" i18nKey="loading" />
  </div>
);

function lazyElement(element: ReactNode) {
  return <Suspense fallback={routeFallback}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: lazyElement(<LoginPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/forgot-password',
    element: lazyElement(<ForgotPasswordPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/403',
    element: lazyElement(<ForbiddenPage />),
  },
  {
    path: '/',
    element: <RouteGuard />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        element: lazyElement(<AppShell />),
        errorElement: <RouteErrorFallback />,
        children: [
          // مسارات المسؤول (Admin Routes)
          {
            element: <RouteGuard allowedRoles={['admin']} />,
            errorElement: <RouteErrorFallback />,
            children: [
              {
                path: 'admin/dashboard',
                element: lazyElement(<DashboardPage />),
              },
              {
                path: 'admin/schedule',
                element: lazyElement(<AdminSchedulePage />),
              },
              {
                path: 'admin/late-schedule',
                element: lazyElement(<LateSchedulePage />),
              },
              {
                path: 'admin/employees',
                element: lazyElement(<EmployeesPage />),
              },
              {
                path: 'admin/departments',
                element: lazyElement(<DepartmentsPage />),
              },
              {
                path: 'admin/reports',
                element: lazyElement(<ReportsPage />),
              },
              {
                path: 'admin/audit-log',
                element: lazyElement(<AuditLogPage />),
              },
              {
                path: 'admin/shift-requests',
                element: lazyElement(<AdminShiftRequestsPage />),
              },
              {
                path: 'admin/employee-justification',
                element: lazyElement(<EmployeeJustificationPage />),
              },
            ],
          },
          // مسارات الموظف والعامة المشتركة (Employee Routes)
          {
            element: <RouteGuard allowedRoles={['employee']} />,
            errorElement: <RouteErrorFallback />,
            children: [
              {
                path: 'employee/dashboard',
                element: lazyElement(<EmployeeDashboardPage />),
              },
              {
                element: <RouteGuard requiredAnyPermission={['schedule.own.view', 'schedule.ot.own.view']} />,
                children: [{
                  path: 'schedule/me',
                  element: lazyElement(<EmployeeSchedulePage />),
                }],
              },
              {
                element: <RouteGuard requiredAnyPermission={['schedule.department.view', 'schedule.ot.department.view']} />,
                children: [{
                  path: 'schedule/department',
                  element: lazyElement(<DepartmentSchedulePage />),
                }],
              },
              {
                element: <RouteGuard requiredPermission="schedule.ot.own.view" />,
                children: [{
                  path: 'late-schedule',
                  element: <Navigate to="/schedule/me?tab=ot" replace />,
                }],
              },
              {
                element: <RouteGuard requiredPermission="schedule.calendar.sync" />,
                children: [{
                  path: 'calendar-sync',
                  element: lazyElement(<CalendarSyncPage />),
                }],
              },
              {
                element: <RouteGuard requiredAnyPermission={[
                  'schedule.exchange.create',
                  'schedule.replace.create',
                  'schedule.requests.respond',
                  'schedule.requests.cancelOwn',
                  'schedule.department.requests.view',
                ]} />,
                children: [{
                  path: 'shift-requests',
                  element: lazyElement(<EmployeeShiftRequestsPage />),
                }],
              },
              {
                path: 'notifications',
                element: lazyElement(<NotificationsPage />),
              },
            ],
          },
          {
            path: 'profile',
            element: lazyElement(<ProfilePage />),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: lazyElement(<NotFoundPage />),
  },
]);
