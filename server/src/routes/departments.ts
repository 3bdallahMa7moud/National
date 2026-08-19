import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createAuditEntry } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const departmentInputSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required.'),
  description: z.string().trim().optional().default(''),
  managerId: z.string().trim().min(1).nullable().optional(),
});

function serializeDepartment(department: {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  managerId: string | null;
}) {
  return {
    id: department.id,
    name: {
      en: department.nameEn,
      ar: department.nameAr,
    },
    description: {
      en: department.descriptionEn,
      ar: department.descriptionAr,
    },
    managerId: department.managerId ?? undefined,
  };
}

export const departmentsRouter = Router();

async function resolveManagerId(managerId: string | null | undefined) {
  if (!managerId) {
    return null;
  }

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true },
  });

  return manager?.id ?? null;
}

departmentsRouter.get('/', requireAuth, async (_req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    departments: departments.map(serializeDepartment),
  });
});

departmentsRouter.post('/', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = departmentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid department payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const managerId = await resolveManagerId(parsed.data.managerId);
  if (parsed.data.managerId && !managerId) {
    res.status(400).json({
      error: {
        code: 'INVALID_MANAGER',
        message: 'Selected department manager was not found.',
      },
    });
    return;
  }

  const department = await prisma.department.create({
    data: {
      id: `dept-${crypto.randomUUID()}`,
      nameEn: parsed.data.name,
      nameAr: parsed.data.name,
      descriptionEn: parsed.data.description,
      descriptionAr: parsed.data.description,
      managerId,
    },
  });

  await createAuditEntry(prisma, {
    actorUserId: req.viewer!.id,
    actorName: req.viewer!.name.en,
    action: 'create',
    module: 'departments',
    entityId: department.id,
    entityLabel: department.nameEn,
    after: {
      managerId: department.managerId,
    },
    context: { route: '/admin/departments', departmentId: department.id },
  });

  res.status(201).json({
    department: serializeDepartment(department),
  });
});

departmentsRouter.patch('/:departmentId', requireRoles('admin', 'super_admin'), async (req, res) => {
  const departmentId = Array.isArray(req.params.departmentId)
    ? req.params.departmentId[0]
    : req.params.departmentId;
  const parsed = departmentInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid department payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const existing = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!existing) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Department not found.',
      },
    });
    return;
  }

  const managerId = await resolveManagerId(parsed.data.managerId);
  if (parsed.data.managerId && !managerId) {
    res.status(400).json({
      error: {
        code: 'INVALID_MANAGER',
        message: 'Selected department manager was not found.',
      },
    });
    return;
  }

  const department = await prisma.department.update({
    where: { id: existing.id },
    data: {
      nameEn: parsed.data.name,
      nameAr: parsed.data.name,
      descriptionEn: parsed.data.description,
      descriptionAr: parsed.data.description,
      managerId,
    },
  });

  await createAuditEntry(prisma, {
    actorUserId: req.viewer!.id,
    actorName: req.viewer!.name.en,
    action: 'update',
    module: 'departments',
    entityId: department.id,
    entityLabel: department.nameEn,
    before: {
      name: existing.nameEn,
      description: existing.descriptionEn,
      managerId: existing.managerId,
    },
    after: {
      name: department.nameEn,
      description: department.descriptionEn,
      managerId: department.managerId,
    },
    context: { route: '/admin/departments', departmentId: department.id },
  });

  res.json({
    department: serializeDepartment(department),
  });
});

departmentsRouter.delete('/:departmentId', requireRoles('admin', 'super_admin'), async (req, res) => {
  const departmentId = Array.isArray(req.params.departmentId)
    ? req.params.departmentId[0]
    : req.params.departmentId;

  const existing = await prisma.department.findUnique({
    where: { id: departmentId },
    include: { _count: { select: { users: true } } },
  });

  if (!existing) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Department not found.',
      },
    });
    return;
  }

  const activeUsersCount = await prisma.user.count({
    where: { departmentId, isActive: true },
  });

  if (activeUsersCount > 0) {
    res.status(409).json({
      error: {
        code: 'DEPARTMENT_HAS_EMPLOYEES',
        message: 'Cannot delete a department that still has employees assigned to it.',
      },
    });
    return;
  }

  const fallbackDepartment = await prisma.department.findFirst({
    where: { id: { not: departmentId } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (fallbackDepartment) {
      await tx.user.updateMany({
        where: { departmentId, isActive: false },
        data: { departmentId: fallbackDepartment.id },
      });
    }
    await tx.department.delete({ where: { id: departmentId } });
  });

  await createAuditEntry(prisma, {
    actorUserId: req.viewer!.id,
    actorName: req.viewer!.name.en,
    action: 'delete',
    module: 'departments',
    entityId: existing.id,
    entityLabel: existing.nameEn,
    before: {
      name: existing.nameEn,
      description: existing.descriptionEn,
      managerId: existing.managerId,
    },
    context: { route: '/admin/departments', departmentId: existing.id },
  });

  res.status(204).end();
});
