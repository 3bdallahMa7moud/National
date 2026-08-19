import crypto from 'node:crypto';
import { type Response, Router } from 'express';
import { AccessTemplateId, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env.js';
import { hashPassword, normalizeEmail } from '../lib/auth.js';
import { EmailDeliveryError, sendPasswordResetEmail } from '../lib/email.js';
import { parseJson } from '../lib/json.js';
import { prisma } from '../lib/prisma.js';
import { requireRoles } from '../middleware/auth.js';

const roleSchema = z.enum(['super_admin', 'admin', 'employee']);
const accessTemplateSchema = z.enum(['standard', 'view_only', 'coordinator']);

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1),
  employeeNumber: z.string().trim().min(1),
  code: z.string().trim().min(1).max(5),
  position: z.string().trim().min(1),
  email: z.string().trim().email().nullable().optional().or(z.literal('')),
  phone: z.string().trim().default(''),
  role: z.enum(['admin', 'employee']).default('employee'),
  departmentId: z.string().trim().min(1).optional(),
});

const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  employeeNumber: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).max(5).optional(),
  position: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().nullable().optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  departmentId: z.string().trim().min(1).optional(),
});

const updateAccessSchema = z.object({
  templateId: accessTemplateSchema,
  overrides: z.record(z.string(), z.boolean()).default({}),
  scheduleEmployeeId: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().default(true),
});

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    department: true;
    accessProfile: true;
  };
}>;

function serializeEmployee(user: UserWithRelations) {
  return {
    id: user.id,
    name: {
      en: user.nameEn,
      ar: user.nameAr,
    },
    email: user.email ?? '',
    phone: user.phone,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: {
      en: user.department.nameEn,
      ar: user.department.nameAr,
    },
    position: {
      en: user.positionEn,
      ar: user.positionAr,
    },
    employeeNumber: user.employeeNumber,
    code: user.code,
    avatar: user.avatar ?? undefined,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString().slice(0, 10),
    scheduleEmployeeId: user.scheduleEmployeeId ?? undefined,
  };
}

function serializeAccessProfile(user: UserWithRelations) {
  const profile = user.accessProfile;

  return {
    accountId: user.id,
    departmentId: user.departmentId,
    scheduleEmployeeId: user.scheduleEmployeeId ?? undefined,
    templateId: profile?.templateId ?? AccessTemplateId.standard,
    overrides: parseJson<Record<string, boolean>>(profile?.overridesJson, {}),
    active: user.isActive && (profile?.isActive ?? true),
    updatedAt: profile?.updatedAt.toISOString() ?? user.updatedAt.toISOString(),
    updatedBy: profile?.updatedByLabel ?? 'system',
  };
}

async function recordAudit(args: {
  actorName: string;
  action: 'create' | 'update' | 'delete';
  entityId: string;
  entityLabel: string;
  departmentId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditEntry.create({
    data: {
      id: `audit-${crypto.randomUUID()}`,
      actorName: args.actorName,
      action: args.action,
      module: 'employees',
      entityId: args.entityId,
      entityLabel: args.entityLabel,
      before: args.before === undefined ? null : JSON.stringify(args.before),
      after: args.after === undefined ? null : JSON.stringify(args.after),
      contextJson: JSON.stringify({ route: '/admin/employees', departmentId: args.departmentId }),
    },
  });
}

async function createAndSendPasswordSetup(args: {
  userId: string;
  email: string;
  identifier: string;
}) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  let resetCodeId = '';

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetCode.deleteMany({
      where: { userId: args.userId },
    });

    const created = await tx.passwordResetCode.create({
      data: {
        id: `reset-${args.userId}-${Date.now()}`,
        userId: args.userId,
        codeHash,
        deliveryTarget: args.email,
        expiresAt,
      },
      select: { id: true },
    });
    resetCodeId = created.id;
  });

  try {
    await sendPasswordResetEmail({
      to: args.email,
      code,
      expiryMinutes: 10,
      appOrigin: env.APP_ORIGIN,
      identifier: args.identifier,
      purpose: 'setup',
    });
  } catch (error) {
    await prisma.passwordResetCode.deleteMany({
      where: { id: resetCodeId },
    });
    throw error;
  }

  return { ok: true as const };
}

async function getUserOr404(userId: string, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      accessProfile: true,
    },
  });

  if (!user) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Employee not found.',
      },
    });
    return null;
  }

  return user;
}

export const employeesRouter = Router();

employeesRouter.post('/', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid employee payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const departmentId = parsed.data.departmentId ?? req.viewer!.department.id;
  const normalizedEmail = parsed.data.email?.trim() ? normalizeEmail(parsed.data.email) : null;
  const DEFAULT_PASSWORD = '123456';
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  if (parsed.data.role === 'admin' && req.viewer!.role !== 'super_admin') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can create admin accounts.',
      },
    });
    return;
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!department) {
    res.status(400).json({
      error: {
        code: 'INVALID_DEPARTMENT',
        message: 'Department does not exist.',
      },
    });
    return;
  }

  const [employeeNumberConflict, codeConflict, emailConflict] = await Promise.all([
    prisma.user.findUnique({ where: { employeeNumber: parsed.data.employeeNumber } }),
    prisma.user.findUnique({ where: { code: parsed.data.code.toUpperCase() } }),
    normalizedEmail ? prisma.user.findUnique({ where: { email: normalizedEmail } }) : Promise.resolve(null),
  ]);

  const conflicts = [employeeNumberConflict, codeConflict, emailConflict].filter(
    (user): user is NonNullable<typeof employeeNumberConflict> => Boolean(user),
  );
  const conflictIds = new Set(conflicts.map((user) => user.id));
  const restoreCandidate = conflictIds.size === 1 ? conflicts[0] : null;

  if (restoreCandidate && !restoreCandidate.isActive) {
    if (restoreCandidate.role === 'super_admin') {
      res.status(400).json({
        error: {
          code: 'PROTECTED_SUPER_ADMIN',
          message: 'Cannot remove or demote a super admin account.',
        },
      });
      return;
    }

    if (restoreCandidate.role !== parsed.data.role && req.viewer!.role !== 'super_admin') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only super admins can change user roles.',
        },
      });
      return;
    }

    let restored: UserWithRelations | null = null;

    try {
      restored = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: restoreCandidate.id },
          data: {
            employeeNumber: parsed.data.employeeNumber,
            code: parsed.data.code.toUpperCase(),
            nameEn: parsed.data.name,
            nameAr: parsed.data.name,
            email: normalizedEmail,
            emailVerifiedAt: new Date(),
            phone: parsed.data.phone,
            role: parsed.data.role,
            departmentId,
            positionEn: parsed.data.position,
            positionAr: parsed.data.position,
            isActive: true,
            passwordHash,
          },
        });

        await tx.employeeAccessProfile.upsert({
          where: { userId: restoreCandidate.id },
          update: {
            templateId: AccessTemplateId.standard,
            overridesJson: '{}',
            isActive: true,
            updatedByLabel: req.viewer!.name.en,
          },
          create: {
            userId: restoreCandidate.id,
            templateId: AccessTemplateId.standard,
            overridesJson: '{}',
            isActive: true,
            updatedByLabel: req.viewer!.name.en,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: restoreCandidate.id },
          include: {
            department: true,
            accessProfile: true,
          },
        });
      });
    } catch {
      res.status(409).json({
        error: {
          code: 'EMPLOYEE_RESTORE_FAILED',
          message: 'Unable to restore the employee account.',
        },
      });
      return;
    }

    if (!restored) return;

    await recordAudit({
      actorName: req.viewer!.name.en,
      action: 'update',
      entityId: restored.id,
      entityLabel: restored.nameEn,
      departmentId: restored.departmentId,
      before: {
        employeeNumber: restoreCandidate.employeeNumber,
        code: restoreCandidate.code,
        role: restoreCandidate.role,
        departmentId: restoreCandidate.departmentId,
        active: restoreCandidate.isActive,
      },
      after: {
        employeeNumber: restored.employeeNumber,
        code: restored.code,
        role: restored.role,
        departmentId: restored.departmentId,
        active: restored.isActive,
      },
    });

    res.status(200).json({
      employee: serializeEmployee(restored),
      accessProfile: serializeAccessProfile(restored),
      defaultPassword: DEFAULT_PASSWORD,
      restored: true,
    });
    return;
  }

  if (employeeNumberConflict) {
    res.status(409).json({
      error: {
        code: 'EMPLOYEE_NUMBER_TAKEN',
        message: 'Employee number is already in use.',
      },
    });
    return;
  }

  if (codeConflict) {
    res.status(409).json({
      error: {
        code: 'EMPLOYEE_CODE_TAKEN',
        message: 'Employee code is already in use.',
      },
    });
    return;
  }

  if (emailConflict) {
    res.status(409).json({
      error: {
        code: 'EMAIL_TAKEN',
        message: 'Email address is already in use.',
      },
    });
    return;
  }

  let created: UserWithRelations | null = null;

  try {
    created = await prisma.user.create({
      data: {
        id: `user-${crypto.randomUUID()}`,
        employeeNumber: parsed.data.employeeNumber,
        code: parsed.data.code.toUpperCase(),
        nameEn: parsed.data.name,
        nameAr: parsed.data.name,
        email: normalizedEmail,
        emailVerifiedAt: new Date(),
        phone: parsed.data.phone,
        role: parsed.data.role,
        departmentId,
        positionEn: parsed.data.position,
        positionAr: parsed.data.position,
        isActive: true,
        passwordHash,
        accessProfile: {
          create: {
            templateId: AccessTemplateId.standard,
            overridesJson: '{}',
            isActive: true,
            updatedByLabel: req.viewer!.name.en,
          },
        },
      },
      include: {
        department: true,
        accessProfile: true,
      },
    });
  } catch {
    res.status(500).json({
      error: {
        code: 'EMPLOYEE_CREATE_FAILED',
        message: 'Unable to create the employee account.',
      },
    });
    return;
  }

  await recordAudit({
    actorName: req.viewer!.name.en,
    action: 'create',
    entityId: created.id,
    entityLabel: created.nameEn,
    departmentId: created.departmentId,
    after: {
      employeeNumber: created.employeeNumber,
      role: created.role,
      departmentId: created.departmentId,
    },
  });

  res.status(201).json({
    employee: serializeEmployee(created),
    accessProfile: serializeAccessProfile(created),
    defaultPassword: DEFAULT_PASSWORD,
  });
});

employeesRouter.patch('/:employeeId', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid employee update payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
  const existing = await getUserOr404(employeeId, res);
  if (!existing) return;

  const nextRole = parsed.data.role ?? existing.role;
  const nextActive = parsed.data.active ?? existing.isActive;

  if (parsed.data.role !== undefined && req.viewer!.role !== 'super_admin') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can change user roles.',
      },
    });
    return;
  }

  if (existing.role === 'super_admin' && req.viewer!.role !== 'super_admin') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can change super admin accounts.',
      },
    });
    return;
  }

  if (existing.role === 'super_admin' && (!nextActive || nextRole !== 'super_admin')) {
    res.status(400).json({
      error: {
        code: 'PROTECTED_SUPER_ADMIN',
        message: 'Cannot remove or demote a super admin account.',
      },
    });
    return;
  }

  if (parsed.data.employeeNumber && parsed.data.employeeNumber !== existing.employeeNumber) {
    const conflict = await prisma.user.findUnique({
      where: { employeeNumber: parsed.data.employeeNumber },
    });
    if (conflict) {
      res.status(409).json({
        error: {
          code: 'EMPLOYEE_NUMBER_TAKEN',
          message: 'Employee number is already in use.',
        },
      });
      return;
    }
  }

  if (parsed.data.code && parsed.data.code.toUpperCase() !== existing.code) {
    const conflict = await prisma.user.findUnique({
      where: { code: parsed.data.code.toUpperCase() },
    });
    if (conflict) {
      res.status(409).json({
        error: {
          code: 'EMPLOYEE_CODE_TAKEN',
          message: 'Employee code is already in use.',
        },
      });
      return;
    }
  }

  if (parsed.data.email !== undefined) {
    const normalizedEmail = parsed.data.email ? normalizeEmail(parsed.data.email) : null;
    if (normalizedEmail) {
      const conflict = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: existing.id },
        },
      });
      if (conflict) {
        res.status(409).json({
          error: {
            code: 'EMAIL_TAKEN',
            message: 'Email address is already in use.',
          },
        });
        return;
      }
    }
  }

  if (parsed.data.departmentId && parsed.data.departmentId !== existing.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
    });
    if (!department) {
      res.status(400).json({
        error: {
          code: 'INVALID_DEPARTMENT',
          message: 'Department does not exist.',
        },
      });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      nameEn: parsed.data.name ?? existing.nameEn,
      nameAr: parsed.data.name ?? existing.nameAr,
      employeeNumber: parsed.data.employeeNumber ?? existing.employeeNumber,
      code: parsed.data.code?.toUpperCase() ?? existing.code,
      phone: parsed.data.phone ?? existing.phone,
      email: parsed.data.email === undefined ? existing.email : parsed.data.email ? normalizeEmail(parsed.data.email) : null,
      emailVerifiedAt: parsed.data.email === undefined
        ? existing.emailVerifiedAt
        : parsed.data.email
          ? new Date()
          : null,
      role: nextRole,
      isActive: nextActive,
      departmentId: parsed.data.departmentId ?? existing.departmentId,
      positionEn: parsed.data.position ?? existing.positionEn,
      positionAr: parsed.data.position ?? existing.positionAr,
    },
    include: {
      department: true,
      accessProfile: true,
    },
  });

  await recordAudit({
    actorName: req.viewer!.name.en,
    action: nextActive ? 'update' : 'delete',
    entityId: updated.id,
    entityLabel: updated.nameEn,
    departmentId: updated.departmentId,
    before: {
      employeeNumber: existing.employeeNumber,
      code: existing.code,
      role: existing.role,
      active: existing.isActive,
    },
    after: {
      employeeNumber: updated.employeeNumber,
      code: updated.code,
      role: updated.role,
      active: updated.isActive,
    },
  });

  res.json({
    employee: serializeEmployee(updated),
  });
});

employeesRouter.post('/:employeeId/reset-password', requireRoles('admin', 'super_admin'), async (req, res) => {
  const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
  const existing = await getUserOr404(employeeId, res);
  if (!existing) return;

  if (!existing.email) {
    res.status(409).json({
      error: {
        code: 'NO_EMAIL_ON_FILE',
        message: 'Add an email address before sending a password reset code.',
      },
    });
    return;
  }

  try {
    await createAndSendPasswordSetup({
      userId: existing.id,
      email: existing.email,
      identifier: existing.email,
    });
  } catch (error) {
    const message = error instanceof EmailDeliveryError ? error.message : 'Unable to send the password reset email.';
    res.status(502).json({
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message,
      },
    });
    return;
  }

  await recordAudit({
    actorName: req.viewer!.name.en,
    action: 'update',
    entityId: existing.id,
    entityLabel: existing.nameEn,
    departmentId: existing.departmentId,
    after: {
      passwordResetEmailSent: true,
    },
  });

  res.json({
    ok: true,
    delivery: 'email',
    email: existing.email,
  });
});

employeesRouter.patch('/:employeeId/access', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = updateAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid employee access payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const employeeId = Array.isArray(req.params.employeeId) ? req.params.employeeId[0] : req.params.employeeId;
  const existing = await getUserOr404(employeeId, res);
  if (!existing) return;

  if (existing.role === 'super_admin' && req.viewer!.role !== 'super_admin') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only super admins can change super admin accounts.',
      },
    });
    return;
  }

  if (existing.role === 'super_admin' && !parsed.data.active) {
    res.status(400).json({
      error: {
        code: 'PROTECTED_SUPER_ADMIN',
        message: 'Cannot remove or demote a super admin account.',
      },
    });
    return;
  }

  const normalizedScheduleEmployeeId = parsed.data.scheduleEmployeeId?.trim() || null;
  if (normalizedScheduleEmployeeId && normalizedScheduleEmployeeId !== existing.scheduleEmployeeId) {
    const conflict = await prisma.user.findFirst({
      where: {
        scheduleEmployeeId: normalizedScheduleEmployeeId,
        id: { not: existing.id },
      },
    });
    if (conflict) {
      res.status(409).json({
        error: {
          code: 'ROSTER_LINK_TAKEN',
          message: 'That roster employee is already linked to another account.',
        },
      });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: {
        scheduleEmployeeId: normalizedScheduleEmployeeId,
        isActive: parsed.data.active,
      },
    });

    await tx.employeeAccessProfile.upsert({
      where: { userId: existing.id },
      update: {
        templateId: parsed.data.templateId,
        overridesJson: JSON.stringify(parsed.data.overrides),
        isActive: parsed.data.active,
        updatedByLabel: req.viewer!.name.en,
      },
      create: {
        userId: existing.id,
        templateId: parsed.data.templateId,
        overridesJson: JSON.stringify(parsed.data.overrides),
        isActive: parsed.data.active,
        updatedByLabel: req.viewer!.name.en,
      },
    });

    return tx.user.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        department: true,
        accessProfile: true,
      },
    });
  });

  await recordAudit({
    actorName: req.viewer!.name.en,
    action: 'update',
    entityId: updated.id,
    entityLabel: updated.nameEn,
    departmentId: updated.departmentId,
    before: existing.accessProfile ? {
      templateId: existing.accessProfile.templateId,
      overrides: parseJson<Record<string, boolean>>(existing.accessProfile.overridesJson, {}),
      scheduleEmployeeId: existing.scheduleEmployeeId,
      active: existing.accessProfile.isActive,
    } : undefined,
    after: {
      templateId: updated.accessProfile?.templateId ?? AccessTemplateId.standard,
      overrides: parseJson<Record<string, boolean>>(updated.accessProfile?.overridesJson, {}),
      scheduleEmployeeId: updated.scheduleEmployeeId,
      active: updated.accessProfile?.isActive ?? updated.isActive,
    },
  });

  res.json({
    employee: serializeEmployee(updated),
    accessProfile: serializeAccessProfile(updated),
  });
});
