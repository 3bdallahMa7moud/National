import type {
  Assignment,
  ScheduleMatrixData,
  ScheduleMatrixVersion,
  ScheduleMonthStatus,
} from '@/types/scheduleMatrix';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import { cloneScheduleMatrix } from './scheduleMatrixMonthOperations';
import { normalizeScheduleCellMarkers } from '@/lib/scheduleCellMarkers';

// v2 stores published snapshots only. The previous key auto-saved generated and
// draft months, so reading it would reintroduce invented annual-analysis coverage.
export const SCHEDULE_MATRIX_HISTORY_STORAGE_KEY = 'ngh_schedule_matrix_months_v2';
export const SCHEDULE_ADMIN_CONTROL_STORAGE_KEY = 'ngh_schedule_admin_control_v1';
export const SCHEDULE_MONTHLY_STORAGE_KEY = 'ngh_schedule_monthly_admin_v3';

interface PersistedScheduleAdminControl {
  version: 1;
  monthStatuses: Record<string, ScheduleMonthStatus>;
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>;
  deletedMonths: string[];
}

export interface PersistedScheduleMonthlyState {
  version: 3;
  matricesByMonth: Record<string, ScheduleMatrixData>;
  draftsByMonth: Record<string, ScheduleMatrixData>;
  monthStatuses: Record<string, ScheduleMonthStatus>;
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>;
  deletedMonths: string[];
}

type PersistableScheduleState = Pick<
  PersistedScheduleMonthlyState,
  'matricesByMonth' | 'monthStatuses' | 'versionsByMonth' | 'deletedMonths'
>;

export interface SchedulePersistenceResult {
  ok: boolean;
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>;
  prunedRecoveryHistory: boolean;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeScheduleMonthStatuses(
  value: unknown,
): Record<string, ScheduleMonthStatus> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, ScheduleMonthStatus> = {};
  for (const [key, status] of Object.entries(value)) {
    if (status === 'published' || status === 'locked') {
      normalized[key] = 'published';
    } else if (status === 'draft') {
      normalized[key] = 'draft';
    }
  }
  return normalized;
}

function compactMatrixForStorage(data: ScheduleMatrixData): ScheduleMatrixData {
  const compacted = cloneScheduleMatrix(data);
  compacted.auditLog = [];
  compacted.legend = [];
  for (const facility of compacted.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        row.cellsByDay = Object.fromEntries(
          Object.entries(row.cellsByDay)
            .filter(([, assignments]) => assignments.length > 0)
            .map(([day, assignments]) => [
              day,
              assignments.map((assignment) => {
                if (assignment.hasConflict) return assignment;
                return {
                  employeeId: assignment.employeeId,
                  employeeCode: assignment.employeeCode,
                  ...(assignment.colorKey ? { colorKey: assignment.colorKey } : {}),
                  ...(assignment.status ? { status: assignment.status } : {}),
                };
              }),
            ]),
        ) as Record<number, Assignment[]>;
      }
    }
  }
  return compacted;
}

function isQuotaExceeded(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: string; code?: number };
  return candidate.name === 'QuotaExceededError'
    || candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || candidate.code === 22
    || candidate.code === 1014;
}

function latestRecoveryVersionOnly(
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>,
): Record<string, ScheduleMatrixVersion[]> {
  return Object.fromEntries(
    Object.entries(versionsByMonth)
      .map(([key, versions]) => [key, versions.slice(0, 1)])
      .filter(([, versions]) => versions.length > 0),
  );
}

function persistedMonthlyPayload(
  state: PersistableScheduleState,
  draftsByMonth: Record<string, ScheduleMatrixData>,
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>,
): PersistedScheduleMonthlyState {
  const compactMatrices = Object.fromEntries(
    Object.entries(state.matricesByMonth).map(([key, matrix]) => [
      key,
      compactMatrixForStorage(matrix),
    ]),
  );
  const compactDrafts = Object.fromEntries(
    Object.entries(draftsByMonth).map(([key, matrix]) => [
      key,
      compactMatrixForStorage(matrix),
    ]),
  );
  const compactVersions = Object.fromEntries(
    Object.entries(versionsByMonth).map(([key, versions]) => [
      key,
      versions.map((version) => ({
        ...version,
        data: compactMatrixForStorage(version.data),
      })),
    ]),
  );

  return {
    version: 3,
    matricesByMonth: compactMatrices,
    draftsByMonth: compactDrafts,
    monthStatuses: normalizeScheduleMonthStatuses(state.monthStatuses),
    versionsByMonth: compactVersions,
    deletedMonths: state.deletedMonths,
  };
}

function hydrateMatrixFromStorage(
  data: ScheduleMatrixData,
  normalizeMatrix: (matrix: ScheduleMatrixData) => void,
): ScheduleMatrixData {
  const hydrated = cloneScheduleMatrix(data);
  hydrated.departmentId = hydrated.departmentId || 'dept-1';
  hydrated.cellMarkers = normalizeScheduleCellMarkers(hydrated.cellMarkers);
  const daysInMonth = new Date(hydrated.year, hydrated.month + 1, 0).getDate();
  hydrated.auditLog = Array.isArray(hydrated.auditLog) ? hydrated.auditLog : [];
  for (const facility of hydrated.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (let day = 1; day <= daysInMonth; day += 1) {
          if (!Array.isArray(row.cellsByDay[day])) row.cellsByDay[day] = [];
        }
      }
    }
  }
  normalizeMatrix(hydrated);
  return hydrated;
}

export function readStoredMatrices(
  prepareLegacyMatrix: (matrix: ScheduleMatrixData) => void,
): Record<string, ScheduleMatrixData> {
  const defaultMatrices = () => {
    const july = generateScheduleMatrixMock(2026, 6);
    const august = generateScheduleMatrixMock(2026, 7);
    prepareLegacyMatrix(july);
    prepareLegacyMatrix(august);
    return {
      '2026-07': july,
      '2026-08': august,
    };
  };
  const storage = browserStorage();
  if (!storage) return defaultMatrices();

  try {
    const value = JSON.parse(
      storage.getItem(SCHEDULE_MATRIX_HISTORY_STORAGE_KEY) || '{}',
    );
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return defaultMatrices();
    }
    const matrices = Object.fromEntries(
      Object.entries(value).filter(([, matrix]) => {
        if (!matrix || typeof matrix !== 'object') return false;
        const candidate = matrix as Partial<ScheduleMatrixData>;
        return Number.isInteger(candidate.year)
          && Number.isInteger(candidate.month)
          && Array.isArray(candidate.facilities)
          && Array.isArray(candidate.vacations);
      }),
    ) as Record<string, ScheduleMatrixData>;
    if (Object.keys(matrices).length === 0) return defaultMatrices();
    for (const matrix of Object.values(matrices)) prepareLegacyMatrix(matrix);
    return matrices;
  } catch {
    return defaultMatrices();
  }
}

export function readAdminControl(): Omit<PersistedScheduleAdminControl, 'version'> {
  const fallback = {
    monthStatuses: {
      '2026-07': 'published' as const,
      '2026-08': 'published' as const,
    },
    versionsByMonth: {},
    deletedMonths: [],
  };
  try {
    const parsed = JSON.parse(
      browserStorage()?.getItem(SCHEDULE_ADMIN_CONTROL_STORAGE_KEY) || 'null',
    ) as Partial<PersistedScheduleAdminControl> | null;
    if (!parsed || parsed.version !== 1) return fallback;
    return {
      monthStatuses: {
        '2026-07': 'published' as const,
        '2026-08': 'published' as const,
        ...normalizeScheduleMonthStatuses(parsed.monthStatuses),
      },
      versionsByMonth:
        parsed.versionsByMonth && typeof parsed.versionsByMonth === 'object'
          ? parsed.versionsByMonth
          : {},
      deletedMonths: Array.isArray(parsed.deletedMonths)
        ? parsed.deletedMonths
        : [],
    };
  } catch {
    return fallback;
  }
}

export function readMonthlyState(
  normalizeMatrix: (matrix: ScheduleMatrixData) => void,
): PersistedScheduleMonthlyState | null {
  try {
    const parsed = JSON.parse(
      browserStorage()?.getItem(SCHEDULE_MONTHLY_STORAGE_KEY) || 'null',
    ) as Partial<PersistedScheduleMonthlyState> | null;
    if (!parsed || parsed.version !== 3) return null;
    const storedMatrices = parsed.matricesByMonth
      && typeof parsed.matricesByMonth === 'object'
      ? parsed.matricesByMonth
      : {};
    const storedDrafts = parsed.draftsByMonth
      && typeof parsed.draftsByMonth === 'object'
      ? parsed.draftsByMonth
      : {};
    const storedVersions = parsed.versionsByMonth
      && typeof parsed.versionsByMonth === 'object'
      ? parsed.versionsByMonth
      : {};
    const matricesByMonth = Object.fromEntries(
      Object.entries(storedMatrices).map(([key, matrix]) => [
        key,
        hydrateMatrixFromStorage(matrix, normalizeMatrix),
      ]),
    );
    const draftsByMonth = Object.fromEntries(
      Object.entries(storedDrafts).map(([key, matrix]) => [
        key,
        hydrateMatrixFromStorage(matrix, normalizeMatrix),
      ]),
    );
    const versionsByMonth = Object.fromEntries(
      Object.entries(storedVersions).map(([key, versions]) => [
        key,
        versions.map((version) => ({
          ...version,
          data: hydrateMatrixFromStorage(version.data, normalizeMatrix),
        })),
      ]),
    );
    return {
      version: 3,
      matricesByMonth,
      draftsByMonth,
      monthStatuses: normalizeScheduleMonthStatuses(parsed.monthStatuses),
      versionsByMonth,
      deletedMonths: Array.isArray(parsed.deletedMonths)
        ? parsed.deletedMonths
        : [],
    };
  } catch {
    return null;
  }
}

export function persistMonthlyState(
  state: PersistableScheduleState,
  draftsByMonth: Record<string, ScheduleMatrixData>,
): SchedulePersistenceResult {
  const storage = browserStorage();
  if (!storage) {
    return {
      ok: true,
      versionsByMonth: state.versionsByMonth,
      prunedRecoveryHistory: false,
    };
  }

  const write = (versionsByMonth: Record<string, ScheduleMatrixVersion[]>) => {
    try {
      storage.setItem(
        SCHEDULE_MONTHLY_STORAGE_KEY,
        JSON.stringify(persistedMonthlyPayload(state, draftsByMonth, versionsByMonth)),
      );
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error };
    }
  };

  const fullWrite = write(state.versionsByMonth);
  if (fullWrite.ok) {
    return {
      ok: true,
      versionsByMonth: state.versionsByMonth,
      prunedRecoveryHistory: false,
    };
  }
  if (!isQuotaExceeded(fullWrite.error)) {
    return {
      ok: false,
      versionsByMonth: state.versionsByMonth,
      prunedRecoveryHistory: false,
    };
  }

  // These keys belong to the superseded schemas and duplicate data already
  // represented by the v3 monthly state. Reclaim them only after a quota error.
  try {
    storage.removeItem(SCHEDULE_MATRIX_HISTORY_STORAGE_KEY);
    storage.removeItem(SCHEDULE_ADMIN_CONTROL_STORAGE_KEY);
  } catch {
    // Continue with the reduced-history attempts even if legacy cleanup is blocked.
  }

  const retryFullWrite = write(state.versionsByMonth);
  if (retryFullWrite.ok) {
    return {
      ok: true,
      versionsByMonth: state.versionsByMonth,
      prunedRecoveryHistory: false,
    };
  }
  if (!isQuotaExceeded(retryFullWrite.error)) {
    return {
      ok: false,
      versionsByMonth: state.versionsByMonth,
      prunedRecoveryHistory: false,
    };
  }

  const latestVersions = latestRecoveryVersionOnly(state.versionsByMonth);
  const latestOnlyWrite = write(latestVersions);
  if (latestOnlyWrite.ok) {
    return {
      ok: true,
      versionsByMonth: latestVersions,
      prunedRecoveryHistory: true,
    };
  }
  if (!isQuotaExceeded(latestOnlyWrite.error)) {
    return {
      ok: false,
      versionsByMonth: state.versionsByMonth,
      prunedRecoveryHistory: false,
    };
  }

  const noHistoryWrite = write({});
  if (noHistoryWrite.ok) {
    return {
      ok: true,
      versionsByMonth: {},
      prunedRecoveryHistory: true,
    };
  }

  return {
    ok: false,
    versionsByMonth: state.versionsByMonth,
    prunedRecoveryHistory: false,
  };
}
