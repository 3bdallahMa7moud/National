import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useOperationalAuditStore } from './operationalAuditStore';
import {
  DEFAULT_LATE_SCHEDULE_NOTICE,
  LEGACY_LATE_SCHEDULE_ROWS,
} from '@/data/lateScheduleSeed';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import { migrateLateSchedulePayload, migrateRetiredOTEmployeeIds } from '@/lib/lateScheduleMigration';
import type {
  LateSchedulePersistedState,
  LateSchedulePersistedStateV2,
  LateSchedulePersistedStateV3,
  LateSchedulePersistedStateV4,
  LateScheduleWarning,
  OTMutationResult,
  OTAdminMutationResult,
  OTMonthStatus,
  OTMonthVersion,
  OTRosterEmployee,
  OTShiftInput,
  OTShiftRow,
  OTTableClipboard,
  OTTableOperationResult,
  OTUnit,
} from '@/types/lateSchedule';

export const LATE_SCHEDULE_STORAGE_KEY = 'ngh_late_schedule_data_v5';
export const V4_LATE_SCHEDULE_STORAGE_KEY = 'ngh_late_schedule_data_v4';
export const V3_LATE_SCHEDULE_STORAGE_KEY = 'ngh_late_schedule_data_v3';
export const V2_LATE_SCHEDULE_STORAGE_KEY = 'ngh_late_schedule_data_v2';
export const LEGACY_LATE_SCHEDULE_STORAGE_KEY = 'ngh_late_schedule_data';
export const LEGACY_LATE_SCHEDULE_NOTICE_KEY = 'ngh_late_schedule_notice_text';

export interface LateScheduleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface CreateLateScheduleStoreOptions {
  storage?: LateScheduleStorage;
  migrationRoster?: OTRosterEmployee[];
  initialRowsByMonth?: Record<string, OTShiftRow[]>;
  initialUnitsByMonth?: Record<string, OTUnit[]>;
  initialYear?: number;
  initialMonth?: number;
  initialNotice?: string;
  onChanged?: () => void;
}

export interface LateScheduleState {
  year: number;
  month: number;
  rows: OTShiftRow[];
  rowsByMonth: Record<string, OTShiftRow[]>;
  units: OTUnit[];
  unitsByMonth: Record<string, OTUnit[]>;
  /** Published snapshots are the only OT data employee surfaces may consume. */
  publishedRowsByMonth: Record<string, OTShiftRow[]>;
  publishedUnitsByMonth: Record<string, OTUnit[]>;
  departmentIdsByMonth: Record<string, string>;
  monthStatuses: Record<string, OTMonthStatus>;
  versionsByMonth: Record<string, OTMonthVersion[]>;
  deletedMonths: string[];
  /** Deliberately in-memory so copying does not duplicate a full month in localStorage. */
  tableClipboard: OTTableClipboard | null;
  storageError: string | null;
  notice: string;
  warnings: LateScheduleWarning[];
  setMonth(year: number, month: number): void;
  goToPreviousMonth(): void;
  goToNextMonth(): void;
  setNotice(notice: string, actorName?: string): void;
  addRow(input: OTShiftInput, actorName?: string): OTMutationResult;
  updateRow(id: string, input: OTShiftInput, actorName?: string): OTMutationResult;
  archiveRow(id: string, actorName?: string): OTMutationResult;
  restoreLateShiftRow(id: string, actorName?: string): OTMutationResult;
  deleteRow(id: string, actorName?: string): OTMutationResult;
  reorderRow(id: string, targetUnitId: string, targetRowId?: string, position?: 'before' | 'after', actorName?: string): OTMutationResult;
  addUnit(name: string, actorName?: string): OTAdminMutationResult;
  renameUnit(id: string, name: string, actorName?: string): OTAdminMutationResult;
  archiveUnit(id: string, actorName?: string): OTAdminMutationResult;
  restoreUnit(id: string, actorName?: string): OTAdminMutationResult;
  deleteUnit(id: string, actorName?: string): OTAdminMutationResult;
  reorderUnit(sourceUnitId: string, targetUnitId: string, position?: 'before' | 'after', actorName?: string): OTAdminMutationResult;
  setCellAssignments(
    rowId: string,
    day: number,
    employeeIds: string[],
    unresolvedLegacyCodes?: string[],
    actorName?: string,
  ): OTMutationResult;
  setRangeAssignments(rowId: string, startDay: number, endDay: number, employeeIds: string[], actorName?: string): OTMutationResult;
  clearRangeAssignments(rowId: string, startDay: number, endDay: number, actorName?: string): OTMutationResult;
  clearCell(rowId: string, day: number, actorName?: string): OTMutationResult;
  copyCurrentTable(actorName?: string): OTTableOperationResult;
  pasteCopiedTable(actorName?: string): OTTableOperationResult;
  clearAllAssignments(actorName?: string): OTAdminMutationResult;
  resetCurrentMonth(actorName?: string): OTAdminMutationResult;
  publishCurrentMonth(actorName?: string): OTAdminMutationResult;
  currentMonthStatus(): OTMonthStatus;
  reloadFromStorage(): void;
}

interface InitialLateScheduleState {
  year: number;
  month: number;
  rowsByMonth: Record<string, OTShiftRow[]>;
  unitsByMonth: Record<string, OTUnit[]>;
  publishedRowsByMonth: Record<string, OTShiftRow[]>;
  publishedUnitsByMonth: Record<string, OTUnit[]>;
  departmentIdsByMonth: Record<string, string>;
  monthStatuses: Record<string, OTMonthStatus>;
  versionsByMonth: Record<string, OTMonthVersion[]>;
  deletedMonths: string[];
  notice: string;
  warnings: LateScheduleWarning[];
}

function cloneRowsByMonth(rowsByMonth: Record<string, OTShiftRow[]>): Record<string, OTShiftRow[]> {
  return JSON.parse(JSON.stringify(rowsByMonth));
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizeOTMonthStatuses(value: unknown): Record<string, OTMonthStatus> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, OTMonthStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    if (status === 'published' || status === 'locked') normalized[key] = 'published';
    else if (status === 'draft') normalized[key] = 'draft';
  }
  return normalized;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '') || 'general-ot';
}

const DEFAULT_OT_BRANCHES = ['KASCH', 'KAMC', 'WHH'] as const;

function normalizeAndEnsureBranchUnits(units: OTUnit[], rows?: OTShiftRow[], ensureDefaultBranches = false): OTUnit[] {
  const nextUnits: OTUnit[] = [];
  const canonicalIdByName = new Map<string, string>();
  const seenNames = new Set<string>();

  for (const unit of units) {
    const key = unit.name.trim().toLocaleLowerCase();
    if (seenNames.has(key)) {
      const canonicalId = canonicalIdByName.get(key);
      if (canonicalId && rows) {
        for (const row of rows) {
          if (row.unitId === unit.id) {
            row.unitId = canonicalId;
          }
        }
      }
    } else {
      seenNames.add(key);
      canonicalIdByName.set(key, unit.id);
      nextUnits.push(unit);
    }
  }

  if (ensureDefaultBranches || nextUnits.length === 0) {
    for (const branchName of DEFAULT_OT_BRANCHES) {
      const branchKey = branchName.toLocaleLowerCase();
      if (!seenNames.has(branchKey)) {
        nextUnits.push({
          id: `ot-unit-${branchName.toLowerCase()}`,
          name: branchName,
        });
        seenNames.add(branchKey);
      }
    }
  }

  return nextUnits;
}

function normalizeStateBranchUnits(state: InitialLateScheduleState, ensureDefaultBranches = true): InitialLateScheduleState {
  const allMonthKeys = new Set([
    ...Object.keys(state.rowsByMonth || {}),
    ...Object.keys(state.unitsByMonth || {}),
    ...Object.keys(state.publishedRowsByMonth || {}),
    ...Object.keys(state.publishedUnitsByMonth || {}),
    formatLateScheduleMonthKey(state.year, state.month),
  ]);

  for (const key of allMonthKeys) {
    const rows = state.rowsByMonth[key] || [];
    const units = state.unitsByMonth[key] || unitsForRows(rows);
    state.unitsByMonth[key] = normalizeAndEnsureBranchUnits(units, rows, ensureDefaultBranches);

    const publishedRows = state.publishedRowsByMonth[key] || [];
    const publishedUnits = state.publishedUnitsByMonth[key] || unitsForRows(publishedRows);
    state.publishedUnitsByMonth[key] = normalizeAndEnsureBranchUnits(publishedUnits, publishedRows, ensureDefaultBranches);
  }

  return state;
}

function unitsForRows(rows: OTShiftRow[]): OTUnit[] {
  const units: OTUnit[] = [];
  const byName = new Map<string, OTUnit>();
  for (const row of rows) {
    const name = row.location.trim() || 'General OT';
    const key = name.toLocaleLowerCase();
    let unit = byName.get(key);
    if (!unit) {
      unit = { id: `ot-unit-${slug(name)}-${units.length + 1}`, name };
      units.push(unit);
      byName.set(key, unit);
    }
    row.unitId = row.unitId || unit.id;
  }
  return normalizeAndEnsureBranchUnits(units, rows, false);
}

function clearOTAssignments(rows: OTShiftRow[]): number {
  let affected = 0;
  for (const row of rows) {
    for (const assignments of Object.values(row.assignments)) affected += assignments.length;
    row.assignments = {};
  }
  return affected;
}

function countOTAssignments(rows: OTShiftRow[]): number {
  return rows.reduce(
    (total, row) => total + Object.values(row.assignments).reduce(
      (rowTotal, assignments) => rowTotal + assignments.length,
      0,
    ),
    0,
  );
}

function copyOTRowsToMonth(
  sourceRows: OTShiftRow[],
  year: number,
  month: number,
): { rows: OTShiftRow[]; omittedAssignments: number } {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let omittedAssignments = 0;
  const rows = cloneValue(sourceRows).map((row) => {
    const assignments: OTShiftRow['assignments'] = {};
    for (const [dayText, cellAssignments] of Object.entries(row.assignments)) {
      const day = Number(dayText);
      if (Number.isInteger(day) && day >= 1 && day <= daysInMonth) {
        assignments[day] = cellAssignments;
      } else {
        omittedAssignments += cellAssignments.length;
      }
    }
    return {
      ...row,
      highlightedDays: row.highlightedDays?.filter((day) => day <= daysInMonth),
      assignments,
    };
  });
  return { rows, omittedAssignments };
}

function templateRows(rows: OTShiftRow[]): OTShiftRow[] {
  const copy = cloneValue(rows);
  clearOTAssignments(copy);
  return copy.map((row) => ({ ...row, archived: false }));
}

function deriveLateScheduleWarnings(
  rowsByMonth: Record<string, OTShiftRow[]>,
  previousWarnings: LateScheduleWarning[] = [],
): LateScheduleWarning[] {
  const unresolvedCodes = new Set<string>();
  Object.values(rowsByMonth).forEach((rows) => {
    rows.forEach((row) => {
      Object.values(row.assignments).forEach((assignments) => {
        assignments.forEach((assignment) => {
          if (assignment.kind === 'unresolved') unresolvedCodes.add(assignment.legacyCode);
        });
      });
    });
  });

  const warnings: LateScheduleWarning[] = [...unresolvedCodes]
    .sort((left, right) => left.localeCompare(right))
    .map((code) => ({ kind: 'unresolved_employee', code }));
  if (previousWarnings.some((warning) => warning.kind === 'storage_recovery')) {
    warnings.push({ kind: 'storage_recovery' });
  }
  return warnings;
}

export function formatLateScheduleMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function normalizeMonth(year: number, month: number): { year: number; month: number } {
  const date = new Date(year, month, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

type LegacyLateSchedulePersistedState = LateSchedulePersistedStateV2 | LateSchedulePersistedStateV3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStoredAssignment(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'employee') {
    return typeof value.employeeId === 'string' && value.employeeId.trim().length > 0;
  }
  if (value.kind === 'unresolved') {
    return typeof value.legacyCode === 'string' && value.legacyCode.trim().length > 0;
  }
  return false;
}

function isStoredRow(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || typeof value.location !== 'string'
    || typeof value.timeRange !== 'string'
    || typeof value.hours !== 'number'
    || !Number.isFinite(value.hours)
    || value.hours <= 0
    || !isRecord(value.assignments)
  ) return false;
  if (value.archived !== undefined && typeof value.archived !== 'boolean') return false;
  if (value.highlightedDays !== undefined && (
    !Array.isArray(value.highlightedDays)
    || !value.highlightedDays.every((day) => Number.isInteger(day) && day >= 1 && day <= 31)
  )) return false;

  return Object.entries(value.assignments).every(([dayText, assignments]) => {
    const day = Number(dayText);
    return Number.isInteger(day)
      && day >= 1
      && day <= 31
      && Array.isArray(assignments)
      && assignments.every(isStoredAssignment);
  });
}

function isStoredRowsByMonth(value: unknown): boolean {
  return isRecord(value)
    && Object.entries(value).every(([monthKey, rows]) =>
      /^\d{4}-\d{2}$/.test(monthKey)
      && Array.isArray(rows)
      && rows.every(isStoredRow));
}

function isPersistedState(
  value: unknown,
  version: 2 | 3,
): value is LegacyLateSchedulePersistedState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<LegacyLateSchedulePersistedState>;
  return state.version === version
    && Number.isInteger(state.currentYear)
    && Number.isInteger(state.currentMonth)
    && Number(state.currentMonth) >= 0
    && Number(state.currentMonth) <= 11
    && isStoredRowsByMonth(state.rowsByMonth)
    && typeof state.notice === 'string';
}

function isPersistedV4(value: unknown): value is LateSchedulePersistedStateV4 {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<LateSchedulePersistedStateV4>;
  return state.version === 4
    && Number.isInteger(state.currentYear)
    && Number.isInteger(state.currentMonth)
    && Number(state.currentMonth) >= 0
    && Number(state.currentMonth) <= 11
    && isStoredRowsByMonth(state.rowsByMonth)
    && typeof state.notice === 'string'
    && !!state.unitsByMonth && typeof state.unitsByMonth === 'object'
    && !!state.monthStatuses && typeof state.monthStatuses === 'object'
    && !!state.versionsByMonth && typeof state.versionsByMonth === 'object'
    && Array.isArray(state.deletedMonths);
}

function isPersistedV5(value: unknown): value is LateSchedulePersistedState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<LateSchedulePersistedState>;
  return state.version === 5
    && Number.isInteger(state.currentYear)
    && Number.isInteger(state.currentMonth)
    && Number(state.currentMonth) >= 0
    && Number(state.currentMonth) <= 11
    && isStoredRowsByMonth(state.rowsByMonth)
    && isStoredRowsByMonth(state.publishedRowsByMonth)
    && typeof state.notice === 'string'
    && !!state.unitsByMonth && typeof state.unitsByMonth === 'object'
    && !!state.publishedUnitsByMonth && typeof state.publishedUnitsByMonth === 'object'
    && !!state.departmentIdsByMonth && typeof state.departmentIdsByMonth === 'object'
    && !!state.monthStatuses && typeof state.monthStatuses === 'object'
    && !!state.versionsByMonth && typeof state.versionsByMonth === 'object'
    && Array.isArray(state.deletedMonths);
}

function validateRowInput(input: OTShiftInput): OTMutationResult {
  if (!input.title.trim()) return { ok: false, reason: 'title_required' };
  if (!input.location.trim()) return { ok: false, reason: 'location_required' };
  if (!input.timeRange.trim()) return { ok: false, reason: 'time_required' };
  if (!Number.isFinite(input.hours) || input.hours <= 0) return { ok: false, reason: 'hours_invalid' };
  return { ok: true };
}

function normalizedHighlightedDays(days: number[] | undefined): number[] | undefined {
  if (!days) return undefined;
  const normalized = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))]
    .sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : undefined;
}

function browserStorage(): LateScheduleStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function defaultMigrationRoster(): OTRosterEmployee[] {
  return OFFICIAL_EMPLOYEE_ROSTER;
}

function seedRowsByMonth(roster: OTRosterEmployee[]): Record<string, OTShiftRow[]> {
  return {
    '2026-07': migrateLateSchedulePayload(LEGACY_LATE_SCHEDULE_ROWS, roster).rows,
  };
}

function addStorageRecoveryWarning(state: InitialLateScheduleState): void {
  if (!state.warnings.some((warning) => warning.kind === 'storage_recovery')) {
    state.warnings.push({ kind: 'storage_recovery' });
  }
}

function writeV5State(storage: LateScheduleStorage, state: InitialLateScheduleState): void {
  storage.setItem(LATE_SCHEDULE_STORAGE_KEY, JSON.stringify({
    version: 5,
    currentYear: state.year,
    currentMonth: state.month,
    rowsByMonth: state.rowsByMonth,
    unitsByMonth: state.unitsByMonth,
    publishedRowsByMonth: state.publishedRowsByMonth,
    publishedUnitsByMonth: state.publishedUnitsByMonth,
    departmentIdsByMonth: state.departmentIdsByMonth,
    monthStatuses: normalizeOTMonthStatuses(state.monthStatuses),
    versionsByMonth: state.versionsByMonth,
    deletedMonths: state.deletedMonths,
    notice: state.notice,
  } satisfies LateSchedulePersistedState));
}

function departmentIdsForMonths(...records: Array<Record<string, unknown>>): Record<string, string> {
  const keys = new Set(records.flatMap((record) => Object.keys(record)));
  return Object.fromEntries([...keys].map((key) => [key, 'dept-1']));
}

function publishedSnapshotsFromV4(state: LateSchedulePersistedStateV4): {
  rows: Record<string, OTShiftRow[]>;
  units: Record<string, OTUnit[]>;
} {
  const rows: Record<string, OTShiftRow[]> = {};
  const units: Record<string, OTUnit[]> = {};
  const statuses = normalizeOTMonthStatuses(state.monthStatuses);
  for (const [key, draftRows] of Object.entries(state.rowsByMonth)) {
    if (state.deletedMonths.includes(key)) continue;
    const status = statuses[key];
    if (!status || status === 'published') {
      rows[key] = cloneValue(draftRows);
      units[key] = cloneValue(state.unitsByMonth[key] || unitsForRows(cloneValue(draftRows)));
      continue;
    }
    const lastPublished = (state.versionsByMonth[key] || []).find((version) => version.reason === 'publish');
    if (lastPublished) {
      rows[key] = cloneValue(lastPublished.rows);
      units[key] = cloneValue(lastPublished.units);
    }
  }
  return { rows, units };
}

function stateFromPersisted(
  parsed: LegacyLateSchedulePersistedState,
): InitialLateScheduleState {
  const migrated = migrateRetiredOTEmployeeIds(parsed.rowsByMonth);
  const unitsByMonth = Object.fromEntries(Object.entries(migrated.rowsByMonth).map(([key, rows]) => [key, unitsForRows(rows)]));
  return {
    year: parsed.currentYear,
    month: parsed.currentMonth,
    rowsByMonth: migrated.rowsByMonth,
    unitsByMonth,
    publishedRowsByMonth: cloneValue(migrated.rowsByMonth),
    publishedUnitsByMonth: cloneValue(unitsByMonth),
    departmentIdsByMonth: departmentIdsForMonths(migrated.rowsByMonth),
    monthStatuses: Object.fromEntries(Object.keys(migrated.rowsByMonth).map((key) => [key, 'published' as const])),
    versionsByMonth: {},
    deletedMonths: [],
    notice: parsed.notice,
    warnings: migrated.warnings.map((code) => ({ kind: 'unresolved_employee', code })),
  };
}

function readInitialState(options: CreateLateScheduleStoreOptions): InitialLateScheduleState {
  const storage = options.storage;
  const roster = options.migrationRoster ?? defaultMigrationRoster();
  const fallbackRows = cloneRowsByMonth(options.initialRowsByMonth ?? seedRowsByMonth(roster));
  const fallbackUnits = Object.fromEntries(Object.entries(fallbackRows).map(([key, rows]) => [key, unitsForRows(rows)]));
  const fallback: InitialLateScheduleState = {
    year: options.initialYear ?? 2026,
    month: options.initialMonth ?? 6,
    rowsByMonth: fallbackRows,
    unitsByMonth: fallbackUnits,
    publishedRowsByMonth: cloneValue(fallbackRows),
    publishedUnitsByMonth: cloneValue(fallbackUnits),
    departmentIdsByMonth: departmentIdsForMonths(fallbackRows),
    monthStatuses: Object.fromEntries(Object.keys(fallbackRows).map((key) => [key, 'published' as const])),
    versionsByMonth: {},
    deletedMonths: [],
    notice: options.initialNotice ?? DEFAULT_LATE_SCHEDULE_NOTICE,
    warnings: [],
  };

  const ensureDefaultBranches = !options.initialRowsByMonth && !options.initialUnitsByMonth;

  if (!storage) return normalizeStateBranchUnits(fallback, ensureDefaultBranches);

  let recoveredFromInvalidPayload = false;
  try {
    const v5Saved = storage.getItem(LATE_SCHEDULE_STORAGE_KEY);
    if (v5Saved) {
      try {
        const parsed: unknown = JSON.parse(v5Saved);
        if (!isPersistedV5(parsed)) throw new Error('Invalid OT schedule v5 payload');
        const migrated = migrateRetiredOTEmployeeIds(parsed.rowsByMonth);
        const migratedPublished = migrateRetiredOTEmployeeIds(parsed.publishedRowsByMonth);
        const state: InitialLateScheduleState = {
          year: parsed.currentYear,
          month: parsed.currentMonth,
          rowsByMonth: migrated.rowsByMonth,
          unitsByMonth: cloneValue(parsed.unitsByMonth),
          publishedRowsByMonth: migratedPublished.rowsByMonth,
          publishedUnitsByMonth: cloneValue(parsed.publishedUnitsByMonth),
          departmentIdsByMonth: cloneValue(parsed.departmentIdsByMonth),
          monthStatuses: normalizeOTMonthStatuses(parsed.monthStatuses),
          versionsByMonth: cloneValue(parsed.versionsByMonth),
          deletedMonths: [...parsed.deletedMonths],
          notice: parsed.notice,
          warnings: migrated.warnings.map((code) => ({ kind: 'unresolved_employee', code })),
        };
        return normalizeStateBranchUnits(state, false);
      } catch {
        recoveredFromInvalidPayload = true;
      }
    }
    const v4Saved = storage.getItem(V4_LATE_SCHEDULE_STORAGE_KEY);
    if (v4Saved) {
      try {
        const parsed: unknown = JSON.parse(v4Saved);
        if (!isPersistedV4(parsed)) throw new Error('Invalid OT schedule v4 payload');
        const migrated = migrateRetiredOTEmployeeIds(parsed.rowsByMonth);
        const published = publishedSnapshotsFromV4(parsed);
        const migratedPublished = migrateRetiredOTEmployeeIds(published.rows);
        const state: InitialLateScheduleState = {
          year: parsed.currentYear,
          month: parsed.currentMonth,
          rowsByMonth: migrated.rowsByMonth,
          unitsByMonth: cloneValue(parsed.unitsByMonth),
          publishedRowsByMonth: migratedPublished.rowsByMonth,
          publishedUnitsByMonth: cloneValue(published.units),
          departmentIdsByMonth: departmentIdsForMonths(parsed.rowsByMonth, published.rows),
          monthStatuses: normalizeOTMonthStatuses(parsed.monthStatuses),
          versionsByMonth: cloneValue(parsed.versionsByMonth),
          deletedMonths: [...parsed.deletedMonths],
          notice: parsed.notice,
          warnings: [...new Set([...migrated.warnings, ...migratedPublished.warnings])]
            .map((code) => ({ kind: 'unresolved_employee' as const, code })),
        };
        try {
          writeV5State(storage, state);
        } catch {
          addStorageRecoveryWarning(state);
        }
        if (recoveredFromInvalidPayload) addStorageRecoveryWarning(state);
        return normalizeStateBranchUnits(state, false);
      } catch {
        recoveredFromInvalidPayload = true;
      }
    }
    const persistedCandidates = [
      { key: V3_LATE_SCHEDULE_STORAGE_KEY, version: 3 as const },
      { key: V2_LATE_SCHEDULE_STORAGE_KEY, version: 2 as const },
    ];

    for (const candidate of persistedCandidates) {
      const saved = storage.getItem(candidate.key);
      if (!saved) continue;
      try {
        const parsed: unknown = JSON.parse(saved);
        if (!isPersistedState(parsed, candidate.version)) {
          throw new Error(`Invalid OT schedule v${candidate.version} payload`);
        }
        const state = stateFromPersisted(parsed);
        if (candidate.version === 2 || candidate.version === 3 || state.warnings.length > 0) {
          try {
            writeV5State(storage, state);
          } catch {
            addStorageRecoveryWarning(state);
          }
        }
        if (recoveredFromInvalidPayload) addStorageRecoveryWarning(state);
        return normalizeStateBranchUnits(state, false);
      } catch {
        recoveredFromInvalidPayload = true;
      }
    }

    const legacyRows = storage.getItem(LEGACY_LATE_SCHEDULE_STORAGE_KEY);
    if (legacyRows) {
      const migrated = migrateLateSchedulePayload(JSON.parse(legacyRows), roster);
      const migratedState: InitialLateScheduleState = {
        year: 2026,
        month: 6,
        rowsByMonth: { '2026-07': migrated.rows },
        unitsByMonth: { '2026-07': unitsForRows(migrated.rows) },
        publishedRowsByMonth: { '2026-07': cloneValue(migrated.rows) },
        publishedUnitsByMonth: { '2026-07': unitsForRows(cloneValue(migrated.rows)) },
        departmentIdsByMonth: { '2026-07': 'dept-1' },
        monthStatuses: { '2026-07': 'published' },
        versionsByMonth: {},
        deletedMonths: [],
        notice: storage.getItem(LEGACY_LATE_SCHEDULE_NOTICE_KEY) ?? fallback.notice,
        warnings: migrated.warnings.map((code) => ({ kind: 'unresolved_employee', code })),
      };
      try {
        writeV5State(storage, migratedState);
      } catch {
        addStorageRecoveryWarning(migratedState);
      }
      if (recoveredFromInvalidPayload) addStorageRecoveryWarning(migratedState);
      return normalizeStateBranchUnits(migratedState, false);
    }
  } catch {
    recoveredFromInvalidPayload = true;
  }

  if (recoveredFromInvalidPayload) addStorageRecoveryWarning(fallback);
  return normalizeStateBranchUnits(fallback, ensureDefaultBranches);
}

function persistedSnapshot(state: LateScheduleState): LateSchedulePersistedState {
  return {
    version: 5,
    currentYear: state.year,
    currentMonth: state.month,
    rowsByMonth: state.rowsByMonth,
    unitsByMonth: state.unitsByMonth,
    publishedRowsByMonth: state.publishedRowsByMonth,
    publishedUnitsByMonth: state.publishedUnitsByMonth,
    departmentIdsByMonth: state.departmentIdsByMonth,
    monthStatuses: state.monthStatuses,
    versionsByMonth: state.versionsByMonth,
    deletedMonths: state.deletedMonths,
    notice: state.notice,
  };
}

function createLateScheduleState(
  options: CreateLateScheduleStoreOptions,
  set: StoreApi<LateScheduleState>['setState'],
  get: StoreApi<LateScheduleState>['getState'],
): LateScheduleState {
  const storage = options.storage;
  const initial = readInitialState(options);
  const activeKey = formatLateScheduleMonthKey(initial.year, initial.month);

  const persist = (previousState?: LateScheduleState) => {
    if (!storage) return true;
    try {
      storage.setItem(LATE_SCHEDULE_STORAGE_KEY, JSON.stringify(persistedSnapshot(get())));
      if (get().storageError) set({ storageError: null });
      options.onChanged?.();
      return true;
    } catch {
      const rollback = previousState ?? get();
      const warnings = rollback.warnings;
      set({
        year: rollback.year,
        month: rollback.month,
        rowsByMonth: rollback.rowsByMonth,
        rows: rollback.rows,
        unitsByMonth: rollback.unitsByMonth,
        units: rollback.units,
        publishedRowsByMonth: rollback.publishedRowsByMonth,
        publishedUnitsByMonth: rollback.publishedUnitsByMonth,
        departmentIdsByMonth: rollback.departmentIdsByMonth,
        monthStatuses: rollback.monthStatuses,
        versionsByMonth: rollback.versionsByMonth,
        deletedMonths: rollback.deletedMonths,
        notice: rollback.notice,
        storageError: 'Unable to save OT administration data.',
        warnings: warnings.some((warning) => warning.kind === 'storage_recovery')
          ? warnings
          : [...warnings, { kind: 'storage_recovery' }],
      });
      return false;
    }
  };

  const commitRows = (rows: OTShiftRow[]) => {
    const state = get();
    const key = formatLateScheduleMonthKey(state.year, state.month);
    const rowsByMonth = { ...state.rowsByMonth, [key]: rows };
    const deletedMonths = state.deletedMonths.filter((item) => item !== key);
    set({
      rows,
      rowsByMonth,
      deletedMonths,
      departmentIdsByMonth: { ...state.departmentIdsByMonth, [key]: state.departmentIdsByMonth[key] || 'dept-1' },
      monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
      warnings: deriveLateScheduleWarnings(rowsByMonth, state.warnings),
    });
    return persist(state);
  };

  const recordAudit = (
    actorName: string | undefined,
    action: 'create' | 'update' | 'delete' | 'assign' | 'clear' | 'archive' | 'restore' | 'publish',
    row: Pick<OTShiftRow, 'id' | 'title'>,
    before?: unknown,
    after?: unknown,
    day?: number,
  ) => {
    const state = get();
    useOperationalAuditStore.getState().record({
      actorName: actorName?.trim() || 'Schedule administrator',
      action,
      module: 'ot',
      entityId: row.id,
      entityLabel: row.title,
      before: before === undefined ? undefined : JSON.stringify(before),
      after: after === undefined ? undefined : JSON.stringify(after),
      context: {
        year: state.year,
        month: state.month,
        rowId: row.id,
        day,
        route: '/admin/late-schedule',
      },
    });
  };

  const withVersion = (
    state: LateScheduleState,
    reason: OTMonthVersion['reason'],
    actorName?: string,
  ): Record<string, OTMonthVersion[]> => {
    const key = formatLateScheduleMonthKey(state.year, state.month);
    const version: OTMonthVersion = {
      id: `ot-version-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      actorName: actorName?.trim() || 'Administrator',
      reason,
      rows: cloneValue(state.rows),
      units: cloneValue(state.units),
      notice: state.notice,
    };
    return { ...state.versionsByMonth, [key]: [version, ...(state.versionsByMonth[key] || [])].slice(0, 5) };
  };

  const commitUnits = (units: OTUnit[]) => {
    const state = get();
    const key = formatLateScheduleMonthKey(state.year, state.month);
    const deletedMonths = state.deletedMonths.filter((item) => item !== key);
    set({
      units,
      unitsByMonth: { ...state.unitsByMonth, [key]: units },
      deletedMonths,
      departmentIdsByMonth: { ...state.departmentIdsByMonth, [key]: state.departmentIdsByMonth[key] || 'dept-1' },
      monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
    });
    return persist(state);
  };

  const commitStructure = (rows: OTShiftRow[], units: OTUnit[]) => {
    const state = get();
    const key = formatLateScheduleMonthKey(state.year, state.month);
    const rowsByMonth = { ...state.rowsByMonth, [key]: rows };
    const deletedMonths = state.deletedMonths.filter((item) => item !== key);
    set({
      rows,
      units,
      rowsByMonth,
      unitsByMonth: { ...state.unitsByMonth, [key]: units },
      deletedMonths,
      departmentIdsByMonth: { ...state.departmentIdsByMonth, [key]: state.departmentIdsByMonth[key] || 'dept-1' },
      monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
      warnings: deriveLateScheduleWarnings(rowsByMonth, state.warnings),
    });
    return persist(state);
  };

  return {
    year: initial.year,
    month: initial.month,
    rowsByMonth: initial.rowsByMonth,
    rows: initial.deletedMonths.includes(activeKey) ? [] : initial.rowsByMonth[activeKey] ?? [],
    unitsByMonth: initial.unitsByMonth,
    units: initial.deletedMonths.includes(activeKey) ? [] : normalizeAndEnsureBranchUnits(initial.unitsByMonth[activeKey] ?? unitsForRows(initial.rowsByMonth[activeKey] ?? []), initial.rowsByMonth[activeKey] ?? []),
    publishedRowsByMonth: initial.publishedRowsByMonth,
    publishedUnitsByMonth: initial.publishedUnitsByMonth,
    departmentIdsByMonth: initial.departmentIdsByMonth,
    monthStatuses: initial.monthStatuses,
    versionsByMonth: initial.versionsByMonth,
    deletedMonths: initial.deletedMonths,
    tableClipboard: null,
    storageError: null,
    notice: initial.notice,
    warnings: initial.warnings,

    currentMonthStatus: () => {
      const state = get();
      const key = formatLateScheduleMonthKey(state.year, state.month);
      const storedStatus = normalizeOTMonthStatuses({ [key]: state.monthStatuses[key] })[key];
      return storedStatus || (state.rowsByMonth[key] ? 'published' : 'draft');
    },

    reloadFromStorage: () => {
      if (!storage) return;
      const state = get();
      const incoming = readInitialState(options);
      const key = formatLateScheduleMonthKey(state.year, state.month);
      set({
        rowsByMonth: incoming.rowsByMonth,
        unitsByMonth: incoming.unitsByMonth,
        publishedRowsByMonth: incoming.publishedRowsByMonth,
        publishedUnitsByMonth: incoming.publishedUnitsByMonth,
        departmentIdsByMonth: incoming.departmentIdsByMonth,
        monthStatuses: incoming.monthStatuses,
        versionsByMonth: incoming.versionsByMonth,
        deletedMonths: incoming.deletedMonths,
        notice: incoming.notice,
        warnings: incoming.warnings,
        rows: incoming.deletedMonths.includes(key) ? [] : incoming.rowsByMonth[key] ?? [],
        units: incoming.deletedMonths.includes(key) ? [] : normalizeAndEnsureBranchUnits(incoming.unitsByMonth[key] ?? unitsForRows(incoming.rowsByMonth[key] ?? []), incoming.rowsByMonth[key] ?? []),
        storageError: null,
      });
    },

    setMonth: (year, month) => {
      const normalized = normalizeMonth(year, month);
      const state = get();
      const key = formatLateScheduleMonthKey(normalized.year, normalized.month);
      set({
        year: normalized.year,
        month: normalized.month,
        rows: state.deletedMonths.includes(key) ? [] : state.rowsByMonth[key] ?? [],
        units: state.deletedMonths.includes(key) ? [] : normalizeAndEnsureBranchUnits(state.unitsByMonth[key] ?? unitsForRows(state.rowsByMonth[key] ?? []), state.rowsByMonth[key] ?? []),
      });
      persist(state);
    },
    goToPreviousMonth: () => {
      const state = get();
      state.setMonth(state.year, state.month - 1);
    },
    goToNextMonth: () => {
      const state = get();
      state.setMonth(state.year, state.month + 1);
    },
    setNotice: (notice, actorName) => {
      const state = get();
      const before = state.notice;
      const after = notice.trim();
      set({ notice: after });
      const saved = persist(state);
      if (saved && before !== after) {
        recordAudit(actorName, 'update', { id: 'ot-notice', title: 'OT notice' }, before, after);
      }
    },
    addRow: (input, actorName) => {
      const validation = validateRowInput(input);
      if (!validation.ok) return validation;
      let currentUnits = get().units;
      if (currentUnits.length === 0) {
        currentUnits = normalizeAndEnsureBranchUnits([], []);
        if (!commitUnits(currentUnits)) return { ok: false, reason: 'storage_error' };
      }
      const created: OTShiftRow = {
        id: `ot-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: input.title.trim(),
        titleAr: input.title.trim(),
        titleEn: input.title.trim(),
        unitId: input.unitId || currentUnits[0]?.id || 'ot-unit-kasch',
        location: input.location.trim() || currentUnits[0]?.name || 'KASCH',
        timeRange: input.timeRange.trim(),
        hours: input.hours,
        highlightedDays: normalizedHighlightedDays(input.highlightedDays),
        backgroundColor: input.backgroundColor,
        textColor: input.textColor,
        shortCode: input.shortCode?.trim(),
        icon: input.icon?.trim(),
        assignments: {},
      };
      if (!commitRows([...get().rows, created])) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'create', created, undefined, created);
      return { ok: true };
    },
    updateRow: (id, input, actorName) => {
      const validation = validateRowInput(input);
      if (!validation.ok) return validation;
      const existing = get().rows.find((row) => row.id === id);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const updated: OTShiftRow = {
        ...existing,
        title: input.title.trim(),
        titleAr: input.title.trim(),
        titleEn: input.title.trim(),
        unitId: input.unitId || existing.unitId,
        location: input.location.trim(),
        timeRange: input.timeRange.trim(),
        hours: input.hours,
        backgroundColor: input.backgroundColor,
        textColor: input.textColor,
        shortCode: input.shortCode?.trim(),
        icon: input.icon?.trim(),
        highlightedDays: input.highlightedDays === undefined
          ? existing.highlightedDays
          : normalizedHighlightedDays(input.highlightedDays),
      };
      if (!commitRows(get().rows.map((row) => row.id === id ? updated : row))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'update', updated, existing, updated);
      return { ok: true };
    },
    archiveRow: (id, actorName) => {
      const existing = get().rows.find((row) => row.id === id);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const updated = { ...existing, archived: true };
      if (!commitRows(get().rows.map((row) => row.id === id ? updated : row))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'archive', updated, { archived: existing.archived === true }, { archived: true });
      return { ok: true };
    },
    restoreLateShiftRow: (id, actorName) => {
      const existing = get().rows.find((row) => row.id === id);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const updated = { ...existing, archived: false };
      if (!commitRows(get().rows.map((row) => row.id === id ? updated : row))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'restore', updated, { archived: existing.archived === true }, { archived: false });
      return { ok: true };
    },
    deleteRow: (id, actorName) => {
      const existing = get().rows.find((row) => row.id === id);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      if (!commitRows(get().rows.filter((row) => row.id !== id))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'delete', existing, existing, undefined);
      return { ok: true };
    },
    reorderRow: (id, targetUnitId, targetRowId, position = 'after', actorName) => {
      const rows = cloneValue(get().rows);
      const sourceIndex = rows.findIndex((row) => row.id === id);
      const targetUnit = get().units.find((unit) => unit.id === targetUnitId);
      if (sourceIndex < 0 || !targetUnit) return { ok: false, reason: 'row_not_found' };
      const [row] = rows.splice(sourceIndex, 1);
      const updatedRow = { ...row, unitId: targetUnitId, location: targetUnit.name };
      if (!targetRowId) {
        const targetUnitIndexes = rows
          .map((candidate, index) => candidate.unitId === targetUnitId ? index : -1)
          .filter((index) => index >= 0);
        const insertIndex = targetUnitIndexes.length > 0 ? targetUnitIndexes[targetUnitIndexes.length - 1] + 1 : rows.length;
        rows.splice(insertIndex, 0, updatedRow);
      } else {
        const targetIndex = rows.findIndex((candidate) => candidate.id === targetRowId && candidate.unitId === targetUnitId);
        if (targetIndex < 0) rows.push(updatedRow);
        else rows.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, updatedRow);
      }
      if (!commitRows(rows)) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'update', updatedRow, { unitId: row.unitId, index: sourceIndex }, { unitId: targetUnitId, targetRowId, position });
      return { ok: true };
    },
    addUnit: (name, actorName) => {
      if (!name.trim()) return { ok: false, reason: 'not_found' };
      const unit = { id: `ot-unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim() };
      if (!commitUnits([...get().units, unit])) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'create', { id: unit.id, title: unit.name }, undefined, unit);
      return { ok: true };
    },
    renameUnit: (id, name, actorName) => {
      const unit = get().units.find((item) => item.id === id);
      if (!unit || !name.trim()) return { ok: false, reason: 'not_found' };
      const units = get().units.map((item) => item.id === id ? { ...item, name: name.trim() } : item);
      const rows = get().rows.map((row) => row.unitId === id ? { ...row, location: name.trim() } : row);
      if (!commitStructure(rows, units)) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'update', { id, title: name.trim() }, unit.name, name.trim());
      return { ok: true };
    },
    archiveUnit: (id, actorName) => {
      const unit = get().units.find((item) => item.id === id);
      if (!unit) return { ok: false, reason: 'not_found' };
      if (!commitUnits(get().units.map((item) => item.id === id ? { ...item, archived: true } : item))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'archive', { id, title: unit.name }, false, true);
      return { ok: true };
    },
    restoreUnit: (id, actorName) => {
      const unit = get().units.find((item) => item.id === id);
      if (!unit) return { ok: false, reason: 'not_found' };
      if (!commitUnits(get().units.map((item) => item.id === id ? { ...item, archived: false } : item))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'restore', { id, title: unit.name }, true, false);
      return { ok: true };
    },
    deleteUnit: (id, actorName) => {
      const unit = get().units.find((item) => item.id === id);
      if (!unit) return { ok: false, reason: 'not_found' };
      const rows = get().rows.filter((row) => row.unitId !== id);
      if (!commitStructure(rows, get().units.filter((item) => item.id !== id))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'delete', { id, title: unit.name }, unit, undefined);
      return { ok: true };
    },
    reorderUnit: (sourceUnitId, targetUnitId, position = 'before', actorName) => {
      const units = cloneValue(get().units);
      const sourceIndex = units.findIndex((unit) => unit.id === sourceUnitId);
      if (sourceIndex < 0 || sourceUnitId === targetUnitId) return sourceIndex < 0 ? { ok: false, reason: 'not_found' } : { ok: true };
      const [unit] = units.splice(sourceIndex, 1);
      const targetIndex = units.findIndex((candidate) => candidate.id === targetUnitId);
      if (targetIndex < 0) return { ok: false, reason: 'not_found' };
      units.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, unit);
      if (!commitUnits(units)) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'update', { id: sourceUnitId, title: unit.name }, sourceIndex, { targetUnitId, position });
      return { ok: true };
    },
    setCellAssignments: (rowId, day, employeeIds, unresolvedLegacyCodes = [], actorName) => {
      const state = get();
      const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
        return { ok: false, reason: 'invalid_day' };
      }
      const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
      const uniqueLegacyCodes = [...new Set(unresolvedLegacyCodes.map((code) => code.trim()).filter(Boolean))];
      const existing = get().rows.find((row) => row.id === rowId);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const before = existing.assignments[day] ?? [];
      const after = [
        ...uniqueIds.map((employeeId) => ({ kind: 'employee' as const, employeeId })),
        ...uniqueLegacyCodes.map((legacyCode) => ({ kind: 'unresolved' as const, legacyCode })),
      ];
      if (!commitRows(get().rows.map((row) => row.id === rowId ? {
        ...row,
        assignments: { ...row.assignments, [day]: after },
      } : row))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'assign', existing, before, after, day);
      return { ok: true };
    },
    setRangeAssignments: (rowId, startDay, endDay, employeeIds, actorName) => {
      const state = get();
      const existing = state.rows.find((row) => row.id === rowId);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      const from = Math.max(1, Math.min(startDay, endDay));
      const to = Math.min(daysInMonth, Math.max(startDay, endDay));
      if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return { ok: false, reason: 'invalid_day' };
      const uniqueIds = [...new Set(employeeIds.filter(Boolean))];
      const updated = {
        ...existing,
        assignments: { ...existing.assignments },
      };
      for (let day = from; day <= to; day += 1) {
        updated.assignments[day] = uniqueIds.map((employeeId) => ({ kind: 'employee' as const, employeeId }));
      }
      if (!commitRows(state.rows.map((row) => row.id === rowId ? updated : row))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'assign', existing, `${from}-${to}`, `${uniqueIds.length} employees`, from);
      return { ok: true };
    },
    clearRangeAssignments: (rowId, startDay, endDay, actorName) => {
      const state = get();
      const existing = state.rows.find((row) => row.id === rowId);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      const from = Math.max(1, Math.min(startDay, endDay));
      const to = Math.min(daysInMonth, Math.max(startDay, endDay));
      if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return { ok: false, reason: 'invalid_day' };
      const assignments = { ...existing.assignments };
      for (let day = from; day <= to; day += 1) delete assignments[day];
      if (!commitRows(state.rows.map((row) => row.id === rowId ? { ...row, assignments } : row))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'clear', existing, `${from}-${to}`, [], from);
      return { ok: true };
    },
    clearCell: (rowId, day, actorName) => {
      const state = get();
      const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
        return { ok: false, reason: 'invalid_day' };
      }
      const existing = get().rows.find((row) => row.id === rowId);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const before = existing.assignments[day] ?? [];
      if (!commitRows(get().rows.map((row) => {
        if (row.id !== rowId) return row;
        const assignments = { ...row.assignments };
        delete assignments[day];
        return { ...row, assignments };
      }))) return { ok: false, reason: 'storage_error' };
      recordAudit(actorName, 'clear', existing, before, [], day);
      return { ok: true };
    },
    copyCurrentTable: (actorName) => {
      const state = get();
      if (!state.rows || !state.units) {
        return { ok: false, reason: 'not_found', message: 'No OT table is available to copy.' };
      }
      const sourceKey = formatLateScheduleMonthKey(state.year, state.month);
      const assignmentCount = countOTAssignments(state.rows);
      set({
        tableClipboard: {
          sourceKey,
          sourceYear: state.year,
          sourceMonth: state.month,
          copiedAt: new Date().toISOString(),
          assignmentCount,
          rows: cloneValue(state.rows),
          units: cloneValue(state.units),
        },
      });
      recordAudit(
        actorName,
        'update',
        { id: sourceKey, title: 'OT table' },
        sourceKey,
        `${assignmentCount} assignments copied`,
      );
      return {
        ok: true,
        affected: assignmentCount,
        omittedAssignments: 0,
        sourceKey,
        message: 'OT table copied.',
      };
    },
    pasteCopiedTable: (actorName) => {
      const state = get();
      const clipboard = state.tableClipboard;
      if (!clipboard) {
        return { ok: false, reason: 'no_clipboard', message: 'Copy an OT table before pasting.' };
      }

      const targetKey = formatLateScheduleMonthKey(state.year, state.month);
      const { rows, omittedAssignments } = copyOTRowsToMonth(clipboard.rows, state.year, state.month);
      const units = cloneValue(clipboard.units);
      const rowsByMonth = { ...state.rowsByMonth, [targetKey]: rows };
      set({
        rows,
        units,
        rowsByMonth,
        unitsByMonth: { ...state.unitsByMonth, [targetKey]: units },
        departmentIdsByMonth: { ...state.departmentIdsByMonth, [targetKey]: state.departmentIdsByMonth[targetKey] || 'dept-1' },
        versionsByMonth: withVersion(state, 'paste', actorName),
        deletedMonths: state.deletedMonths.filter((key) => key !== targetKey),
        monthStatuses: { ...state.monthStatuses, [targetKey]: 'draft' },
        warnings: deriveLateScheduleWarnings(rowsByMonth, state.warnings),
      });
      if (!persist(state)) {
        return { ok: false, reason: 'storage_error', message: 'Unable to save OT administration data.' };
      }

      recordAudit(
        actorName,
        'update',
        { id: targetKey, title: 'OT table' },
        `${state.rows.length} rows`,
        `Pasted ${clipboard.sourceKey} with ${clipboard.assignmentCount} assignments`,
      );
      return {
        ok: true,
        affected: countOTAssignments(rows),
        omittedAssignments,
        sourceKey: clipboard.sourceKey,
        targetKey,
        message: omittedAssignments > 0
          ? `OT table pasted; ${omittedAssignments} assignments outside this month's days were omitted.`
          : 'OT table pasted.',
      };
    },
    clearAllAssignments: (actorName) => {
      const state = get();
      const rows = cloneValue(state.rows);
      const affected = clearOTAssignments(rows);
      if (affected === 0) return { ok: true, affected: 0 };
      const key = formatLateScheduleMonthKey(state.year, state.month);
      const versionsByMonth = withVersion(state, 'clear', actorName);
      set({
        rows,
        rowsByMonth: { ...state.rowsByMonth, [key]: rows },
        versionsByMonth,
        monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
      });
      if (!persist(state)) return { ok: false, reason: 'storage_error', message: 'Unable to save OT administration data.' };
      recordAudit(actorName, 'clear', { id: key, title: 'OT month' }, `${affected} assignments`, '0 assignments');
      return { ok: true, affected };
    },
    resetCurrentMonth: (actorName) => {
      const state = get();
      const key = formatLateScheduleMonthKey(state.year, state.month);
      const seedKey = '2026-07';
      const defaultRows = seedRowsByMonth(defaultMigrationRoster())[seedKey] ?? [];
      const sourceRows = state.rowsByMonth[seedKey] ?? defaultRows;
      const sourceUnits = state.unitsByMonth[seedKey] ?? unitsForRows(cloneValue(sourceRows));
      const rows = templateRows(sourceRows);
      const units = normalizeAndEnsureBranchUnits(
        cloneValue(sourceUnits).map((unit) => ({ ...unit, archived: false })),
        rows,
      );
      set({
        rows,
        units,
        rowsByMonth: { ...state.rowsByMonth, [key]: rows },
        unitsByMonth: { ...state.unitsByMonth, [key]: units },
        departmentIdsByMonth: { ...state.departmentIdsByMonth, [key]: state.departmentIdsByMonth[key] || 'dept-1' },
        versionsByMonth: withVersion(state, 'reset', actorName),
        deletedMonths: state.deletedMonths.filter((item) => item !== key),
        monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
      });
      if (!persist(state)) return { ok: false, reason: 'storage_error', message: 'Unable to save OT administration data.' };
      recordAudit(actorName, 'update', { id: key, title: 'OT month reset' }, key, 'Default layout');
      return { ok: true };
    },
    publishCurrentMonth: (actorName) => {
      const state = get();
      const key = formatLateScheduleMonthKey(state.year, state.month);
      set({
        publishedRowsByMonth: { ...state.publishedRowsByMonth, [key]: cloneValue(state.rows) },
        publishedUnitsByMonth: { ...state.publishedUnitsByMonth, [key]: cloneValue(state.units) },
        departmentIdsByMonth: { ...state.departmentIdsByMonth, [key]: state.departmentIdsByMonth[key] || 'dept-1' },
        versionsByMonth: withVersion(state, 'publish', actorName),
        monthStatuses: { ...state.monthStatuses, [key]: 'published' },
      });
      if (!persist(state)) return { ok: false, reason: 'storage_error', message: 'Unable to save OT administration data.' };
      recordAudit(actorName, 'publish', { id: key, title: 'OT month' }, 'draft', 'published');
      return { ok: true };
    },
  };
}

export function createLateScheduleStore(
  options: CreateLateScheduleStoreOptions = {},
): StoreApi<LateScheduleState> {
  const resolvedOptions = { ...options, storage: options.storage ?? browserStorage() };
  return createStore<LateScheduleState>()((set, get) => createLateScheduleState(resolvedOptions, set, get));
}

let lateScheduleChannel: BroadcastChannel | null = null;

function broadcastLateScheduleChange() {
  try {
    lateScheduleChannel?.postMessage({ type: 'late-schedule-changed' });
  } catch {
    // localStorage persistence remains authoritative when BroadcastChannel is unavailable.
  }
}

const defaultOptions: CreateLateScheduleStoreOptions = {
  storage: browserStorage(),
  onChanged: broadcastLateScheduleChange,
};

export const useLateScheduleStore = create<LateScheduleState>()(
  (set, get) => createLateScheduleState(defaultOptions, set, get),
);

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      lateScheduleChannel = new BroadcastChannel('ngh-late-schedule');
      lateScheduleChannel.addEventListener('message', () => useLateScheduleStore.getState().reloadFromStorage());
    }
    window.addEventListener('storage', (event) => {
      if (event.key === LATE_SCHEDULE_STORAGE_KEY) useLateScheduleStore.getState().reloadFromStorage();
    });
  } catch {
    // Cross-tab refresh is best-effort; the versioned local snapshot is still safe.
  }
}
