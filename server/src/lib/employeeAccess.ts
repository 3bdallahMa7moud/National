import { AccessTemplateId, type UserRole } from '@prisma/client';

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

type PermissionTemplate = Record<EmployeePermission, boolean>;

const allDisabled = Object.fromEntries(
  EMPLOYEE_PERMISSIONS.map((permission) => [permission, false]),
) as PermissionTemplate;

const templates: Record<AccessTemplateId, PermissionTemplate> = {
  view_only: {
    ...allDisabled,
    'schedule.own.view': true,
    'schedule.department.view': true,
    'schedule.ot.own.view': true,
    'schedule.ot.department.view': true,
  },
  standard: {
    ...allDisabled,
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
  coordinator: {
    ...allDisabled,
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
};

export function resolveEmployeePermissions(
  templateId: AccessTemplateId,
  overrides: Partial<Record<EmployeePermission, boolean>> = {},
) {
  return {
    ...templates[templateId],
    ...overrides,
  };
}

export function hasEmployeePermission(
  user: {
    role: UserRole;
    access?: {
      templateId: AccessTemplateId;
      overrides: Record<string, boolean>;
      active: boolean;
    } | null;
  },
  permission: EmployeePermission,
) {
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (!user.access?.active) return false;
  const overrides = user.access.overrides as Partial<Record<EmployeePermission, boolean>>;
  return resolveEmployeePermissions(user.access.templateId, overrides)[permission] === true;
}
