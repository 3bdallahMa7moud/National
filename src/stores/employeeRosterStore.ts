import { create } from 'zustand';
import { OFFICIAL_EMPLOYEE_ROSTER, type OfficialEmployee } from '@/data/officialEmployeeRoster';
import {
  getEmployeeDirectoryRoster,
  useEmployeeDirectoryStore,
} from '@/stores/employeeDirectoryStore';

/** Legacy key retained for the v3 directory migration only. */
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

function updateRosterIdentity(employeeId: string, fullName: string, code: string): EmployeeRosterUpdateResult {
  const normalizedName = fullName.trim();
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedName) return { ok: false, reason: 'name_required' };
  if (!normalizedCode) return { ok: false, reason: 'code_required' };

  const directory = useEmployeeDirectoryStore.getState();
  const record = directory.records.find((candidate) => candidate.scheduleEmployeeId === employeeId);
  if (!record) return { ok: false, reason: 'employee_not_found' };
  if (directory.records.some((candidate) =>
    candidate.accountId !== record.accountId
    && candidate.scheduleEmployeeId
    && candidate.code.toUpperCase() === normalizedCode,
  )) return { ok: false, reason: 'duplicate_code' };

  const result = directory.updateEmployee(record.accountId, {
    name: { ar: normalizedName, en: normalizedName },
    code: normalizedCode,
  }, 'Schedule administrator');
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason === 'duplicate_value' ? 'duplicate_code' : 'employee_not_found',
    };
  }
  return { ok: true, fullName: normalizedName, code: normalizedCode };
}

export const useEmployeeRosterStore = create<EmployeeRosterState>((set) => ({
  employees: getEmployeeDirectoryRoster(),
  updateEmployeeIdentity: (employeeId, fullName, code) => {
    const result = updateRosterIdentity(employeeId, fullName, code);
    if (result.ok) set({ employees: getEmployeeDirectoryRoster() });
    return result;
  },
  resetEmployees: () => {
    const directory = useEmployeeDirectoryStore.getState();
    for (const seed of OFFICIAL_EMPLOYEE_ROSTER) {
      const record = directory.records.find((candidate) => candidate.scheduleEmployeeId === seed.employeeId);
      if (!record) continue;
      directory.updateEmployee(record.accountId, {
        name: { ar: seed.fullName, en: seed.fullNameEn || seed.fullName },
        code: seed.code,
      }, 'System');
    }
    set({ employees: getEmployeeDirectoryRoster() });
  },
}));

useEmployeeDirectoryStore.subscribe(() => {
  useEmployeeRosterStore.setState({ employees: getEmployeeDirectoryRoster() });
});

export function getOfficialEmployeeRoster(): OfficialEmployee[] {
  return getEmployeeDirectoryRoster();
}
