import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AuthUser } from '@/types/employee';
import {
  EMPLOYEE_PERMISSIONS,
  type EffectiveEmployeeAccess,
  type EmployeeAccessMutationResult,
  type EmployeeAccessProfile,
  type EmployeeAccessSubject,
  type EmployeePermission,
  type EmployeePermissionTemplateId,
  defaultEmployeeAccessProfile,
  resolveEffectiveEmployeeAccess,
} from '@/types/employeeAccess';
import { useOperationalAuditStore } from './operationalAuditStore';
import { mockEmployeesSource } from '@/mocks/sources';

export const EMPLOYEE_ACCESS_STORAGE_KEY = 'ngh_employee_access_v2';

export interface EmployeeAccessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface EmployeeAccessPersistedState {
  version: 2;
  profiles: Record<string, EmployeeAccessProfile>;
}

interface EmployeeAccessStoreOptions {
  storage?: EmployeeAccessStorage | null;
  seedSubjects?: EmployeeAccessSubject[];
  /** Production supplies a live admin-session check; isolated stores default to trusted callers. */
  canManageAccess?: () => boolean;
  now?: () => string;
  onChanged?: () => void;
  recordAudit?: (entry: {
    actorName: string;
    accountId: string;
    before?: unknown;
    after?: unknown;
  }) => void | { ok: true; rollback?: () => boolean } | { ok: false; message?: string };
}

export interface EmployeeAccessState {
  profiles: Record<string, EmployeeAccessProfile>;
  storageError: string | null;
  ensureProfile(subject: EmployeeAccessSubject, actorName?: string): EmployeeAccessMutationResult;
  setTemplate(accountId: string, templateId: EmployeePermissionTemplateId, actorName?: string): EmployeeAccessMutationResult;
  setOverride(accountId: string, permission: EmployeePermission, value: boolean | undefined, actorName?: string): EmployeeAccessMutationResult;
  setRosterLink(accountId: string, scheduleEmployeeId: string | undefined, actorName?: string): EmployeeAccessMutationResult;
  setActive(accountId: string, active: boolean, actorName?: string): EmployeeAccessMutationResult;
  resolveForUser(user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>): EffectiveEmployeeAccess;
  hasPermission(user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>, permission: EmployeePermission): boolean;
  accountForRosterEmployee(departmentId: string, scheduleEmployeeId: string): EmployeeAccessProfile | undefined;
  reloadFromStorage(): void;
  clearForTests(): void;
}

function browserStorage(): EmployeeAccessStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function hasBrowserAdminSession(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage.getItem('token')) return false;
    const user = JSON.parse(window.localStorage.getItem('user') || 'null') as { role?: string } | null;
    return user?.role === 'admin';
  } catch {
    return false;
  }
}

function isTemplate(value: unknown): value is EmployeePermissionTemplateId {
  return value === 'standard' || value === 'view_only' || value === 'coordinator';
}

function normalizeProfile(value: unknown): EmployeeAccessProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<EmployeeAccessProfile>;
  if (!candidate.accountId || !candidate.departmentId || !isTemplate(candidate.templateId)) return null;
  const overrides: Partial<Record<EmployeePermission, boolean>> = {};
  for (const permission of EMPLOYEE_PERMISSIONS) {
    const current = candidate.overrides?.[permission];
    if (typeof current === 'boolean') overrides[permission] = current;
  }
  return {
    accountId: candidate.accountId,
    departmentId: candidate.departmentId,
    scheduleEmployeeId: candidate.scheduleEmployeeId || undefined,
    templateId: candidate.templateId,
    overrides,
    active: candidate.active !== false,
    updatedAt: candidate.updatedAt || new Date(0).toISOString(),
    updatedBy: candidate.updatedBy || 'system',
  };
}

function readProfiles(storage: EmployeeAccessStorage | null): Record<string, EmployeeAccessProfile> {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(EMPLOYEE_ACCESS_STORAGE_KEY) || 'null') as Partial<EmployeeAccessPersistedState> | null;
    if (!parsed || parsed.version !== 2 || !parsed.profiles || typeof parsed.profiles !== 'object') return {};
    const profiles: Record<string, EmployeeAccessProfile> = {};
    for (const value of Object.values(parsed.profiles)) {
      const profile = normalizeProfile(value);
      if (profile) profiles[profile.accountId] = profile;
    }
    return profiles;
  } catch {
    return {};
  }
}

function readInitialProfiles(
  storage: EmployeeAccessStorage | null,
  seedSubjects: EmployeeAccessSubject[] = [],
): Record<string, EmployeeAccessProfile> {
  const profiles = readProfiles(storage);
  let changed = false;
  for (const subject of seedSubjects) {
    if (profiles[subject.accountId]) {
      if (!profiles[subject.accountId].scheduleEmployeeId && subject.scheduleEmployeeId) {
        profiles[subject.accountId].scheduleEmployeeId = subject.scheduleEmployeeId;
        changed = true;
      }
      continue;
    }
    profiles[subject.accountId] = {
      accountId: subject.accountId,
      departmentId: subject.departmentId,
      scheduleEmployeeId: subject.scheduleEmployeeId,
      templateId: 'standard',
      overrides: {},
      active: subject.active !== false,
      updatedAt: new Date(0).toISOString(),
      updatedBy: 'system',
    };
    changed = true;
  }
  if (changed) {
    try {
      storage?.setItem(EMPLOYEE_ACCESS_STORAGE_KEY, JSON.stringify({ version: 2, profiles } satisfies EmployeeAccessPersistedState));
    } catch {
      // Defaults remain available in memory; the first explicit admin mutation reports persistence failures.
    }
  }
  return profiles;
}

function defaultAudit(entry: { actorName: string; accountId: string; before?: unknown; after?: unknown }) {
  const auditStore = useOperationalAuditStore.getState();
  const result = auditStore.record({
    actorName: entry.actorName,
    action: 'settings',
    module: 'employees',
    entityId: entry.accountId,
    entityLabel: 'Employee access permissions',
    before: entry.before === undefined ? undefined : JSON.stringify(entry.before),
    after: entry.after === undefined ? undefined : JSON.stringify(entry.after),
    context: { route: '/admin/employees' },
  });
  if (!result.ok) return result;
  return {
    ok: true as const,
    rollback: () => useOperationalAuditStore.getState().remove(result.entry.id).ok,
  };
}

function makeState(
  options: EmployeeAccessStoreOptions,
  set: StoreApi<EmployeeAccessState>['setState'],
  get: StoreApi<EmployeeAccessState>['getState'],
): EmployeeAccessState {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date().toISOString());
  const recordAudit = options.recordAudit ?? defaultAudit;
  const canManageAccess = options.canManageAccess ?? (() => true);

  const commit = (
    profiles: Record<string, EmployeeAccessProfile>,
    accountId: string,
    actorName: string,
    before: EmployeeAccessProfile | undefined,
  ): EmployeeAccessMutationResult => {
    let auditResult: ReturnType<typeof recordAudit>;
    try {
      auditResult = recordAudit({ actorName, accountId, before, after: profiles[accountId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the employee access audit.';
      set({ storageError: message });
      return { ok: false, reason: 'storage_error', message };
    }
    if (auditResult && !auditResult.ok) {
      const message = auditResult.message || 'Unable to save the employee access audit.';
      set({ storageError: message });
      return { ok: false, reason: 'storage_error', message };
    }
    try {
      storage?.setItem(EMPLOYEE_ACCESS_STORAGE_KEY, JSON.stringify({ version: 1, profiles } satisfies EmployeeAccessPersistedState));
    } catch {
      auditResult?.rollback?.();
      set({ storageError: 'Unable to save employee permissions.' });
      return { ok: false, reason: 'storage_error', message: 'Unable to save employee permissions.' };
    }
    set({ profiles, storageError: null });
    options.onChanged?.();
    const profile = profiles[accountId];
    return { ok: true, profile };
  };

  const mutate = (
    accountId: string,
    actorName: string | undefined,
    update: (profile: EmployeeAccessProfile) => EmployeeAccessProfile,
  ): EmployeeAccessMutationResult => {
    if (!canManageAccess()) return { ok: false, reason: 'permission_denied' };
    const before = get().profiles[accountId];
    if (!before) return { ok: false, reason: 'not_found' };
    const next = update(before);
    return commit({ ...get().profiles, [accountId]: next }, accountId, actorName?.trim() || 'Administrator', before);
  };

  return {
    profiles: readInitialProfiles(storage, options.seedSubjects),
    storageError: null,
    ensureProfile: (subject, actorName) => {
      if (!canManageAccess()) return { ok: false, reason: 'permission_denied' };
      if (!subject.accountId.trim() || !subject.departmentId.trim()) return { ok: false, reason: 'invalid_account' };
      const before = get().profiles[subject.accountId];
      if (subject.scheduleEmployeeId) {
        const duplicate = Object.values(get().profiles).find((profile) =>
          profile.accountId !== subject.accountId
          && profile.departmentId === subject.departmentId
          && profile.scheduleEmployeeId === subject.scheduleEmployeeId,
        );
        if (duplicate) return { ok: false, reason: 'duplicate_roster_link' };
      }
      const profile: EmployeeAccessProfile = before ? {
        ...before,
        departmentId: subject.departmentId,
        scheduleEmployeeId: subject.scheduleEmployeeId ?? before.scheduleEmployeeId,
        active: subject.active ?? before.active,
        updatedAt: now(),
        updatedBy: actorName?.trim() || 'Administrator',
      } : {
        accountId: subject.accountId,
        departmentId: subject.departmentId,
        scheduleEmployeeId: subject.scheduleEmployeeId,
        templateId: 'standard',
        overrides: {},
        active: subject.active !== false,
        updatedAt: now(),
        updatedBy: actorName?.trim() || 'Administrator',
      };
      return commit({ ...get().profiles, [subject.accountId]: profile }, subject.accountId, actorName?.trim() || 'Administrator', before);
    },
    setTemplate: (accountId, templateId, actorName) => mutate(accountId, actorName, (profile) => ({
      ...profile,
      templateId,
      overrides: {},
      updatedAt: now(),
      updatedBy: actorName?.trim() || 'Administrator',
    })),
    setOverride: (accountId, permission, value, actorName) => mutate(accountId, actorName, (profile) => {
      const overrides = { ...profile.overrides };
      if (value === undefined) delete overrides[permission];
      else overrides[permission] = value;
      return { ...profile, overrides, updatedAt: now(), updatedBy: actorName?.trim() || 'Administrator' };
    }),
    setRosterLink: (accountId, scheduleEmployeeId, actorName) => {
      if (!canManageAccess()) return { ok: false, reason: 'permission_denied' };
      const profile = get().profiles[accountId];
      if (!profile) return { ok: false, reason: 'not_found' };
      if (scheduleEmployeeId) {
        const duplicate = Object.values(get().profiles).find((candidate) =>
          candidate.accountId !== accountId
          && candidate.departmentId === profile.departmentId
          && candidate.scheduleEmployeeId === scheduleEmployeeId,
        );
        if (duplicate) return { ok: false, reason: 'duplicate_roster_link' };
      }
      return mutate(accountId, actorName, (current) => ({
        ...current,
        scheduleEmployeeId: scheduleEmployeeId || undefined,
        updatedAt: now(),
        updatedBy: actorName?.trim() || 'Administrator',
      }));
    },
    setActive: (accountId, active, actorName) => mutate(accountId, actorName, (profile) => ({
      ...profile,
      active,
      updatedAt: now(),
      updatedBy: actorName?.trim() || 'Administrator',
    })),
    resolveForUser: (user) => resolveEffectiveEmployeeAccess(user, get().profiles[user.id]),
    hasPermission: (user, permission) => {
      const access = resolveEffectiveEmployeeAccess(user, get().profiles[user.id]);
      return access.active && access.permissions[permission];
    },
    accountForRosterEmployee: (departmentId, scheduleEmployeeId) => Object.values(get().profiles).find((profile) =>
      profile.active
      && profile.departmentId === departmentId
      && profile.scheduleEmployeeId === scheduleEmployeeId,
    ),
    reloadFromStorage: () => set({ profiles: readInitialProfiles(storage, options.seedSubjects), storageError: null }),
    clearForTests: () => {
      try {
        storage?.setItem(EMPLOYEE_ACCESS_STORAGE_KEY, JSON.stringify({ version: 1, profiles: {} } satisfies EmployeeAccessPersistedState));
      } catch {
        // Test reset still clears in-memory state when persistence is unavailable.
      }
      set({ profiles: {}, storageError: null });
    },
  };
}

export function createEmployeeAccessStore(options: EmployeeAccessStoreOptions = {}): StoreApi<EmployeeAccessState> {
  return createStore<EmployeeAccessState>()((set, get) => makeState(options, set, get));
}

let employeeAccessChannel: BroadcastChannel | null = null;
const broadcastEmployeeAccess = () => {
  try {
    employeeAccessChannel?.postMessage({ type: 'employee-access-changed' });
  } catch {
    // Cross-tab sync is best-effort; local persistence already succeeded.
  }
};

export const useEmployeeAccessStore = create<EmployeeAccessState>()(
  (set, get) => makeState({
    onChanged: broadcastEmployeeAccess,
    canManageAccess: hasBrowserAdminSession,
    seedSubjects: mockEmployeesSource
      .filter((employee) => employee.role === 'employee')
      .map((employee) => ({
        accountId: employee.id,
        name: employee.name.en,
        departmentId: employee.departmentId,
        scheduleEmployeeId: employee.scheduleEmployeeId,
        active: employee.isActive,
      })),
  }, set, get),
);

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      employeeAccessChannel = new BroadcastChannel('ngh-employee-access');
      employeeAccessChannel.addEventListener('message', () => useEmployeeAccessStore.getState().reloadFromStorage());
    }
    window.addEventListener('storage', (event) => {
      if (event.key === EMPLOYEE_ACCESS_STORAGE_KEY) useEmployeeAccessStore.getState().reloadFromStorage();
    });
  } catch {
    // Storage-event sync remains optional in restricted browser contexts.
  }
}

export function employeeCan(
  user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>,
  permission: EmployeePermission,
): boolean {
  return useEmployeeAccessStore.getState().hasPermission(user, permission);
}

export function resolveCurrentEmployeeAccess(
  user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>,
): EffectiveEmployeeAccess {
  return useEmployeeAccessStore.getState().resolveForUser(user);
}

export function defaultAccessForUser(user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>) {
  return defaultEmployeeAccessProfile(user);
}
