import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createAuditEntry } from '../lib/audit.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const departmentInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).default(''),
  managerId: z.string().min(1).nullable().optional(),
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

  const department = await prisma.department.create({
    data: {
      id: `dept-${crypto.randomUUID()}`,
      nameEn: parsed.data.name,
      nameAr: parsed.data.name,
      descriptionEn: parsed.data.description,
      descriptionAr: parsed.data.description,
      managerId: parsed.data.managerId ?? null,
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
    context: { route: '/admin/departments' },
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

  const department = await prisma.department.update({
    where: { id: existing.id },
    data: {
      nameEn: parsed.data.name,
      nameAr: parsed.data.name,
      descriptionEn: parsed.data.description,
      descriptionAr: parsed.data.description,
      managerId: parsed.data.managerId ?? null,
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
    context: { route: '/admin/departments' },
  });

  res.json({
    department: serializeDepartment(department),
  });
});
