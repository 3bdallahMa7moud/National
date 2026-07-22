import type { UserRole } from './employee';
import type { EmployeePermission, EmployeePermissionTemplateId } from './employeeAccess';
import type { LocalizedText } from './localized';

export type EmployeeDirectoryIssue =
  | 'duplicate_account_id'
  | 'duplicate_employee_number'
  | 'duplicate_email'
  | 'duplicate_code'
  | 'duplicate_roster_link'
  | 'missing_employee_number'
  | 'missing_code';

export interface EmployeeDirectoryAccess {
  templateId: EmployeePermissionTemplateId;
  overrides: Partial<Record<EmployeePermission, boolean>>;
  updatedAt: string;
  updatedBy: string;
}

export interface EmployeeDirectoryRecord {
  accountId: string;
  name: LocalizedText;
  email: string;
  phone: string;
  role: UserRole;
  departmentId: string;
  departmentName: LocalizedText;
  position: LocalizedText;
  employeeNumber: string;
  code: string;
  avatar?: string;
  active: boolean;
  createdAt: string;
  scheduleEmployeeId?: string;
  origin: 'official' | 'custom';
  issues: EmployeeDirectoryIssue[];
  access: EmployeeDirectoryAccess;
}

export interface EmployeeDirectoryMigrationReport {
  migratedAt: string;
  sourceVersions: string[];
  importedAccounts: number;
  officialAccountsRestored: number;
  recordsNeedingReview: number;
  issues: Array<{
    accountId: string;
    issues: EmployeeDirectoryIssue[];
  }>;
}

export type EmployeeDirectoryMutationResult =
  | { ok: true; record: EmployeeDirectoryRecord }
  | {
      ok: false;
      reason: 'not_found' | 'invalid_record' | 'duplicate_value' | 'storage_error';
      message?: string;
      issues?: EmployeeDirectoryIssue[];
    };
