export type UserRole = 'admin' | 'employee';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  departmentId: string;
  departmentName?: string;
  position: string;
  employeeNumber: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentName: string;
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
