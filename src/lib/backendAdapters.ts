import type { Language } from '@/i18n/constants';
import type { AuthUser, DepartmentRecord } from '@/types';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import type { EmployeeDirectoryRecord } from '@/types/employeeDirectory';

export interface ApiLocalizedText {
  en: string;
  ar: string;
}

export interface ApiViewer {
  id: string;
  employeeNumber: string;
  code: string;
  role: 'super_admin' | 'admin' | 'employee';
  email: string;
  phone: string;
  isActive: boolean;
  scheduleEmployeeId?: string;
  name: ApiLocalizedText;
  department: {
    id: string;
    name: ApiLocalizedText;
  };
  position: ApiLocalizedText;
  access: {
    templateId: 'standard' | 'view_only' | 'coordinator';
    overrides: Record<string, boolean>;
    active: boolean;
    updatedAt: string;
    updatedBy: string;
  } | null;
}

export interface ApiDepartment {
  id: string;
  name: ApiLocalizedText;
  description: ApiLocalizedText;
  managerId?: string | null;
}

export interface ApiEmployee {
  id: string;
  name: ApiLocalizedText;
  email: string;
  phone: string;
  role: 'super_admin' | 'admin' | 'employee';
  departmentId: string;
  departmentName: ApiLocalizedText;
  position: ApiLocalizedText;
  employeeNumber: string;
  code: string;
  avatar?: string | null;
  isActive: boolean;
  createdAt: string;
  scheduleEmployeeId?: string | null;
}

export interface ApiBootstrapPayload {
  departments: ApiDepartment[];
  employees: ApiEmployee[];
  accessProfiles: Record<string, {
    accountId: string;
    departmentId: string;
    scheduleEmployeeId?: string;
    templateId: 'standard' | 'view_only' | 'coordinator';
    overrides: Record<string, boolean>;
    active: boolean;
    updatedAt: string;
    updatedBy: string;
  }>;
  notifications: unknown[];
  auditEntries: unknown[];
  shiftRequests: unknown[];
  schedule: {
    draftsByMonth: Record<string, unknown>;
    matricesByMonth: Record<string, unknown>;
    versionsByMonth: Record<string, unknown[]>;
    monthStatuses: Record<string, 'draft' | 'published'>;
    deletedMonths: string[];
    updatedAtByMonth: Record<string, string>;
  };
  overtime: {
    rowsByMonth: Record<string, unknown[]>;
    unitsByMonth: Record<string, unknown[]>;
    publishedRowsByMonth: Record<string, unknown[]>;
    publishedUnitsByMonth: Record<string, unknown[]>;
    versionsByMonth: Record<string, unknown[]>;
    monthStatuses: Record<string, 'draft' | 'published'>;
    deletedMonths: string[];
    notice: string;
    departmentIdsByMonth: Record<string, string>;
    updatedAtByMonth: Record<string, string>;
  };
}

function localize(value: ApiLocalizedText, language: Language): string {
  return language === 'ar' ? value.ar : value.en;
}

export function mapViewerToAuthUser(viewer: ApiViewer, language: Language): AuthUser {
  return {
    id: viewer.id,
    name: localize(viewer.name, language),
    email: viewer.email,
    role: viewer.role,
    departmentId: viewer.department.id,
    departmentName: localize(viewer.department.name, language),
    code: viewer.code,
    scheduleEmployeeId: viewer.scheduleEmployeeId,
  };
}

export function mapApiEmployeeToDirectoryRecord(
  employee: ApiEmployee,
  accessProfile?: EmployeeAccessProfile,
): EmployeeDirectoryRecord {
  return {
    accountId: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    role: employee.role,
    departmentId: employee.departmentId,
    departmentName: employee.departmentName,
    position: employee.position,
    employeeNumber: employee.employeeNumber,
    code: employee.code,
    avatar: employee.avatar ?? undefined,
    active: employee.isActive,
    createdAt: employee.createdAt,
    scheduleEmployeeId: employee.scheduleEmployeeId ?? undefined,
    origin: 'official',
    issues: [],
    access: {
      templateId: accessProfile?.templateId ?? 'standard',
      overrides: { ...(accessProfile?.overrides ?? {}) },
      updatedAt: accessProfile?.updatedAt ?? employee.createdAt,
      updatedBy: accessProfile?.updatedBy ?? 'system',
    },
  };
}

export function mapApiDepartmentToRecord(department: ApiDepartment): DepartmentRecord {
  return {
    id: department.id,
    name: department.name,
    description: department.description,
    managerId: department.managerId ?? undefined,
  };
}
