import axios from 'axios';
import api from './axios';
import { useAuthStore } from '@/stores/authStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { sanitizeSyncErrorMessage } from './syncErrorMessages';

const scheduleUpdatedAtByMonth: Record<string, string> = {};
const overtimeUpdatedAtByMonth: Record<string, string> = {};

let scheduleTimer: number | null = null;
let overtimeTimer: number | null = null;
let started = false;
let suppressDepth = 0;
let unsubscribeScheduleSync: (() => void) | null = null;
let unsubscribeOvertimeSync: (() => void) | null = null;

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canSync() {
  const user = useAuthStore.getState().user;
  return Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));
}

function isSuppressed() {
  return suppressDepth > 0;
}

export function suppressBackendSync<T>(callback: () => T): T {
  suppressDepth += 1;
  try {
    return callback();
  } finally {
    suppressDepth = Math.max(0, suppressDepth - 1);
  }
}

export function setBackendStateUpdatedAt(payload: {
  schedule?: { updatedAtByMonth?: Record<string, string> };
  overtime?: { updatedAtByMonth?: Record<string, string> };
}) {
  Object.keys(scheduleUpdatedAtByMonth).forEach((key) => delete scheduleUpdatedAtByMonth[key]);
  Object.assign(scheduleUpdatedAtByMonth, payload.schedule?.updatedAtByMonth ?? {});
  Object.keys(overtimeUpdatedAtByMonth).forEach((key) => delete overtimeUpdatedAtByMonth[key]);
  Object.assign(overtimeUpdatedAtByMonth, payload.overtime?.updatedAtByMonth ?? {});
}

function sanitizeMatrixForSync(matrix: unknown): unknown {
  if (!matrix || typeof matrix !== 'object') return matrix;
  const cloned = clone(matrix) as Record<string, unknown>;
  if (!Array.isArray(cloned.facilities)) return cloned;

  for (const facility of cloned.facilities) {
    if (!facility || typeof facility !== 'object' || !Array.isArray(facility.units)) continue;
    for (const unit of facility.units) {
      if (!unit || typeof unit !== 'object' || !Array.isArray(unit.rows)) continue;
      for (const row of unit.rows) {
        if (!row || typeof row !== 'object' || !row.cellsByDay || typeof row.cellsByDay !== 'object') continue;
        for (const [dayText, assignments] of Object.entries(row.cellsByDay as Record<string, unknown>)) {
          if (!Array.isArray(assignments)) {
            (row.cellsByDay as Record<string, unknown>)[dayText] = [];
            continue;
          }
          const cleanedAssignments: Record<string, unknown>[] = [];
          const seen = new Set<string>();
          for (const assignment of assignments) {
            if (!assignment || typeof assignment !== 'object') continue;
            const item = { ...assignment } as Record<string, unknown>;
            let empId = typeof item.employeeId === 'string' ? item.employeeId.trim() : '';
            if (!empId) {
              if (typeof item.employeeCode === 'string' && item.employeeCode.trim()) {
                empId = item.employeeCode.trim();
              } else if (typeof item.code === 'string' && item.code.trim()) {
                empId = item.code.trim();
              } else if (typeof item.legacyCode === 'string' && item.legacyCode.trim()) {
                empId = item.legacyCode.trim();
              }
            }
            if (!empId) continue;
            if (seen.has(empId)) continue;
            seen.add(empId);
            item.employeeId = empId;
            cleanedAssignments.push(item);
          }
          (row.cellsByDay as Record<string, unknown>)[dayText] = cleanedAssignments;
        }
      }
    }
  }
  return cloned;
}

function sanitizeMatricesRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = sanitizeMatrixForSync(value);
  }
  return result;
}

function effectiveSchedulePayload() {
  const state = useScheduleMatrixStore.getState();
  const currentKey = state.data ? monthKey(state.data.year, state.data.month) : monthKey(state.year, state.month);
  let nextDeletedMonths = [...state.deletedMonths];
  const nextDrafts = { ...state.draftsByMonth };

  if (state.data && state.draftCellKeys.length > 0 && nextDeletedMonths.includes(currentKey)) {
    nextDeletedMonths = nextDeletedMonths.filter((item) => item !== currentKey);
  }

  if (state.data && state.draftCellKeys.length > 0 && !nextDeletedMonths.includes(currentKey)) {
    nextDrafts[currentKey] = clone(state.data);
  }

  return {
    draftsByMonth: sanitizeMatricesRecord(nextDrafts),
    matricesByMonth: sanitizeMatricesRecord(state.matricesByMonth),
    versionsByMonth: state.versionsByMonth,
    monthStatuses: state.monthStatuses,
    deletedMonths: nextDeletedMonths,
    updatedAtByMonth: { ...scheduleUpdatedAtByMonth },
  };
}

function effectiveOvertimePayload() {
  const state = useLateScheduleStore.getState();
  return {
    rowsByMonth: state.rowsByMonth,
    unitsByMonth: state.unitsByMonth,
    publishedRowsByMonth: state.publishedRowsByMonth,
    publishedUnitsByMonth: state.publishedUnitsByMonth,
    versionsByMonth: state.versionsByMonth,
    monthStatuses: state.monthStatuses,
    deletedMonths: state.deletedMonths,
    notice: state.notice,
    departmentIdsByMonth: state.departmentIdsByMonth,
    updatedAtByMonth: { ...overtimeUpdatedAtByMonth },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function syncErrorMessage(error: unknown, fallback: string) {
  if (
    axios.isAxiosError(error)
    && isRecord(error.response?.data)
    && isRecord(error.response.data.error)
    && typeof error.response.data.error.message === 'string'
    && error.response.data.error.message.trim()
  ) {
    return sanitizeSyncErrorMessage(error.response.data.error.message, fallback);
  }

  return sanitizeSyncErrorMessage(error instanceof Error ? error.message : '', fallback);
}

async function syncSchedule() {
  scheduleTimer = null;
  if (!canSync()) return;
  try {
    const response = await api.put('/schedule', effectiveSchedulePayload());
    Object.assign(scheduleUpdatedAtByMonth, response.data.schedule.updatedAtByMonth ?? {});
    useScheduleMatrixStore.setState({ storageError: null });
  } catch (error) {
    const message = syncErrorMessage(error, 'Unable to sync schedule state.');
    useScheduleMatrixStore.setState({ storageError: message });
  }
}

async function syncOvertime() {
  overtimeTimer = null;
  if (!canSync()) return;
  try {
    const response = await api.put('/overtime', effectiveOvertimePayload());
    Object.assign(overtimeUpdatedAtByMonth, response.data.overtime.updatedAtByMonth ?? {});
    useLateScheduleStore.setState({ storageError: null });
  } catch (error) {
    const message = syncErrorMessage(error, 'Unable to sync overtime state.');
    useLateScheduleStore.setState({ storageError: message });
  }
}

function scheduleChanged(
  state: ReturnType<typeof useScheduleMatrixStore.getState>,
  previous: ReturnType<typeof useScheduleMatrixStore.getState>,
) {
  return state.data !== previous.data
    || state.draftCellKeys !== previous.draftCellKeys
    || state.matricesByMonth !== previous.matricesByMonth
    || state.draftsByMonth !== previous.draftsByMonth
    || state.monthStatuses !== previous.monthStatuses
    || state.versionsByMonth !== previous.versionsByMonth
    || state.deletedMonths !== previous.deletedMonths;
}

function overtimeChanged(
  state: ReturnType<typeof useLateScheduleStore.getState>,
  previous: ReturnType<typeof useLateScheduleStore.getState>,
) {
  return state.rows !== previous.rows
    || state.rowsByMonth !== previous.rowsByMonth
    || state.unitsByMonth !== previous.unitsByMonth
    || state.publishedRowsByMonth !== previous.publishedRowsByMonth
    || state.publishedUnitsByMonth !== previous.publishedUnitsByMonth
    || state.versionsByMonth !== previous.versionsByMonth
    || state.monthStatuses !== previous.monthStatuses
    || state.deletedMonths !== previous.deletedMonths
    || state.notice !== previous.notice;
}

export function startBackendStateSync() {
  if (started || typeof window === 'undefined') return;
  started = true;

  unsubscribeScheduleSync = useScheduleMatrixStore.subscribe((state, previous) => {
    if (isSuppressed() || !scheduleChanged(state, previous)) return;
    if (scheduleTimer) window.clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(() => {
      void syncSchedule();
    }, 500);
  });

  unsubscribeOvertimeSync = useLateScheduleStore.subscribe((state, previous) => {
    if (isSuppressed() || !overtimeChanged(state, previous)) return;
    if (overtimeTimer) window.clearTimeout(overtimeTimer);
    overtimeTimer = window.setTimeout(() => {
      void syncOvertime();
    }, 500);
  });
}

export function stopBackendStateSync() {
  if (typeof window !== 'undefined') {
    if (scheduleTimer) window.clearTimeout(scheduleTimer);
    if (overtimeTimer) window.clearTimeout(overtimeTimer);
  }
  scheduleTimer = null;
  overtimeTimer = null;
  unsubscribeScheduleSync?.();
  unsubscribeOvertimeSync?.();
  unsubscribeScheduleSync = null;
  unsubscribeOvertimeSync = null;
  started = false;
  suppressDepth = 0;
}
