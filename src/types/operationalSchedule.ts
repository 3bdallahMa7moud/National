import type { ShiftColorKey } from './scheduleMatrix';

export type OperationalShiftCategory =
  | 'day'
  | 'late'
  | 'night'
  | 'onCallDay'
  | 'onCallNight'
  | 'ot';

export interface OperationalPeriod {
  startDate: string;
  endDate: string;
}

export interface OperationalShiftVisual {
  colorKey: ShiftColorKey;
  backgroundColor?: string;
  textColor?: string;
}

export interface OperationalOccurrence extends OperationalShiftVisual {
  id: string;
  date: string;
  source: 'schedule' | 'ot';
  employeeId?: string;
  employeeCode: string;
  employeeName?: string;
  unresolvedEmployee: boolean;
  category: OperationalShiftCategory;
  label: string;
  facility: string;
  unit: string;
  timeRange: string;
  hours: number;
  rowId: string;
  hasConflict: boolean;
  conflictReason?: string;
  isOnApprovedVacation: boolean;
}
