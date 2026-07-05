import { useMemo } from 'react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useMockData } from '@/hooks/useMockData';
import { resolveShift } from '@/mocks/resolveMockData';

export function useSchedule(employeeId?: string, month?: number, year?: number) {
  const { shifts, addShift, updateShift, deleteShift, addShiftToCell, bulkUpdateShifts } = useScheduleStore();
  const { employees, shiftTypes, language } = useMockData();

  const now = new Date();
  const currentMonth = month ?? now.getMonth();
  const currentYear = year ?? now.getFullYear();

  const localizedShifts = useMemo(
    () => shifts.map((s) => resolveShift(s, language, employees)),
    [shifts, language, employees],
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
