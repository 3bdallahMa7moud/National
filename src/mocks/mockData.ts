import type { Shift } from '@/types';
import { getStoredLanguage } from '@/i18n/constants';
import { verifyEmployeePassword } from './mockPasswordStore';
import { resolveCurrentEmployeeAccess } from '@/stores/employeeAccessStore';
import {
  mockDepartmentsSource,
  mockShiftTypesSource,
  mockEmployeesSource,
  mockNotificationsSource,
  mockAuditLogSource,
  mockShifts,
} from './sources';
import {
  resolveEmployee,
  resolveDepartment,
  resolveNotification,
  resolveAuditLog,
  resolveShiftType,
  resolveAuthUser,
} from './resolveMockData';

export type {
  MockDepartmentSource,
  MockShiftTypeSource,
  MockEmployeeSource,
  MockNotificationSource,
  MockAuditLogSource,
} from './types';

export {
  mockDepartmentsSource,
  mockShiftTypesSource,
  mockEmployeesSource,
  mockNotificationsSource,
  mockAuditLogSource,
  mockShifts,
} from './sources';

function resolveAll(lang = getStoredLanguage()) {
  return {
    employees: mockEmployeesSource.map((e) => resolveEmployee(e, lang)),
    departments: mockDepartmentsSource.map((d) => resolveDepartment(d, lang)),
    notifications: mockNotificationsSource.map((n) => resolveNotification(n, lang)),
    auditLog: mockAuditLogSource.map((e) => resolveAuditLog(e, lang)),
    shiftTypes: mockShiftTypesSource.map((st) => resolveShiftType(st, lang)),
  };
}

/** @deprecated Use useMockData() for language-aware data */
export const mockDepartments = resolveAll().departments;
/** @deprecated Use useMockData() for language-aware data */
export const mockEmployees = resolveAll().employees;
/** @deprecated Use useMockData() for language-aware data */
export const mockShiftTypes = resolveAll().shiftTypes;
/** @deprecated Use useMockData() for language-aware data */
export const mockNotifications = resolveAll().notifications;
/** @deprecated Use useMockData() for language-aware data */
export const mockAuditLog = resolveAll().auditLog;

export function mockLogin(identifier: string, password: string) {
  const input = identifier.trim().toLowerCase();

  // Find the matching employee by email, employee number, or name
  const source = mockEmployeesSource.find((e) => {
    const nameEn = typeof e.name === 'object' ? (e.name as { en: string; ar: string }).en : '';
    const nameAr = typeof e.name === 'object' ? (e.name as { en: string; ar: string }).ar : '';
    const emailMatch  = e.email !== '' && e.email.toLowerCase() === input;
    const empNumMatch = e.employeeNumber.toLowerCase() === input;
    const nameMatch   = nameEn.toLowerCase() === input || nameAr === input;
    return emailMatch || empNumMatch || nameMatch;
  });

  if (!source) return null;

  // Verify password against the mock password store (default: '123456')
  if (!verifyEmployeePassword(source.id, password)) return null;

  const lang = getStoredLanguage();
  const user = resolveAuthUser(source, lang);
  if (user.role === 'employee' && !resolveCurrentEmployeeAccess(user).active) return null;
  return {
    user,
    token: 'mock-jwt-token-' + source.id,
  };
}

export function getShiftsForEmployee(employeeId: string): Shift[] {
  return mockShifts.filter((s) => s.employeeId === employeeId);
}

export function getShiftsForDate(date: string): Shift[] {
  return mockShifts.filter((s) => s.date === date);
}

export function getShiftTypeById(id: string) {
  const source = mockShiftTypesSource.find((s) => s.id === id);
  if (!source) return undefined;
  return resolveShiftType(source, getStoredLanguage());
}

export function findEmployeeSource(id: string) {
  return mockEmployeesSource.find((e) => e.id === id);
}

export function findEmployeeSourceByEmail(email: string) {
  return mockEmployeesSource.find((e) => e.email === email);
}
