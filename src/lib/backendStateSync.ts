import api from './axios';
import { useAuthStore } from '@/stores/authStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { fetchAndHydrateBootstrap } from './backendBootstrap';

const scheduleUpdatedAtByMonth: Record<string, string> = {};
const overtimeUpdatedAtByMonth: Record<string, string> = {};

let scheduleTimer: number | null = null;
let overtimeTimer: number | null = null;
let started = false;
let suppressDepth = 0;

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

function effectiveSchedulePayload() {
  const state = useScheduleMatrixStore.getState();
  const currentKey = state.data ? monthKey(state.data.year, state.data.month) : monthKey(state.year, state.month);
  let nextDeletedMonths = [...state.deletedMonths];
  let nextDrafts = state.draftsByMonth;

  if (state.data && state.draftCellKeys.length > 0 && nextDeletedMonths.includes(currentKey)) {
    nextDeletedMonths = nextDeletedMonths.filter((item) => item !== currentKey);
  }

  if (state.data) {
    if (state.draftCellKeys.length > 0 && !nextDeletedMonths.includes(currentKey)) {
      nextDrafts = { ...state.draftsByMonth, [currentKey]: clone(state.data) };
    } else if (state.draftsByMonth[currentKey] && (state.matricesByMonth[currentKey] || nextDeletedMonths.includes(currentKey))) {
      nextDrafts = { ...state.draftsByMonth };
      delete nextDrafts[currentKey];
    }
  }

  return {
    draftsByMonth: nextDrafts,
    matricesByMonth: state.matricesByMonth,
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

async function syncSchedule() {
  scheduleTimer = null;
  if (!canSync()) return;
  try {
    const response = await api.put('/schedule', effectiveSchedulePayload());
    Object.assign(scheduleUpdatedAtByMonth, response.data.schedule.updatedAtByMonth ?? {});
    useScheduleMatrixStore.setState({ storageError: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to sync schedule state.';
    useScheduleMatrixStore.setState({ storageError: message });
    try {
      await fetchAndHydrateBootstrap();
      useScheduleMatrixStore.setState({ storageError: message });
    } catch {
      // Keep the current editor state; the user still sees the local draft and the sync error.
    }
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
    const message = error instanceof Error ? error.message : 'Unable to sync overtime state.';
    useLateScheduleStore.setState({ storageError: message });
    try {
      await fetchAndHydrateBootstrap();
      useLateScheduleStore.setState({ storageError: message });
    } catch {
      // Keep the current editor state; the user still sees the local draft and the sync error.
    }
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

  useScheduleMatrixStore.subscribe((state, previous) => {
    if (isSuppressed() || !scheduleChanged(state, previous)) return;
    if (scheduleTimer) window.clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(() => {
      void syncSchedule();
    }, 500);
  });

  useLateScheduleStore.subscribe((state, previous) => {
    if (isSuppressed() || !overtimeChanged(state, previous)) return;
    if (overtimeTimer) window.clearTimeout(overtimeTimer);
    overtimeTimer = window.setTimeout(() => {
      void syncOvertime();
    }, 500);
  });
}
