import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import type { UserRole } from '@/types';
import { resolveEffectiveEmployeeAccess, type EmployeePermission } from '@/types/employeeAccess';

interface RouteGuardProps {
  allowedRoles?: UserRole[];
  requiredPermission?: EmployeePermission;
  requiredAnyPermission?: EmployeePermission[];
}

export default function RouteGuard({ allowedRoles, requiredPermission, requiredAnyPermission }: RouteGuardProps) {
  const { user, isAuthenticated } = useAuthStore();
  const accessProfile = useEmployeeAccessStore((state) => user ? state.profiles[user.id] : undefined);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  if (user.role === 'employee') {
    const access = resolveEffectiveEmployeeAccess(user, accessProfile);
    if (!access.active) {
      return <Navigate to="/403" replace />;
    }
    if (requiredPermission && (!access.active || !access.permissions[requiredPermission])) {
      return <Navigate to="/403" replace />;
    }
    if (requiredAnyPermission?.length && (!access.active || !requiredAnyPermission.some((permission) => access.permissions[permission]))) {
      return <Navigate to="/403" replace />;
    }
  }

  return <Outlet />;
}
