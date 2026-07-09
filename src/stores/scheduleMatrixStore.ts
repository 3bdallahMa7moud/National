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
  ScheduleMatrixData,
  ShiftColorKey,
  ShiftDefinition,
  ShiftRow,
  Unit,
  UnitDefinition,
  VacationType,
  ValidateResult,
} from '@/types/scheduleMatrix';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import { recalculateAllConflicts, validateAssignmentsForCell } from '@/lib/validateAssignment';

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
}

interface PublishResult {
  ok: boolean;
  message: string;
}

interface ScheduleMatrixState {
  data: ScheduleMatrixData | null;
  /** Last published snapshot, used by discard and dirty checks */
  snapshot: string;
  /** Draft cell/settings/vacation keys changed since last publish */
  draftCellKeys: string[];
  undoStack: UndoSnapshot[];

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

  brushEmployeeCodes: string[];
  toggleBrushEmployeeCode: (code: string) => { ok: boolean; reason?: 'max_selection' };
  clearBrushEmployees: () => void;

  colorblindMode: boolean;
  setColorblindMode: (value: boolean) => void;

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

  publishDrafts: () => PublishResult;
  discardDraft: () => void;
  undoLastEdit: () => boolean;
  recalculateConflicts: () => void;

  addShiftDefinition: (facilityId: string, payload: Omit<ShiftDefinition, 'id' | 'facilityId'>) => void;
  updateShiftDefinition: (facilityId: string, shiftId: string, updates: Partial<ShiftDefinition>) => void;
  archiveShiftDefinition: (facilityId: string, shiftId: string) => void;
  addUnit: (facilityId: string, name: string) => void;
  renameUnit: (facilityId: string, unitId: string, name: string) => void;
  archiveUnit: (facilityId: string, unitId: string) => void;
  updateMatrixRow: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly'>>,
  ) => void;

  isDirty: () => boolean;
  pendingDraftCount: () => number;
  conflictCount: () => number;
}

function cloneData(data: ScheduleMatrixData): ScheduleMatrixData {
  return JSON.parse(JSON.stringify(data));
}

function cellKey(rowId: string, day: number) {
  return `cell|${rowId}|${day}`;
}

function draftWith(existing: string[], key: string) {
  return existing.includes(key) ? existing : [...existing, key];
}

function removeDraft(existing: string[], key: string) {
  return existing.filter((item) => item !== key);
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

function setCellAssignments(row: ShiftRow, day: number, assignments: Assignment[]) {
  row.cellsByDay[day] = assignments.slice(0, 2).map((assignment) => ({
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

function makeEmptyUnit(facilityId: string, name: string, year: number, month: number, _locale: Language): Unit {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const id = `${facilityId}-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const timeRange = '08:00 - 17:00';

  return {
    id,
    name,
    blockType: 'equipmentDay',
    rows: [
      {
        id: `${id}-primary`,
        blockType: 'equipmentDay',
        unitLabel: name,
        rowLabel: name,
        shiftLabel: 'Day Shift',
        timeRange,
        colorKey: 'morning',
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
      },
      {
        id: `${id}-time`,
        blockType: 'equipmentDay',
        unitLabel: name,
        rowLabel: timeRange,
        shiftLabel: 'Day Shift',
        timeRange,
        colorKey: 'morning',
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
        isOverflowRow: true,
      },
      {
        id: `${id}-scdp`,
        blockType: 'equipmentDay',
        unitLabel: name,
        rowLabel: 'SCDP',
        shiftLabel: 'Day Shift',
        timeRange,
        colorKey: 'morning',
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
        isOverflowRow: true,
      },
    ],
  };
}

function pushUndo(state: ScheduleMatrixState): UndoSnapshot[] {
  if (!state.data) return state.undoStack;
  return [
    { data: cloneData(state.data), draftCellKeys: [...state.draftCellKeys] },
    ...state.undoStack,
  ].slice(0, 20);
}

const now = new Date();

export const useScheduleMatrixStore = create<ScheduleMatrixState>((set, get) => ({
  data: null,
  snapshot: '',
  draftCellKeys: [],
  undoStack: [],
  month: now.getMonth(),
  year: now.getFullYear(),
  locale: getStoredLanguage(),

  setLocale: (locale) => set((state) => (state.locale === locale ? state : { locale })),

  adminMode: 'view',
  setAdminMode: (mode) => set({ adminMode: mode, selectedCells: [], brushEmployeeCodes: [] }),

  facilityFilter: '',
  setFacilityFilter: (id) => set({ facilityFilter: id }),

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

  brushEmployeeCodes: [],
  toggleBrushEmployeeCode: (code) => {
    const state = get();
    if (state.brushEmployeeCodes.includes(code)) {
      set({ brushEmployeeCodes: state.brushEmployeeCodes.filter((c) => c !== code) });
      return { ok: true };
    }
    if (state.brushEmployeeCodes.length >= 2) {
      return { ok: false, reason: 'max_selection' };
    }
    set({ brushEmployeeCodes: [...state.brushEmployeeCodes, code] });
    return { ok: true };
  },
  clearBrushEmployees: () => set({ brushEmployeeCodes: [] }),

  colorblindMode: false,
  setColorblindMode: (value) => set({ colorblindMode: value }),

  drawerCell: null,
  openDrawer: (cell) => set({ drawerCell: cell }),
  closeDrawer: () => set({ drawerCell: null }),

  loadMonth: (month, year) => {
    const data = cloneData(generateScheduleMatrixMock(year, month));
    recalculateAllConflicts(data);
    set({
      data,
      month,
      year,
      snapshot: JSON.stringify(data),
      draftCellKeys: [],
      undoStack: [],
      selectedCells: [],
      brushEmployeeCodes: [],
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

    if (!validation.ok) return validation;

    const oldAssignments = context.row.cellsByDay[day] || [];
    setCellAssignments(context.row, day, assignments);
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

  publishDrafts: () => {
    const state = get();
    if (!state.data || state.draftCellKeys.length === 0) {
      return { ok: true, message: getMatrixStoreText(state.locale, 'noUnpublished') };
    }

    const data = cloneData(state.data);
    recalculateAllConflicts(data);

    const blocked = state.draftCellKeys.some((key) => {
      if (key.startsWith('cell|')) {
        const [, rowId, dayText] = key.split('|');
        const context = findRowContext(data, rowId);
        const assignments = context?.row.cellsByDay[Number(dayText)] || [];
        return assignments.some((assignment) => assignment.hasConflict);
      }
      if (key.startsWith('vac|')) {
        return data.facilities.some((facility) =>
          facility.units.some((unit) =>
            unit.rows.some((row) =>
              Object.values(row.cellsByDay).some((assignments) =>
                assignments.some((assignment) => assignment.hasConflict && assignment.conflictType === 'vacation'),
              ),
            ),
          ),
        );
      }
      return false;
    });

    if (blocked) {
      set({ data });
      return { ok: false, message: getMatrixStoreText(state.locale, 'resolveConflicts') };
    }

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

    addAudit(data, state.locale, {
      action: 'publish',
      oldValue: `${state.draftCellKeys.length} draft changes`,
      newValue: 'published batch + notifications queued',
    });
    recalculateAllConflicts(data);

    const snapshot = JSON.stringify(data);
    set({
      data,
      snapshot,
      draftCellKeys: [],
      undoStack: [],
    });
    return { ok: true, message: getMatrixStoreText(state.locale, 'publishedBatch') };
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
    set({ data, draftCellKeys: last.draftCellKeys, undoStack: rest });
    return true;
  },

  recalculateConflicts: () =>
    set((state) => {
      if (!state.data) return {};
      const data = cloneData(state.data);
      recalculateAllConflicts(data);
      return { data };
    }),

  addShiftDefinition: (facilityId, payload) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    if (!settings) return;
    settings.shiftDefinitions.push({
      id: `${facilityId}-shift-${Date.now()}`,
      facilityId,
      ...payload,
    });
    addAudit(data, state.locale, {
      action: 'settings',
      facilityId,
      newValue: formatSettingsMessage(state.locale, 'addShift', payload.label),
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
    Object.assign(shift, updates);
    addAudit(data, state.locale, {
      action: 'settings',
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

  archiveShiftDefinition: (facilityId, shiftId) => {
    get().updateShiftDefinition(facilityId, shiftId, { archived: true });
  },

  addUnit: (facilityId, name) => {
    const state = get();
    if (!state.data || !name.trim()) return;
    const data = cloneData(state.data);
    const facility = data.facilities.find((item) => item.id === facilityId);
    const settings = data.settings.find((item) => item.facilityId === facilityId);
    if (!facility || !settings) return;

    const unit = makeEmptyUnit(facilityId, name.trim(), data.year, data.month, state.locale);
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
      action: 'settings',
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

  updateMatrixRow: (rowId, updates) => {
    const state = get();
    if (!state.data) return;
    const data = cloneData(state.data);
    const context = findRowContext(data, rowId);
    if (!context) return;

    Object.assign(context.row, updates);
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

export type { FacilitySettings, ShiftDefinition, UnitDefinition, ShiftColorKey };
