import type { OperationalShiftCategory, OperationalShiftVisual } from './operationalSchedule';

export type CoverageCategory = 'day' | 'late' | 'night' | 'onCall' | 'ot';

export interface CoverageMetric {
  category: CoverageCategory;
  assignedEmployees: number;
  assignments: number;
  expectedSlots: number | null;
  coveredSlots: number | null;
  uncoveredSlots: number | null;
  hours: number | null;
  scheduledRows: number;
  conflicts: number;
  approvedAbsences: number;
  /** Unique published row colors contributing to this aggregate. */
  shiftColors?: OperationalShiftVisual[];
}

export interface DailyShiftItem extends OperationalShiftVisual {
  id: string;
  source: 'schedule' | 'ot';
  category: CoverageCategory;
  subcategory: OperationalShiftCategory;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  facility: string;
  unit: string;
  label: string;
  timeRange: string;
  hours: number;
  rowId: string;
  day: number;
  uncovered: boolean;
  unresolvedEmployee: boolean;
  hasConflict: boolean;
  isOnApprovedVacation: boolean;
  href: string;
}

export interface DailyShiftGroup {
  category: CoverageCategory;
  assignmentCount: number;
  issueCount: number;
  items: DailyShiftItem[];
}

export interface OperationalIssue {
  id: string;
  severity: 'critical' | 'warning';
  kind: 'uncovered' | 'conflict' | 'approvedAbsence' | 'unresolvedEmployee';
  label: string;
  count: number;
  href: string;
  category: CoverageCategory;
}

export interface OperationalSnapshot {
  date: string;
  availability: 'available' | 'missing';
  coverage: CoverageMetric[];
  shiftGroups: DailyShiftGroup[];
  issues: OperationalIssue[];
  secondary: {
    activeEmployees: number;
    scheduledEmployees: number;
    standardAssignments: number;
    otAssignments: number;
    otHours: number;
    vacationEmployees: number;
  };
}
