import type { ShiftTypeKey } from './department';

export type ShiftStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export interface Shift {
  id: string;
  employeeId: string;
  employeeName?: string;
  shiftTypeId: string;
  shiftType?: ShiftTypeKey;
  date: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  notes?: string;
}

export interface ScheduleDay {
  date: string;
  shifts: Shift[];
}

export interface BulkEditPayload {
  employeeIds: string[];
  dates: string[];
  shiftTypeId: string;
  repeatWeekly?: boolean;
}
