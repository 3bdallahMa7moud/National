import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  scheduleStatePayloadSchema,
  serializeScheduleState,
  syncScheduleState,
} from '../lib/scheduleState.js';

export const scheduleRouter = Router();

scheduleRouter.get('/', requireAuth, async (_req, res) => {
  const months = await prisma.scheduleMonth.findMany({
    orderBy: { monthKey: 'asc' },
  });
  res.json({
    schedule: serializeScheduleState(months),
  });
});

scheduleRouter.put('/', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = scheduleStatePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid schedule payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  try {
    const schedule = await prisma.$transaction((tx) => syncScheduleState(tx, req.viewer!, parsed.data));
    res.json({ schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save schedule state.';
    res.status(message.includes('another session') ? 409 : 400).json({
      error: {
        code: message.includes('another session') ? 'CONFLICT' : 'SCHEDULE_SYNC_FAILED',
        message,
      },
    });
  }
});
