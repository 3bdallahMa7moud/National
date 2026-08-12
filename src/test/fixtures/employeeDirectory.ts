import type { UserRole } from '@/types';
import type {
  EmployeeDirectoryMigrationReport,
  EmployeeDirectoryRecord,
} from '@/types/employeeDirectory';
import { EMPLOYEE_DIRECTORY_STORAGE_KEY } from '@/stores/employeeDirectoryStore';
import { OFFICIAL_EMPLOYEE_ROSTER } from './officialEmployeeRoster';

const ACCESS = {
  templateId: 'standard' as const,
  overrides: {},
  updatedAt: new Date(0).toISOString(),
  updatedBy: 'test-fixture',
};

export function createEmployeeDirectoryRecordFixture(
  overrides: Partial<EmployeeDirectoryRecord> & Pick<EmployeeDirectoryRecord, 'accountId'>,
): EmployeeDirectoryRecord {
  const name = overrides.name ?? { ar: overrides.accountId, en: overrides.accountId };
  const departmentName = overrides.departmentName ?? { ar: 'CT Department', en: 'CT Department' };
  const position = overrides.position ?? { ar: 'CT Technologist', en: 'CT Technologist' };

  return {
    accountId: overrides.accountId,
    name,
    email: overrides.email ?? `${overrides.accountId}@hospital.test`,
    phone: overrides.phone ?? '0500000000',
    role: overrides.role ?? 'employee',
    departmentId: overrides.departmentId ?? 'dept-1',
    departmentName,
    position,
    employeeNumber: overrides.employeeNumber ?? overrides.accountId,
    code: (overrides.code ?? overrides.accountId.slice(0, 3)).toUpperCase(),
    avatar: overrides.avatar,
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date(0).toISOString(),
    scheduleEmployeeId: overrides.scheduleEmployeeId,
    origin: overrides.origin ?? 'official',
    issues: overrides.issues ? [...overrides.issues] : [],
    access: overrides.access
      ? { ...overrides.access, overrides: { ...overrides.access.overrides } }
      : { ...ACCESS },
  };
}

export function createOfficialEmployeeDirectoryRecordsFixture(
  roles: { superAdminRole?: UserRole } = {},
): EmployeeDirectoryRecord[] {
  const superAdmin = createEmployeeDirectoryRecordFixture({
    accountId: 'emp-1',
    name: { ar: 'Super Admin', en: 'Super Admin' },
    email: 'super.admin@hospital.test',
    role: roles.superAdminRole ?? 'super_admin',
    employeeNumber: 'EMP-001',
    code: 'ADM',
    scheduleEmployeeId: undefined,
  });

  const employees = OFFICIAL_EMPLOYEE_ROSTER.map((employee, index) =>
    createEmployeeDirectoryRecordFixture({
      accountId: employee.employeeId,
      name: { ar: employee.fullName, en: employee.fullNameEn || employee.fullName },
      role: 'employee',
      employeeNumber: `EMP-${String(index + 2).padStart(3, '0')}`,
      code: employee.code,
      scheduleEmployeeId: employee.employeeId,
    }));

  return [superAdmin, ...employees];
}

export function createEmployeeDirectoryStorageFixture(
  records = createOfficialEmployeeDirectoryRecordsFixture(),
  sourceVersions = ['test-fixture'],
) {
  const migrationReport: EmployeeDirectoryMigrationReport = {
    migratedAt: new Date(0).toISOString(),
    sourceVersions,
    importedAccounts: records.length,
    officialAccountsRestored: 0,
    recordsNeedingReview: records.filter((record) => record.issues.length > 0).length,
    issues: records
      .filter((record) => record.issues.length > 0)
      .map((record) => ({ accountId: record.accountId, issues: [...record.issues] })),
  };

  return {
    version: 3 as const,
    records,
    migrationReport,
  };
}

export function writeEmployeeDirectoryFixtureToStorage(
  storage: Pick<Storage, 'setItem'>,
  records = createOfficialEmployeeDirectoryRecordsFixture(),
) {
  storage.setItem(
    EMPLOYEE_DIRECTORY_STORAGE_KEY,
    JSON.stringify(createEmployeeDirectoryStorageFixture(records)),
  );
}
