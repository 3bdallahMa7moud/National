import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  scheduleStatePayloadSchema,
  serializeScheduleState,
  syncScheduleState,
} from '../lib/scheduleState.js';
import { syncRouteErrorResponse } from '../lib/syncRouteErrors.js';

export const scheduleRouter = Router();

scheduleRouter.get('/', requireAuth, async (req, res) => {
  const months = await prisma.scheduleMonth.findMany({
    orderBy: { monthKey: 'asc' },
  });
  const fullSchedule = serializeScheduleState(months);
  const schedule = req.viewer!.role === 'employee'
    ? {
      ...fullSchedule,
      draftsByMonth: {},
      versionsByMonth: {},
    }
    : fullSchedule;
  res.json({
    schedule,
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
    const response = syncRouteErrorResponse(error, 'SCHEDULE_SYNC_FAILED', 'Unable to save schedule state.');
    res.status(response.status).json({
      error: {
        code: response.code,
        message: response.message,
      },
    });
  }
});
