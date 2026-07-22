import { describe, expect, it, vi } from 'vitest';
import {
  EMPLOYEE_DIRECTORY_STORAGE_KEY,
  LEGACY_EMPLOYEE_ACCESS_STORAGE_KEY,
  LEGACY_EMPLOYEE_ROSTER_STORAGE_KEY,
  createEmployeeDirectoryStore,
  type EmployeeDirectoryStorage,
} from './employeeDirectoryStore';
import { MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY } from '@/mocks/sources';
import type { MockEmployeeSource } from '@/mocks/types';

function memoryStorage(): EmployeeDirectoryStorage & { values: Map<string, string>; failKey?: string } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.failKey === key) throw new Error('quota');
      values.set(key, value);
    },
  };
}

function customEmployee(): MockEmployeeSource {
  return {
    id: 'custom-account',
    name: { ar: 'موظف مضاف', en: 'Custom Employee' },
    email: 'custom@hospital.sa',
    phone: '0500000000',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: { ar: 'الأشعة', en: 'Radiology' },
    position: { ar: 'فني', en: 'Technologist' },
    employeeNumber: 'CUSTOM-1',
    code: 'CUSTOM',
    isActive: true,
    createdAt: '2026-07-01',
    scheduleEmployeeId: 'emp-m-1',
  };
}

describe('employeeDirectoryStore migration', () => {
  it('merges legacy accounts, roster identities, and access while restoring official accounts', () => {
    const storage = memoryStorage();
    storage.values.set(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY, JSON.stringify({
      version: 2,
      employees: [
        {
          ...customEmployee(),
          id: 'emp-m-1',
          employeeNumber: 'EMP-003',
          code: 'A',
          scheduleEmployeeId: 'emp-m-1',
          name: { ar: 'أحمد المعدل', en: 'Edited Ahmed' },
        },
        customEmployee(),
      ],
    }));
    storage.values.set(LEGACY_EMPLOYEE_ROSTER_STORAGE_KEY, JSON.stringify([
      { employeeId: 'emp-m-1', code: 'AX', fullName: 'أحمد الرسمي', fullNameEn: 'Official Ahmed' },
    ]));
    storage.values.set(LEGACY_EMPLOYEE_ACCESS_STORAGE_KEY, JSON.stringify({
      version: 2,
      profiles: {
        'emp-m-1': {
          accountId: 'emp-m-1', departmentId: 'dept-1', scheduleEmployeeId: 'emp-m-1',
          templateId: 'coordinator', overrides: {}, active: true,
          updatedAt: '2026-07-02T00:00:00.000Z', updatedBy: 'Admin',
        },
      },
    }));

    const store = createEmployeeDirectoryStore(storage);
    const ahmed = store.getState().records.find((record) => record.accountId === 'emp-m-1');
    const custom = store.getState().records.find((record) => record.accountId === 'custom-account');

    expect(ahmed).toMatchObject({
      name: { ar: 'أحمد الرسمي', en: 'Official Ahmed' },
      code: 'AX',
      scheduleEmployeeId: 'emp-m-1',
      access: { templateId: 'coordinator' },
      issues: [],
    });
    expect(custom?.issues).toContain('duplicate_roster_link');
    expect(store.getState().records.some((record) => record.accountId === 'emp-m-30')).toBe(true);
    expect(store.getState().migrationReport.officialAccountsRestored).toBeGreaterThan(0);
    expect(storage.values.has(EMPLOYEE_DIRECTORY_STORAGE_KEY)).toBe(true);
    expect(storage.values.has(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY)).toBe(true);
  });

  it('is idempotent and keeps review issues stable when v3 already exists', () => {
    const storage = memoryStorage();
    storage.values.set(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY, JSON.stringify({
      version: 2,
      employees: [customEmployee()],
    }));

    const first = createEmployeeDirectoryStore(storage);
    const firstCount = first.getState().records.length;
    const second = createEmployeeDirectoryStore(storage);

    expect(second.getState().records).toHaveLength(firstCount);
    expect(second.getState().records.filter((record) => record.accountId === 'custom-account')).toHaveLength(1);
    expect(second.getState().records.find((record) => record.accountId === 'custom-account')?.issues)
      .toContain('duplicate_roster_link');
  });

  it('flags repeated legacy account ids for administrator review', () => {
    const storage = memoryStorage();
    storage.values.set(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY, JSON.stringify({
      version: 2,
      employees: [customEmployee(), { ...customEmployee(), phone: '0599999999' }],
    }));

    const store = createEmployeeDirectoryStore(storage);
    expect(store.getState().records.find((record) => record.accountId === 'custom-account')?.issues)
      .toContain('duplicate_account_id');
  });

  it('keeps incomplete legacy employees visible with review reasons instead of failing migration', () => {
    const storage = memoryStorage();
    storage.values.set(MOCK_EMPLOYEE_ACCOUNTS_STORAGE_KEY, JSON.stringify({
      version: 2,
      employees: [{
        id: 'incomplete-account',
        name: { ar: 'موظف ناقص', en: 'Incomplete Employee' },
        role: 'employee',
        departmentId: 'dept-1',
        isActive: true,
      }, null, 'invalid-row'],
    }));

    const store = createEmployeeDirectoryStore(storage);
    expect(store.getState().records.find((record) => record.accountId === 'incomplete-account')).toMatchObject({
      issues: expect.arrayContaining(['missing_employee_number', 'missing_code']),
    });
  });

  it('does not mutate the directory when audit fails and rolls audit back when storage fails', () => {
    const storage = memoryStorage();
    const auditFailureStore = createEmployeeDirectoryStore(storage, false, {
      recordAudit: () => ({ ok: false, message: 'Audit unavailable.' }),
    });
    const employee = auditFailureStore.getState().records.find((record) => record.role === 'employee')!;
    const persistedBefore = storage.values.get(EMPLOYEE_DIRECTORY_STORAGE_KEY);

    expect(auditFailureStore.getState().updateEmployee(employee.accountId, {
      name: { ar: 'اسم جديد', en: 'New Name' },
    })).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(auditFailureStore.getState().records.find((record) => record.accountId === employee.accountId)?.name)
      .toEqual(employee.name);
    expect(storage.values.get(EMPLOYEE_DIRECTORY_STORAGE_KEY)).toBe(persistedBefore);

    const rollback = vi.fn(() => true);
    const storageFailureStore = createEmployeeDirectoryStore(storage, false, {
      recordAudit: () => ({ ok: true, rollback }),
    });
    storage.failKey = EMPLOYEE_DIRECTORY_STORAGE_KEY;
    expect(storageFailureStore.getState().setRosterLink(employee.accountId, 'new-roster-link'))
      .toMatchObject({ ok: false, reason: 'storage_error' });
    expect(rollback).toHaveBeenCalledTimes(1);
  });
});
