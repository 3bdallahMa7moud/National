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
  /** @deprecated Visual color is inherited from the shift row. */
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
  /** Stable link to the facility shift definition used for archive/restore and reporting. */
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
  /** day number (1-31) -> array of 0-3 assignments */
  cellsByDay: Record<number, Assignment[]>;
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
  timeRange: string;
  colorKey: ShiftColorKey;
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
  action: 'assign' | 'remove' | 'vacation' | 'publish' | 'discard' | 'settings' | 'undo' | 'archive' | 'restore';
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
  /** max 3 assignments per cell */
  assignments: Assignment[];
}

/** Admin interaction modes */
export type MatrixAdminMode = 'view' | 'edit' | 'vacations' | 'brush' | 'settings';

export interface ConflictDetail {
  facility?: string;
  unit?: string;
  shiftLabel?: string;
  day: number;
  timeRange?: string;
  type: 'crossFacility' | 'vacation';
  reason: string;
}

/** Result of assignment validation */
export type ValidateResult =
  | { ok: true }
  | { ok: false; conflict: ConflictDetail };
