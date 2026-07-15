import type { Language } from '@/i18n/constants';
import { getLocalizedText, type LocalizedText } from '@/types/localized';
import type {
  Employee,
  Department,
  ShiftType,
  Shift,
  AppNotification,
  AuditLogEntry,
  AuthUser,
  ShiftTypeKey,
} from '@/types';
import type {
  MockEmployeeSource,
  MockDepartmentSource,
  MockNotificationSource,
  MockAuditLogSource,
  MockShiftTypeSource,
} from './types';
import { mockShiftTypesSource } from './sources';

function getShiftLabelByKey(key: ShiftTypeKey | undefined, lang: Language): string | undefined {
  if (!key) return undefined;
  const st = mockShiftTypesSource.find((s) => s.key === key);
  return st ? getLocalizedText(st.label, lang) : undefined;
}

export function resolveEmployee(emp: MockEmployeeSource, lang: Language): Employee {
  return {
    id: emp.id,
    name: getLocalizedText(emp.name, lang),
    email: emp.email,
    phone: emp.phone,
    role: emp.role,
    departmentId: emp.departmentId,
    departmentName: getLocalizedText(emp.departmentName, lang),
    position: getLocalizedText(emp.position, lang),
    employeeNumber: emp.employeeNumber,
    code: emp.code,
    avatar: emp.avatar,
    isActive: emp.isActive,
    createdAt: emp.createdAt,
  };
}

export function resolveDepartment(dept: MockDepartmentSource, lang: Language): Department {
  return {
    id: dept.id,
    name: getLocalizedText(dept.name, lang),
    description: getLocalizedText(dept.description, lang),
    managerId: dept.managerId,
    employeeCount: dept.employeeCount,
  };
}

export function resolveShiftType(st: MockShiftTypeSource, lang: Language): ShiftType {
  return {
    id: st.id,
    key: st.key,
    name: getLocalizedText(st.label, lang),
    nameAr: st.label.ar,
    color: st.color,
    startTime: st.startTime,
    endTime: st.endTime,
    hours: st.hours,
  };
}

export function resolveNotification(notif: MockNotificationSource, lang: Language): AppNotification {
  return {
    id: notif.id,
    type: notif.type,
    title: getLocalizedText(notif.title, lang),
    message: getLocalizedText(notif.message, lang),
    oldShiftType: getShiftLabelByKey(notif.oldShiftTypeKey, lang),
    newShiftType: getShiftLabelByKey(notif.newShiftTypeKey, lang),
    isRead: notif.isRead,
    isUrgent: notif.isUrgent,
    actionUrl: notif.actionUrl,
    createdAt: notif.createdAt,
  };
}

export function resolveAuditLog(entry: MockAuditLogSource, lang: Language): AuditLogEntry {
  return {
    id: entry.id,
    userId: entry.userId,
    userName: getLocalizedText(entry.userName, lang),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    description: getLocalizedText(entry.description, lang),
    oldValue: entry.oldValue ? getLocalizedText(entry.oldValue, lang) : undefined,
    newValue: entry.newValue ? getLocalizedText(entry.newValue, lang) : undefined,
    timestamp: entry.timestamp,
  };
}

export function resolveShift(
  shift: Shift,
  lang: Language,
  employees: Employee[],
): Shift {
  const employee = employees.find((e) => e.id === shift.employeeId);
  return {
    ...shift,
    employeeName: employee?.name ?? shift.employeeName,
  };
}

export function resolveAuthUser(emp: MockEmployeeSource, lang: Language): AuthUser {
  const resolved = resolveEmployee(emp, lang);
  return {
    id: resolved.id,
    name: resolved.name,
    email: resolved.email,
    role: resolved.role,
    departmentId: resolved.departmentId,
    departmentName: resolved.departmentName ?? getLocalizedText(emp.departmentName, lang),
    code: resolved.code,
    avatar: resolved.avatar,
    scheduleEmployeeId: emp.scheduleEmployeeId,
  };
}

export function updateLocalizedField(
  field: LocalizedText,
  lang: Language,
  value: string,
): LocalizedText {
  return { ...field, [lang]: value };
}
