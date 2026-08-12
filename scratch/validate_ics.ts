/**
 * Generate and validate ICS output for Ali's feed token.
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

function parseTimeRange(timeRange: string) {
  const [startText, endText] = timeRange.split('-');
  const start = startText?.match(/\d{1,2}:\d{2}/)?.[0] ?? '00:00';
  const end = endText?.match(/\d{1,2}:\d{2}/)?.[0] ?? '23:59';
  return { start, end };
}

function toUtcDate(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function main() {
  // Get Ali's active token
  const token = await prisma.calendarFeedToken.findFirst({
    where: { userId: 'ot-employee-s', revokedAt: null },
    include: { user: true },
  });

  if (!token) {
    console.log('No active token found for Ali');
    return;
  }

  console.log(`User: ${token.user.nameEn}`);
  console.log(`scheduleEmployeeId: ${token.user.scheduleEmployeeId}`);

  const userScheduleEmployeeId = token.user.scheduleEmployeeId!;

  const [scheduleMonths, overtimeMonths] = await Promise.all([
    prisma.scheduleMonth.findMany({
      where: { publishedJson: { not: null } },
      orderBy: { monthKey: 'asc' },
    }),
    prisma.overtimeMonth.findMany({
      orderBy: { monthKey: 'asc' },
    }),
  ]);

  console.log(`Published schedule months: ${scheduleMonths.length}`);
  console.log(`Overtime months: ${overtimeMonths.length}`);

  // Collect schedule events (same logic as calendarSync.ts)
  const events: Array<{ title: string; description: string; start: Date; end: Date }> = [];

  for (const month of scheduleMonths) {
    const matrix = parseJson<{
      year?: number;
      month?: number;
      facilities?: Array<{
        name: string;
        units: Array<{
          name: string;
          rows: Array<{
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
            events.push({
              title: row.shiftLabel,
              description: `${facility.name} / ${unit.name}`,
              start: toUtcDate(date, start),
              end: toUtcDate(date, end),
            });
          }
        }
      }
    }
  }

  // Collect overtime events
  for (const month of overtimeMonths) {
    const rows = parseJson<Array<{
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
        events.push({
          title: row.title,
          description: `OT / ${row.location}`,
          start: toUtcDate(date, start),
          end: toUtcDate(date, end),
        });
      }
    }
  }

  events.sort((left, right) => left.start.getTime() - right.start.getTime());
  console.log(`\nTotal events: ${events.length}`);

  // Generate ICS
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CT Scan Scheduling//EN',
    'CALSCALE:GREGORIAN',
    ...events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${crypto.randomUUID()}`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(event.start)}`,
      `DTEND:${icsDate(event.end)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];

  const icsContent = lines.join('\r\n');
  
  console.log(`\n=== ICS Output (first 50 lines) ===`);
  const outputLines = icsContent.split('\r\n');
  for (let i = 0; i < Math.min(50, outputLines.length); i++) {
    console.log(outputLines[i]);
  }
  console.log(`... total lines: ${outputLines.length}`);

  // Validate ICS structure
  console.log(`\n=== ICS Validation ===`);
  console.log(`Contains BEGIN:VCALENDAR: ${icsContent.includes('BEGIN:VCALENDAR')}`);
  console.log(`Contains END:VCALENDAR: ${icsContent.includes('END:VCALENDAR')}`);
  const veventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;
  console.log(`VEVENT count: ${veventCount}`);
  
  // Check for UID uniqueness
  const uids = outputLines.filter(l => l.startsWith('UID:')).map(l => l.substring(4));
  const uniqueUids = new Set(uids);
  console.log(`UIDs: ${uids.length}, Unique: ${uniqueUids.size}, All unique: ${uids.length === uniqueUids.size}`);

  // Check date format
  const dtstarts = outputLines.filter(l => l.startsWith('DTSTART:'));
  if (dtstarts.length > 0) {
    console.log(`\nSample DTSTART values:`);
    for (const dt of dtstarts.slice(0, 5)) {
      console.log(`  ${dt}`);
      const val = dt.substring(8);
      const valid = /^\d{8}T\d{6}Z$/.test(val);
      console.log(`    Format valid: ${valid}`);
    }
  }

  // Check CRLF
  const hasCRLF = icsContent.includes('\r\n');
  console.log(`\nUses CRLF: ${hasCRLF}`);

  // Check for NaN in dates
  const hasNaN = icsContent.includes('NaN');
  console.log(`Contains NaN: ${hasNaN}`);

  // Check for "Invalid Date"
  const hasInvalidDate = icsContent.includes('Invalid');
  console.log(`Contains "Invalid": ${hasInvalidDate}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
