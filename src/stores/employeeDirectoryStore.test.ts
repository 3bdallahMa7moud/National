import { describe, expect, it, vi } from 'vitest';
import {
  EMPLOYEE_DIRECTORY_STORAGE_KEY,
  buildEmployeeDirectoryRoster,
  buildPendingEmployeeRosterId,
  createEmployeeDirectoryStore,
  type EmployeeDirectoryStorage,
} from './employeeDirectoryStore';
import type { EmployeeDirectoryRecord, EmployeeDirectorySource } from '@/types/employeeDirectory';

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

function sourceEmployee(): EmployeeDirectorySource {
  return {
    id: 'custom-account',
    name: { ar: 'Custom Employee', en: 'Custom Employee' },
    email: 'custom@hospital.sa',
    phone: '0500000000',
    role: 'employee',
    departmentId: 'dept-1',
    departmentName: { ar: 'Radiology', en: 'Radiology' },
    position: { ar: 'Technologist', en: 'Technologist' },
    employeeNumber: 'CUSTOM-1',
    code: 'CUSTOM',
    isActive: true,
    createdAt: '2026-07-01',
    scheduleEmployeeId: 'schedule-employee-1',
  };
}

function backendRecord(overrides: Partial<EmployeeDirectoryRecord> = {}): EmployeeDirectoryRecord {
  return {
    accountId: 'backend-account',
    name: { ar: 'Backend Employee', en: 'Backend Employee' },
    email: 'backend.employee@hospital.sa',
    phone: '0501112233',
    role: 'employee',
    departmentId: 'dept-backend',
    departmentName: { ar: 'Backend Department', en: 'Backend Department' },
    position: { ar: 'Technologist', en: 'Technologist' },
    employeeNumber: 'BE-100',
    code: 'B100',
    active: true,
    createdAt: '2026-08-08T00:00:00.000Z',
    scheduleEmployeeId: 'backend-employee-1',
    origin: 'official',
    issues: [],
    access: {
      templateId: 'coordinator',
      overrides: { 'schedule.department.export': true },
      updatedAt: '2026-08-08T00:00:00.000Z',
      updatedBy: 'Backend bootstrap',
    },
    ...overrides,
  };
}

describe('employeeDirectoryStore', () => {
  it('starts empty when no backend bootstrap data has been loaded', () => {
    const storage = memoryStorage();
    const store = createEmployeeDirectoryStore(storage);

    expect(store.getState().records).toEqual([]);
    expect(store.getState().migrationReport).toMatchObject({
      importedAccounts: 0,
      officialAccountsRestored: 0,
      recordsNeedingReview: 0,
    });
    expect(storage.values.has(EMPLOYEE_DIRECTORY_STORAGE_KEY)).toBe(true);
  });

  it('can add explicit directory records without relying on built-in account data', () => {
    const storage = memoryStorage();
    const store = createEmployeeDirectoryStore(storage, false, {
      canManageRoles: () => true,
      recordAudit: () => ({ ok: true }),
    });

    expect(store.getState().addEmployee(sourceEmployee(), 'Admin')).toMatchObject({ ok: true });
    expect(store.getState().records).toHaveLength(1);
    expect(store.getState().records[0]).toMatchObject({
      accountId: 'custom-account',
      employeeNumber: 'CUSTOM-1',
      code: 'CUSTOM',
    });
  });

  it('does not mutate the directory when audit fails and rolls audit back when storage fails', () => {
    const storage = memoryStorage();
    const employee = backendRecord();
    const auditFailureStore = createEmployeeDirectoryStore(storage, false, {
      recordAudit: () => ({ ok: false, message: 'Audit unavailable.' }),
    });
    auditFailureStore.getState().replaceRecords([employee], ['backend-bootstrap']);
    const persistedBefore = storage.values.get(EMPLOYEE_DIRECTORY_STORAGE_KEY);

    expect(auditFailureStore.getState().updateEmployee(employee.accountId, {
      name: { ar: 'New Name', en: 'New Name' },
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

  it('keeps backend-hydrated records authoritative across reloads', () => {
    const storage = memoryStorage();
    const store = createEmployeeDirectoryStore(storage);
    const employee = backendRecord();

    store.getState().replaceRecords([employee], ['backend-bootstrap']);
    expect(store.getState().records).toEqual([employee]);

    store.getState().reloadFromStorage();

    expect(store.getState().records).toEqual([employee]);
    expect(store.getState().migrationReport.sourceVersions).toContain('backend-bootstrap');
  });

  it('builds the operational roster from active accounts, including super admins, and excludes inactive records', () => {
    const roster = buildEmployeeDirectoryRoster([
      backendRecord({
        accountId: 'linked-employee',
        name: { ar: 'Linked Ahmed', en: 'Linked Ahmed' },
        employeeNumber: '5555555',
        code: 'LA',
        scheduleEmployeeId: 'schedule-linked-1',
      }),
      backendRecord({
        accountId: 'unlinked-employee',
        name: { ar: 'Unlinked User', en: 'Unlinked User' },
        code: 'UU',
        scheduleEmployeeId: undefined,
      }),
      backendRecord({
        accountId: 'inactive-employee',
        name: { ar: 'Inactive User', en: 'Inactive User' },
        code: 'IU',
        active: false,
        scheduleEmployeeId: 'schedule-inactive-1',
      }),
      backendRecord({
        accountId: 'super-admin',
        name: { ar: 'Root Scheduler', en: 'Root Scheduler' },
        role: 'super_admin',
        code: 'SUP',
        scheduleEmployeeId: 'schedule-super-1',
      }),
    ]);

    expect(roster).toHaveLength(3);
    expect(roster.some((employee) => employee.employeeId === 'schedule-inactive-1')).toBe(false);
    expect(roster.find((employee) => employee.employeeId === 'schedule-linked-1')).toMatchObject({
      code: 'LA',
      employeeNumber: '5555555',
      fullName: 'Linked Ahmed',
      fullNameEn: 'Linked Ahmed',
      origin: 'schedule',
    });
    expect(roster.find((employee) => employee.employeeId === buildPendingEmployeeRosterId('unlinked-employee'))).toMatchObject({
      code: 'UU',
      fullName: 'Unlinked User',
      fullNameEn: 'Unlinked User',
      origin: 'directory',
    });
    expect(roster.find((employee) => employee.employeeId === 'schedule-super-1')).toMatchObject({
      code: 'SUP',
      fullName: 'Root Scheduler',
      fullNameEn: 'Root Scheduler',
      origin: 'schedule',
    });
  });
});
