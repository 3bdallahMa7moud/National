import { create } from 'zustand';
import type { OfficialEmployee } from '@/types/officialEmployee';
import { isUserRole, type UserRole } from '@/types/employee';
import type { EmployeeAccessProfile, EmployeePermissionTemplateId } from '@/types/employeeAccess';
import type {
  EmployeeDirectoryIssue,
  EmployeeDirectoryMigrationReport,
  EmployeeDirectoryMutationResult,
  EmployeeDirectoryRecord,
  EmployeeDirectorySource,
} from '@/types/employeeDirectory';
import { useOperationalAuditStore } from './operationalAuditStore';

export const EMPLOYEE_DIRECTORY_STORAGE_KEY = 'ngh_employee_directory_v3';
const DIRECTORY_ROSTER_EMPLOYEE_PREFIX = 'directory-account:';

export interface EmployeeDirectoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type EmployeeDirectoryAuditResult =
  | void
  | { ok: true; rollback?: () => boolean }
  | { ok: false; message?: string };

interface EmployeeDirectoryStoreOptions {
  /** Production reads the live session; tests can inject explicit trusted callers. */
  canManageRoles?: () => boolean;
  now?: () => string;
  onChanged?: () => void;
  recordAudit?: (entry: {
    actorName: string;
    action: 'create' | 'update' | 'delete';
    accountId: string;
    entityLabel?: string;
    before?: unknown;
    after: unknown;
  }) => EmployeeDirectoryAuditResult;
}

interface PersistedDirectory {
  version: 3;
  records: EmployeeDirectoryRecord[];
  migrationReport: EmployeeDirectoryMigrationReport;
}

export interface EmployeeDirectoryState {
  records: EmployeeDirectoryRecord[];
  migrationReport: EmployeeDirectoryMigrationReport;
  storageError: string | null;
  replaceRecords(records: EmployeeDirectoryRecord[], sourceVersions?: string[]): void;
  addEmployee(source: EmployeeDirectorySource, actorName?: string): EmployeeDirectoryMutationResult;
  updateEmployee(
    accountId: string,
    updates: Partial<Pick<EmployeeDirectoryRecord,
      'name' | 'email' | 'phone' | 'role' | 'departmentId' | 'departmentName' | 'position' | 'employeeNumber' | 'code' | 'avatar' | 'active'>>,
    actorName?: string,
  ): EmployeeDirectoryMutationResult;
  setRole(accountId: string, newRole: UserRole, actorName?: string): EmployeeDirectoryMutationResult;
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

export function buildPendingEmployeeRosterId(accountId: string): string {
  return `${DIRECTORY_ROSTER_EMPLOYEE_PREFIX}${accountId}`;
}

export function isPendingEmployeeRosterId(employeeId: string): boolean {
  return employeeId.startsWith(DIRECTORY_ROSTER_EMPLOYEE_PREFIX);
}

function hasBrowserSuperAdminSession(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const hasToken = Boolean(window.sessionStorage.getItem('token') || window.localStorage.getItem('token'));
    if (!hasToken) return false;
    const stored = window.sessionStorage.getItem('user') || window.localStorage.getItem('user');
    const user = JSON.parse(stored || 'null') as { role?: unknown } | null;
    return user?.role === 'super_admin';
  } catch {
    return false;
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

function sourceToRecord(source: EmployeeDirectorySource, origin: EmployeeDirectoryRecord['origin']): EmployeeDirectoryRecord {
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

function recordToSource(record: EmployeeDirectoryRecord): EmployeeDirectorySource {
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

function normalizeRecord(value: unknown): EmployeeDirectoryRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<EmployeeDirectoryRecord>;
  if (!record.accountId || !isLocalized(record.name) || !isLocalized(record.departmentName) || !isLocalized(record.position)) return null;
  if (!isUserRole(record.role)) return null;
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
    const code = record.active ? record.code.trim().toUpperCase() : '';

    if (!employeeNumber) issues.push('missing_employee_number');
    else if (employeeNumbers.has(employeeNumber)) issues.push('duplicate_employee_number');
    else employeeNumbers.set(employeeNumber, record.accountId);

    if (email) {
      if (emails.has(email)) issues.push('duplicate_email');
      else emails.set(email, record.accountId);
    }
    if (record.active && !record.code.trim()) issues.push('missing_code');
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
    const sourceVersions = existing.migrationReport?.sourceVersions || ['directory-v3'];
    const records = validateRecords([...byId.values()]);
    return {
      version: 3,
      records,
      migrationReport: existing.migrationReport || migrationReport(records, sourceVersions, normalized.length, 0),
    };
  }

  const records: EmployeeDirectoryRecord[] = [];
  return {
    version: 3,
    records,
    migrationReport: migrationReport(records, ['empty-before-backend-bootstrap'], 0, 0),
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

function syncCompatibility(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('employee-directory-changed'));
  } catch {
    // Store updates remain usable in non-browser tests.
  }
}

function makeState(storage: EmployeeDirectoryStorage | null, syncLegacy = false): EmployeeDirectoryState {
  const initial = migrate(storage);
  persist(storage, initial);
  if (syncLegacy) syncCompatibility();

  return {
    records: initial.records,
    migrationReport: initial.migrationReport,
    storageError: null,
    addEmployee: () => ({ ok: false, reason: 'invalid_record' }),
    updateEmployee: () => ({ ok: false, reason: 'invalid_record' }),
    setRole: () => ({ ok: false, reason: 'invalid_record' }),
    setRosterLink: () => ({ ok: false, reason: 'invalid_record' }),
    setAccess: () => ({ ok: false, reason: 'invalid_record' }),
    applyAccessProfile: () => ({ ok: false, reason: 'invalid_record' }),
    setActive: () => ({ ok: false, reason: 'invalid_record' }),
    reloadFromStorage: () => undefined,
    replaceRecords: () => undefined,
  };
}

function defaultAudit(entry: {
  actorName: string;
  action: 'create' | 'update' | 'delete';
  accountId: string;
  entityLabel?: string;
  before?: unknown;
  after: unknown;
}): EmployeeDirectoryAuditResult {
  const afterRecord = entry.after as Partial<EmployeeDirectoryRecord>;
  const result = useOperationalAuditStore.getState().record({
    actorName: entry.actorName,
    action: entry.action,
    module: 'employees',
    entityId: entry.accountId,
    entityLabel: entry.entityLabel
      || (afterRecord.name?.en || afterRecord.name?.ar)
      || entry.accountId,
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
    const canManageRoles = options.canManageRoles ?? hasBrowserSuperAdminSession;
    const now = options.now ?? (() => new Date().toISOString());
    const wouldRemoveProtectedSuperAdmin = (
      record: EmployeeDirectoryRecord,
      nextRole: UserRole,
      nextActive = record.active,
    ) => record.role === 'super_admin' && (!nextActive || nextRole !== 'super_admin');
    const commit = (
      records: EmployeeDirectoryRecord[],
      accountId: string,
      actorName = 'Administrator',
      action: 'create' | 'update' | 'delete' = 'update',
      audit?: { entityLabel?: string; before?: unknown; after?: unknown },
    ) => {
      const validated = validateRecords(records);
      const record = validated.find((candidate) => candidate.accountId === accountId);
      if (!record) return { ok: false as const, reason: 'not_found' as const };
      const before = get().records.find((candidate) => candidate.accountId === accountId);
      let auditResult: EmployeeDirectoryAuditResult;
      try {
        auditResult = options.recordAudit?.({
          actorName,
          action,
          accountId,
          entityLabel: audit?.entityLabel,
          before: audit?.before ?? before,
          after: audit?.after ?? record,
        });
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
      if (syncLegacy) syncCompatibility();
      set({ records: validated, migrationReport: report, storageError: null });
      options.onChanged?.();
      return { ok: true as const, record };
    };
    return {
      ...base,
      replaceRecords: (records, sourceVersions = ['backend-bootstrap']) => {
        const validated = validateRecords(records.map(cloneRecord));
        const report = migrationReport(validated, sourceVersions, validated.length, 0);
        if (!persist(storage, { version: 3, records: validated, migrationReport: report })) {
          set({ storageError: 'Unable to save the employee directory.' });
          return;
        }
        if (syncLegacy) syncCompatibility();
        set({ records: validated, migrationReport: report, storageError: null });
        options.onChanged?.();
      },
      addEmployee: (source, actorName) => {
        if (!source.id.trim() || get().records.some((record) => record.accountId === source.id)) {
          return { ok: false, reason: 'invalid_record' };
        }
        const record = sourceToRecord(source, 'custom');
        record.access.updatedAt = now();
        record.access.updatedBy = actorName?.trim() || 'Administrator';
        return commit([...get().records, record], record.accountId, actorName?.trim() || 'Administrator', 'create');
      },
      updateEmployee: (accountId, updates, actorName) => {
        const current = get().records.find((record) => record.accountId === accountId);
        if (!current) return { ok: false, reason: 'not_found', message: 'Employee record not found.' };
        if (updates.role !== undefined) {
          if (!isUserRole(updates.role)) return { ok: false, reason: 'invalid_record', message: 'Invalid user role.' };
          if (updates.role !== current.role && !canManageRoles()) {
            return { ok: false, reason: 'permission_denied', message: 'Only super admins can change user roles.' };
          }
          if (wouldRemoveProtectedSuperAdmin(current, updates.role, updates.active ?? current.active)) {
            return { ok: false, reason: 'invalid_record', message: 'Cannot remove or demote a super admin account.' };
          }
        }
        if (updates.active === false && wouldRemoveProtectedSuperAdmin(current, updates.role ?? current.role, false)) {
          return { ok: false, reason: 'invalid_record', message: 'Cannot remove or demote a super admin account.' };
        }
        return commit(get().records.map((record) => record.accountId === accountId ? ({
          ...record,
          ...updates,
          name: updates.name ? { ...updates.name } : record.name,
          departmentName: updates.departmentName ? { ...updates.departmentName } : record.departmentName,
          position: updates.position ? { ...updates.position } : record.position,
          employeeNumber: updates.employeeNumber?.trim() ?? record.employeeNumber,
          code: updates.code?.trim().toUpperCase() ?? record.code,
          access: { ...record.access, updatedAt: now(), updatedBy: actorName?.trim() || record.access.updatedBy },
        }) : record), accountId, actorName?.trim() || 'Administrator');
      },
      setRole: (accountId, newRole, actorName) => {
        const current = get().records.find((r) => r.accountId === accountId);
        if (!current) return { ok: false, reason: 'not_found', message: 'Employee record not found.' };
        if (!isUserRole(newRole)) return { ok: false, reason: 'invalid_record', message: 'Invalid user role.' };
        if (!canManageRoles()) {
          return { ok: false, reason: 'permission_denied', message: 'Only super admins can change user roles.' };
        }
        if (current.role === newRole) return { ok: true, record: current };
        if (wouldRemoveProtectedSuperAdmin(current, newRole)) {
          return { ok: false, reason: 'invalid_record', message: 'Cannot remove or demote a super admin account.' };
        }
        const actor = actorName?.trim() || 'Administrator';
        return commit(
          get().records.map((record) => record.accountId === accountId ? ({
            ...record,
            role: newRole,
            access: { ...record.access, updatedAt: now(), updatedBy: actor },
          }) : record),
          accountId,
          actor,
          'update',
          {
            entityLabel: current.name.en || current.name.ar || current.accountId,
            before: { role: current.role },
            after: { role: newRole },
          },
        );
      },
      setRosterLink: (accountId, scheduleEmployeeId, actorName) => commit(get().records.map((record) => record.accountId === accountId ? ({
        ...record,
        scheduleEmployeeId: scheduleEmployeeId || undefined,
        access: { ...record.access, updatedAt: now(), updatedBy: actorName?.trim() || 'Administrator' },
      }) : record), accountId, actorName?.trim() || 'Administrator'),
      setAccess: (accountId, access, actorName) => commit(get().records.map((record) => record.accountId === accountId ? ({
        ...record,
        access: {
          templateId: access.templateId,
          overrides: { ...access.overrides },
          updatedAt: now(),
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
          updatedAt: profile.updatedAt || now(),
          updatedBy: actorName?.trim() || profile.updatedBy || 'Administrator',
        },
      }) : record), profile.accountId, actorName?.trim() || 'Administrator'),
      setActive: (accountId, active, actorName) => {
        const current = get().records.find((record) => record.accountId === accountId);
        if (!current) return { ok: false, reason: 'not_found', message: 'Employee record not found.' };
        if (!active && wouldRemoveProtectedSuperAdmin(current, current.role, false)) {
          return { ok: false, reason: 'invalid_record', message: 'Cannot remove or demote a super admin account.' };
        }
        return commit(get().records.map((record) => record.accountId === accountId ? ({
          ...record,
          active,
          access: { ...record.access, updatedAt: now(), updatedBy: actorName?.trim() || 'Administrator' },
        }) : record), accountId, actorName?.trim() || 'Administrator', active ? 'update' : 'delete');
      },
      reloadFromStorage: () => {
        const payload = migrate(storage);
        if (syncLegacy) syncCompatibility();
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
  canManageRoles: hasBrowserSuperAdminSession,
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

export function buildEmployeeDirectoryRoster(records: EmployeeDirectoryRecord[]): OfficialEmployee[] {
  const roster = new Map<string, OfficialEmployee>();

  for (const record of records) {
    if (!record.active || record.issues.length > 0) continue;

    const employeeId = record.scheduleEmployeeId || buildPendingEmployeeRosterId(record.accountId);

    const entry: OfficialEmployee = {
      employeeId,
      code: record.code,
      employeeNumber: record.employeeNumber,
      fullName: record.name.ar || record.name.en,
      fullNameEn: record.name.en || record.name.ar,
      origin: isPendingEmployeeRosterId(employeeId) ? 'directory' : 'schedule',
    };

    if (roster.has(employeeId)) {
      roster.set(employeeId, {
        ...roster.get(employeeId)!,
        ...entry,
      });
      continue;
    }

    roster.set(employeeId, entry);
  }

  return [...roster.values()];
}

export function getEmployeeDirectoryRoster(): OfficialEmployee[] {
  return buildEmployeeDirectoryRoster(useEmployeeDirectoryStore.getState().records);
}

export function directoryRecordToSource(record: EmployeeDirectoryRecord): EmployeeDirectorySource {
  return recordToSource(record);
}
