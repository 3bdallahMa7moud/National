import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseJson } from '../lib/json.js';
import { requireRoles } from '../middleware/auth.js';

const querySchema = z.object({
  module: z.string().trim().optional(),
  action: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const auditRouter = Router();

auditRouter.get('/', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid audit query.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const entries = await prisma.auditEntry.findMany({
    where: {
      ...(parsed.data.module ? { module: parsed.data.module } : {}),
      ...(parsed.data.action ? { action: parsed.data.action } : {}),
      ...(req.viewer!.role === 'admin' ? { contextJson: { contains: req.viewer!.department.id } } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: parsed.data.limit,
  });

  const search = parsed.data.search?.toLowerCase();
  const filtered = search
    ? entries.filter((entry) =>
      [
        entry.actorName,
        entry.action,
        entry.module,
        entry.entityLabel,
        entry.entityId,
      ].some((value) => value.toLowerCase().includes(search)),
    )
    : entries;

  res.json({
    auditEntries: filtered.map((entry) => ({
      id: entry.id,
      actorName: entry.actorName,
      action: entry.action,
      module: entry.module,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      timestamp: entry.timestamp.toISOString(),
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
      context: parseJson<Record<string, unknown>>(entry.contextJson, {}),
    })),
  });
});
