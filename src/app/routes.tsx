import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/layouts/AppShell';
import RouteGuard from '@/features/auth/RouteGuard';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import NotFoundPage from '@/features/auth/NotFoundPage';
import ForbiddenPage from '@/features/auth/ForbiddenPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import AdminSchedulePage from '@/features/schedule/AdminSchedulePage';
import EmployeesPage from '@/features/employees/EmployeesPage';
import DepartmentsPage from '@/features/departments/DepartmentsPage';
import ReportsPage from '@/features/reports/ReportsPage';
import AuditLogPage from '@/features/reports/AuditLogPage';
import EmployeeSchedulePage from '@/features/schedule/EmployeeSchedulePage';
import DepartmentSchedulePage from '@/features/schedule/DepartmentSchedulePage';
import CalendarSyncPage from '@/features/calendar-sync/CalendarSyncPage';
import NotificationsPage from '@/features/notifications/NotificationsPage';
import ProfilePage from '@/features/employees/ProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/403',
    element: <ForbiddenPage />,
  },
  {
    path: '/',
    element: <RouteGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          // مسارات المسؤول (Admin Routes)
          {
            element: <RouteGuard allowedRoles={['admin']} />,
            children: [
              {
                path: 'admin/dashboard',
                element: <DashboardPage />,
              },
              {
                path: 'admin/schedule',
                element: <AdminSchedulePage />,
              },
              {
                path: 'admin/employees',
                element: <EmployeesPage />,
              },
              {
                path: 'admin/departments',
                element: <DepartmentsPage />,
              },
              {
                path: 'admin/reports',
                element: <ReportsPage />,
              },
              {
                path: 'admin/audit-log',
                element: <AuditLogPage />,
              },
            ],
          },
          // مسارات الموظف والعامة المشتركة (Employee Routes)
          {
            path: 'schedule/me',
            element: <EmployeeSchedulePage />,
          },
          {
            path: 'schedule/department',
            element: <DepartmentSchedulePage />,
          },
          {
            path: 'calendar-sync',
            element: <CalendarSyncPage />,
          },
          {
            element: <RouteGuard allowedRoles={['employee']} />,
            children: [
              {
                path: 'notifications',
                element: <NotificationsPage />,
              },
            ],
          },
          {
            path: 'profile',
            element: <ProfilePage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
