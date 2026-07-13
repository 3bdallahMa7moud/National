export interface OTEmployeeAssignment {
  kind: 'employee';
  employeeId: string;
}

export interface OTUnresolvedAssignment {
  kind: 'unresolved';
  legacyCode: string;
}

export type OTCellAssignment = OTEmployeeAssignment | OTUnresolvedAssignment;

export interface OTShiftRow {
  id: string;
  title: string;
  location: string;
  timeRange: string;
  hours: number;
  highlightedDays?: number[];
  archived?: boolean;
  assignments: Record<number, OTCellAssignment[]>;
}

export interface OTShiftInput {
  title: string;
  location: string;
  timeRange: string;
  hours: number;
  highlightedDays?: number[];
}

export interface OTRosterEmployee {
  employeeId: string;
  code: string;
  fullName: string;
  fullNameEn?: string;
}

export type LateScheduleWarning =
  | { kind: 'storage_recovery' }
  | { kind: 'unresolved_employee'; code: string };

interface LateSchedulePersistedFields {
  currentYear: number;
  currentMonth: number;
  rowsByMonth: Record<string, OTShiftRow[]>;
  notice: string;
}

export interface LateSchedulePersistedStateV2 extends LateSchedulePersistedFields {
  version: 2;
}

export interface LateSchedulePersistedState extends LateSchedulePersistedFields {
  version: 3;
}

export type OTMutationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'capacity'
        | 'invalid_day'
        | 'title_required'
        | 'location_required'
        | 'time_required'
        | 'hours_invalid'
        | 'row_not_found';
    };
