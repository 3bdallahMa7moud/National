import { describe, expect, it } from 'vitest';
import { createEmployeeAccessStore, EMPLOYEE_ACCESS_STORAGE_KEY } from './employeeAccessStore';
import type { EmployeeAccessStorage } from './employeeAccessStore';

function memoryStorage(): EmployeeAccessStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('employeeAccessStore', () => {
  it('applies templates, individual overrides, and persists them', () => {
    const storage = memoryStorage();
    const store = createEmployeeAccessStore({ storage, now: () => '2026-07-15T10:00:00.000Z', recordAudit: () => undefined });
    const ensured = store.getState().ensureProfile({
      accountId: 'account-a', name: 'A', departmentId: 'dept-1', scheduleEmployeeId: 'employee-a',
    }, 'Admin');
    expect(ensured.ok).toBe(true);
    expect(store.getState().setTemplate('account-a', 'view_only', 'Admin').ok).toBe(true);
    expect(store.getState().setOverride('account-a', 'schedule.exchange.create', true, 'Admin').ok).toBe(true);
    expect(store.getState().hasPermission({ id: 'account-a', departmentId: 'dept-1' }, 'schedule.exchange.create')).toBe(true);
    expect(JSON.parse(storage.values.get(EMPLOYEE_ACCESS_STORAGE_KEY) || '{}').version).toBe(1);
  });

  it('prevents duplicate official roster links inside a department', () => {
    const store = createEmployeeAccessStore({ storage: memoryStorage(), recordAudit: () => undefined });
    store.getState().ensureProfile({ accountId: 'a', name: 'A', departmentId: 'dept-1', scheduleEmployeeId: 'employee-a' });
    const result = store.getState().ensureProfile({ accountId: 'b', name: 'B', departmentId: 'dept-1', scheduleEmployeeId: 'employee-a' });
    expect(result).toMatchObject({ ok: false, reason: 'duplicate_roster_link' });
  });

  it('keeps the previous profile when localStorage is full', () => {
    let writes = 0;
    const storage: EmployeeAccessStorage = {
      getItem: () => null,
      setItem: () => {
        writes += 1;
        if (writes > 1) throw new Error('quota');
      },
    };
    const store = createEmployeeAccessStore({ storage, recordAudit: () => undefined });
    store.getState().ensureProfile({ accountId: 'a', name: 'A', departmentId: 'dept-1', scheduleEmployeeId: 'employee-a' });
    const result = store.getState().setTemplate('a', 'coordinator', 'Admin');
    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(store.getState().profiles.a.templateId).toBe('standard');
  });

  it('rejects permission changes when the caller is not an administrator', () => {
    let allowed = true;
    const store = createEmployeeAccessStore({
      storage: memoryStorage(),
      canManageAccess: () => allowed,
      recordAudit: () => undefined,
    });
    expect(store.getState().ensureProfile({
      accountId: 'a', name: 'A', departmentId: 'dept-1', scheduleEmployeeId: 'employee-a',
    }).ok).toBe(true);
    allowed = false;
    expect(store.getState().setTemplate('a', 'coordinator')).toMatchObject({
      ok: false,
      reason: 'permission_denied',
    });
    expect(store.getState().setOverride('a', 'schedule.department.export', true)).toMatchObject({
      ok: false,
      reason: 'permission_denied',
    });
    expect(store.getState().setRosterLink('a', 'employee-b')).toMatchObject({
      ok: false,
      reason: 'permission_denied',
    });
    expect(store.getState().profiles.a.templateId).toBe('standard');
    expect(store.getState().profiles.a.scheduleEmployeeId).toBe('employee-a');
  });

  it('does not persist a permission change when the audit cannot be saved', () => {
    const storage = memoryStorage();
    let failAudit = false;
    const store = createEmployeeAccessStore({
      storage,
      recordAudit: () => failAudit
        ? { ok: false as const, message: 'Audit quota exceeded.' }
        : { ok: true as const },
    });
    expect(store.getState().ensureProfile({
      accountId: 'a', name: 'A', departmentId: 'dept-1', scheduleEmployeeId: 'employee-a',
    }).ok).toBe(true);
    const persistedBefore = storage.values.get(EMPLOYEE_ACCESS_STORAGE_KEY);
    failAudit = true;

    expect(store.getState().setTemplate('a', 'coordinator', 'Admin')).toMatchObject({
      ok: false,
      reason: 'storage_error',
      message: 'Audit quota exceeded.',
    });
    expect(store.getState().profiles.a.templateId).toBe('standard');
    expect(storage.values.get(EMPLOYEE_ACCESS_STORAGE_KEY)).toBe(persistedBefore);
  });
});
