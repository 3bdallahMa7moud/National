import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import RouteGuard from '@/features/auth/RouteGuard';

const AppShell = lazy(() => import('@/layouts/AppShell'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const NotFoundPage = lazy(() => import('@/features/auth/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/features/auth/ForbiddenPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const AdminSchedulePage = lazy(() => import('@/features/schedule/AdminSchedulePage'));
const ScheduleManagementPage = lazy(() => import('@/features/schedule-management/ScheduleManagementPage'));
const EmployeesPage = lazy(() => import('@/features/employees/EmployeesPage'));
const DepartmentsPage = lazy(() => import('@/features/departments/DepartmentsPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const AuditLogPage = lazy(() => import('@/features/reports/AuditLogPage'));
const EmployeeSchedulePage = lazy(() => import('@/features/schedule/EmployeeSchedulePage'));
const DepartmentSchedulePage = lazy(() => import('@/features/schedule/DepartmentSchedulePage'));
const CalendarSyncPage = lazy(() => import('@/features/calendar-sync/CalendarSyncPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('@/features/employees/ProfilePage'));

const routeFallback = (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm font-semibold text-text-secondary">
    Loading...
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
  },
  {
    path: '/register',
    element: lazyElement(<RegisterPage />),
  },
  {
    path: '/403',
    element: lazyElement(<ForbiddenPage />),
  },
  {
    path: '/',
    element: <RouteGuard />,
    children: [
      {
        element: lazyElement(<AppShell />),
        children: [
          // مسارات المسؤول (Admin Routes)
          {
            element: <RouteGuard allowedRoles={['admin']} />,
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
                path: 'admin/schedule-management',
                element: lazyElement(<ScheduleManagementPage />),
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
            ],
          },
          // مسارات الموظف والعامة المشتركة (Employee Routes)
          {
            path: 'schedule/me',
            element: lazyElement(<EmployeeSchedulePage />),
          },
          {
            path: 'schedule/department',
            element: lazyElement(<DepartmentSchedulePage />),
          },
          {
            path: 'calendar-sync',
            element: lazyElement(<CalendarSyncPage />),
          },
          {
            element: <RouteGuard allowedRoles={['employee']} />,
            children: [
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
