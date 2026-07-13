import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import type { OTShiftRow } from '@/types/lateSchedule';
import type {
  OperationalOccurrence,
  OperationalPeriod,
  OperationalShiftCategory,
} from '@/types/operationalSchedule';
import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';

const CATEGORY_ORDER: Record<OperationalShiftCategory, number> = {
  day: 0,
  late: 1,
  night: 2,
  onCallDay: 3,
  onCallNight: 4,
  ot: 5,
};

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid local date: ${value}`);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1])
    || date.getMonth() !== Number(match[2]) - 1
    || date.getDate() !== Number(match[3])
  ) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return date;
}

function formatLocalDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function categoryFromColor(colorKey: ShiftColorKey): OperationalShiftCategory | null {
  switch (colorKey) {
    case 'morning': return 'day';
    case 'evening': return 'late';
    case 'night': return 'night';
    case 'onCall': return 'onCallDay';
    case 'onCallNight': return 'onCallNight';
    case 'overtime': return 'ot';
    case 'vacation': return null;
  }
}

function hoursFromRange(timeRange: string): number {
  const times = timeRange.match(/\b\d{1,2}:\d{2}\b/g);
  if (!times || times.length < 2) return 0;
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  };
  const start = toMinutes(times[0]);
  let end = toMinutes(times[1]);
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

function compareOccurrences(left: OperationalOccurrence, right: OperationalOccurrence): number {
  return left.date.localeCompare(right.date)
    || CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category]
    || left.facility.localeCompare(right.facility)
    || left.unit.localeCompare(right.unit)
    || left.rowId.localeCompare(right.rowId)
    || left.employeeCode.localeCompare(right.employeeCode);
}

export function monthKeysInPeriod(period: OperationalPeriod): string[] {
  const start = parseLocalDate(period.startDate);
  const end = parseLocalDate(period.endDate);
  if (start > end) return [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const keys: string[] = [];
  while (cursor <= last) {
    keys.push(monthKey(cursor.getFullYear(), cursor.getMonth()));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export function collectPublishedOperationalOccurrences(
  period: OperationalPeriod,
  matricesByMonth: Record<string, ScheduleMatrixData>,
  otRowsByMonth: Record<string, OTShiftRow[]>,
  roster: UnifiedEmployee[],
): OperationalOccurrence[] {
  const start = period.startDate;
  const end = period.endDate;
  if (parseLocalDate(start) > parseLocalDate(end)) return [];
  const employeeById = new Map(roster.map((employee) => [employee.employeeId, employee]));
  const occurrences: OperationalOccurrence[] = [];

  for (const key of monthKeysInPeriod(period)) {
    const matrix = matricesByMonth[key];
    if (matrix) {
      const vacationDaysByEmployee = new Map<string, Set<number>>();
      for (const vacation of matrix.vacations) {
        vacationDaysByEmployee.set(vacation.employeeId, new Set(vacation.daysOff));
      }

      for (const facility of matrix.facilities) {
        for (const unit of facility.units) {
          if (unit.archived || unit.blockType === 'vacation') continue;
          const rows = filterActiveScheduleRows(matrix, facility.id, unit.rows);
          for (const row of rows) {
            if (row.blockType === 'vacation') continue;
            const category = categoryFromColor(row.colorKey);
            if (!category) continue;
            for (const [dayText, assignments] of Object.entries(row.cellsByDay)) {
              const day = Number(dayText);
              const date = formatLocalDate(matrix.year, matrix.month, day);
              if (date < start || date > end) continue;
              for (const assignment of assignments) {
                if (assignment.status === 'draft') continue;
                const currentEmployee = employeeById.get(assignment.employeeId);
                occurrences.push({
                  id: `schedule:${date}:${row.id}:${assignment.employeeId}`,
                  date,
                  source: 'schedule',
                  employeeId: assignment.employeeId,
                  employeeCode: currentEmployee?.code ?? assignment.employeeCode,
                  employeeName: currentEmployee?.fullNameEn || currentEmployee?.fullName,
                  unresolvedEmployee: false,
                  category,
                  label: row.shiftLabel,
                  facility: facility.name,
                  unit: unit.name || row.unitLabel,
                  timeRange: row.timeRange,
                  hours: hoursFromRange(row.timeRange),
                  rowId: row.id,
                  hasConflict: assignment.hasConflict === true,
                  conflictReason: assignment.conflictReason,
                  isOnApprovedVacation: vacationDaysByEmployee.get(assignment.employeeId)?.has(day) === true,
                });
              }
            }
          }
        }
      }
    }

    const [yearText, monthText] = key.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    for (const row of otRowsByMonth[key] ?? []) {
      if (row.archived) continue;
      for (const [dayText, assignments] of Object.entries(row.assignments)) {
        const day = Number(dayText);
        const date = formatLocalDate(year, monthIndex, day);
        if (date < start || date > end) continue;
        for (const assignment of assignments) {
          if (assignment.kind === 'unresolved') {
            occurrences.push({
              id: `ot:${date}:${row.id}:unresolved:${assignment.legacyCode}`,
              date,
              source: 'ot',
              employeeId: undefined,
              employeeCode: assignment.legacyCode,
              employeeName: undefined,
              unresolvedEmployee: true,
              category: 'ot',
              label: row.title,
              facility: row.location,
              unit: row.title,
              timeRange: row.timeRange,
              hours: row.hours,
              rowId: row.id,
              hasConflict: false,
              isOnApprovedVacation: false,
            });
            continue;
          }
          const currentEmployee = employeeById.get(assignment.employeeId);
          occurrences.push({
            id: `ot:${date}:${row.id}:${assignment.employeeId}`,
            date,
            source: 'ot',
            employeeId: assignment.employeeId,
            employeeCode: currentEmployee?.code ?? assignment.employeeId,
            employeeName: currentEmployee?.fullNameEn || currentEmployee?.fullName,
            unresolvedEmployee: !currentEmployee,
            category: 'ot',
            label: row.title,
            facility: row.location,
            unit: row.title,
            timeRange: row.timeRange,
            hours: row.hours,
            rowId: row.id,
            hasConflict: false,
            isOnApprovedVacation: false,
          });
        }
      }
    }
  }

  return occurrences.sort(compareOccurrences);
}
