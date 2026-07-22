import { create } from 'zustand';
import { OFFICIAL_EMPLOYEE_ROSTER, type OfficialEmployee } from '@/data/officialEmployeeRoster';
import {
  BUILTIN_EMPLOYEE_ACCOUNTS,
  MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY,
  mockEmployeesSource,
} from '@/mocks/sources';
import type { MockEmployeeSource } from '@/mocks/types';
import type { EmployeeAccessProfile, EmployeePermissionTemplateId } from '@/types/employeeAccess';
import type {
  EmployeeDirectoryIssue,
  EmployeeDirectoryMigrationReport,
  EmployeeDirectoryMutationResult,
  EmployeeDirectoryRecord,
} from '@/types/employeeDirectory';
import { useOperationalAuditStore } from './operationalAuditStore';

export const EMPLOYEE_DIRECTORY_STORAGE_KEY = 'ngh_employee_directory_v3';
export const LEGACY_EMPLOYEE_ROSTER_STORAGE_KEY = 'ngh_official_employee_roster_v1';
export const LEGACY_EMPLOYEE_ACCESS_STORAGE_KEY = 'ngh_employee_access_v2';

export interface EmployeeDirectoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type EmployeeDirectoryAuditResult =
  | void
  | { ok: true; rollback?: () => boolean }
  | { ok: false; message?: string };

interface EmployeeDirectoryStoreOptions {
  onChanged?: () => void;
  recordAudit?: (entry: {
    actorName: string;
    action: 'create' | 'update' | 'delete';
    accountId: string;
    before?: EmployeeDirectoryRecord;
    after: EmployeeDirectoryRecord;
  }) => EmployeeDirectoryAuditResult;
}

interface PersistedDirectory {
  version: 3;
  records: EmployeeDirectoryRecord[];
  migrationReport: EmployeeDirectoryMigrationReport;
}

interface LegacyAccountsEnvelope {
  version?: number;
  employees?: unknown[];
}

interface LegacyRosterOverride {
  employeeId: string;
  code: string;
  fullName: string;
  fullNameEn?: string;
}

interface LegacyAccessEnvelope {
  version?: number;
  profiles?: Record<string, EmployeeAccessProfile>;
}

export interface EmployeeDirectoryState {
  records: EmployeeDirectoryRecord[];
  migrationReport: EmployeeDirectoryMigrationReport;
  storageError: string | null;
  addEmployee(source: MockEmployeeSource, actorName?: string): EmployeeDirectoryMutationResult;
  updateEmployee(
    accountId: string,
    updates: Partial<Pick<EmployeeDirectoryRecord,
      'name' | 'email' | 'phone' | 'departmentId' | 'departmentName' | 'position' | 'employeeNumber' | 'code' | 'avatar' | 'active'>>,
    actorName?: string,
  ): EmployeeDirectoryMutationResult;
  setRosterLink(accountId: string, scheduleEmployeeId: string | undefined, actorName?: string): EmployeeDirectoryMutationResult;
  setAccess(
    accountId: string,
    access: Pick<EmployeeDirectoryRecord['access'], 'templateId' | 'overrides'>,
    actorName?: string,
  ): EmployeeDirectoryMutationResult;
  applyAccessProfile(profile: EmployeeAccessProfile, actorName?: string): EmployeeDirectoryMutationResult;
  setActive(accountId: string, active: boolean, actorName?: string): EmployeeDirectoryMutationResult;
  reloadFromStorage(): void;
}

const DEFAULT_ACCESS = {
  templateId: 'standard' as EmployeePermissionTemplateId,
  overrides: {},
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'system',
};

function browserStorage(): EmployeeDirectoryStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function cloneRecord(record: EmployeeDirectoryRecord): EmployeeDirectoryRecord {
  return {
    ...record,
    name: { ...record.name },
    departmentName: { ...record.departmentName },
    position: { ...record.position },
    issues: [...record.issues],
    access: { ...record.access, overrides: { ...record.access.overrides } },
  };
}

function sourceToRecord(source: MockEmployeeSource, origin: EmployeeDirectoryRecord['origin']): EmployeeDirectoryRecord {
  return {
    accountId: source.id,
    name: { ...source.name },
    email: source.email.trim(),
    phone: source.phone.trim(),
    role: source.role,
    departmentId: source.departmentId,
    departmentName: { ...source.departmentName },
    position: { ...source.position },
    employeeNumber: source.employeeNumber.trim(),
    code: source.code.trim().toUpperCase(),
    avatar: source.avatar,
    active: source.isActive,
    createdAt: source.createdAt,
    scheduleEmployeeId: source.scheduleEmployeeId,
    origin,
    issues: [],
    access: { ...DEFAULT_ACCESS },
  };
}

function recordToSource(record: EmployeeDirectoryRecord): MockEmployeeSource {
  return {
    id: record.accountId,
    name: { ...record.name },
    email: record.email,
    phone: record.phone,
    role: record.role,
    departmentId: record.departmentId,
    departmentName: { ...record.departmentName },
    position: { ...record.position },
    employeeNumber: record.employeeNumber,
    code: record.code,
    avatar: record.avatar,
    isActive: record.active,
    createdAt: record.createdAt,
    scheduleEmployeeId: record.scheduleEmployeeId,
  };
}

function isLocalized(value: unknown): value is { ar: string; en: string } {
  if (!value || typeof value !== 'object') return false;
  const item = value as { ar?: unknown; en?: unknown };
  return typeof item.ar === 'string' && typeof item.en === 'string';
}

function normalizeLegacySource(value: unknown): MockEmployeeSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<MockEmployeeSource>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
  const seed = BUILTIN_EMPLOYEE_ACCOUNTS.find((record) => record.id === candidate.id);
  const role = candidate.role === 'admin' || candidate.role === 'employee'
    ? candidate.role
    : seed?.role || 'employee';
  const fallbackName = seed?.name || { ar: candidate.id, en: candidate.id };
  const fallbackDepartment = seed?.departmentName || { ar: 'القسم', en: 'Department' };
  const fallbackPosition = seed?.position || { ar: 'موظف', en: 'Employee' };
  const name = isLocalized(candidate.name)
    ? candidate.name
    : fallbackName;
  const departmentName = isLocalized(candidate.departmentName)
    ? candidate.departmentName
    : fallbackDepartment;
  const position = isLocalized(candidate.position)
    ? candidate.position
    : fallbackPosition;
  return {
    id: candidate.id.trim(),
    name: { ...name },
    email: typeof candidate.email === 'string' ? candidate.email : seed?.email || '',
    phone: typeof candidate.phone === 'string' ? candidate.phone : seed?.phone || '',
    role,
    departmentId: typeof candidate.departmentId === 'string' && candidate.departmentId.trim()
      ? candidate.departmentId
      : seed?.departmentId || 'dept-1',
    departmentName: { ...departmentName },
    position: { ...position },
    employeeNumber: typeof candidate.employeeNumber === 'string' ? candidate.employeeNumber : seed?.employeeNumber || '',
    code: typeof candidate.code === 'string' ? candidate.code : seed?.code || '',
    avatar: typeof candidate.avatar === 'string' ? candidate.avatar : seed?.avatar,
    isActive: typeof candidate.isActive === 'boolean' ? candidate.isActive : seed?.isActive !== false,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : seed?.createdAt || new Date(0).toISOString(),
    scheduleEmployeeId: typeof candidate.scheduleEmployeeId === 'string'
      ? candidate.scheduleEmployeeId
      : seed?.scheduleEmployeeId,
  };
}

function normalizeRecord(value: unknown): EmployeeDirectoryRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<EmployeeDirectoryRecord>;
  if (!record.accountId || !isLocalized(record.name) || !isLocalized(record.departmentName) || !isLocalized(record.position)) return null;
  if (record.role !== 'admin' && record.role !== 'employee') return null;
  if (!record.departmentId || typeof record.employeeNumber !== 'string' || typeof record.code !== 'string') return null;
  const templateId = record.access?.templateId;
  const normalizedTemplate: EmployeePermissionTemplateId = templateId === 'view_only' || templateId === 'coordinator'
    ? templateId
    : 'standard';
  return {
    accountId: record.accountId,
    name: { ...record.name },
    email: typeof record.email === 'string' ? record.email.trim() : '',
    phone: typeof record.phone === 'string' ? record.phone.trim() : '',
    role: record.role,
    departmentId: record.departmentId,
    departmentName: { ...record.departmentName },
    position: { ...record.position },
    employeeNumber: record.employeeNumber.trim(),
    code: record.code.trim().toUpperCase(),
    avatar: record.avatar,
    active: record.active !== false,
    createdAt: record.createdAt || new Date(0).toISOString(),
    scheduleEmployeeId: record.scheduleEmployeeId || undefined,
    origin: record.origin === 'custom' ? 'custom' : 'official',
    issues: [],
    access: {
      templateId: normalizedTemplate,
      overrides: { ...(record.access?.overrides || {}) },
      updatedAt: record.access?.updatedAt || new Date(0).toISOString(),
      updatedBy: record.access?.updatedBy || 'system',
    },
  };
}

function parseJson<T>(storage: EmployeeDirectoryStorage | null, key: string): T | null {
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(key) || 'null') as T | null;
  } catch {
    return null;
  }
}

function mergeEditable(base: EmployeeDirectoryRecord, source: MockEmployeeSource): EmployeeDirectoryRecord {
  return {
    ...base,
    name: isLocalized(source.name) ? { ...source.name } : base.name,
    email: source.email?.trim() || base.email,
    phone: source.phone?.trim() || base.phone,
    departmentName: isLocalized(source.departmentName) ? { ...source.departmentName } : base.departmentName,
    position: isLocalized(source.position) ? { ...source.position } : base.position,
    employeeNumber: source.employeeNumber?.trim() || base.employeeNumber,
    code: source.code?.trim().toUpperCase() || base.code,
    avatar: source.avatar ?? base.avatar,
    active: source.isActive !== false,
    scheduleEmployeeId: source.scheduleEmployeeId || base.scheduleEmployeeId,
  };
}

function validateRecords(input: EmployeeDirectoryRecord[]): EmployeeDirectoryRecord[] {
  const records = input.map(cloneRecord).sort((left, right) => {
    if (left.origin !== right.origin) return left.origin === 'official' ? -1 : 1;
    return left.accountId.localeCompare(right.accountId);
  });
  const employeeNumbers = new Map<string, string>();
  const emails = new Map<string, string>();
  const rosterLinks = new Map<string, string>();
  const codes = new Map<string, string>();

  for (const record of records) {
    const issues: EmployeeDirectoryIssue[] = record.issues.includes('duplicate_account_id')
      ? ['duplicate_account_id']
      : [];
    const employeeNumber = record.employeeNumber.trim().toLowerCase();
    const email = record.email.trim().toLowerCase();
    const rosterLink = record.scheduleEmployeeId || '';
    const code = record.role === 'employee' ? record.code.trim().toUpperCase() : '';

    if (!employeeNumber) issues.push('missing_employee_number');
    else if (employeeNumbers.has(employeeNumber)) issues.push('duplicate_employee_number');
    else employeeNumbers.set(employeeNumber, record.accountId);

    if (email) {
      if (emails.has(email)) issues.push('duplicate_email');
      else emails.set(email, record.accountId);
    }
    if (record.role === 'employee' && !record.code.trim()) issues.push('missing_code');
    if (rosterLink) {
      if (rosterLinks.has(rosterLink)) issues.push('duplicate_roster_link');
      else rosterLinks.set(rosterLink, record.accountId);
    }
    if (code) {
      if (codes.has(code)) issues.push('duplicate_code');
      else codes.set(code, record.accountId);
    }
    record.issues = issues;
  }
  return records;
}

function migrationReport(records: EmployeeDirectoryRecord[], sourceVersions: string[], imported: number, restored: number): EmployeeDirectoryMigrationReport {
  const issues = records.filter((record) => record.issues.length > 0).map((record) => ({
    accountId: record.accountId,
    issues: [...record.issues],
  }));
  return {
    migratedAt: new Date().toISOString(),
    sourceVersions,
    importedAccounts: imported,
    officialAccountsRestored: restored,
    recordsNeedingReview: issues.length,
    issues,
  };
}

function migrate(storage: EmployeeDirectoryStorage | null): PersistedDirectory {
  const existing = parseJson<Partial<PersistedDirectory>>(storage, EMPLOYEE_DIRECTORY_STORAGE_KEY);
  if (existing?.version === 3 && Array.isArray(existing.records)) {
    const normalized = existing.records.map(normalizeRecord).filter((record): record is EmployeeDirectoryRecord => Boolean(record));
    const byId = new Map<string, EmployeeDirectoryRecord>();
    for (const record of normalized) {
      const duplicate = byId.get(record.accountId);
      if (duplicate) record.issues = [...record.issues, 'duplicate_account_id'];
      byId.set(record.accountId, record);
    }
    let restored = 0;
    for (const seed of BUILTIN_EMPLOYEE_ACCOUNTS) {
      if (byId.has(seed.id)) continue;
      byId.set(seed.id, sourceToRecord(seed, 'official'));
      restored += 1;
    }
    const records = validateRecords([...byId.values()]);
    return {
      version: 3,
      records,
      migrationReport: restored > 0
        ? migrationReport(records, ['directory-v3'], normalized.length, restored)
        : existing.migrationReport || migrationReport(records, ['directory-v3'], normalized.length, 0),
    };
  }

  const sourceVersions: string[] = [];
  const legacyAccounts = parseJson<LegacyAccountsEnvelope>(storage, MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY);
  const legacyRoster = parseJson<LegacyRosterOverride[]>(storage, LEGACY_EMPLOYEE_ROSTER_STORAGE_KEY);
  const legacyAccess = parseJson<LegacyAccessEnvelope>(storage, LEGACY_EMPLOYEE_ACCESS_STORAGE_KEY);
  if (legacyAccounts?.version === 2) sourceVersions.push('accounts-v2');
  if (Array.isArray(legacyRoster)) sourceVersions.push('roster-v1');
  if (legacyAccess?.version === 2) sourceVersions.push('access-v2');

  const byId = new Map<string, EmployeeDirectoryRecord>();
  for (const seed of BUILTIN_EMPLOYEE_ACCOUNTS) byId.set(seed.id, sourceToRecord(seed, 'official'));
  const accounts = (Array.isArray(legacyAccounts?.employees)
    ? legacyAccounts.employees
    : mockEmployeesSource)
    .map(normalizeLegacySource)
    .filter((account): account is MockEmployeeSource => Boolean(account));
  const importedAccountIds = new Set<string>();
  for (const account of accounts) {
    if (!account?.id) continue;
    const current = byId.get(account.id);
    const merged = current
      ? mergeEditable(current, account)
      : sourceToRecord(account, 'custom');
    if (importedAccountIds.has(account.id)) merged.issues = [...merged.issues, 'duplicate_account_id'];
    importedAccountIds.add(account.id);
    byId.set(account.id, merged);
  }

  if (Array.isArray(legacyRoster)) {
    for (const override of legacyRoster) {
      if (!override || typeof override !== 'object') continue;
      const record = [...byId.values()].find((candidate) => candidate.scheduleEmployeeId === override.employeeId);
      if (!record || !override.fullName?.trim()) continue;
      record.name = {
        ar: override.fullName.trim(),
        en: (override.fullNameEn || override.fullName).trim(),
      };
      record.code = override.code?.trim().toUpperCase() || record.code;
    }
  }

  for (const profile of Object.values(legacyAccess?.profiles || {})) {
    if (!profile || typeof profile !== 'object' || typeof profile.accountId !== 'string') continue;
    const record = byId.get(profile.accountId);
    if (!record) continue;
    record.departmentId = profile.departmentId || record.departmentId;
    record.scheduleEmployeeId = profile.scheduleEmployeeId || record.scheduleEmployeeId;
    record.active = profile.active !== false;
    record.access = {
      templateId: profile.templateId || 'standard',
      overrides: { ...profile.overrides },
      updatedAt: profile.updatedAt || new Date(0).toISOString(),
      updatedBy: profile.updatedBy || 'system',
    };
  }

  const records = validateRecords([...byId.values()]);
  const restored = BUILTIN_EMPLOYEE_ACCOUNTS.filter((seed) => !accounts.some((account) => account.id === seed.id)).length;
  return {
    version: 3,
    records,
    migrationReport: migrationReport(records, sourceVersions.length ? sourceVersions : ['built-in-seed'], accounts.length, restored),
  };
}

function persist(storage: EmployeeDirectoryStorage | null, payload: PersistedDirectory): boolean {
  try {
    storage?.setItem(EMPLOYEE_DIRECTORY_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function syncCompatibility(records: EmployeeDirectoryRecord[]): void {
  const sources = records.map(recordToSource);
  mockEmployeesSource.splice(0, mockEmployeesSource.length, ...sources);
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('mock-data-changed'));
  } catch {
    // Store updates remain usable in non-browser tests.
  }
}

function makeState(storage: EmployeeDirectoryStorage | null, syncLegacy = false): EmployeeDirectoryState {
  const initial = migrate(storage);
  persist(storage, initial);
  if (syncLegacy) syncCompatibility(initial.records);

  return {
    records: initial.records,
    migrationReport: initial.migrationReport,
    storageError: null,
    addEmployee: () => ({ ok: false, reason: 'invalid_record' }),
    updateEmployee: () => ({ ok: false, reason: 'invalid_record' }),
    setRosterLink: () => ({ ok: false, reason: 'invalid_record' }),
    setAccess: () => ({ ok: false, reason: 'invalid_record' }),
    applyAccessProfile: () => ({ ok: false, reason: 'invalid_record' }),
    setActive: () => ({ ok: false, reason: 'invalid_record' }),
    reloadFromStorage: () => undefined,
  };
}

function defaultAudit(entry: {
  actorName: string;
  action: 'create' | 'update' | 'delete';
  accountId: string;
  before?: EmployeeDirectoryRecord;
  after: EmployeeDirectoryRecord;
}): EmployeeDirectoryAuditResult {
  const result = useOperationalAuditStore.getState().record({
    actorName: entry.actorName,
    action: entry.action,
    module: 'employees',
    entityId: entry.accountId,
    entityLabel: entry.after.name.en || entry.after.name.ar || entry.accountId,
    before: entry.before ? JSON.stringify(entry.before) : undefined,
    after: JSON.stringify(entry.after),
    context: { route: '/admin/employees' },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    rollback: () => useOperationalAuditStore.getState().remove(result.entry.id).ok,
  };
}

export function createEmployeeDirectoryStore(
  storage: EmployeeDirectoryStorage | null = null,
  syncLegacy = false,
  options: EmployeeDirectoryStoreOptions = {},
) {
  return create<EmployeeDirectoryState>((set, get) => {
    const base = makeState(storage, syncLegacy);
    const commit = (
      records: EmployeeDirectoryRecord[],
      accountId: string,
      actorName = 'Administrator',
      action: 'create' | 'update' | 'delete' = 'update',
    ) => {
      const validated = validateRecords(records);
      const record = validated.find((candidate) => candidate.accountId === accountId);
      if (!record) return { ok: false as const, reason: 'not_found' as const };
      const before = get().records.find((candidate) => candidate.accountId === accountId);
      let auditResult: EmployeeDirectoryAuditResult;
      try {
        auditResult = options.recordAudit?.({ actorName, action, accountId, before, after: record });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save the employee audit.';
        set({ storageError: message });
        return { ok: false as const, reason: 'storage_error' as const, message };
      }
      if (auditResult && !auditResult.ok) {
        const message = auditResult.message || 'Unable to save the employee audit.';
        set({ storageError: message });
        return { ok: false as const, reason: 'storage_error' as const, message };
      }
      const report = migrationReport(validated, ['directory-v3'], validated.length, 0);
      if (!persist(storage, { version: 3, records: validated, migrationReport: report })) {
        auditResult?.rollback?.();
        set({ storageError: 'Unable to save the employee directory.' });
        return { ok: false as const, reason: 'storage_error' as const, message: 'Unable to save the employee directory.' };
      }
      if (syncLegacy) syncCompatibility(validated);
      set({ records: validated, migrationReport: report, storageError: null });
      options.onChanged?.();
      return { ok: true as const, record };
    };
    return {
      ...base,
      addEmployee: (source, actorName) => {
        if (!source.id.trim() || get().records.some((record) => record.accountId === source.id)) {
          return { ok: false, reason: 'invalid_record' };
        }
        const record = sourceToRecord(source, 'custom');
        record.access.updatedAt = new Date().toISOString();
        record.access.updatedBy = actorName?.trim() || 'Administrator';
        return commit([...get().records, record], record.accountId, actorName?.trim() || 'Administrator', 'create');
      },
      updateEmployee: (accountId, updates, actorName) => commit(get().records.map((record) => record.accountId === accountId ? ({
        ...record,
        ...updates,
        name: updates.name ? { ...updates.name } : record.name,
        departmentName: updates.departmentName ? { ...updates.departmentName } : record.departmentName,
        position: updates.position ? { ...updates.position } : record.position,
        employeeNumber: updates.employeeNumber?.trim() ?? record.employeeNumber,
        code: updates.code?.trim().toUpperCase() ?? record.code,
        access: { ...record.access, updatedAt: new Date().toISOString(), updatedBy: actorName?.trim() || record.access.updatedBy },
      }) : record), accountId, actorName?.trim() || 'Administrator'),
      setRosterLink: (accountId, scheduleEmployeeId, actorName) => commit(get().records.map((record) => record.accountId === accountId ? ({
        ...record,
        scheduleEmployeeId: scheduleEmployeeId || undefined,
        access: { ...record.access, updatedAt: new Date().toISOString(), updatedBy: actorName?.trim() || 'Administrator' },
      }) : record), accountId, actorName?.trim() || 'Administrator'),
      setAccess: (accountId, access, actorName) => commit(get().records.map((record) => record.accountId === accountId ? ({
        ...record,
        access: {
          templateId: access.templateId,
          overrides: { ...access.overrides },
          updatedAt: new Date().toISOString(),
          updatedBy: actorName?.trim() || 'Administrator',
        },
      }) : record), accountId, actorName?.trim() || 'Administrator'),
      applyAccessProfile: (profile, actorName) => commit(get().records.map((record) => record.accountId === profile.accountId ? ({
        ...record,
        departmentId: profile.departmentId,
        scheduleEmployeeId: profile.scheduleEmployeeId || undefined,
        active: profile.active,
        access: {
          templateId: profile.templateId,
          overrides: { ...profile.overrides },
          updatedAt: profile.updatedAt || new Date().toISOString(),
          updatedBy: actorName?.trim() || profile.updatedBy || 'Administrator',
        },
      }) : record), profile.accountId, actorName?.trim() || 'Administrator'),
      setActive: (accountId, active, actorName) => commit(get().records.map((record) => record.accountId === accountId ? ({
        ...record,
        active,
        access: { ...record.access, updatedAt: new Date().toISOString(), updatedBy: actorName?.trim() || 'Administrator' },
      }) : record), accountId, actorName?.trim() || 'Administrator', active ? 'update' : 'delete'),
      reloadFromStorage: () => {
        const payload = migrate(storage);
        if (syncLegacy) syncCompatibility(payload.records);
        set({ records: payload.records, migrationReport: payload.migrationReport, storageError: null });
      },
    };
  });
}

let employeeDirectoryChannel: BroadcastChannel | null = null;
const broadcastEmployeeDirectory = () => {
  try {
    employeeDirectoryChannel?.postMessage({ type: 'employee-directory-changed' });
  } catch {
    // The storage event remains available when BroadcastChannel is restricted.
  }
};

export const useEmployeeDirectoryStore = createEmployeeDirectoryStore(browserStorage(), true, {
  onChanged: broadcastEmployeeDirectory,
  recordAudit: defaultAudit,
});

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      employeeDirectoryChannel = new BroadcastChannel('ngh-employee-directory');
      employeeDirectoryChannel.addEventListener('message', () => useEmployeeDirectoryStore.getState().reloadFromStorage());
    }
    window.addEventListener('storage', (event) => {
      if (event.key === EMPLOYEE_DIRECTORY_STORAGE_KEY) useEmployeeDirectoryStore.getState().reloadFromStorage();
    });
    window.addEventListener('focus', () => useEmployeeDirectoryStore.getState().reloadFromStorage());
  } catch {
    // The active tab continues to work with its in-memory directory.
  }
}

export function getEmployeeDirectoryRecord(accountId: string): EmployeeDirectoryRecord | undefined {
  return useEmployeeDirectoryStore.getState().records.find((record) => record.accountId === accountId);
}

export function getEmployeeDirectoryRoster(): OfficialEmployee[] {
  return useEmployeeDirectoryStore.getState().records
    .filter((record) => record.role === 'employee' && record.scheduleEmployeeId && record.issues.length === 0)
    .map((record) => ({
      employeeId: record.scheduleEmployeeId!,
      code: record.code,
      fullName: record.name.ar || record.name.en,
      fullNameEn: record.name.en || record.name.ar,
      origin: 'schedule' as const,
    }));
}

export function directoryRecordToMockSource(record: EmployeeDirectoryRecord): MockEmployeeSource {
  return recordToSource(record);
}
