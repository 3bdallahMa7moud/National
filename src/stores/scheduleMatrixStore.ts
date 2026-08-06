// ============================================================
// scheduleMatrixStore - Zustand store for Schedule Matrix
// ============================================================
// Frontend-only state management. Mutations are in-memory against
// cloned mock data, but the flow mirrors draft -> publish behavior.

import { create } from 'zustand';
import type { Language } from '@/i18n/constants';
import { getStoredLanguage } from '@/i18n/constants';
import {
  formatRangeCopyMessage,
  formatSettingsMessage,
  formatVacationDaysMessage,
  formatVacationRangeMessage,
  getMatrixStoreText,
} from '@/lib/scheduleMatrixLocale';
import type {
  Assignment,
  AuditEntry,
  FacilitySettings,
  MatrixAdminMode,
  MatrixCellRef,
  MatrixReorderCommand,
  MatrixReorderResult,
  MatrixDeleteResult,
  MarkerColor,
  ScheduleMatrixData,
  ScheduleAdminMutationResult,
  ScheduleCellMarkerMutationResult,
  ScheduleMatrixVersion,
  ScheduleMonthStatus,
  SchedulePublishResult,
  ShiftColorKey,
  ShiftDefinition,
  ShiftRow,
  Unit,
  UnitDefinition,
  VacationRange,
  VacationType,
  ValidateResult,
} from '@/types/scheduleMatrix';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import {
  isBlockingAssignmentConflict,
  recalculateAllConflicts,
  validateAssignmentsForCell,
} from '@/lib/validateAssignment';
import {
  countScheduleConflicts,
  generateConflictFreeScheduleMonth,
} from '@/lib/conflictFreeScheduleGenerator';
import {
  countScheduleCellMarkers,
  normalizeScheduleCellMarkers,
  removeScheduleCellMarkersForRows,
  scheduleCellMarkerKey,
} from '@/lib/scheduleCellMarkers';
import { getOfficialEmployeeRoster, useEmployeeRosterStore } from './employeeRosterStore';
import { useOperationalAuditStore } from './operationalAuditStore';
import {
  addMonthVersion,
  clearScheduleContent,
  cloneScheduleMatrix as cloneData,
  countMatrixAssignments,
  deletedMonthShell,
  matrixMonthKey,
  pasteMatrixIntoMonth,
  structureOnly,
} from './scheduleMatrixMonthOperations';
import {
  normalizeScheduleMonthStatuses,
  persistMonthlyState,
  readAdminControl,
  readMonthlyState,
  readStoredMatrices,
  SCHEDULE_MONTHLY_STORAGE_KEY,
} from './scheduleMatrixPersistence';

export {
  SCHEDULE_ADMIN_CONTROL_STORAGE_KEY,
  SCHEDULE_MATRIX_HISTORY_STORAGE_KEY,
  SCHEDULE_MONTHLY_STORAGE_KEY,
} from './scheduleMatrixPersistence';

type DrawerCell = MatrixCellRef & {
  facilityName: string;
  unitName: string;
  shiftLabel: string;
  timeRange: string;
  defaultColorKey: ShiftColorKey;
};

interface UndoSnapshot {
  data: ScheduleMatrixData;
  draftCellKeys: string[];
  brushEmployeeCodes: string[];
}

interface ScheduleTableClipboard {
  sourceKey: string;
  sourceYear: number;
  sourceMonth: number;
  copiedAt: string;
  assignmentCount: number;
  data: ScheduleMatrixData;
}

export type EmployeeIdentityUpdateResult =
  | { ok: true; fullName: string; code: string }
  | {
    ok: false;
    reason: 'name_required' | 'code_required' | 'duplicate_code' | 'employee_not_found';
  };

interface ScheduleMatrixState {
  data: ScheduleMatrixData | null;
  /** Published month snapshots only; reports must never treat generated or draft months as available. */
  matricesByMonth: Record<string, ScheduleMatrixData>;
  /** Persisted draft snapshots, including manual unit and shift ordering. */
  draftsByMonth: Record<string, ScheduleMatrixData>;
  /** Last published snapshot, used by discard and dirty checks */
  snapshot: string;
  /** Draft cell/settings/vacation keys changed since last publish */
  draftCellKeys: string[];
  undoStack: UndoSnapshot[];
  monthStatuses: Record<string, ScheduleMonthStatus>;
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>;
  tableClipboard: ScheduleTableClipboard | null;
  deletedMonths: string[];
  storageError: string | null;

  month: number;
  year: number;
  locale: Language;

  setLocale: (locale: Language) => void;

  adminMode: MatrixAdminMode;
  setAdminMode: (mode: MatrixAdminMode) => void;

  facilityFilter: string;
  setFacilityFilter: (id: string) => void;

  highlightedEmployeeId: string | null;
  setHighlightedEmployeeId: (id: string | null) => void;

  selectedCells: MatrixCellRef[];
  toggleCellSelection: (ref: MatrixCellRef) => void;
  selectCellRange: (start: MatrixCellRef, end: MatrixCellRef) => void;
  clearSelection: () => void;
  setCellMarkers: (
    cells: MatrixCellRef[],
    color: MarkerColor | null,
  ) => ScheduleCellMarkerMutationResult;
  setSelectedCellMarkers: (color: MarkerColor | null) => ScheduleCellMarkerMutationResult;

  brushEmployeeCodes: string[];
  toggleBrushEmployeeCode: (code: string) => { ok: true };
  clearBrushEmployees: () => void;

  drawerCell: DrawerCell | null;
  openDrawer: (cell: DrawerCell) => void;
  closeDrawer: () => void;

  loadMonth: (month: number, year: number) => void;
  assignCell: (rowId: string, day: number, assignments: Assignment[]) => ValidateResult;
  clearCell: (rowId: string, day: number) => void;
  duplicateToNextDay: (rowId: string, day: number) => void;
  fillAssignmentRange: (source: MatrixCellRef, target: MatrixCellRef) => void;

  toggleVacation: (employeeId: string, day: number) => void;
  addVacationRange: (employeeId: string, startDay: number, endDay: number, type: VacationType) => void;
  addVacationDays: (employeeId: string, days: number[], type: VacationType) => void;
  removeVacationDay: (employeeId: string, day: number) => void;
  removeVacationRange: (employeeId: string, rangeId: string) => void;
  clearEmployeeVacations: (employeeId: string) => void;
  markCellVacation: (rowId: string, day: number, employeeId?: string) => void;
  updateEmployeeIdentity: (
    employeeId: string,
    fullName: string,
    code: string,
  ) => EmployeeIdentityUpdateResult;

  publishDrafts: (publisherName?: string) => SchedulePublishResult;
  discardDraft: () => void;
  undoLastEdit: () => boolean;
  recalculateConflicts: () => void;
  reloadFromStorage: () => void;

  addShiftDefinition: (facilityId: string, payload: Omit<ShiftDefinition, 'id' | 'facilityId'>) => void;
  updateShiftDefinition: (facilityId: string, shiftId: string, updates: Partial<ShiftDefinition>) => void;
  deleteShiftDefinition: (facilityId: string, shiftId: string) => void;
  archiveShiftDefinition: (facilityId: string, shiftId: string) => void;
  restoreShiftDefinition: (facilityId: string, shiftId: string) => void;
  addUnit: (facilityId: string, name: string) => void;
  renameUnit: (facilityId: string, unitId: string, name: string) => void;
  archiveUnit: (facilityId: string, unitId: string) => void;
  restoreUnit: (facilityId: string, unitId: string) => void;
  deleteUnit: (facilityId: string, unitId: string, removeAssignments?: boolean, actorName?: string) => MatrixDeleteResult;
  reorderMatrixItem: (command: MatrixReorderCommand, actorName?: string) => MatrixReorderResult;
  updateMatrixRow: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly' | 'shiftDefinitionId' | 'backgroundColor' | 'textColor'>>,
  ) => void;
  addMatrixRow: (facilityId: string, unitId: string, shiftDefinitionId: string, rowLabel: string) => void;
  archiveMatrixRow: (rowId: string) => void;
  restoreMatrixRow: (rowId: string) => void;
  deleteMatrixRow: (rowId: string, removeAssignments?: boolean) => void;
  clearAllAssignments: (actorName?: string) => number;
  copyCurrentTable: (actorName?: string) => ScheduleAdminMutationResult;
  pasteCopiedTable: (actorName?: string) => ScheduleAdminMutationResult;
  resetCurrentMonth: (actorName?: string) => ScheduleAdminMutationResult;
  generateConflictFreeMonth: (actorName?: string) => ScheduleAdminMutationResult;
  currentMonthStatus: () => ScheduleMonthStatus;

  expandedCellsView: boolean;
  setExpandedCellsView: (value: boolean | ((prev: boolean) => boolean)) => void;

  isDirty: () => boolean;
  pendingDraftCount: () => number;
  conflictCount: () => number;
}

function recordScheduleAdminAudit(
  actorName: string | undefined,
  action: 'delete' | 'clear' | 'restore' | 'publish' | 'update',
  state: Pick<ScheduleMatrixState, 'year' | 'month'>,
  label: string,
  before?: string,
  after?: string,
): void {
  useOperationalAuditStore.getState().record({
    actorName: actorName?.trim() || 'Administrator',
    action,
    module: 'schedule',
    entityId: `${state.year}-${String(state.month + 1).padStart(2, '0')}`,
    entityLabel: label,
    before,
    after,
    context: { year: state.year, month: state.month, route: '/admin/schedule' },
  });
}

function cellKey(rowId: string, day: number) {
  return scheduleCellMarkerKey(rowId, day);
}

function draftWith(existing: string[], key: string) {
  return existing.includes(key) ? existing : [...existing, key];
}

function formatAssignments(assignments: Assignment[], locale: Language) {
  return assignments.map((assignment) => assignment.employeeCode).join(', ')
    || getMatrixStoreText(locale, 'empty');
}

function addAudit(
  data: ScheduleMatrixData,
  locale: Language,
  entry: Omit<AuditEntry, 'id' | 'actorName' | 'timestamp'> & {
    actorName?: string;
    timestamp?: string;
  },
) {
  data.auditLog.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actorName: entry.actorName || getMatrixStoreText(locale, 'scheduleSupervisor'),
    timestamp: entry.timestamp || new Date().toISOString(),
    ...entry,
  });
}

function findRowContext(data: ScheduleMatrixData, rowId: string) {
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        if (row.id === rowId) {
          return { facility, unit, row };
        }
      }
    }
  }

  return null;
}

function normalizeComparableText(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function definitionMatchesRow(definition: ShiftDefinition, row: ShiftRow): boolean {
  const rowTimeRange = normalizeComparableText(row.timeRange);
  const definitionTimeRange = normalizeComparableText(normalizeTimeRange(definition));
  const rowShiftLabel = normalizeComparableText(row.shiftLabel);
  const definitionNames = new Set([
    normalizeComparableText(definition.label),
    normalizeComparableText(definition.englishName),
    normalizeComparableText(definition.arabicName),
    normalizeComparableText(definitionDisplayName(definition)),
  ].filter(Boolean));

  return rowTimeRange === definitionTimeRange && definitionNames.has(rowShiftLabel);
}

function resolveShiftDefinitionForRow(
  definitions: ShiftDefinition[],
  row: ShiftRow,
  preferredId?: string,
): ShiftDefinition | undefined {
  if (preferredId) {
    const definition = definitions.find((candidate) => candidate.id === preferredId);
    if (definition) return definition;
  }

  if (row.shiftDefinitionId) {
    const definition = definitions.find((candidate) => candidate.id === row.shiftDefinitionId);
    if (definition) return definition;
  }

  const exactMatches = definitions.filter((definition) => definitionMatchesRow(definition, row));
  if (exactMatches.length === 1) return exactMatches[0];

  const sameColorAndTime = definitions.filter((definition) =>
    definition.colorKey === row.colorKey
    && normalizeComparableText(normalizeTimeRange(definition)) === normalizeComparableText(row.timeRange),
  );
  const labeledColorMatch = sameColorAndTime.find((definition) => definitionMatchesRow(definition, row));
  if (labeledColorMatch) return labeledColorMatch;
  if (sameColorAndTime.length === 1) return sameColorAndTime[0];

  const sameColor = definitions.filter((definition) => definition.colorKey === row.colorKey);
  const labeledColorOnlyMatch = sameColor.find((definition) => definitionMatchesRow(definition, row));
  if (labeledColorOnlyMatch) return labeledColorOnlyMatch;
  if (sameColor.length === 1) return sameColor[0];

  return exactMatches[0];
}

function linkShiftDefinitionIds(data: ScheduleMatrixData): void {
  for (const facility of data.facilities) {
    const definitions = data.settings
      .find((entry) => entry.facilityId === facility.id)
      ?.shiftDefinitions ?? [];
    for (const unit of facility.units) {
      for (const shiftRow of unit.rows) {
        shiftRow.shiftDefinitionId = resolveShiftDefinitionForRow(definitions, shiftRow)?.id;
      }
    }
  }
}

function synchronizeMatrixRoster(data: ScheduleMatrixData): void {
  const roster = getOfficialEmployeeRoster();
  const employeeById = new Map(roster.map((employee) => [employee.employeeId, employee]));
  data.legend = roster.map((employee) => ({
    employeeId: employee.employeeId,
    code: employee.code,
    fullName: employee.fullName,
    fullNameEn: employee.fullNameEn,
  }));
  for (const vacation of data.vacations) {
    const employee = employeeById.get(vacation.employeeId);
    if (!employee) continue;
    vacation.employeeCode = employee.code;
    vacation.fullName = employee.fullName;
  }
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const shiftRow of unit.rows) {
        for (const assignments of Object.values(shiftRow.cellsByDay)) {
          for (const assignment of assignments) {
            const employee = employeeById.get(assignment.employeeId);
            if (employee) assignment.employeeCode = employee.code;
          }
        }
      }
    }
  }
}

function setCellAssignments(row: ShiftRow, day: number, assignments: Assignment[]) {
  const seen = new Set<string>();
  row.cellsByDay[day] = assignments.filter((assignment) => {
    const key = assignment.employeeId || assignment.employeeCode.trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((assignment) => ({
    ...assignment,
    status: 'draft',
    hasConflict: false,
    conflictReason: undefined,
    conflictType: undefined,
  }));
}

function emptyCells(daysInMonth: number): Record<number, Assignment[]> {
  const cells: Record<number, Assignment[]> = {};
  for (let day = 1; day <= daysInMonth; day += 1) cells[day] = [];
  return cells;
}

function normalizeTimeRange(definition: ShiftDefinition): string {
  if (definition.startTime && definition.endTime) return `${definition.startTime} - ${definition.endTime}`;
  return definition.timeRange;
}

function definitionDisplayName(definition: ShiftDefinition): string {
  return definition.englishName?.trim() || definition.label;
}

function applyShiftDefinitionToRow(row: ShiftRow, definition: ShiftDefinition): void {
  row.shiftDefinitionId = definition.id;
  row.shiftLabel = definitionDisplayName(definition);
  row.timeRange = normalizeTimeRange(definition);
  row.colorKey = definition.colorKey;
  row.backgroundColor = definition.backgroundColor;
  row.textColor = definition.textColor;
  row.icon = definition.icon;
}

function synchronizeShiftTypeColors(data: ScheduleMatrixData): void {
  const styleByColorKey = new Map<ShiftColorKey, Pick<ShiftDefinition, 'backgroundColor' | 'textColor'>>();

  for (const settings of data.settings) {
    for (const definition of settings.shiftDefinitions) {
      const style = styleByColorKey.get(definition.colorKey) ?? {};
      if (!style.backgroundColor && definition.backgroundColor) {
        style.backgroundColor = definition.backgroundColor;
      }
      if (!style.textColor && definition.textColor) {
        style.textColor = definition.textColor;
      }
      styleByColorKey.set(definition.colorKey, style);
    }
  }

  for (const settings of data.settings) {
    for (const definition of settings.shiftDefinitions) {
      const style = styleByColorKey.get(definition.colorKey);
      definition.backgroundColor = style?.backgroundColor;
      definition.textColor = style?.textColor;
    }
  }
}

function synchronizeRowsWithShiftDefinitions(data: ScheduleMatrixData): void {
  synchronizeShiftTypeColors(data);
  for (const facility of data.facilities) {
    const definitions = data.settings
      .find((entry) => entry.facilityId === facility.id)
      ?.shiftDefinitions ?? [];
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        const definition = row.shiftDefinitionId ? definitionById.get(row.shiftDefinitionId) : undefined;
        if (definition) applyShiftDefinitionToRow(row, definition);
      }
    }
  }
}

function prepareLegacyStoredMatrix(data: ScheduleMatrixData): void {
  data.cellMarkers = normalizeScheduleCellMarkers(data.cellMarkers);
  linkShiftDefinitionIds(data);
  synchronizeRowsWithShiftDefinitions(data);
}

function normalizeStoredMatrix(data: ScheduleMatrixData): void {
  prepareLegacyStoredMatrix(data);
  synchronizeMatrixRoster(data);
}

export function normalizeScheduleMatrixData(data: ScheduleMatrixData): ScheduleMatrixData {
  normalizeStoredMatrix(data);
  return data;
}

function makeShiftRowFromDefinition(
  facilityId: string,
  unit: Unit,
  definition: ShiftDefinition,
  rowLabel: string,
  year: number,
  month: number,
): ShiftRow {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const shiftRow: ShiftRow = {
    id: `${unit.id}-row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    shiftDefinitionId: definition.id,
    blockType: unit.blockType,
    unitLabel: unit.name,
    rowLabel: rowLabel.trim(),
    shiftLabel: definitionDisplayName(definition),
    timeRange: normalizeTimeRange(definition),
    colorKey: definition.colorKey,
    backgroundColor: definition.backgroundColor,
    textColor: definition.textColor,
    icon: definition.icon,
    weekendOnly: definition.colorKey === 'onCall' || definition.colorKey === 'onCallNight',
    cellsByDay: emptyCells(daysInMonth),
  };

  if (facilityId.includes('oncall')) shiftRow.weekendOnly = true;
  return shiftRow;
}

function makeEmptyUnit(facilityId: string, name: string): Unit {
  const id = `${facilityId}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  return {
    id,
    name,
    blockType: 'equipmentDay',
    rows: [],
  };
}

function pushUndo(state: ScheduleMatrixState): UndoSnapshot[] {
  if (!state.data) return state.undoStack;
  return [
    {
      data: cloneData(state.data),
      draftCellKeys: [...state.draftCellKeys],
      brushEmployeeCodes: [...state.brushEmployeeCodes],
    },
    ...state.undoStack,
  ].slice(0, 20);
}

const now = new Date();
const initialMonthlyState = readMonthlyState(normalizeStoredMatrix);
const initialAdminControl = initialMonthlyState ?? readAdminControl();
if (!initialMonthlyState) {
  Object.values(initialAdminControl.versionsByMonth)
    .flat()
    .forEach((version) => normalizeStoredMatrix(version.data));
}
let isSchedulePersistenceRollback = false;

export const useScheduleMatrixStore = create<ScheduleMatrixState>((set, get) => ({
  data: null,
  matricesByMonth: initialMonthlyState?.matricesByMonth
    ?? readStoredMatrices(prepareLegacyStoredMatrix),
  draftsByMonth: initialMonthlyState?.draftsByMonth ?? {},
  snapshot: '',
  draftCellKeys: [],
  undoStack: [],
  monthStatuses: initialAdminControl.monthStatuses,
  versionsByMonth: initialAdminControl.versionsByMonth,
  tableClipboard: null,
  deletedMonths: initialAdminControl.deletedMonths,
  storageError: null,
  month: now.getMonth(),
  year: now.getFullYear(),
  locale: getStoredLanguage(),

  setLocale: (locale) => set((state) => (state.locale === locale ? state : { locale })),

  adminMode: 'view',
  setAdminMode: (mode) => set({ adminMode: mode, selectedCells: [], brushEmployeeCodes: [] }),

  facilityFilter: '',
  setFacilityFilter: (id) => set({ facilityFilter: id }),

  expandedCellsView: false,
  setExpandedCellsView: (val) =>
    set((state) => ({
      expandedCellsView: typeof val === 'function' ? val(state.expandedCellsView) : val,
    })),

  currentMonthStatus: () => {
    const state = get();
    const key = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
    const storedStatus = normalizeScheduleMonthStatuses({ [key]: state.monthStatuses[key] })[key];
    if (state.draftCellKeys.length > 0) return 'draft';
    return storedStatus || (state.matricesByMonth[key] ? 'published' : 'draft');
  },
  highlightedEmployeeId: null,
  setHighlightedEmployeeId: (id) => set((state) => ({
    highlightedEmployeeId: state.highlightedEmployeeId === id ? null : id,
  })),

  selectedCells: [],
  toggleCellSelection: (ref) =>
    set((state) => {
      const key = `${ref.facilityId}|${ref.unitId}|${ref.rowId}|${ref.day}`;
      const exists = state.selectedCells.some(
        (cell) => `${cell.facilityId}|${cell.unitId}|${cell.rowId}|${cell.day}` === key,
      );
      return {
        selectedCells: exists
          ? state.selectedCells.filter((cell) => `${cell.facilityId}|${cell.unitId}|${cell.rowId}|${cell.day}` !== key)
          : [...state.selectedCells, ref],
      };
    }),
  selectCellRange: (start, end) =>
    set((state) => {
      if (start.facilityId !== end.facilityId || start.unitId !== end.unitId || start.rowId !== end.rowId) {
        return { selectedCells: [end] };
      }

      const from = Math.min(start.day, end.day);
      const to = Math.max(start.day, end.day);
      const selectedCells = Array.from({ length: to - from + 1 }, (_, index) => ({
        ...start,
        day: from + index,
      }));
      return { selectedCells: state.selectedCells.length ? selectedCells : selectedCells };
    }),
  clearSelection: () => set({ selectedCells: [] }),
  setCellMarkers: (cells, color) => {
    const state = get();
    if (!state.data || cells.length === 0) {
      return { ok: false, reason: 'no_selection' };
    }

    const data = cloneData(state.data);
    data.cellMarkers = normalizeScheduleCellMarkers(data.cellMarkers);
    const affectedKeys: string[] = [];

    for (const cell of cells) {
      const context = findRowContext(data, cell.rowId);
      if (!context) continue;
      const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
      if (cell.day < 1 || cell.day > daysInMonth) continue;

      const key = scheduleCellMarkerKey(cell.rowId, cell.day);
      if (color === null) {
        if (!(key in data.cellMarkers)) continue;
        delete data.cellMarkers[key];
      } else {
        if (data.cellMarkers[key] === color) continue;
        data.cellMarkers[key] = color;
      }
      affectedKeys.push(key);
    }

    if (affectedKeys.length === 0) return { ok: true, affected: 0 };

    addAudit(data, state.locale, {
      action: 'marker',
      oldValue: `${affectedKeys.length} selected cells`,
      newValue: color ? `${color} marker` : 'Marker removed',
    });
    set({
      data,
      draftCellKeys: affectedKeys.reduce(
        (keys, key) => draftWith(keys, key),
        state.draftCellKeys,
      ),
      undoStack: pushUndo(state),
    });

    if (get().data !== data || get().storageError) {
      return {
        ok: false,
        reason: 'storage_error',
        message: get().storageError || undefined,
      };
    }
    return { ok: true, affected: affectedKeys.length };
  },
  setSelectedCellMarkers: (color) => {
    const state = get();
    return state.setCellMarkers(state.selectedCells, color);
  },

  brushEmployeeCodes: [],
  toggleBrushEmployeeCode: (code) => {
    const state = get();
    if (state.brushEmployeeCodes.includes(code)) {
      set({ brushEmployeeCodes: state.brushEmployeeCodes.filter((c) => c !== code) });
      return { ok: true };
    }
    set({ brushEmployeeCodes: [...state.brushEmployeeCodes, code] });
    return { ok: true };
  },
  clearBrushEmployees: () => set({ brushEmployeeCodes: [] }),

  updateEmployeeIdentity: (employeeId, fullName, code) => {
    const state = get();
    const normalizedName = fullName.trim();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedName) return { ok: false, reason: 'name_required' };
    if (!normalizedCode) return { ok: false, reason: 'code_required' };
    if (!state.data) return { ok: false, reason: 'employee_not_found' };

    const employee = state.data.legend.find((entry) => entry.employeeId === employeeId);
    if (!employee) return { ok: false, reason: 'employee_not_found' };

    const duplicate = state.data.legend.some(
      (entry) =>
        entry.employeeId !== employeeId
        && entry.code.trim().toUpperCase() === normalizedCode,
    );
    if (duplicate) return { ok: false, reason: 'duplicate_code' };

    const data = cloneData(state.data);
    const target = data.legend.find((entry) => entry.employeeId === employeeId);
    if (!target) return { ok: false, reason: 'employee_not_found' };

    const oldName = target.fullName;
    const oldCode = target.code;
    target.fullName = normalizedName;
    target.fullNameEn = normalizedName;
    target.code = normalizedCode;

    for (const vacation of data.vacations) {
      if (vacation.employeeId !== employeeId) continue;
      vacation.fullName = normalizedName;
      vacation.employeeCode = normalizedCode;
    }

    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const assignments of Object.values(row.cellsByDay)) {
            for (const assignment of assignments) {
              if (assignment.employeeId === employeeId) {
                assignment.employeeCode = normalizedCode;
              }
            }
          }
        }
      }
    }

    addAudit(data, state.locale, {
      action: 'settings',
      oldValue: `${oldName} (${oldCode})`,
      newValue: `${normalizedName} (${normalizedCode})`,
    });

    set({
      data,
      brushEmployeeCodes: state.brushEmployeeCodes.map((selectedCode) =>
        selectedCode === oldCode ? normalizedCode : selectedCode,
      ),
      draftCellKeys: draftWith(state.draftCellKeys, `identity|${employeeId}`),
      undoStack: pushUndo(state),
    });

    return { ok: true, fullName: normalizedName, code: normalizedCode };
  },

  drawerCell: null,
  openDrawer: (cell) => set({ drawerCell: cell }),
  closeDrawer: () => set({ drawerCell: null }),

  loadMonth: (month, year) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const stored = get().matricesByMonth[key];
    const draft = get().draftsByMonth[key];
    const isDeleted = get().deletedMonths.includes(key);
    const data = isDeleted
      ? deletedMonthShell(year, month)
      : cloneData(draft ?? stored ?? generateScheduleMatrixMock(year, month));
    linkShiftDefinitionIds(data);
    synchronizeRowsWithShiftDefinitions(data);
    synchronizeMatrixRoster(data);
    recalculateAllConflicts(data);
    set({
      data,
      month,
      year,
      snapshot: JSON.stringify(stored ?? data),
      draftCellKeys: draft && !isDeleted ? [`restored-draft|${key}`] : [],
      undoStack: [],
      selectedCells: [],
      brushEmployeeCodes: [],
      monthStatuses: get().monthStatuses[key]
        ? get().monthStatuses
        : { ...get().monthStatuses, [key]: stored ? 'published' : 'draft' },
    });
  },

  assignCell: (rowId, day, assignments) => {
    const state = get();
    if (!state.data) return { ok: true };
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return { ok: true };

    const validation = validateAssignmentsForCell(data, {
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      day,
      timeRange: context.row.timeRange,
      assignments,
    });

    if (isBlockingAssignmentConflict(validation)) return validation;

    const oldAssignments = context.row.cellsByDay[day] || [];
    setCellAssignments(context.row, day, assignments);
    recalculateAllConflicts(data);
    addAudit(data, state.locale, {
      action: assignments.length ? 'assign' : 'remove',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      day,
      oldValue: formatAssignments(oldAssignments, state.locale),
      newValue: formatAssignments(assignments, state.locale),
    });
    recalculateAllConflicts(data);

    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, cellKey(rowId, day)),
      undoStack: pushUndo(state),
    });

    if (get().storageError) {
      return {
        ok: false,
        conflict: { day, type: 'storage', reason: get().storageError! },
      };
    }

    return { ok: true };
  },

  clearCell: (rowId, day) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;

    const oldAssignments = context.row.cellsByDay[day] || [];
    setCellAssignments(context.row, day, []);
    addAudit(data, state.locale, {
      action: 'remove',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      day,
      oldValue: formatAssignments(oldAssignments, state.locale),
      newValue: getMatrixStoreText(state.locale, 'empty'),
    });
    recalculateAllConflicts(data);

    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, cellKey(rowId, day)),
      undoStack: pushUndo(state),
    });
  },

  duplicateToNextDay: (rowId, day) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;

    const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
    if (day >= daysInMonth) return;

    const sourceAssignments = context.row.cellsByDay[day] || [];
    const validation = validateAssignmentsForCell(data, {
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      day: day + 1,
      timeRange: context.row.timeRange,
      assignments: sourceAssignments,
    });
    if (isBlockingAssignmentConflict(validation)) return;

    setCellAssignments(context.row, day + 1, sourceAssignments);
    addAudit(data, state.locale, {
      action: 'assign',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      day: day + 1,
      oldValue: formatAssignments(context.row.cellsByDay[day + 1] || [], state.locale),
      newValue: formatAssignments(sourceAssignments, state.locale),
    });
    recalculateAllConflicts(data);

    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, cellKey(rowId, day + 1)),
      undoStack: pushUndo(state),
    });
  },

  fillAssignmentRange: (source, target) => {
    const state = get();
    if (!state.data) return;
    if (source.facilityId !== target.facilityId || source.unitId !== target.unitId || source.rowId !== target.rowId) return;

    const data = cloneData(state.data);
    const context = findRowContext(data, source.rowId);
    if (!context) return;

    const sourceAssignments = context.row.cellsByDay[source.day] || [];
    if (sourceAssignments.length === 0) return;

    const from = Math.min(source.day, target.day);
    const to = Math.max(source.day, target.day);
    let draftCellKeys = state.draftCellKeys;

    for (let day = from; day <= to; day += 1) {
      if (day === source.day) continue;
      const validation = validateAssignmentsForCell(data, {
        facilityId: context.facility.id,
        unitId: context.unit.id,
        rowId: source.rowId,
        day,
        timeRange: context.row.timeRange,
        assignments: sourceAssignments,
      });
      if (isBlockingAssignmentConflict(validation)) continue;

      setCellAssignments(context.row, day, sourceAssignments);
      draftCellKeys = draftWith(draftCellKeys, cellKey(source.rowId, day));
    }

    addAudit(data, state.locale, {
      action: 'assign',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId: source.rowId,
      day: target.day,
      oldValue: 'fill-handle',
      newValue: formatRangeCopyMessage(state.locale, formatAssignments(sourceAssignments, state.locale), from, to),
    });
    recalculateAllConflicts(data);
    set({ data, draftCellKeys, undoStack: pushUndo(state) });
  },

  toggleVacation: (employeeId, day) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const vacation = data.vacations.find((row) => row.employeeId === employeeId);
    if (!vacation) return;

    if (vacation.daysOff.includes(day)) {
      vacation.daysOff = vacation.daysOff.filter((item) => item !== day);
    } else {
      vacation.daysOff.push(day);
      vacation.daysOff.sort((a, b) => a - b);
    }

    addAudit(data, state.locale, {
      action: 'vacation',
      day,
      oldValue: vacation.employeeCode,
      newValue: vacation.daysOff.includes(day)
        ? getMatrixStoreText(state.locale, 'addVacation')
        : getMatrixStoreText(state.locale, 'removeVacation'),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `vac|${employeeId}|${day}`),
      undoStack: pushUndo(state),
    });
  },

  addVacationRange: (employeeId, startDay, endDay, type) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const from = Math.max(1, Math.min(startDay, endDay));
    const to = Math.min(new Date(data.year, data.month + 1, 0).getDate(), Math.max(startDay, endDay));
    const employee = data.legend.find((item) => item.employeeId === employeeId);
    if (!employee) return;

    let vacation = data.vacations.find((row) => row.employeeId === employeeId);
    if (!vacation) {
      vacation = {
        employeeId,
        employeeCode: employee.code,
        fullName: employee.fullName,
        daysOff: [],
        type,
        ranges: [],
      };
      data.vacations.push(vacation);
    }

    const days = new Set(vacation.daysOff);
    for (let day = from; day <= to; day += 1) days.add(day);
    vacation.daysOff = [...days].sort((a, b) => a - b);
    vacation.type = type;
    vacation.ranges = [
      ...(vacation.ranges || []),
      {
        id: `vac-${employee.code.toLowerCase()}-${from}-${Date.now()}`,
        employeeId,
        startDay: from,
        endDay: to,
        type,
        status: 'draft',
      },
    ];

    addAudit(data, state.locale, {
      action: 'vacation',
      day: from,
      oldValue: employee.code,
      newValue: formatVacationRangeMessage(state.locale, type, from, to),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `vac|${employeeId}|${from}-${to}`),
      undoStack: pushUndo(state),
    });
  },

  addVacationDays: (employeeId, selectedDays, type) => {
    const state = get();
    if (!state.data || selectedDays.length === 0) return;
    const data = cloneData(state.data);
    const employee = data.legend.find((item) => item.employeeId === employeeId);
    if (!employee) return;

    let vacation = data.vacations.find((row) => row.employeeId === employeeId);
    if (!vacation) {
      vacation = {
        employeeId,
        employeeCode: employee.code,
        fullName: employee.fullName,
        daysOff: [],
        type,
        ranges: [],
      };
      data.vacations.push(vacation);
    }

    const daysSet = new Set(vacation.daysOff);
    for (const day of selectedDays) {
      daysSet.add(day);
    }
    vacation.daysOff = [...daysSet].sort((a, b) => a - b);
    vacation.type = type;

    const sorted = [...selectedDays].sort((a, b) => a - b);
    vacation.ranges = [
      ...(vacation.ranges || []),
      {
        id: `vac-${employee.code.toLowerCase()}-${sorted[0]}-${Date.now()}`,
        employeeId,
        startDay: sorted[0],
        endDay: sorted[sorted.length - 1],
        type,
        status: 'draft',
      },
    ];

    addAudit(data, state.locale, {
      action: 'vacation',
      day: sorted[0],
      oldValue: employee.code,
      newValue: formatVacationDaysMessage(state.locale, type, sorted.join(', ')),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `vac|${employeeId}|${sorted.join(',')}`),
      undoStack: pushUndo(state),
    });
  },

  removeVacationDay: (employeeId, day) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const vacationIndex = data.vacations.findIndex((row) => row.employeeId === employeeId);
    if (vacationIndex === -1) return;

    const vacation = data.vacations[vacationIndex];
    if (!vacation.daysOff.includes(day)) return;

    vacation.daysOff = vacation.daysOff.filter((d) => d !== day);
    if (vacation.ranges) {
      vacation.ranges = vacation.ranges
        .map((r) => {
          if (day >= r.startDay && day <= r.endDay) {
            if (r.startDay === r.endDay) return null;
            if (day === r.startDay) return { ...r, startDay: r.startDay + 1 };
            if (day === r.endDay) return { ...r, endDay: r.endDay - 1 };
          }
          return r;
        })
        .filter(Boolean) as VacationRange[];
    }

    if (vacation.daysOff.length === 0) {
      data.vacations.splice(vacationIndex, 1);
    }

    addAudit(data, state.locale, {
      action: 'vacation',
      day,
      oldValue: vacation.employeeCode,
      newValue: getMatrixStoreText(state.locale, 'removeVacation'),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `vac|${employeeId}|remove-${day}`),
      undoStack: pushUndo(state),
    });
  },

  removeVacationRange: (employeeId, rangeId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const vacationIndex = data.vacations.findIndex((row) => row.employeeId === employeeId);
    if (vacationIndex === -1) return;

    const vacation = data.vacations[vacationIndex];
    const targetRange = vacation.ranges?.find((r) => r.id === rangeId);
    if (!targetRange) return;

    const daysToRemove = new Set<number>();
    for (let d = targetRange.startDay; d <= targetRange.endDay; d++) {
      daysToRemove.add(d);
    }

    vacation.ranges = (vacation.ranges || []).filter((r) => r.id !== rangeId);
    vacation.daysOff = vacation.daysOff.filter((d) => !daysToRemove.has(d));

    if (vacation.daysOff.length === 0) {
      data.vacations.splice(vacationIndex, 1);
    }

    addAudit(data, state.locale, {
      action: 'vacation',
      day: targetRange.startDay,
      oldValue: vacation.employeeCode,
      newValue: getMatrixStoreText(state.locale, 'removeVacation'),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `vac|${employeeId}|remove-range-${rangeId}`),
      undoStack: pushUndo(state),
    });
  },

  clearEmployeeVacations: (employeeId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const vacationIndex = data.vacations.findIndex((row) => row.employeeId === employeeId);
    if (vacationIndex === -1) return;

    const vacation = data.vacations[vacationIndex];
    data.vacations.splice(vacationIndex, 1);

    addAudit(data, state.locale, {
      action: 'vacation',
      day: 1,
      oldValue: vacation.employeeCode,
      newValue: getMatrixStoreText(state.locale, 'removeVacation'),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `vac|${employeeId}|clear`),
      undoStack: pushUndo(state),
    });
  },

  markCellVacation: (rowId, day, employeeId) => {
    const state = get();
    if (!state.data) return;
    const context = findRowContext(state.data, rowId);
    const assignment = employeeId
      ? context?.row.cellsByDay[day]?.find((item) => item.employeeId === employeeId)
      : context?.row.cellsByDay[day]?.[0];

    if (!assignment) return;
    get().addVacationRange(assignment.employeeId, day, day, 'emergency');
  },

  publishDrafts: (publisherName) => {
    const state = get();
    if (!state.data) {
      return { ok: false, message: 'Schedule is unavailable.' };
    }
    const currentKey = matrixMonthKey(state.data);
    if (state.draftCellKeys.length === 0 && state.matricesByMonth[currentKey]) {
      return {
        ok: true,
        message: getMatrixStoreText(state.locale, 'noUnpublished'),
        conflictCount: countScheduleConflicts(state.data),
        markerCount: countScheduleCellMarkers(state.data.cellMarkers),
      };
    }

    const data = cloneData(state.data);
    recalculateAllConflicts(data);

    const identityEmployeeIds = state.draftCellKeys
      .filter((key) => key.startsWith('identity|'))
      .map((key) => key.split('|')[1]);
    for (const employeeId of identityEmployeeIds) {
      const employee = data.legend.find((entry) => entry.employeeId === employeeId);
      if (!employee) continue;
      const rosterResult = useEmployeeRosterStore.getState().updateEmployeeIdentity(
        employeeId,
        employee.fullName,
        employee.code,
      );
      if (!rosterResult.ok) {
        return { ok: false, message: rosterResult.reason };
      }
    }
    synchronizeMatrixRoster(data);

    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const assignments of Object.values(row.cellsByDay)) {
            for (const assignment of assignments) assignment.status = 'published';
          }
        }
      }
    }

    for (const vacation of data.vacations) {
      for (const range of vacation.ranges || []) range.status = 'published';
    }

    const actorName = publisherName?.trim() || 'Administrator';
    const conflictCount = countScheduleConflicts(data);
    const markerCount = countScheduleCellMarkers(data.cellMarkers);
    addAudit(data, state.locale, {
      actorName,
      action: 'publish',
      oldValue: `Publisher: ${actorName} | ${state.draftCellKeys.length} draft changes`,
      newValue: `Published | ${conflictCount} conflicts | ${markerCount} markers`,
    });
    recalculateAllConflicts(data);

    const snapshot = JSON.stringify(data);
    const key = matrixMonthKey(data);
    const matricesByMonth = {
      ...state.matricesByMonth,
      [key]: cloneData(data),
    };
    const versionsByMonth = addMonthVersion(
      state.versionsByMonth,
      key,
      data,
      actorName,
      'publish',
    );
    set({
      data,
      matricesByMonth,
      snapshot,
      draftCellKeys: [],
      undoStack: [],
      versionsByMonth,
      deletedMonths: state.deletedMonths.filter((item) => item !== key),
      monthStatuses: { ...state.monthStatuses, [key]: 'published' },
    });
    if (get().storageError) return { ok: false, message: get().storageError! };
    recordScheduleAdminAudit(
      actorName,
      'publish',
      state,
      'Publish schedule month',
      `Publisher: ${actorName} | ${state.draftCellKeys.length} draft changes`,
      `Published | ${conflictCount} conflicts | ${markerCount} markers`,
    );
    return {
      ok: true,
      message: getMatrixStoreText(state.locale, 'publishedBatch'),
      conflictCount,
      markerCount,
    };
  },

  discardDraft: () => {
    const state = get();
    if (!state.snapshot) return;
    const data = JSON.parse(state.snapshot) as ScheduleMatrixData;
    addAudit(data, state.locale, {
      action: 'discard',
      oldValue: `${state.draftCellKeys.length} draft changes`,
      newValue: 'reverted to last published state',
    });
    set({ data, draftCellKeys: [], selectedCells: [], brushEmployeeCodes: [], undoStack: [] });
  },

  undoLastEdit: () => {
    const [last, ...rest] = get().undoStack;
    if (!last) return false;
    const data = cloneData(last.data);
    const locale = get().locale;
    addAudit(data, locale, {
      action: 'undo',
      oldValue: getMatrixStoreText(locale, 'lastLocalEdit'),
      newValue: getMatrixStoreText(locale, 'revertedBeforePublish'),
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: last.draftCellKeys,
      brushEmployeeCodes: last.brushEmployeeCodes,
      undoStack: rest,
    });
    return true;
  },

  recalculateConflicts: () =>
    set((state) => {
      if (!state.data) return {};
      const data = cloneData(state.data);
      recalculateAllConflicts(data);
      return { data };
    }),

  reloadFromStorage: () => {
    const stored = readMonthlyState(normalizeStoredMatrix);
    if (!stored) return;
    const state = get();
    const activeKey = state.data ? matrixMonthKey(state.data) : null;
    const publishedActive = activeKey ? stored.matricesByMonth[activeKey] : undefined;
    const shouldRefreshActiveData = !!publishedActive
      && state.draftCellKeys.length === 0;

    isSchedulePersistenceRollback = true;
    try {
      set({
        matricesByMonth: stored.matricesByMonth,
        monthStatuses: stored.monthStatuses,
        versionsByMonth: stored.versionsByMonth,
        deletedMonths: stored.deletedMonths,
        storageError: null,
        ...(shouldRefreshActiveData
          ? {
              data: cloneData(publishedActive),
              snapshot: JSON.stringify(publishedActive),
            }
          : {}),
      });
    } finally {
      isSchedulePersistenceRollback = false;
    }
  },

  addShiftDefinition: (facilityId, payload) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    if (!settings) return;
    const label = payload.englishName?.trim() || payload.label.trim();
    const startTime = payload.startTime || payload.timeRange.split(' - ')[0] || '08:00';
    const endTime = payload.endTime || payload.timeRange.split(' - ')[1] || '17:00';
    const existingTypeDefinition = data.settings
      .flatMap((entry) => entry.shiftDefinitions)
      .find((definition) => definition.colorKey === payload.colorKey);
    const definition: ShiftDefinition = {
      id: `${facilityId}-shift-${Date.now()}`,
      facilityId,
      ...payload,
      backgroundColor: payload.backgroundColor || existingTypeDefinition?.backgroundColor,
      textColor: payload.textColor || existingTypeDefinition?.textColor,
      label,
      englishName: payload.englishName || label,
      startTime,
      endTime,
      timeRange: `${startTime} - ${endTime}`,
    };
    settings.shiftDefinitions.push(definition);
    if (payload.backgroundColor || payload.textColor) {
      for (const facilitySettings of data.settings) {
        for (const candidate of facilitySettings.shiftDefinitions) {
          if (candidate.colorKey !== definition.colorKey) continue;
          if (payload.backgroundColor) candidate.backgroundColor = definition.backgroundColor;
          if (payload.textColor) candidate.textColor = definition.textColor;
        }
      }
    }
    synchronizeRowsWithShiftDefinitions(data);
    addAudit(data, state.locale, {
      action: 'settings',
      facilityId,
      newValue: formatSettingsMessage(state.locale, 'addShift', label),
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|shift|${facilityId}|${Date.now()}`),
      undoStack: pushUndo(state),
    });
  },

  updateShiftDefinition: (facilityId, shiftId, updates) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    const shift = settings?.shiftDefinitions.find((item) => item.id === shiftId);
    if (!shift) return;
    const previousColorKey = shift.colorKey;
    const colorKeyChanged = !!updates.colorKey && updates.colorKey !== previousColorKey;
    const targetTypeDefinition = colorKeyChanged
      ? data.settings
        .flatMap((entry) => entry.shiftDefinitions)
        .find((candidate) => candidate.id !== shift.id && candidate.colorKey === updates.colorKey)
      : undefined;
    Object.assign(shift, updates);
    if (colorKeyChanged) {
      if (!updates.backgroundColor) shift.backgroundColor = targetTypeDefinition?.backgroundColor;
      if (!updates.textColor) shift.textColor = targetTypeDefinition?.textColor;
    }
    shift.label = shift.englishName?.trim() || shift.label.trim();
    shift.timeRange = normalizeTimeRange(shift);
    const backgroundChanged = Object.prototype.hasOwnProperty.call(updates, 'backgroundColor')
      && (!colorKeyChanged || !!updates.backgroundColor);
    const textChanged = Object.prototype.hasOwnProperty.call(updates, 'textColor')
      && (!colorKeyChanged || !!updates.textColor);
    if (backgroundChanged || textChanged) {
      for (const facilitySettings of data.settings) {
        for (const candidate of facilitySettings.shiftDefinitions) {
          if (candidate.id === shift.id || candidate.colorKey !== shift.colorKey) continue;
          if (backgroundChanged) candidate.backgroundColor = shift.backgroundColor;
          if (textChanged) candidate.textColor = shift.textColor;
        }
      }
    }
    synchronizeRowsWithShiftDefinitions(data);
    recalculateAllConflicts(data);
    const archiveAction = Object.keys(updates).length === 1 && updates.archived === true;
    const restoreAction = Object.keys(updates).length === 1 && updates.archived === false;
    addAudit(data, state.locale, {
      action: archiveAction ? 'archive' : restoreAction ? 'restore' : 'settings',
      facilityId,
      oldValue: shiftId,
      newValue: formatSettingsMessage(state.locale, 'updateShift', shift.label),
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|shift|${shiftId}`),
      undoStack: pushUndo(state),
    });
  },

  deleteShiftDefinition: (facilityId, shiftId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    if (!settings) return;

    const isUsed = data.facilities.some((facility) =>
      facility.id === facilityId
      && facility.units.some((unit) => unit.rows.some((row) => row.shiftDefinitionId === shiftId)),
    );
    if (isUsed) {
      const shift = settings.shiftDefinitions.find((item) => item.id === shiftId);
      if (shift) shift.archived = true;
    } else {
      settings.shiftDefinitions = settings.shiftDefinitions.filter((item) => item.id !== shiftId);
    }

    addAudit(data, state.locale, {
      action: isUsed ? 'archive' : 'delete',
      facilityId,
      oldValue: shiftId,
      newValue: isUsed ? 'Archived shift definition in use' : 'Deleted shift definition',
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|shift-delete|${shiftId}`),
      undoStack: pushUndo(state),
    });
  },

  archiveShiftDefinition: (facilityId, shiftId) => {
    get().updateShiftDefinition(facilityId, shiftId, { archived: true });
  },

  restoreShiftDefinition: (facilityId, shiftId) => {
    get().updateShiftDefinition(facilityId, shiftId, { archived: false });
  },

  addUnit: (facilityId, name) => {
    const state = get();
    if (!state.data || !name.trim()) return;
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    if (!facility || !settings) return;

    const unit = makeEmptyUnit(facilityId, name.trim());
    facility.units.push(unit);
    settings.units.push({ id: unit.id, facilityId, name: unit.name });
    addAudit(data, state.locale, {
      action: 'settings',
      facilityId,
      newValue: formatSettingsMessage(state.locale, 'addUnit', unit.name),
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|unit|${unit.id}`),
      undoStack: pushUndo(state),
    });
  },

  renameUnit: (facilityId, unitId, name) => {
    const state = get();
    if (!state.data || !name.trim()) return;
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const unit = facility?.units.find((item) => item.id === unitId);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    const unitDefinition = settings?.units.find((item) => item.id === unitId);
    if (!unit || !unitDefinition) return;

    unit.name = name.trim();
    unitDefinition.name = name.trim();
    for (const row of unit.rows) row.unitLabel = name.trim();
    addAudit(data, state.locale, {
      action: 'settings',
      facilityId,
      unitId,
      newValue: formatSettingsMessage(state.locale, 'renameUnit', name.trim()),
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|unit|${unitId}`),
      undoStack: pushUndo(state),
    });
  },

  archiveUnit: (facilityId, unitId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const unit = facility?.units.find((item) => item.id === unitId);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    const unitDefinition = settings?.units.find((item) => item.id === unitId);
    if (!unit || !unitDefinition) return;

    unit.archived = true;
    unitDefinition.archived = true;
    addAudit(data, state.locale, {
      action: 'archive',
      facilityId,
      unitId,
      newValue: formatSettingsMessage(state.locale, 'archiveUnit', unit.name),
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|unit|${unitId}`),
      undoStack: pushUndo(state),
    });
  },

  restoreUnit: (facilityId, unitId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const unit = facility?.units.find((item) => item.id === unitId);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    const unitDefinition = settings?.units.find((item) => item.id === unitId);
    if (!unit || !unitDefinition) return;

    unit.archived = false;
    unitDefinition.archived = false;
    addAudit(data, state.locale, {
      action: 'restore',
      facilityId,
      unitId,
      newValue: formatSettingsMessage(state.locale, 'restoreUnit', unit.name),
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|unit|${unitId}`),
      undoStack: pushUndo(state),
    });
  },

  deleteUnit: (facilityId, unitId, removeAssignments = false, actorName) => {
    const state = get();
    if (!state.data) return { ok: false, reason: 'not_found' };
    const sourceFacility = state.data.facilities.find((item) => item.id === facilityId);
    const sourceUnit = sourceFacility?.units.find((item) => item.id === unitId);
    if (!sourceFacility || !sourceUnit) return { ok: false, reason: 'not_found' };
    const affectedAssignments = sourceUnit.rows.reduce((unitTotal, row) => unitTotal
      + Object.values(row.cellsByDay).reduce((rowTotal, assignments) => rowTotal + assignments.length, 0), 0);
    if (affectedAssignments > 0 && !removeAssignments) {
      return { ok: false, reason: 'has_assignments', affectedAssignments };
    }

    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    const unit = facility?.units.find((item) => item.id === unitId);
    if (!facility || !settings || !unit) return { ok: false, reason: 'not_found' };
    data.cellMarkers = removeScheduleCellMarkersForRows(
      data.cellMarkers,
      unit.rows.map((row) => row.id),
    );
    facility.units = facility.units.filter((item) => item.id !== unitId);
    settings.units = settings.units.filter((item) => item.id !== unitId);
    addAudit(data, state.locale, {
      actorName,
      action: 'delete',
      facilityId,
      unitId,
      oldValue: `${unit.name} · ${affectedAssignments} assignments`,
      newValue: `Deleted unit ${unit.name}`,
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|unit-delete|${unitId}`),
      undoStack: pushUndo(state),
    });
    if (get().data !== data || get().storageError) {
      return { ok: false, reason: 'storage_error', affectedAssignments, message: get().storageError || undefined };
    }
    recordScheduleAdminAudit(
      actorName,
      'delete',
      state,
      `Delete schedule unit ${unit.name}`,
      `${affectedAssignments} assignments`,
      'deleted',
    );
    return { ok: true, affectedAssignments };
  },

  reorderMatrixItem: (command, actorName) => {
    const state = get();
    if (!state.data) return { ok: false, reason: 'not_found' };
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === command.facilityId);
    if (!facility) return { ok: false, reason: 'not_found' };

    const moveRelative = <T extends { id: string }>(arr: T[], sourceId: string, targetId: string) => {
      const before = arr.map((item) => item.id).join('|');
      const sourceIndex = arr.findIndex((item) => item.id === sourceId);
      const targetIndex = arr.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return false;
      const [movedItem] = arr.splice(sourceIndex, 1);
      const targetAfterRemoval = arr.findIndex((item) => item.id === targetId);
      const insertIndex = command.position === 'before' ? targetAfterRemoval : targetAfterRemoval + 1;
      arr.splice(insertIndex, 0, movedItem);
      return before !== arr.map((item) => item.id).join('|');
    };

    let affectedAssignments = 0;
    let beforeLabel = '';
    let afterLabel = '';

    if (command.kind === 'unit') {
      if (command.sourceUnitId === command.targetUnitId) {
        return { ok: false, reason: 'same_position' };
      }
      const sourceUnit = facility.units.find((unit) => unit.id === command.sourceUnitId);
      const targetUnit = facility.units.find((unit) => unit.id === command.targetUnitId);
      if (!sourceUnit || !targetUnit) return { ok: false, reason: 'not_found' };
      affectedAssignments = sourceUnit.rows.reduce((total, row) => total + Object.values(row.cellsByDay)
        .reduce((rowTotal, assignments) => rowTotal + assignments.length, 0), 0);
      beforeLabel = `${sourceUnit.name} @ ${facility.units.indexOf(sourceUnit) + 1}`;
      if (!moveRelative(facility.units, command.sourceUnitId, command.targetUnitId)) {
        return { ok: false, reason: 'same_position' };
      }
      afterLabel = `${sourceUnit.name} @ ${facility.units.indexOf(sourceUnit) + 1}`;

      const settings = data.settings.find((item) => item.facilityId === command.facilityId);
      if (settings) {
        moveRelative(settings.units, command.sourceUnitId, command.targetUnitId);
      }
    } else {
      const sourceUnit = facility.units.find((unit) => unit.id === command.sourceUnitId);
      const targetUnit = facility.units.find((unit) => unit.id === command.targetUnitId);
      if (!sourceUnit || !targetUnit) return { ok: false, reason: 'not_found' };
      const sourceIndex = sourceUnit.rows.findIndex((row) => row.id === command.sourceRowId);
      if (sourceIndex === -1) return { ok: false, reason: 'not_found' };
      if (command.targetRowId === command.sourceRowId) {
        return { ok: false, reason: 'same_position' };
      }
      if (command.targetRowId && !targetUnit.rows.some((row) => row.id === command.targetRowId)) {
        return { ok: false, reason: 'invalid_target' };
      }
      const beforeSourceIds = sourceUnit.rows.map((row) => row.id).join('|');
      const beforeTargetIds = targetUnit.rows.map((row) => row.id).join('|');
      const sourceRow = sourceUnit.rows[sourceIndex];
      affectedAssignments = Object.values(sourceRow.cellsByDay)
        .reduce((total, assignments) => total + assignments.length, 0);
      beforeLabel = `${sourceUnit.name} / ${sourceRow.rowLabel} @ ${sourceIndex + 1}`;
      const [movedRow] = sourceUnit.rows.splice(sourceIndex, 1);

      if (!command.targetRowId) {
        targetUnit.rows.push(movedRow);
      } else {
        const targetIndex = targetUnit.rows.findIndex((row) => row.id === command.targetRowId);
        targetUnit.rows.splice(command.position === 'before' ? targetIndex : targetIndex + 1, 0, movedRow);
      }

      const rowOrderChanged = sourceUnit !== targetUnit
        || beforeSourceIds !== sourceUnit.rows.map((row) => row.id).join('|')
        || beforeTargetIds !== targetUnit.rows.map((row) => row.id).join('|');
      if (!rowOrderChanged) {
        return { ok: false, reason: 'same_position' };
      }
      movedRow.unitLabel = targetUnit.name;
      movedRow.blockType = targetUnit.blockType;
      afterLabel = `${targetUnit.name} / ${movedRow.rowLabel} @ ${targetUnit.rows.indexOf(movedRow) + 1}`;
    }

    addAudit(data, state.locale, {
      action: 'reorder',
      actorName,
      facilityId: command.facilityId,
      unitId: command.targetUnitId,
      rowId: command.kind === 'row' ? command.sourceRowId : undefined,
      oldValue: beforeLabel,
      newValue: `${afterLabel} (${affectedAssignments} assignments)`,
    });
    set({
      data,
      draftCellKeys: draftWith(
        state.draftCellKeys,
        `settings|reorder|${command.kind === 'row' ? command.sourceRowId : command.sourceUnitId}`,
      ),
      undoStack: pushUndo(state),
    });
    if (get().data !== data || get().storageError) {
      return { ok: false, reason: 'storage_error', message: get().storageError || undefined };
    }
    recordScheduleAdminAudit(
      actorName,
      'update',
      state,
      command.kind === 'row' ? 'Reorder schedule row' : 'Reorder schedule unit',
      beforeLabel,
      afterLabel,
    );
    return {
      ok: true,
      kind: command.kind,
      affectedAssignments,
      sourceUnitId: command.sourceUnitId,
      targetUnitId: command.targetUnitId,
    };
  },

  updateMatrixRow: (rowId, updates) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;
    const definitions = data.settings
      .find((entry) => entry.facilityId === context.facility.id)
      ?.shiftDefinitions ?? [];

    const {
      shiftDefinitionId,
      rowLabel,
      weekendOnly,
      shiftLabel,
      timeRange,
      colorKey,
      backgroundColor,
      textColor,
    } = updates;

    if (shiftDefinitionId !== undefined) {
      const definition = resolveShiftDefinitionForRow(definitions, context.row, shiftDefinitionId);
      if (definition) {
        applyShiftDefinitionToRow(context.row, definition);
      } else {
        context.row.shiftDefinitionId = undefined;
      }
    } else {
      if (shiftLabel !== undefined) context.row.shiftLabel = shiftLabel;
      if (timeRange !== undefined) context.row.timeRange = timeRange;
      if (colorKey !== undefined) context.row.colorKey = colorKey;
      if (backgroundColor !== undefined) context.row.backgroundColor = backgroundColor;
      if (textColor !== undefined) context.row.textColor = textColor;

      if (colorKey !== undefined || timeRange !== undefined || shiftLabel !== undefined) {
        context.row.shiftDefinitionId = resolveShiftDefinitionForRow(definitions, context.row)?.id;
      }
    }

    if (rowLabel !== undefined) context.row.rowLabel = rowLabel;
    if (weekendOnly !== undefined) context.row.weekendOnly = weekendOnly;

    addAudit(data, state.locale, {
      action: 'settings',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      newValue: context.row.shiftLabel || context.row.rowLabel,
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|row|${rowId}`),
      undoStack: pushUndo(state),
    });
  },

  addMatrixRow: (facilityId, unitId, shiftDefinitionId, rowLabel) => {
    const state = get();
    if (!state.data || !rowLabel.trim()) return;
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const unit = facility?.units.find((item) => item.id === unitId);
    const definition = data.settings
      .find((item) => item.facilityId === facilityId)
      ?.shiftDefinitions.find((item) => item.id === shiftDefinitionId && !item.archived);
    if (!facility || !unit || !definition) return;

    const row = makeShiftRowFromDefinition(facilityId, unit, definition, rowLabel, data.year, data.month);
    unit.rows.push(row);
    addAudit(data, state.locale, {
      action: 'settings',
      facilityId,
      unitId,
      rowId: row.id,
      newValue: `Added row ${row.rowLabel} (${row.shiftLabel})`,
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|row-add|${row.id}`),
      undoStack: pushUndo(state),
    });
  },

  archiveMatrixRow: (rowId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;
    context.row.archived = true;
    addAudit(data, state.locale, {
      action: 'archive',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      newValue: `Archived row ${context.row.rowLabel}`,
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|row-archive|${rowId}`),
      undoStack: pushUndo(state),
    });
  },

  restoreMatrixRow: (rowId) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;
    context.row.archived = false;
    addAudit(data, state.locale, {
      action: 'restore',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      newValue: `Restored row ${context.row.rowLabel}`,
    });
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|row-restore|${rowId}`),
      undoStack: pushUndo(state),
    });
  },

  deleteMatrixRow: (rowId, removeAssignments = false) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;
    const assignmentsCount = Object.values(context.row.cellsByDay).reduce((sum, assignments) => sum + assignments.length, 0);
    if (assignmentsCount > 0 && !removeAssignments) {
      context.row.archived = true;
    } else {
      context.unit.rows = context.unit.rows.filter((row) => row.id !== rowId);
      data.cellMarkers = removeScheduleCellMarkersForRows(data.cellMarkers, [rowId]);
    }
    addAudit(data, state.locale, {
      action: assignmentsCount > 0 && !removeAssignments ? 'archive' : 'delete',
      facilityId: context.facility.id,
      unitId: context.unit.id,
      rowId,
      oldValue: `${assignmentsCount} assignments`,
      newValue: assignmentsCount > 0 && !removeAssignments ? `Archived row ${context.row.rowLabel}` : `Deleted row ${context.row.rowLabel}`,
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `settings|row-delete|${rowId}`),
      undoStack: pushUndo(state),
    });
  },

  clearAllAssignments: (actorName) => {
    const state = get();
    if (!state.data) return 0;
    const data = cloneData(state.data);
    const removed = clearScheduleContent(data);
    if (removed === 0) return 0;
    const key = matrixMonthKey(data);
    const versionsByMonth = addMonthVersion(state.versionsByMonth, key, state.data, actorName, 'clear');
    addAudit(data, state.locale, {
      actorName,
      action: 'bulk-clear',
      oldValue: `${removed} assignments`,
      newValue: `Clear Assignments Only | ${data.year}-${String(data.month + 1).padStart(2, '0')} | all facilities`,
    });
    recalculateAllConflicts(data);
    set({
      data,
      draftCellKeys: draftWith(state.draftCellKeys, `bulk-clear|${data.year}|${data.month}|${Date.now()}`),
      selectedCells: [],
      undoStack: pushUndo(state),
      versionsByMonth,
      monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
    });
    if (get().storageError) return 0;
    recordScheduleAdminAudit(actorName, 'clear', state, 'Clear all schedule assignments', `${removed} assignments`, '0 assignments');
    return removed;
  },

  copyCurrentTable: (actorName) => {
    const state = get();
    if (!state.data || state.data.facilities.length === 0) {
      return { ok: false, reason: 'not_found', message: 'There is no schedule table to copy.' };
    }
    const sourceKey = matrixMonthKey(state.data);
    const assignmentCount = countMatrixAssignments(state.data);
    set({
      tableClipboard: {
        sourceKey,
        sourceYear: state.data.year,
        sourceMonth: state.data.month,
        copiedAt: new Date().toISOString(),
        assignmentCount,
        data: cloneData(state.data),
      },
    });
    recordScheduleAdminAudit(actorName, 'update', state, 'Copy schedule table', sourceKey, `${assignmentCount} assignments copied`);
    return { ok: true, affected: assignmentCount };
  },

  pasteCopiedTable: (actorName) => {
    const state = get();
    if (!state.data) return { ok: false, reason: 'not_found', message: 'The target schedule month is unavailable.' };
    if (!state.tableClipboard) return { ok: false, reason: 'not_found', message: 'Copy a schedule table first.' };

    const targetKey = matrixMonthKey(state.data);
    const { data, omittedAssignments } = pasteMatrixIntoMonth(
      state.tableClipboard.data,
      state.year,
      state.month,
      normalizeStoredMatrix,
    );
    const affected = countMatrixAssignments(data);
    addAudit(data, state.locale, {
      actorName,
      action: 'paste',
      oldValue: state.tableClipboard.sourceKey,
      newValue: `${targetKey} | ${affected} assignments | ${omittedAssignments} omitted`,
    });
    const versionsByMonth = addMonthVersion(
      state.versionsByMonth,
      targetKey,
      state.data,
      actorName,
      'paste',
    );
    set({
      data,
      draftCellKeys: [`table-paste|${state.tableClipboard.sourceKey}|${targetKey}|${Date.now()}`],
      undoStack: [],
      selectedCells: [],
      versionsByMonth,
      deletedMonths: state.deletedMonths.filter((item) => item !== targetKey),
      monthStatuses: { ...state.monthStatuses, [targetKey]: 'draft' },
    });
    if (get().storageError) {
      return { ok: false, reason: 'storage_error', message: get().storageError! };
    }
    recordScheduleAdminAudit(
      actorName,
      'update',
      state,
      'Paste schedule table',
      state.tableClipboard.sourceKey,
      `${targetKey} | ${affected} assignments | ${omittedAssignments} omitted`,
    );
    return {
      ok: true,
      affected,
      message: omittedAssignments > 0
        ? `Table pasted. ${omittedAssignments} assignments outside the target month were omitted.`
        : 'Table pasted successfully.',
    };
  },

  resetCurrentMonth: (actorName) => {
    const state = get();
    if (!state.data) return { ok: false, reason: 'not_found' };
    const key = matrixMonthKey(state.data);
    const source = generateScheduleMatrixMock(state.year, state.month);
    const data = structureOnly(source, state.year, state.month);
    data.legend = cloneData(state.data).legend;
    addAudit(data, state.locale, {
      actorName,
      action: 'reset',
      oldValue: key,
      newValue: 'Default layout',
    });
    const versionsByMonth = addMonthVersion(state.versionsByMonth, key, state.data, actorName, 'reset');
    const deletedMonths = state.deletedMonths.filter((item) => item !== key);
    set({
      data,
      snapshot: JSON.stringify(data),
      draftCellKeys: [`month-reset|${key}`],
      undoStack: [],
      selectedCells: [],
      versionsByMonth,
      deletedMonths,
      monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
    });
    if (get().storageError) return { ok: false, reason: 'storage_error', message: get().storageError! };
    recordScheduleAdminAudit(actorName, 'update', state, 'Reset schedule to default layout', key, 'Default layout');
    return { ok: true };
  },

  generateConflictFreeMonth: (actorName) => {
    const state = get();
    if (!state.data) return { ok: false, reason: 'not_found', message: 'The target schedule month is unavailable.' };

    const key = matrixMonthKey(state.data);
    const beforeAssignmentCount = countMatrixAssignments(state.data);
    const generation = generateConflictFreeScheduleMonth(state.data, {
      rotationSeed: Date.now(),
      maxAssignmentsPerCell: 2,
    });

    if (generation.conflictCount > 0) {
      return {
        ok: false,
        reason: 'invalid_state',
        message: 'The generated schedule still has conflicts. No changes were saved.',
      };
    }

    addAudit(generation.data, state.locale, {
      actorName,
      action: 'generate',
      oldValue: `${beforeAssignmentCount} assignments`,
      newValue: `${generation.assignedCount} assignments | ${generation.vacationDaysGenerated} vacation days | ${generation.skippedCount} cells left empty`,
    });

    const versionsByMonth = addMonthVersion(state.versionsByMonth, key, state.data, actorName, 'generate');
    const deletedMonths = state.deletedMonths.filter((item) => item !== key);

    set({
      data: generation.data,
      draftCellKeys: [`month-generate|${key}|${Date.now()}`],
      undoStack: pushUndo(state),
      selectedCells: [],
      brushEmployeeCodes: [],
      versionsByMonth,
      deletedMonths,
      monthStatuses: { ...state.monthStatuses, [key]: 'draft' },
    });

    if (get().storageError) {
      return { ok: false, reason: 'storage_error', message: get().storageError! };
    }

    recordScheduleAdminAudit(
      actorName,
      'update',
      state,
      'Generate conflict-free schedule',
      `${beforeAssignmentCount} assignments`,
      `${generation.assignedCount} assignments; ${generation.vacationDaysGenerated} vacation days; ${generation.skippedCount} cells left empty`,
    );

    return {
      ok: true,
      affected: generation.assignedCount,
      skipped: generation.skippedCount,
      vacations: generation.vacationDaysGenerated,
      message: generation.skippedCount > 0
        ? `Generated ${generation.assignedCount} assignments and ${generation.vacationDaysGenerated} vacation days with ${generation.skippedCount} cells left empty.`
        : `Generated ${generation.assignedCount} assignments and ${generation.vacationDaysGenerated} vacation days with no conflicts.`,
    };
  },


  isDirty: () => get().draftCellKeys.length > 0,
  pendingDraftCount: () => get().draftCellKeys.length,
  conflictCount: () => {
    const data = get().data;
    if (!data) return 0;
    const seen = new Set<string>();
    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const [day, assignments] of Object.entries(row.cellsByDay)) {
            assignments.forEach((assignment) => {
              if (assignment.hasConflict) {
                seen.add(`${assignment.employeeId}|${day}|${assignment.conflictReason || row.id}`);
              }
            });
          }
        }
      }
    }
    return seen.size;
  },
}));

let scheduleMatrixChannel: BroadcastChannel | null = null;

useScheduleMatrixStore.subscribe((state, previousState) => {
  if (isSchedulePersistenceRollback) return;
  const changed = state.data !== previousState.data
    || state.draftCellKeys !== previousState.draftCellKeys
    || state.matricesByMonth !== previousState.matricesByMonth
    || state.draftsByMonth !== previousState.draftsByMonth
    || state.monthStatuses !== previousState.monthStatuses
    || state.versionsByMonth !== previousState.versionsByMonth
    || state.deletedMonths !== previousState.deletedMonths;
  if (!changed) return;

  const previousDrafts = previousState.draftsByMonth;
  let nextDrafts = state.draftsByMonth;
  if (state.data) {
    const key = matrixMonthKey(state.data);
    let nextDeletedMonths = state.deletedMonths;
    if (state.draftCellKeys.length > 0 && state.deletedMonths.includes(key)) {
      nextDeletedMonths = state.deletedMonths.filter((item) => item !== key);
      isSchedulePersistenceRollback = true;
      useScheduleMatrixStore.setState({ deletedMonths: nextDeletedMonths });
      isSchedulePersistenceRollback = false;
    }
    if (state.draftCellKeys.length > 0 && !nextDeletedMonths.includes(key)) {
      nextDrafts = { ...state.draftsByMonth, [key]: cloneData(state.data) };
    } else if (state.draftsByMonth[key] && (state.matricesByMonth[key] || nextDeletedMonths.includes(key))) {
      nextDrafts = { ...state.draftsByMonth };
      delete nextDrafts[key];
    }
  }

  const persistence = persistMonthlyState(state, nextDrafts);
  if (persistence.ok) {
    const draftsChanged = nextDrafts !== state.draftsByMonth;
    const versionsChanged = persistence.versionsByMonth !== state.versionsByMonth;
    if (draftsChanged || versionsChanged || state.storageError) {
      isSchedulePersistenceRollback = true;
      useScheduleMatrixStore.setState({
        ...(draftsChanged ? { draftsByMonth: nextDrafts } : {}),
        ...(versionsChanged ? { versionsByMonth: persistence.versionsByMonth } : {}),
        ...(state.storageError ? { storageError: null } : {}),
      });
      isSchedulePersistenceRollback = false;
    }
    if (
      state.matricesByMonth !== previousState.matricesByMonth
      && scheduleMatrixChannel
    ) {
      scheduleMatrixChannel.postMessage({ type: 'published-schedule-updated' });
    }
    return;
  }

  isSchedulePersistenceRollback = true;
  useScheduleMatrixStore.setState({
    data: previousState.data,
    matricesByMonth: previousState.matricesByMonth,
    draftsByMonth: previousDrafts,
    snapshot: previousState.snapshot,
    draftCellKeys: previousState.draftCellKeys,
    undoStack: previousState.undoStack,
    monthStatuses: previousState.monthStatuses,
    versionsByMonth: previousState.versionsByMonth,
    deletedMonths: previousState.deletedMonths,
    month: previousState.month,
    year: previousState.year,
    selectedCells: previousState.selectedCells,
    brushEmployeeCodes: previousState.brushEmployeeCodes,
    storageError: 'Unable to save schedule administration data.',
  });
  isSchedulePersistenceRollback = false;
});

useEmployeeRosterStore.subscribe(() => {
  const current = useScheduleMatrixStore.getState().data;
  if (!current) return;
  const data = cloneData(current);
  synchronizeMatrixRoster(data);
  useScheduleMatrixStore.setState({ data });
});

if (typeof window !== 'undefined') {
  if ('BroadcastChannel' in window) {
    scheduleMatrixChannel = new BroadcastChannel('ngh-schedule-matrix');
    scheduleMatrixChannel.addEventListener('message', () => {
      useScheduleMatrixStore.getState().reloadFromStorage();
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key === SCHEDULE_MONTHLY_STORAGE_KEY) {
      useScheduleMatrixStore.getState().reloadFromStorage();
    }
  });
}

export type {
  FacilitySettings,
  MarkerColor,
  ShiftDefinition,
  UnitDefinition,
  ShiftColorKey,
};
