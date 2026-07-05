import { useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  mockEmployeesSource,
  mockDepartmentsSource,
  mockNotificationsSource,
  mockAuditLogSource,
  mockShiftTypesSource,
  mockShifts,
} from '@/mocks/sources';
import {
  resolveEmployee,
  resolveDepartment,
  resolveNotification,
  resolveAuditLog,
  resolveShiftType,
  resolveShift,
} from '@/mocks/resolveMockData';

export function useMockData() {
  const { language } = useLanguage();

  return useMemo(() => {
    const employees = mockEmployeesSource.map((e) => resolveEmployee(e, language));
    const departments = mockDepartmentsSource.map((d) => resolveDepartment(d, language));
    const notifications = mockNotificationsSource.map((n) => resolveNotification(n, language));
    const auditLog = mockAuditLogSource.map((e) => resolveAuditLog(e, language));
    const shiftTypes = mockShiftTypesSource.map((st) => resolveShiftType(st, language));
    const shifts = mockShifts.map((s) => resolveShift(s, language, employees));

    return {
      language,
      employees,
      departments,
      notifications,
      auditLog,
      shiftTypes,
      shifts,
    };
  }, [language]);
}
