import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  overtimeStatePayloadSchema,
  serializeOvertimeState,
  syncOvertimeState,
} from '../lib/scheduleState.js';
import { syncRouteErrorResponse } from '../lib/syncRouteErrors.js';

export const overtimeRouter = Router();

overtimeRouter.get('/', requireAuth, async (req, res) => {
  const months = await prisma.overtimeMonth.findMany({
    orderBy: { monthKey: 'asc' },
  });
  const fullOvertime = serializeOvertimeState(months);
  const overtime = req.viewer!.role === 'employee'
    ? {
      ...fullOvertime,
      rowsByMonth: fullOvertime.publishedRowsByMonth,
      unitsByMonth: fullOvertime.publishedUnitsByMonth,
      versionsByMonth: {},
    }
    : fullOvertime;
  res.json({
    overtime,
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
    const response = syncRouteErrorResponse(error, 'OVERTIME_SYNC_FAILED', 'Unable to save overtime state.');
    res.status(response.status).json({
      error: {
        code: response.code,
        message: response.message,
      },
    });
  }
});
