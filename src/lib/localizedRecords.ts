import type { Language } from '@/i18n/constants';
import type { Department, DepartmentRecord, Employee, Shift, ShiftType } from '@/types';
import type { EmployeeDirectoryRecord } from '@/types/employeeDirectory';

export function localize(value: { en: string; ar: string }, language: Language): string {
  return language === 'ar' ? value.ar : value.en;
}

export function departmentRecordToDepartment(
  department: DepartmentRecord,
  language: Language,
  employeeCount?: number,
): Department {
  return {
    id: department.id,
    name: localize(department.name, language),
    description: localize(department.description, language),
    managerId: department.managerId,
    employeeCount,
  };
}

export function employeeRecordToEmployee(
  employee: EmployeeDirectoryRecord,
  language: Language,
): Employee {
  return {
    id: employee.accountId,
    name: localize(employee.name, language),
    email: employee.email,
    phone: employee.phone,
    role: employee.role,
    departmentId: employee.departmentId,
    departmentName: localize(employee.departmentName, language),
    position: localize(employee.position, language),
    employeeNumber: employee.employeeNumber,
    code: employee.code,
    avatar: employee.avatar,
    isActive: employee.active,
    createdAt: employee.createdAt,
  };
}

export function localizeShiftType(shiftType: ShiftType, language: Language): ShiftType {
  return {
    ...shiftType,
    name: language === 'ar' ? shiftType.nameAr : shiftType.name,
  };
}

export function localizeShift(
  shift: Shift,
  employees: Employee[],
): Shift {
  const employee = employees.find((candidate) => candidate.id === shift.employeeId);
  return {
    ...shift,
    employeeName: shift.employeeName || employee?.name || '',
  };
}
