import { collectPublishedOperationalOccurrences, monthKeysInPeriod } from './operationalSchedule';
import type { UnifiedEmployee } from './unifiedEmployeeRoster';
import type { DepartmentScheduleFilters, DepartmentScheduleView, DepartmentShiftGroup, EmployeeScheduleView } from '@/types/employeeScheduleView';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { OperationalOccurrence, OperationalPeriod, OperationalShiftCategory } from '@/types/operationalSchedule';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

const CATEGORY_ORDER: OperationalShiftCategory[] = ['day', 'late', 'night', 'onCallDay', 'onCallNight', 'ot'];

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function datesInPeriod(period: OperationalPeriod): string[] {
  const start = parseDate(period.startDate);
  const end = parseDate(period.endDate);
  if (start > end) return [];
  const result: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) result.push(formatDate(cursor));
  return result;
}

function availability(period: OperationalPeriod, matrices: Record<string, ScheduleMatrixData>, ot: Record<string, OTShiftRow[]>): 'available' | 'partial' | 'missing' {
  const keys = monthKeysInPeriod(period);
  const count = keys.filter((key) => Object.prototype.hasOwnProperty.call(matrices, key) || Object.prototype.hasOwnProperty.call(ot, key)).length;
  if (count === 0) return 'missing';
  return count === keys.length ? 'available' : 'partial';
}

function groupsFor(occurrences: OperationalOccurrence[]): DepartmentShiftGroup[] {
  return CATEGORY_ORDER.flatMap((category) => {
    const matches = occurrences.filter((entry) => entry.category === category);
    return matches.length > 0 ? [{ category, occurrences: matches }] : [];
  });
}

function departmentView(period: OperationalPeriod, status: DepartmentScheduleView['availability'], occurrences: OperationalOccurrence[]): DepartmentScheduleView {
  const dates = datesInPeriod(period);
  return {
    period,
    availability: status,
    occurrences,
    days: dates.map((date) => ({ date, groups: groupsFor(occurrences.filter((entry) => entry.date === date)) })),
    facilities: [...new Set(occurrences.map((entry) => entry.facility))].sort(),
  };
}

export function buildEmployeeScheduleView(
  employeeId: string,
  period: OperationalPeriod,
  matrixMonths: Record<string, ScheduleMatrixData>,
  otMonths: Record<string, OTShiftRow[]>,
  roster: UnifiedEmployee[],
  nowDate: string,
): EmployeeScheduleView {
  const occurrences = collectPublishedOperationalOccurrences(period, matrixMonths, otMonths, roster)
    .filter((entry) => entry.employeeId === employeeId);
  const totals = { day: 0, late: 0, night: 0, onCallDay: 0, onCallNight: 0, ot: 0, otHours: 0 };
  for (const occurrence of occurrences) {
    totals[occurrence.category] += 1;
    if (occurrence.category === 'ot') totals.otHours += occurrence.hours;
  }
  return {
    employeeId,
    period,
    availability: availability(period, matrixMonths, otMonths),
    nextShift: occurrences.find((entry) => entry.date >= nowDate),
    occurrences,
    days: datesInPeriod(period).map((date) => ({ date, occurrences: occurrences.filter((entry) => entry.date === date) })),
    totals,
    notices: occurrences.flatMap((entry) => [
      ...(entry.hasConflict ? [{ id: `conflict:${entry.id}`, date: entry.date, kind: 'conflict' as const, severity: 'warning' as const, label: entry.conflictReason || entry.label }] : []),
      ...(entry.isOnApprovedVacation ? [{ id: `vacation:${entry.id}`, date: entry.date, kind: 'approvedVacation' as const, severity: 'warning' as const, label: entry.label }] : []),
    ]),
  };
}

export function buildDepartmentScheduleView(
  period: OperationalPeriod,
  matrixMonths: Record<string, ScheduleMatrixData>,
  otMonths: Record<string, OTShiftRow[]>,
  roster: UnifiedEmployee[],
): DepartmentScheduleView {
  return departmentView(period, availability(period, matrixMonths, otMonths), collectPublishedOperationalOccurrences(period, matrixMonths, otMonths, roster));
}

export function filterDepartmentScheduleView(view: DepartmentScheduleView, filters: DepartmentScheduleFilters): DepartmentScheduleView {
  const occurrences = view.occurrences.filter((entry) => (filters.facility === 'all' || entry.facility === filters.facility) && (filters.category === 'all' || entry.category === filters.category));
  return departmentView(view.period, view.availability, occurrences);
}
