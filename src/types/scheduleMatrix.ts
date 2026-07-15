// ============================================================
// Schedule Matrix - Type Definitions
// ============================================================
// Data shape for the dense, multi-facility monthly shift grid.
// month is 0-indexed (0 = January) to match JS Date conventions.

/** Shift color key - maps to chip color pairs in schedule-tokens.css */
export type ShiftColorKey =
  | 'morning'
  | 'evening'
  | 'night'
  | 'onCall'
  | 'onCallNight'
  | 'overtime'
  | 'vacation';

/** Facility accent color token - used for vertical band */
export type FacilityColorToken =
  | 'facility-kamc'
  | 'facility-kasch'
  | 'facility-whh';

export type ScheduleBlockType =
  | 'equipmentDay'
  | 'lateOrNight'
  | 'onCall'
  | 'vacation';

export type AssignmentStatus = 'draft' | 'published';

export type VacationType = 'annual' | 'sick' | 'emergency';

export type ScheduleMonthStatus = 'draft' | 'published';

export type ScheduleAdminMutationResult =
  | { ok: true; affected?: number; message?: string }
  | { ok: false; reason: 'not_found' | 'invalid_state' | 'storage_error'; message?: string };

export interface LegendEmployee {
  employeeId: string;
  code: string;
  fullName: string;
  fullNameEn?: string;
}

/** A single employee assignment within a cell */
export interface Assignment {
  employeeId: string;
  employeeCode: string;
  /** Legacy per-assignment override; new assignments inherit the row color. */
  colorKey?: ShiftColorKey;
  status?: AssignmentStatus;
  /** true if this employee conflicts with another assignment or an approved vacation */
  hasConflict?: boolean;
  conflictReason?: string;
  conflictType?: 'crossFacility' | 'vacation';
}

/** One row in the schedule grid = one Excel-style sub-row within a block */
export interface ShiftRow {
  id: string;
  /** Stable link to the facility shift definition. */
  shiftDefinitionId?: string;
  blockType: ScheduleBlockType;
  /** Parent unit / shift-type label, e.g. GE VCT, Late Shift, Night OnCall */
  unitLabel: string;
  /** Label printed in column 2 for this exact sub-row */
  rowLabel: string;
  /** Logical shift label used by conflict checks and ARIA labels */
  shiftLabel: string;
  /** e.g. "08:00 - 17:00" */
  timeRange: string;
  colorKey: ShiftColorKey;
  /** true for on-call / weekend-designated rows */
  weekendOnly: boolean;
  /** day number (1-31) -> unlimited unique employee assignments */
  cellsByDay: Record<number, Assignment[]>;
  /** Optional custom colors inherited from the linked shift definition. */
  backgroundColor?: string;
  textColor?: string;
  archived?: boolean;
  isOverflowRow?: boolean;
}

/** A unit / block within a facility */
export interface Unit {
  id: string;
  /** e.g. "GE VCT", "Room 1", "Night OnCall" */
  name: string;
  blockType: ScheduleBlockType;
  archived?: boolean;
  rows: ShiftRow[];
}

/** A hospital facility */
export interface Facility {
  id: string;
  /** e.g. "KAMC", "KASCH", "WHH" */
  name: string;
  accentColorToken: FacilityColorToken;
  units: Unit[];
}

export interface VacationRange {
  id: string;
  employeeId: string;
  startDay: number;
  endDay: number;
  type: VacationType;
  status: AssignmentStatus;
}

/** A named public-holiday band spanning one or more calendar days. */
export interface HolidayRange {
  id: string;
  label: string;
  labelAr?: string;
  startDay: number;
  endDay: number;
}

/** Vacation row for one employee */
export interface VacationRow {
  employeeId: string;
  employeeCode: string;
  /** Column 2 in the vacation band uses the full name, not the short code */
  fullName: string;
  /** Days off in the month, e.g. [1, 2, 8, 15] */
  daysOff: number[];
  type?: VacationType;
  ranges?: VacationRange[];
}

export interface ShiftDefinition {
  id: string;
  facilityId: string;
  label: string;
  arabicName?: string;
  englishName?: string;
  timeRange: string;
  startTime?: string;
  endTime?: string;
  colorKey: ShiftColorKey;
  backgroundColor?: string;
  textColor?: string;
  icon?: string;
  shortCode?: string;
  archived?: boolean;
  effectiveFromDay: number;
}

export interface UnitDefinition {
  id: string;
  facilityId: string;
  name: string;
  archived?: boolean;
}

export interface FacilitySettings {
  facilityId: string;
  shiftDefinitions: ShiftDefinition[];
  units: UnitDefinition[];
}

export interface AuditEntry {
  id: string;
  actorName: string;
  action:
    | 'assign'
    | 'remove'
    | 'vacation'
    | 'publish'
    | 'discard'
    | 'settings'
    | 'undo'
    | 'archive'
    | 'restore'
    | 'bulk-clear'
    | 'delete'
    | 'reset'
    | 'copy'
    | 'paste'
    | 'lock'
    | 'unlock'
    | 'clone'
    | 'version-restore'
    | 'reorder';
  facilityId?: string;
  unitId?: string;
  rowId?: string;
  day?: number;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

/** Complete schedule data for one month */
export interface ScheduleMatrixData {
  /** Owning department. Legacy months are hydrated as the CT department. */
  departmentId: string;
  /** 0-indexed month (0 = Jan, 11 = Dec) */
  month: number;
  year: number;
  facilities: Facility[];
  legend: LegendEmployee[];
  vacations: VacationRow[];
  holidays: HolidayRange[];
  settings: FacilitySettings[];
  auditLog: AuditEntry[];
}

export interface ScheduleMatrixVersion {
  id: string;
  createdAt: string;
  actorName: string;
  reason: 'publish' | 'clear' | 'reset' | 'delete' | 'restore' | 'paste' | 'shift_request';
  data: ScheduleMatrixData;
}

/** Reference to a specific cell in the matrix */
export interface MatrixCellRef {
  facilityId: string;
  unitId: string;
  rowId: string;
  day: number;
}

/** Payload for assigning employees to a cell */
export interface AssignmentChangePayload {
  rowId: string;
  day: number;
  /** Unlimited unique assignments per cell. */
  assignments: Assignment[];
}

/** Admin interaction modes */
export type MatrixAdminMode = 'view' | 'edit' | 'order' | 'vacations' | 'brush' | 'settings' | 'reports';

export type MatrixReorderPosition = 'before' | 'after';

/** Explicit command used by both the matrix and the Settings ordering panel. */
export type MatrixReorderCommand =
  | {
      kind: 'unit';
      facilityId: string;
      sourceUnitId: string;
      targetUnitId: string;
      position: MatrixReorderPosition;
    }
  | {
      kind: 'row';
      facilityId: string;
      sourceUnitId: string;
      sourceRowId: string;
      targetUnitId: string;
      targetRowId?: string;
      position: MatrixReorderPosition;
    };

export type MatrixReorderResult =
  | {
      ok: true;
      kind: MatrixReorderCommand['kind'];
      affectedAssignments: number;
      sourceUnitId: string;
      targetUnitId: string;
    }
  | {
      ok: false;
      reason: 'not_found' | 'same_position' | 'invalid_target' | 'storage_error';
      message?: string;
    };

export type MatrixDeleteResult =
  | { ok: true; affectedAssignments: number }
  | {
      ok: false;
      reason: 'not_found' | 'has_assignments' | 'storage_error';
      affectedAssignments?: number;
      message?: string;
    };

export interface ConflictDetail {
  facility?: string;
  unit?: string;
  shiftLabel?: string;
  day: number;
  timeRange?: string;
  type: 'crossFacility' | 'vacation' | 'storage';
  reason: string;
}

/** Result of assignment validation */
export type ValidateResult =
  | { ok: true }
  | { ok: false; conflict: ConflictDetail };
