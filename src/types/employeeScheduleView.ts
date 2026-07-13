import type { OperationalOccurrence, OperationalPeriod, OperationalShiftCategory } from './operationalSchedule';

export interface EmployeeScheduleDay { date: string; occurrences: OperationalOccurrence[] }

export interface EmployeeScheduleView {
  employeeId: string;
  period: OperationalPeriod;
  availability: 'available' | 'partial' | 'missing';
  nextShift?: OperationalOccurrence;
  occurrences: OperationalOccurrence[];
  days: EmployeeScheduleDay[];
  totals: Record<OperationalShiftCategory, number> & { otHours: number };
  notices: Array<{ id: string; date: string; kind: 'conflict' | 'approvedVacation'; severity: 'info' | 'warning'; label: string }>;
}

export interface DepartmentShiftGroup { category: OperationalShiftCategory; occurrences: OperationalOccurrence[] }
export interface DepartmentScheduleDay { date: string; groups: DepartmentShiftGroup[] }

export interface DepartmentScheduleView {
  period: OperationalPeriod;
  availability: 'available' | 'partial' | 'missing';
  occurrences: OperationalOccurrence[];
  days: DepartmentScheduleDay[];
  facilities: string[];
}

export interface DepartmentScheduleFilters { facility: string | 'all'; category: OperationalShiftCategory | 'all' }
