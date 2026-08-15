/**
 * Check how many events have DTEND before DTSTART (overnight shift bug).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ScheduleAssignment {
  employeeId?: string;
  status?: string;
}

interface ScheduleRow {
  shiftLabel?: string;
  timeRange: string;
  cellsByDay?: Record<string, ScheduleAssignment[]>;
}

interface ScheduleUnit {
  name: string;
  rows: ScheduleRow[];
}

interface ScheduleFacility {
  name: string;
  units: ScheduleUnit[];
}

interface PublishedScheduleMatrix {
  year: number;
  month: number;
  facilities: ScheduleFacility[];
}

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

async function main() {
  const scheduleMonths = await prisma.scheduleMonth.findMany({
    where: { publishedJson: { not: null } },
    orderBy: { monthKey: 'asc' },
  });

  const userScheduleEmployeeId = 'ot-employee-s';
  let totalEvents = 0;
  let badEvents = 0;

  for (const month of scheduleMonths) {
    const matrix = parseJson<PublishedScheduleMatrix | null>(month.publishedJson, null);
    if (!matrix?.facilities || typeof matrix.year !== 'number' || typeof matrix.month !== 'number') continue;

    for (const facility of matrix.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const [dayText, assignments] of Object.entries(row.cellsByDay ?? {})) {
            const day = Number(dayText);
            if (!Number.isInteger(day)) continue;
            const assignment = assignments.find(
              (item) => item.employeeId === userScheduleEmployeeId && item.status !== 'draft',
            );
            if (!assignment) continue;
            const date = `${matrix.year}-${String(matrix.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { start, end } = parseTimeRange(row.timeRange);
            const startDate = toUtcDate(date, start);
            const endDate = toUtcDate(date, end);
            totalEvents++;
            if (endDate <= startDate) {
              badEvents++;
              console.log(`BAD EVENT: ${row.shiftLabel} at ${facility.name}/${unit.name}, day=${day}`);
              console.log(`  timeRange: ${row.timeRange}`);
              console.log(`  start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);
              console.log(`  DTEND is before DTSTART!`);
            }
          }
        }
      }
    }
  }

  console.log(`\nTotal events: ${totalEvents}`);
  console.log(`Events with DTEND <= DTSTART: ${badEvents}`);
  console.log(`Percentage bad: ${((badEvents / totalEvents) * 100).toFixed(1)}%`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
