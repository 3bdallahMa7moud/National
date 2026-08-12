import { useMemo } from 'react';
import { SHIFT_TYPES } from '@/data/shiftTypes';
import { useLanguage } from '@/hooks/useLanguage';
import { employeeRecordToEmployee, localizeShift, localizeShiftType } from '@/lib/localizedRecords';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import { useScheduleStore } from '@/stores/scheduleStore';

export function useSchedule(employeeId?: string, month?: number, year?: number) {
  const { shifts, addShift, updateShift, deleteShift, addShiftToCell, bulkUpdateShifts } = useScheduleStore();
  const { language } = useLanguage();
  const directoryRecords = useEmployeeDirectoryStore((state) => state.records);

  const now = new Date();
  const currentMonth = month ?? now.getMonth();
  const currentYear = year ?? now.getFullYear();
  const employees = useMemo(
    () => directoryRecords.map((record) => employeeRecordToEmployee(record, language)),
    [directoryRecords, language],
  );
  const shiftTypes = useMemo(
    () => SHIFT_TYPES.map((shiftType) => localizeShiftType(shiftType, language)),
    [language],
  );

  const localizedShifts = useMemo(
    () => shifts.map((shift) => localizeShift(shift, employees)),
    [shifts, employees],
  );

  const filteredShifts = useMemo(() => {
    let result = localizedShifts;
    if (employeeId) {
      result = result.filter((s) => s.employeeId === employeeId);
    }
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;
    result = result.filter((s) => s.date.startsWith(prefix));
    return result;
  }, [localizedShifts, employeeId, currentMonth, currentYear]);

  return {
    shifts: filteredShifts,
    shiftTypes,
    updateShift,
    addShift,
    deleteShift,
    addShiftToCell,
    bulkUpdateShifts,
    allShifts: localizedShifts,
  };
}
