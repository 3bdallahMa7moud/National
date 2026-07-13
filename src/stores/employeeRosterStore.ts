import { create } from 'zustand';
import {
  OFFICIAL_EMPLOYEE_ROSTER,
  type OfficialEmployee,
} from '@/data/officialEmployeeRoster';

export const EMPLOYEE_ROSTER_STORAGE_KEY = 'ngh_official_employee_roster_v1';

export type EmployeeRosterUpdateResult =
  | { ok: true; fullName: string; code: string }
  | {
      ok: false;
      reason: 'name_required' | 'code_required' | 'duplicate_code' | 'employee_not_found';
    };

interface EmployeeRosterState {
  employees: OfficialEmployee[];
  updateEmployeeIdentity: (employeeId: string, fullName: string, code: string) => EmployeeRosterUpdateResult;
  resetEmployees: () => void;
}

interface StoredRosterOverride {
  employeeId: string;
  code: string;
  fullName: string;
  fullNameEn?: string;
}

function cloneDefaultRoster(): OfficialEmployee[] {
  return OFFICIAL_EMPLOYEE_ROSTER.map((employee) => ({ ...employee }));
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readRoster(): OfficialEmployee[] {
  const storage = browserStorage();
  if (!storage) return cloneDefaultRoster();
  try {
    const parsed = JSON.parse(storage.getItem(EMPLOYEE_ROSTER_STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return cloneDefaultRoster();
    const overrides = new Map<string, StoredRosterOverride>(
      parsed.flatMap((candidate) => {
        if (!candidate || typeof candidate !== 'object') return [];
        const value = candidate as Partial<OfficialEmployee>;
        if (typeof value.employeeId !== 'string' || typeof value.code !== 'string' || typeof value.fullName !== 'string') {
          return [];
        }
        return [[value.employeeId, {
          employeeId: value.employeeId,
          code: value.code,
          fullName: value.fullName,
          fullNameEn: value.fullNameEn,
        }] as const];
      }),
    );
    const merged = cloneDefaultRoster().map((employee) => {
      const override = overrides.get(employee.employeeId);
      return override
        ? {
            ...employee,
            code: override.code.trim().toUpperCase(),
            fullName: override.fullName.trim(),
            fullNameEn: (override.fullNameEn || override.fullName).trim(),
          }
        : employee;
    });
    const codes = new Set(merged.map((employee) => employee.code));
    return codes.size === merged.length ? merged : cloneDefaultRoster();
  } catch {
    return cloneDefaultRoster();
  }
}

function persistRoster(employees: OfficialEmployee[]): void {
  try {
    browserStorage()?.setItem(EMPLOYEE_ROSTER_STORAGE_KEY, JSON.stringify(employees));
  } catch {
    // Keep the in-memory roster usable when storage is unavailable.
  }
}

export const useEmployeeRosterStore = create<EmployeeRosterState>((set, get) => ({
  employees: readRoster(),
  updateEmployeeIdentity: (employeeId, fullName, code) => {
    const normalizedName = fullName.trim();
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedName) return { ok: false, reason: 'name_required' };
    if (!normalizedCode) return { ok: false, reason: 'code_required' };

    const employees = get().employees;
    if (!employees.some((employee) => employee.employeeId === employeeId)) {
      return { ok: false, reason: 'employee_not_found' };
    }
    if (employees.some((employee) =>
      employee.employeeId !== employeeId && employee.code.toUpperCase() === normalizedCode,
    )) {
      return { ok: false, reason: 'duplicate_code' };
    }

    const next = employees.map((employee) => employee.employeeId === employeeId
      ? { ...employee, code: normalizedCode, fullName: normalizedName, fullNameEn: normalizedName }
      : employee);
    set({ employees: next });
    persistRoster(next);
    return { ok: true, fullName: normalizedName, code: normalizedCode };
  },
  resetEmployees: () => {
    const employees = cloneDefaultRoster();
    set({ employees });
    try {
      browserStorage()?.removeItem(EMPLOYEE_ROSTER_STORAGE_KEY);
    } catch {
      // No-op when storage is unavailable.
    }
  },
}));

export function getOfficialEmployeeRoster(): OfficialEmployee[] {
  return useEmployeeRosterStore.getState().employees;
}
