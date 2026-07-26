import { recalculateAllConflicts } from '@/lib/validateAssignment';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import type {
  Assignment,
  ScheduleMatrixData,
  ScheduleMatrixVersion,
} from '@/types/scheduleMatrix';

export function cloneScheduleMatrix(data: ScheduleMatrixData): ScheduleMatrixData {
  return JSON.parse(JSON.stringify(data));
}

export function clearScheduleContent(
  data: ScheduleMatrixData,
  clearVacations = false,
): number {
  let affected = 0;
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const day of Object.keys(row.cellsByDay)) {
          affected += row.cellsByDay[Number(day)]?.length || 0;
          row.cellsByDay[Number(day)] = [];
        }
      }
    }
  }
  if (clearVacations) data.vacations = [];
  return affected;
}

export function structureOnly(
  data: ScheduleMatrixData,
  year = data.year,
  month = data.month,
): ScheduleMatrixData {
  const copy = cloneScheduleMatrix(data);
  copy.year = year;
  copy.month = month;
  clearScheduleContent(copy, true);
  copy.auditLog = [];
  return copy;
}

export function countMatrixAssignments(data: ScheduleMatrixData): number {
  return data.facilities.reduce((facilityTotal, facility) => facilityTotal + facility.units.reduce(
    (unitTotal, unit) => unitTotal + unit.rows.reduce(
      (rowTotal, row) => rowTotal + Object.values(row.cellsByDay)
        .reduce((cellTotal, assignments) => cellTotal + assignments.length, 0),
      0,
    ),
    0,
  ), 0);
}

export function pasteMatrixIntoMonth(
  source: ScheduleMatrixData,
  year: number,
  month: number,
  normalizeMatrix: (data: ScheduleMatrixData) => void,
): { data: ScheduleMatrixData; omittedAssignments: number } {
  const data = cloneScheduleMatrix(source);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let omittedAssignments = 0;
  data.year = year;
  data.month = month;
  data.auditLog = [];

  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        const cellsByDay: Record<number, Assignment[]> = {};
        for (const [dayText, assignments] of Object.entries(row.cellsByDay)) {
          if (Number(dayText) > daysInMonth) omittedAssignments += assignments.length;
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
          cellsByDay[day] = (row.cellsByDay[day] || []).map((assignment) => ({
            ...assignment,
            status: 'draft',
            hasConflict: false,
            conflictReason: undefined,
            conflictType: undefined,
          }));
        }
        row.cellsByDay = cellsByDay;
      }
    }
  }

  data.vacations = data.vacations.map((vacation) => ({
    ...vacation,
    daysOff: vacation.daysOff.filter((day) => day >= 1 && day <= daysInMonth),
    ranges: vacation.ranges
      ?.filter((range) => range.startDay <= daysInMonth && range.endDay >= 1)
      .map((range) => ({
        ...range,
        startDay: Math.max(1, range.startDay),
        endDay: Math.min(daysInMonth, range.endDay),
        status: 'draft',
      })),
  }));
  data.holidays = data.holidays
    .filter((holiday) => holiday.startDay <= daysInMonth && holiday.endDay >= 1)
    .map((holiday) => ({
      ...holiday,
      startDay: Math.max(1, holiday.startDay),
      endDay: Math.min(daysInMonth, holiday.endDay),
    }));

  normalizeMatrix(data);
  recalculateAllConflicts(data);
  return { data, omittedAssignments };
}

export function deletedMonthShell(
  year: number,
  month: number,
): ScheduleMatrixData {
  const generated = generateScheduleMatrixMock(year, month);
  return {
    ...generated,
    facilities: [],
    settings: [],
    vacations: [],
    holidays: [],
    auditLog: [],
  };
}

export function addMonthVersion(
  versionsByMonth: Record<string, ScheduleMatrixVersion[]>,
  key: string,
  data: ScheduleMatrixData,
  actorName: string | undefined,
  reason: ScheduleMatrixVersion['reason'],
): Record<string, ScheduleMatrixVersion[]> {
  const version: ScheduleMatrixVersion = {
    id: `schedule-version-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    actorName: actorName?.trim() || 'Administrator',
    reason,
    data: cloneScheduleMatrix(data),
  };
  return {
    ...versionsByMonth,
    [key]: [version, ...(versionsByMonth[key] || [])].slice(0, 5),
  };
}

export function matrixMonthKey(
  data: Pick<ScheduleMatrixData, 'year' | 'month'>,
): string {
  return `${data.year}-${String(data.month + 1).padStart(2, '0')}`;
}
