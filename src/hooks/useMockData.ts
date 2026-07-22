import { useMemo, useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  mockDepartmentsSource,
  mockNotificationsSource,
  mockAuditLogSource,
  mockShiftTypesSource,
  mockShifts,
} from '@/mocks/sources';
import { directoryRecordToMockSource, useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
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
  const directoryRecords = useEmployeeDirectoryStore((state) => state.records);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener('mock-data-changed', handler);
    return () => window.removeEventListener('mock-data-changed', handler);
  }, []);

  return useMemo(() => {
    void tick;
    const employees = directoryRecords.map((record) => resolveEmployee(directoryRecordToMockSource(record), language));
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
  }, [directoryRecords, language, tick]);
}
