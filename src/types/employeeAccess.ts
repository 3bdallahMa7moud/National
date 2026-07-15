import type { AuthUser } from './employee';

export const EMPLOYEE_PERMISSIONS = [
  'schedule.own.view',
  'schedule.department.view',
  'schedule.ot.own.view',
  'schedule.ot.department.view',
  'schedule.exchange.create',
  'schedule.replace.create',
  'schedule.requests.respond',
  'schedule.requests.cancelOwn',
  'schedule.own.export',
  'schedule.calendar.sync',
  'schedule.department.export',
  'schedule.department.requests.view',
] as const;

export type EmployeePermission = (typeof EMPLOYEE_PERMISSIONS)[number];
export type EmployeePermissionTemplateId = 'standard' | 'view_only' | 'coordinator';

export interface EmployeePermissionTemplate {
  id: EmployeePermissionTemplateId;
  permissions: Record<EmployeePermission, boolean>;
}

export interface EmployeeAccessProfile {
  accountId: string;
  departmentId: string;
  /** Explicit operational-roster link. It is never inferred from names or codes. */
  scheduleEmployeeId?: string;
  templateId: EmployeePermissionTemplateId;
  overrides: Partial<Record<EmployeePermission, boolean>>;
  active: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface EffectiveEmployeeAccess extends EmployeeAccessProfile {
  permissions: Record<EmployeePermission, boolean>;
  linked: boolean;
}

export interface EmployeeAccessSubject {
  accountId: string;
  name: string;
  departmentId: string;
  scheduleEmployeeId?: string;
  active?: boolean;
}

export type EmployeeAccessMutationResult =
  | { ok: true; profile: EmployeeAccessProfile }
  | {
      ok: false;
      reason: 'not_found' | 'duplicate_roster_link' | 'storage_error' | 'invalid_account' | 'permission_denied';
      message?: string;
    };

const ALL_DISABLED = Object.fromEntries(
  EMPLOYEE_PERMISSIONS.map((permission) => [permission, false]),
) as Record<EmployeePermission, boolean>;

export const EMPLOYEE_PERMISSION_TEMPLATES: Record<EmployeePermissionTemplateId, EmployeePermissionTemplate> = {
  view_only: {
    id: 'view_only',
    permissions: {
      ...ALL_DISABLED,
      'schedule.own.view': true,
      'schedule.department.view': true,
      'schedule.ot.own.view': true,
      'schedule.ot.department.view': true,
    },
  },
  standard: {
    id: 'standard',
    permissions: {
      ...ALL_DISABLED,
      'schedule.own.view': true,
      'schedule.department.view': true,
      'schedule.ot.own.view': true,
      'schedule.ot.department.view': true,
      'schedule.exchange.create': true,
      'schedule.replace.create': true,
      'schedule.requests.respond': true,
      'schedule.requests.cancelOwn': true,
      'schedule.own.export': true,
      'schedule.calendar.sync': true,
    },
  },
  coordinator: {
    id: 'coordinator',
    permissions: {
      ...ALL_DISABLED,
      'schedule.own.view': true,
      'schedule.department.view': true,
      'schedule.ot.own.view': true,
      'schedule.ot.department.view': true,
      'schedule.exchange.create': true,
      'schedule.replace.create': true,
      'schedule.requests.respond': true,
      'schedule.requests.cancelOwn': true,
      'schedule.own.export': true,
      'schedule.calendar.sync': true,
      'schedule.department.export': true,
      'schedule.department.requests.view': true,
    },
  },
};

export function effectivePermissions(
  templateId: EmployeePermissionTemplateId,
  overrides: Partial<Record<EmployeePermission, boolean>> = {},
): Record<EmployeePermission, boolean> {
  return {
    ...EMPLOYEE_PERMISSION_TEMPLATES[templateId].permissions,
    ...overrides,
  };
}

export function defaultEmployeeAccessProfile(
  user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>,
  now = new Date().toISOString(),
): EmployeeAccessProfile {
  return {
    accountId: user.id,
    departmentId: user.departmentId,
    scheduleEmployeeId: user.scheduleEmployeeId,
    templateId: 'standard',
    overrides: {},
    active: true,
    updatedAt: now,
    updatedBy: 'system',
  };
}

export function resolveEffectiveEmployeeAccess(
  user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>,
  profile?: EmployeeAccessProfile,
): EffectiveEmployeeAccess {
  const resolved = profile ?? defaultEmployeeAccessProfile(user);
  return {
    ...resolved,
    permissions: effectivePermissions(resolved.templateId, resolved.overrides),
    linked: Boolean(resolved.scheduleEmployeeId),
  };
}
