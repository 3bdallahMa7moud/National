import { describe, expect, it } from 'vitest';
import { EMPLOYEE_DIRECTORY_STORAGE_KEY, createEmployeeDirectoryStore } from './employeeDirectoryStore';
import type { EmployeeDirectoryStorage } from './employeeDirectoryStore';
import {
  createEmployeeDirectoryStorageFixture,
  createOfficialEmployeeDirectoryRecordsFixture,
} from '@/test/fixtures/employeeDirectory';

function memoryStorage(): EmployeeDirectoryStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

function seededStore(options: Parameters<typeof createEmployeeDirectoryStore>[2] = {}) {
  const storage = memoryStorage();
  storage.setItem(
    EMPLOYEE_DIRECTORY_STORAGE_KEY,
    JSON.stringify(createEmployeeDirectoryStorageFixture()),
  );
  return {
    storage,
    store: createEmployeeDirectoryStore(storage, false, options),
  };
}

describe('Super Admin Role Assignment', () => {
  it('allows promoting an employee to admin and demoting back', () => {
    const { store } = seededStore({
      canManageRoles: () => true,
    });

    // Target an existing employee record 'ot-employee-s' or 'emp-2'
    const target = store.getState().records.find((r) => r.role === 'employee')!;
    expect(target).toBeDefined();

    // Promote target to admin
    const promoteRes = store.getState().setRole(target.accountId, 'admin', 'Super Admin');
    expect(promoteRes.ok).toBe(true);
    expect(store.getState().records.find((r) => r.accountId === target.accountId)?.role).toBe('admin');

    // Demote target back to employee
    const demoteRes = store.getState().setRole(target.accountId, 'employee', 'Super Admin');
    expect(demoteRes.ok).toBe(true);
    expect(store.getState().records.find((r) => r.accountId === target.accountId)?.role).toBe('employee');
  });

  it('prevents demoting a super admin account', () => {
    const { store } = seededStore({
      canManageRoles: () => true,
    });

    // Identify the super_admin record (emp-1)
    const superAdmin = store.getState().records.find((r) => r.role === 'super_admin')!;
    expect(superAdmin).toBeDefined();

    const result = store.getState().setRole(superAdmin.accountId, 'admin', 'Super Admin');
    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid_record',
      message: 'Cannot remove or demote a super admin account.',
    });
    expect(store.getState().records.find((r) => r.accountId === superAdmin.accountId)?.role).toBe('super_admin');
  });

  it('rejects role changes when the actor is not a super admin', () => {
    const { store } = seededStore({
      canManageRoles: () => false,
    });
    const target = store.getState().records.find((r) => r.role === 'employee')!;

    const result = store.getState().setRole(target.accountId, 'admin', 'Department Admin');

    expect(result).toMatchObject({
      ok: false,
      reason: 'permission_denied',
      message: 'Only super admins can change user roles.',
    });
    expect(store.getState().records.find((r) => r.accountId === target.accountId)?.role).toBe('employee');
  });

  it('rejects role changes through the generic employee update path without super admin rights', () => {
    const { store } = seededStore({
      canManageRoles: () => false,
    });
    const target = store.getState().records.find((r) => r.role === 'employee')!;

    const result = store.getState().updateEmployee(target.accountId, { role: 'admin' }, 'Department Admin');

    expect(result).toMatchObject({ ok: false, reason: 'permission_denied' });
    expect(store.getState().records.find((r) => r.accountId === target.accountId)?.role).toBe('employee');
  });

  it('rejects invalid runtime role values', () => {
    const { store } = seededStore();
    const target = store.getState().records.find((r) => r.role === 'employee')!;

    const result = store.getState().setRole(target.accountId, 'owner' as never, 'Super Admin');

    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid_record',
      message: 'Invalid user role.',
    });
    expect(store.getState().records.find((r) => r.accountId === target.accountId)?.role).toBe('employee');
  });

  it('keeps a super admin protected even after another super admin exists', () => {
    const { store } = seededStore({
      canManageRoles: () => true,
    });
    const originalSuperAdmin = store.getState().records.find((r) => r.role === 'super_admin')!;
    const secondSuperAdmin = store.getState().records.find((r) => r.role === 'employee')!;

    expect(store.getState().setRole(secondSuperAdmin.accountId, 'super_admin', 'Super Admin')).toMatchObject({ ok: true });
    const result = store.getState().setRole(originalSuperAdmin.accountId, 'admin', 'Super Admin');

    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid_record',
      message: 'Cannot remove or demote a super admin account.',
    });
    expect(store.getState().records.find((r) => r.accountId === originalSuperAdmin.accountId)?.role).toBe('super_admin');
    expect(store.getState().records.find((r) => r.accountId === secondSuperAdmin.accountId)?.role).toBe('super_admin');
  });

  it('prevents deactivating a super admin account', () => {
    const { store } = seededStore();
    const superAdmin = store.getState().records.find((r) => r.role === 'super_admin')!;

    const result = store.getState().setActive(superAdmin.accountId, false, 'Super Admin');

    expect(result).toMatchObject({
      ok: false,
      reason: 'invalid_record',
      message: 'Cannot remove or demote a super admin account.',
    });
    expect(store.getState().records.find((r) => r.accountId === superAdmin.accountId)?.active).toBe(true);
  });

  it('does not invent a super admin when persisted backend records have none', () => {
    const storage = memoryStorage();
    const demotedRecords = createOfficialEmployeeDirectoryRecordsFixture().map((record) => (
      record.role === 'super_admin'
        ? { ...record, role: 'admin' as const, active: true }
        : record
    ));

    storage.setItem(EMPLOYEE_DIRECTORY_STORAGE_KEY, JSON.stringify({
      version: 3,
      records: demotedRecords,
      migrationReport: createEmployeeDirectoryStorageFixture(demotedRecords).migrationReport,
    }));

    const repaired = createEmployeeDirectoryStore(storage);

    expect(repaired.getState().records.some((record) => record.role === 'super_admin')).toBe(false);
    expect(repaired.getState().migrationReport.sourceVersions).not.toContain('super-admin-recovery');
  });

  it('persists the role and records a focused operational audit payload', () => {
    const audits: Array<{
      actorName: string;
      action: string;
      accountId: string;
      before?: unknown;
      after?: unknown;
    }> = [];
    const { storage, store } = seededStore({
      canManageRoles: () => true,
      recordAudit: (entry) => {
        audits.push(entry);
        return { ok: true };
      },
    });
    const target = store.getState().records.find((r) => r.role === 'employee')!;

    const result = store.getState().setRole(target.accountId, 'admin', 'Super Admin');

    expect(result).toMatchObject({ ok: true });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorName: 'Super Admin',
      action: 'update',
      accountId: target.accountId,
      before: { role: 'employee' },
      after: { role: 'admin' },
    });
    const persisted = JSON.parse(storage.values.get(EMPLOYEE_DIRECTORY_STORAGE_KEY) || 'null');
    expect(persisted.records.find((record: { accountId: string; role: string }) => record.accountId === target.accountId)?.role).toBe('admin');
  });
});
