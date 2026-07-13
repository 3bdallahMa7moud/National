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
  LateScheduleWarning,
  OTMutationResult,
  OTRosterEmployee,
  OTShiftInput,
  OTShiftRow,
} from '@/types/lateSchedule';

export const LATE_SCHEDULE_STORAGE_KEY = 'ngh_late_schedule_data_v3';
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
  initialYear?: number;
  initialMonth?: number;
  initialNotice?: string;
}

export interface LateScheduleState {
  year: number;
  month: number;
  rows: OTShiftRow[];
  rowsByMonth: Record<string, OTShiftRow[]>;
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
  setCellAssignments(
    rowId: string,
    day: number,
    employeeIds: string[],
    unresolvedLegacyCodes?: string[],
    actorName?: string,
  ): OTMutationResult;
  clearCell(rowId: string, day: number, actorName?: string): OTMutationResult;
}

interface InitialLateScheduleState {
  year: number;
  month: number;
  rowsByMonth: Record<string, OTShiftRow[]>;
  notice: string;
  warnings: LateScheduleWarning[];
}

function cloneRowsByMonth(rowsByMonth: Record<string, OTShiftRow[]>): Record<string, OTShiftRow[]> {
  return JSON.parse(JSON.stringify(rowsByMonth));
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

type SupportedLateSchedulePersistedState = LateSchedulePersistedState | LateSchedulePersistedStateV2;

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
      && assignments.length <= 2
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
): value is SupportedLateSchedulePersistedState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<SupportedLateSchedulePersistedState>;
  return state.version === version
    && Number.isInteger(state.currentYear)
    && Number.isInteger(state.currentMonth)
    && Number(state.currentMonth) >= 0
    && Number(state.currentMonth) <= 11
    && isStoredRowsByMonth(state.rowsByMonth)
    && typeof state.notice === 'string';
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

function writeV3State(storage: LateScheduleStorage, state: InitialLateScheduleState): void {
  storage.setItem(LATE_SCHEDULE_STORAGE_KEY, JSON.stringify({
    version: 3,
    currentYear: state.year,
    currentMonth: state.month,
    rowsByMonth: state.rowsByMonth,
    notice: state.notice,
  } satisfies LateSchedulePersistedState));
}

function stateFromPersisted(
  parsed: SupportedLateSchedulePersistedState,
): InitialLateScheduleState {
  const migrated = migrateRetiredOTEmployeeIds(parsed.rowsByMonth);
  return {
    year: parsed.currentYear,
    month: parsed.currentMonth,
    rowsByMonth: migrated.rowsByMonth,
    notice: parsed.notice,
    warnings: migrated.warnings.map((code) => ({ kind: 'unresolved_employee', code })),
  };
}

function readInitialState(options: CreateLateScheduleStoreOptions): InitialLateScheduleState {
  const storage = options.storage;
  const roster = options.migrationRoster ?? defaultMigrationRoster();
  const fallbackRows = cloneRowsByMonth(options.initialRowsByMonth ?? seedRowsByMonth(roster));
  const fallback: InitialLateScheduleState = {
    year: options.initialYear ?? 2026,
    month: options.initialMonth ?? 6,
    rowsByMonth: fallbackRows,
    notice: options.initialNotice ?? DEFAULT_LATE_SCHEDULE_NOTICE,
    warnings: [],
  };

  if (!storage) return fallback;

  let recoveredFromInvalidPayload = false;
  try {
    const persistedCandidates = [
      { key: LATE_SCHEDULE_STORAGE_KEY, version: 3 as const },
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
        if (candidate.version === 2 || state.warnings.length > 0) {
          try {
            writeV3State(storage, state);
          } catch {
            addStorageRecoveryWarning(state);
          }
        }
        if (recoveredFromInvalidPayload) addStorageRecoveryWarning(state);
        return state;
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
        notice: storage.getItem(LEGACY_LATE_SCHEDULE_NOTICE_KEY) ?? fallback.notice,
        warnings: migrated.warnings.map((code) => ({ kind: 'unresolved_employee', code })),
      };
      try {
        writeV3State(storage, migratedState);
      } catch {
        addStorageRecoveryWarning(migratedState);
      }
      if (recoveredFromInvalidPayload) addStorageRecoveryWarning(migratedState);
      return migratedState;
    }
  } catch {
    recoveredFromInvalidPayload = true;
  }

  if (recoveredFromInvalidPayload) addStorageRecoveryWarning(fallback);
  return fallback;
}

function persistedSnapshot(state: LateScheduleState): LateSchedulePersistedState {
  return {
    version: 3,
    currentYear: state.year,
    currentMonth: state.month,
    rowsByMonth: state.rowsByMonth,
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

  const persist = () => {
    if (!storage) return;
    try {
      storage.setItem(LATE_SCHEDULE_STORAGE_KEY, JSON.stringify(persistedSnapshot(get())));
    } catch {
      const warnings = get().warnings;
      if (!warnings.some((warning) => warning.kind === 'storage_recovery')) {
        set({ warnings: [...warnings, { kind: 'storage_recovery' }] });
      }
    }
  };

  const commitRows = (rows: OTShiftRow[]) => {
    const state = get();
    const key = formatLateScheduleMonthKey(state.year, state.month);
    const rowsByMonth = { ...state.rowsByMonth, [key]: rows };
    set({
      rows,
      rowsByMonth,
      warnings: deriveLateScheduleWarnings(rowsByMonth, state.warnings),
    });
    persist();
  };

  const recordAudit = (
    actorName: string | undefined,
    action: 'create' | 'update' | 'assign' | 'clear' | 'archive' | 'restore',
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

  return {
    year: initial.year,
    month: initial.month,
    rowsByMonth: initial.rowsByMonth,
    rows: initial.rowsByMonth[activeKey] ?? [],
    notice: initial.notice,
    warnings: initial.warnings,

    setMonth: (year, month) => {
      const normalized = normalizeMonth(year, month);
      const state = get();
      const key = formatLateScheduleMonthKey(normalized.year, normalized.month);
      set({ year: normalized.year, month: normalized.month, rows: state.rowsByMonth[key] ?? [] });
      persist();
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
      const before = get().notice;
      const after = notice.trim();
      set({ notice: after });
      persist();
      if (before !== after) {
        recordAudit(actorName, 'update', { id: 'ot-notice', title: 'OT notice' }, before, after);
      }
    },
    addRow: (input, actorName) => {
      const validation = validateRowInput(input);
      if (!validation.ok) return validation;
      const created: OTShiftRow = {
        id: `ot-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: input.title.trim(),
        location: input.location.trim(),
        timeRange: input.timeRange.trim(),
        hours: input.hours,
        highlightedDays: normalizedHighlightedDays(input.highlightedDays),
        assignments: {},
      };
      commitRows([...get().rows, created]);
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
        location: input.location.trim(),
        timeRange: input.timeRange.trim(),
        hours: input.hours,
        highlightedDays: input.highlightedDays === undefined
          ? existing.highlightedDays
          : normalizedHighlightedDays(input.highlightedDays),
      };
      commitRows(get().rows.map((row) => row.id === id ? updated : row));
      recordAudit(actorName, 'update', updated, existing, updated);
      return { ok: true };
    },
    archiveRow: (id, actorName) => {
      const existing = get().rows.find((row) => row.id === id);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const updated = { ...existing, archived: true };
      commitRows(get().rows.map((row) => row.id === id ? updated : row));
      recordAudit(actorName, 'archive', updated, { archived: existing.archived === true }, { archived: true });
      return { ok: true };
    },
    restoreLateShiftRow: (id, actorName) => {
      const existing = get().rows.find((row) => row.id === id);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const updated = { ...existing, archived: false };
      commitRows(get().rows.map((row) => row.id === id ? updated : row));
      recordAudit(actorName, 'restore', updated, { archived: existing.archived === true }, { archived: false });
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
      if (uniqueIds.length + uniqueLegacyCodes.length > 2) return { ok: false, reason: 'capacity' };
      const existing = get().rows.find((row) => row.id === rowId);
      if (!existing) return { ok: false, reason: 'row_not_found' };
      const before = existing.assignments[day] ?? [];
      const after = [
        ...uniqueIds.map((employeeId) => ({ kind: 'employee' as const, employeeId })),
        ...uniqueLegacyCodes.map((legacyCode) => ({ kind: 'unresolved' as const, legacyCode })),
      ];
      commitRows(get().rows.map((row) => row.id === rowId ? {
        ...row,
        assignments: { ...row.assignments, [day]: after },
      } : row));
      recordAudit(actorName, 'assign', existing, before, after, day);
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
      commitRows(get().rows.map((row) => {
        if (row.id !== rowId) return row;
        const assignments = { ...row.assignments };
        delete assignments[day];
        return { ...row, assignments };
      }));
      recordAudit(actorName, 'clear', existing, before, [], day);
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

const defaultOptions: CreateLateScheduleStoreOptions = { storage: browserStorage() };

export const useLateScheduleStore = create<LateScheduleState>()(
  (set, get) => createLateScheduleState(defaultOptions, set, get),
);
