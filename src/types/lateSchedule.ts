export interface OTEmployeeAssignment {
  kind: 'employee';
  employeeId: string;
}

export interface OTUnresolvedAssignment {
  kind: 'unresolved';
  legacyCode: string;
}

export type OTCellAssignment = OTEmployeeAssignment | OTUnresolvedAssignment;

export type OTMonthStatus = 'draft' | 'published';

export interface OTUnit {
  id: string;
  name: string;
  archived?: boolean;
}

export interface OTShiftRow {
  id: string;
  unitId?: string;
  title: string;
  titleAr?: string;
  titleEn?: string;
  location: string;
  timeRange: string;
  hours: number;
  highlightedDays?: number[];
  backgroundColor?: string;
  textColor?: string;
  shortCode?: string;
  icon?: string;
  archived?: boolean;
  assignments: Record<number, OTCellAssignment[]>;
}

export interface OTShiftInput {
  unitId?: string;
  title: string;
  location: string;
  timeRange: string;
  hours: number;
  highlightedDays?: number[];
  backgroundColor?: string;
  textColor?: string;
  shortCode?: string;
  icon?: string;
}

/** In-memory snapshot used when copying an entire OT table between months. */
export interface OTTableClipboard {
  sourceKey: string;
  sourceYear: number;
  sourceMonth: number;
  copiedAt: string;
  assignmentCount: number;
  rows: OTShiftRow[];
  units: OTUnit[];
}

export type OTTableOperationResult =
  | {
      ok: true;
      affected: number;
      omittedAssignments: number;
      sourceKey: string;
      targetKey?: string;
      message?: string;
    }
  | {
      ok: false;
      reason: 'no_clipboard' | 'not_found' | 'storage_error';
      message?: string;
    };

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
  version: 5;
  unitsByMonth: Record<string, OTUnit[]>;
  /** Immutable employee-facing snapshots created only by Publish. */
  publishedRowsByMonth: Record<string, OTShiftRow[]>;
  publishedUnitsByMonth: Record<string, OTUnit[]>;
  /** Department ownership for both draft and published months. */
  departmentIdsByMonth: Record<string, string>;
  monthStatuses: Record<string, OTMonthStatus>;
  versionsByMonth: Record<string, OTMonthVersion[]>;
  deletedMonths: string[];
}

export interface LateSchedulePersistedStateV3 extends LateSchedulePersistedFields { version: 3 }

export interface LateSchedulePersistedStateV4 extends LateSchedulePersistedFields {
  version: 4;
  unitsByMonth: Record<string, OTUnit[]>;
  monthStatuses: Record<string, OTMonthStatus>;
  versionsByMonth: Record<string, OTMonthVersion[]>;
  deletedMonths: string[];
}

export interface OTMonthVersion {
  id: string;
  createdAt: string;
  actorName: string;
  reason: 'publish' | 'clear' | 'reset' | 'delete' | 'restore' | 'paste' | 'shift_request';
  rows: OTShiftRow[];
  units: OTUnit[];
  notice: string;
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
        | 'row_not_found'
        | 'storage_error';
    };

export type OTAdminMutationResult =
  | { ok: true; affected?: number; message?: string }
  | { ok: false; reason: 'not_found' | 'invalid_state' | 'storage_error'; message?: string };
