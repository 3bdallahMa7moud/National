import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  overtimeStatePayloadSchema,
  serializeOvertimeState,
  syncOvertimeState,
} from '../lib/scheduleState.js';

export const overtimeRouter = Router();

overtimeRouter.get('/', requireAuth, async (_req, res) => {
  const months = await prisma.overtimeMonth.findMany({
    orderBy: { monthKey: 'asc' },
  });
  res.json({
    overtime: serializeOvertimeState(months),
  });
});

overtimeRouter.put('/', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = overtimeStatePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid overtime payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  try {
    const overtime = await prisma.$transaction((tx) => syncOvertimeState(tx, req.viewer!, parsed.data));
    res.json({ overtime });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save overtime state.';
    res.status(message.includes('another session') ? 409 : 400).json({
      error: {
        code: message.includes('another session') ? 'CONFLICT' : 'OVERTIME_SYNC_FAILED',
        message,
      },
    });
  }
});
