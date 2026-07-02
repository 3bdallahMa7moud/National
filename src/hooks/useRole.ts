import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

export function useRole() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const hasRole = (role: UserRole) => user?.role === role;

  return { role: user?.role, isAdmin, isEmployee, hasRole };
}
