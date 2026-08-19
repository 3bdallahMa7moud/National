import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { createAuditEntry } from '../lib/audit.js';
import { hasEmployeePermission } from '../lib/employeeAccess.js';
import { requireAuth } from '../middleware/auth.js';
import { parseJson } from '../lib/json.js';

function buildFeedUrl(token: string) {
  return new URL(`/api/calendar-sync/feed/${token}.ics`, env.APP_ORIGIN).toString();
}

function parseTimeRange(timeRange: string) {
  const [startText, endText] = timeRange.split('-');
  const start = startText?.match(/\d{1,2}:\d{2}/)?.[0] ?? '00:00';
  const end = endText?.match(/\d{1,2}:\d{2}/)?.[0] ?? '23:59';
  return { start, end };
}

function parseShiftDateTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
}

function icsUtcDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function icsLocalDateTime(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}`;
}

async function ensureActiveToken(userId: string) {
  const existing = await prisma.calendarFeedToken.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  return prisma.calendarFeedToken.create({
    data: {
      id: `calendar-${crypto.randomUUID()}`,
      userId,
      token: crypto.randomBytes(32).toString('hex'),
      label: 'Primary feed',
    },
  });
}

function ensureCalendarSyncAccess(viewer: NonNullable<Express.Request['viewer']>) {
  if (viewer.role === 'admin' || viewer.role === 'super_admin') return true;
  return hasEmployeePermission({
    role: viewer.role,
    access: viewer.access ? {
      templateId: viewer.access.templateId,
      overrides: viewer.access.overrides,
      active: viewer.access.active,
    } : null,
  }, 'schedule.calendar.sync');
}

interface CalendarFeedEvent {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
}

function collectScheduleEvents(userScheduleEmployeeId: string, months: Array<{ publishedJson: string | null }>): CalendarFeedEvent[] {
  const events: CalendarFeedEvent[] = [];

  for (const month of months) {
    const matrix = parseJson<{
      year?: number;
      month?: number;
      facilities?: Array<{
        name: string;
        units: Array<{
          name: string;
          rows: Array<{
            id?: string;
            shiftLabel: string;
            timeRange: string;
            cellsByDay: Record<string, Array<{ employeeId: string; status?: string }>>;
          }>;
        }>;
      }>;
    } | null>(month.publishedJson, null);
    if (!matrix?.facilities || typeof matrix.year !== 'number' || typeof matrix.month !== 'number') continue;

    for (const facility of matrix.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const [dayText, assignments] of Object.entries(row.cellsByDay ?? {})) {
            const day = Number(dayText);
            if (!Number.isInteger(day)) continue;
            const assignment = assignments.find((item) => item.employeeId === userScheduleEmployeeId && item.status !== 'draft');
            if (!assignment) continue;
            const date = `${matrix.year}-${String(matrix.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { start, end } = parseTimeRange(row.timeRange);
            const startDate = parseShiftDateTime(date, start);
            let endDate = parseShiftDateTime(date, end);
            if (endDate.getTime() <= startDate.getTime()) {
              endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
            }
            const rowKey = row.id || `${facility.name}-${unit.name}-${row.shiftLabel}`;
            events.push({
              id: `schedule-${userScheduleEmployeeId}-${matrix.year}-${matrix.month}-${day}-${rowKey}`,
              title: row.shiftLabel,
              description: `${facility.name} / ${unit.name}`,
              start: startDate,
              end: endDate,
            });
          }
        }
      }
    }
  }

  return events;
}

function collectOvertimeEvents(userScheduleEmployeeId: string, months: Array<{ monthKey: string; publishedRowsJson: string }>): CalendarFeedEvent[] {
  const events: CalendarFeedEvent[] = [];

  for (const month of months) {
    const rows = parseJson<Array<{
      id?: string;
      title: string;
      location: string;
      timeRange: string;
      assignments: Record<string, Array<{ kind: string; employeeId?: string }>>;
    }>>(month.publishedRowsJson, []);

    const [yearText, monthText] = month.monthKey.split('-');
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) continue;

    for (const row of rows) {
      for (const [dayText, assignments] of Object.entries(row.assignments ?? {})) {
        const assignment = assignments.find((item) => item.kind === 'employee' && item.employeeId === userScheduleEmployeeId);
        if (!assignment) continue;
        const date = `${year}-${String(monthNumber).padStart(2, '0')}-${String(Number(dayText)).padStart(2, '0')}`;
        const { start, end } = parseTimeRange(row.timeRange);
        const startDate = parseShiftDateTime(date, start);
        let endDate = parseShiftDateTime(date, end);
        if (endDate.getTime() <= startDate.getTime()) {
          endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
        }
        const rowKey = row.id || `${row.title}-${row.location}`;
        events.push({
          id: `ot-${userScheduleEmployeeId}-${year}-${monthNumber}-${dayText}-${rowKey}`,
          title: row.title,
          description: `OT / ${row.location}`,
          start: startDate,
          end: endDate,
        });
      }
    }
  }

  return events;
}

export const calendarSyncRouter = Router();

calendarSyncRouter.get('/', requireAuth, async (req, res) => {
  if (!ensureCalendarSyncAccess(req.viewer!)) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Calendar sync is not enabled for this account.',
      },
    });
    return;
  }
  const token = await ensureActiveToken(req.viewer!.id);
  res.json({
    feedUrl: buildFeedUrl(token.token),
    token: token.token,
  });
});

calendarSyncRouter.post('/rotate', requireAuth, async (req, res) => {
  if (!ensureCalendarSyncAccess(req.viewer!)) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Calendar sync is not enabled for this account.',
      },
    });
    return;
  }
  const token = await prisma.$transaction(async (tx) => {
    await tx.calendarFeedToken.updateMany({
      where: { userId: req.viewer!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const created = await tx.calendarFeedToken.create({
      data: {
        id: `calendar-${crypto.randomUUID()}`,
        userId: req.viewer!.id,
        token: crypto.randomBytes(32).toString('hex'),
        label: 'Rotated feed',
      },
    });

    await createAuditEntry(tx, {
      actorUserId: req.viewer!.id,
      actorName: req.viewer!.name.en,
      action: 'update',
      module: 'calendar_sync',
      entityId: created.id,
      entityLabel: 'Calendar feed token',
      after: { rotated: true },
      context: { route: '/calendar-sync' },
    });

    return created;
  });

  res.json({
    feedUrl: buildFeedUrl(token.token),
    token: token.token,
  });
});

calendarSyncRouter.get('/feed/:token.ics', async (req, res) => {
  const token = await prisma.calendarFeedToken.findFirst({
    where: {
      token: req.params.token,
      revokedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!token) {
    res.status(404).send('Calendar feed not found.');
    return;
  }

  let events: CalendarFeedEvent[] = [];

  if (token.user.scheduleEmployeeId) {
    const [scheduleMonths, overtimeMonths] = await Promise.all([
      prisma.scheduleMonth.findMany({
        where: { publishedJson: { not: null } },
        orderBy: { monthKey: 'asc' },
      }),
      prisma.overtimeMonth.findMany({
        orderBy: { monthKey: 'asc' },
      }),
    ]);

    events = [
      ...collectScheduleEvents(token.user.scheduleEmployeeId, scheduleMonths),
      ...collectOvertimeEvents(token.user.scheduleEmployeeId, overtimeMonths),
    ].sort((left, right) => left.start.getTime() - right.start.getTime());
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CT Scan Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Riyadh',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${crypto.createHash('sha256').update(event.id).digest('hex')}@ct-scan-scheduling`,
      `DTSTAMP:${icsUtcDate(new Date())}`,
      `DTSTART;TZID=Asia/Riyadh:${icsLocalDateTime(event.start)}`,
      `DTEND;TZID=Asia/Riyadh:${icsLocalDateTime(event.end)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];

  await prisma.calendarFeedToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  res.type('text/calendar').send(lines.join('\r\n'));
});
