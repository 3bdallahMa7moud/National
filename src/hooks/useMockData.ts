import { useMemo, useState, useEffect } from 'react';
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

export function triggerMockDataChange() {
  window.dispatchEvent(new Event('mock-data-changed'));
}

export function useMockData() {
  const { language } = useLanguage();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener('mock-data-changed', handler);
    return () => window.removeEventListener('mock-data-changed', handler);
  }, []);

  return useMemo(() => {
    void tick;
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
  }, [language, tick]);
}
