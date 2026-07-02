import { useMemo } from 'react';
import { useScheduleStore } from '@/stores/scheduleStore';
import { mockShiftTypes } from '@/mocks/mockData';
import type { Shift, ShiftType } from '@/types';

export function useSchedule(employeeId?: string, month?: number, year?: number) {
  const { shifts, addShift, updateShift, deleteShift, addShiftToCell, bulkUpdateShifts } = useScheduleStore();
  
  const now = new Date();
  const currentMonth = month ?? now.getMonth();
  const currentYear = year ?? now.getFullYear();

  const filteredShifts = useMemo(() => {
    let result = shifts;
    if (employeeId) {
      result = result.filter((s) => s.employeeId === employeeId);
    }
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const prefix = `${currentYear}-${monthStr}`;
    result = result.filter((s) => s.date.startsWith(prefix));
    return result;
  }, [shifts, employeeId, currentMonth, currentYear]);

  const shiftTypes: ShiftType[] = mockShiftTypes;

  return {
    shifts: filteredShifts,
    shiftTypes,
    updateShift,
    addShift,
    deleteShift,
    addShiftToCell,
    bulkUpdateShifts,
    allShifts: shifts,
  };
}
