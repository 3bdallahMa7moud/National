import { create } from 'zustand';
import { mockShiftTypesSource, mockShifts } from '@/mocks/sources';
import type { Shift } from '@/types';

interface ScheduleState {
  shifts: Shift[];
  addShift: (shift: Shift) => void;
  updateShift: (shiftId: string, updates: Partial<Shift>) => void;
  deleteShift: (shiftId: string) => void;
  addShiftToCell: (employeeId: string, employeeName: string, dateStr: string, shiftTypeKey: string, replaceRegular?: boolean) => void;
  bulkUpdateShifts: (cellIds: string[], shiftTypeId: string, repeatWeekly: boolean) => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  shifts: mockShifts,
  addShift: (shift) => set((state) => ({ shifts: [...state.shifts, shift] })),
  updateShift: (shiftId, updates) =>
    set((state) => ({
      shifts: state.shifts.map((s) => (s.id === shiftId ? { ...s, ...updates } : s)),
    })),
  deleteShift: (shiftId) =>
    set((state) => ({
      shifts: state.shifts.filter((s) => s.id !== shiftId),
    })),
  addShiftToCell: (employeeId, employeeName, dateStr, shiftTypeKey, replaceRegular = true) => {
    set((state) => {
      let newShifts = [...state.shifts];
      const shiftType = mockShiftTypesSource.find((st) => st.key === shiftTypeKey || st.id === shiftTypeKey);
      if (!shiftType) return { shifts: newShifts };

      const isUrgentOrExtra = shiftType.key === 'oncall' || shiftType.key === 'overtime';

      if (replaceRegular && !isUrgentOrExtra) {
        newShifts = newShifts.filter(
          (s) => !(s.employeeId === employeeId && s.date === dateStr && s.shiftType !== 'oncall' && s.shiftType !== 'overtime')
        );
      }

      const newShift: Shift = {
        id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employeeId,
        employeeName,
        shiftTypeId: shiftType.id,
        shiftType: shiftType.key,
        date: dateStr,
        startTime: shiftType.startTime,
        endTime: shiftType.endTime,
        status: 'scheduled',
      };

      return { shifts: [...newShifts, newShift] };
    });
  },
  bulkUpdateShifts: (cellIds, shiftTypeId) => {
    set((state) => {
      let newShifts = [...state.shifts];
      const shiftType = mockShiftTypesSource.find((st) => st.id === shiftTypeId || st.key === shiftTypeId);
      if (!shiftType) return { shifts: newShifts };

      cellIds.forEach((cellId) => {
        const parts = cellId.split('-'); // e.g. ["emp", "1", "2026", "07", "05"]
        if (parts.length < 5) return;
        const empId = `${parts[0]}-${parts[1]}`;
        const dateStr = `${parts[2]}-${parts[3]}-${parts[4]}`;

        newShifts = newShifts.filter(
          (s) => !(s.employeeId === empId && s.date === dateStr && s.shiftType !== 'oncall' && s.shiftType !== 'overtime')
        );

        newShifts.push({
          id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          employeeId: empId,
          employeeName: '',
          shiftTypeId: shiftType.id,
          shiftType: shiftType.key,
          date: dateStr,
          startTime: shiftType.startTime,
          endTime: shiftType.endTime,
          status: 'scheduled',
        });
      });

      return { shifts: newShifts };
    });
  },
}));
