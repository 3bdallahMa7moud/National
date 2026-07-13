import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { OfficialEmployee } from '@/data/officialEmployeeRoster';
import { getOfficialEmployeeRoster } from '@/stores/employeeRosterStore';
import {
  createAnalysisPeriod,
  getMonthKeysForPeriod,
  isIsoDateWithinPeriod,
  type AnalysisPeriod,
} from './analysisPeriod';
import { filterActiveScheduleRows } from './scheduleMatrixArchive';

export type EmployeeAnalysisSource = 'schedule' | 'ot' | 'both' | 'none';

export interface EmployeeAnalysisRow {
  employeeId: string;
  code: string;
  fullName: string;
  fullNameEn?: string;
  day: number;
  late: number;
  night: number;
  onCallDay: number;
  onCallNight: number;
  matrixOTShifts: number;
  otScheduleShifts: number;
  otScheduleHours: number;
  vacationDays: number;
  totalScheduledAssignments: number;
  source: EmployeeAnalysisSource;
}

interface AggregateEmployeeAnalysisInput {
  matrix: ScheduleMatrixData;
  otRows: OTShiftRow[];
  roster?: OfficialEmployee[];
}

export interface AggregateEmployeeAnalysisPeriodInput {
  matricesByMonth: Record<string, ScheduleMatrixData>;
  otRowsByMonth: Record<string, OTShiftRow[]>;
  period: AnalysisPeriod;
  roster?: OfficialEmployee[];
}

interface MutableAnalysisRow extends EmployeeAnalysisRow {
  scheduleSourceCount: number;
  otSourceCount: number;
}

function incrementMatrixCategory(row: MutableAnalysisRow, colorKey: ShiftColorKey): void {
  if (colorKey === 'morning') row.day += 1;
  else if (colorKey === 'evening') row.late += 1;
  else if (colorKey === 'night') row.night += 1;
  else if (colorKey === 'onCall') row.onCallDay += 1;
  else if (colorKey === 'onCallNight') row.onCallNight += 1;
  else if (colorKey === 'overtime') row.matrixOTShifts += 1;
}

function resolveSource(scheduleCount: number, otCount: number): EmployeeAnalysisSource {
  if (scheduleCount > 0 && otCount > 0) return 'both';
  if (scheduleCount > 0) return 'schedule';
  if (otCount > 0) return 'ot';
  return 'none';
}

function createAnalysisRows(roster: OfficialEmployee[]): Map<string, MutableAnalysisRow> {
  const rows = new Map<string, MutableAnalysisRow>();

  for (const employee of roster) {
    rows.set(employee.employeeId, {
      employeeId: employee.employeeId,
      code: employee.code,
      fullName: employee.fullName,
      fullNameEn: employee.fullNameEn,
      day: 0,
      late: 0,
      night: 0,
      onCallDay: 0,
      onCallNight: 0,
      matrixOTShifts: 0,
      otScheduleShifts: 0,
      otScheduleHours: 0,
      vacationDays: 0,
      totalScheduledAssignments: 0,
      source: 'none',
      scheduleSourceCount: 0,
      otSourceCount: 0,
    });
  }

  return rows;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function accumulateMatrix(
  rows: Map<string, MutableAnalysisRow>,
  matrix: ScheduleMatrixData,
  period: AnalysisPeriod,
): void {
  for (const facility of matrix.facilities) {
    const settings = matrix.settings.find((entry) => entry.facilityId === facility.id);
    for (const unit of facility.units) {
      const unitDefinition = settings?.units.find((entry) => entry.id === unit.id);
      if (unit.archived || unitDefinition?.archived) continue;
      for (const shift of filterActiveScheduleRows(matrix, facility.id, unit.rows)) {
        for (const [dayText, assignments] of Object.entries(shift.cellsByDay)) {
          const day = Number(dayText);
          if (!isIsoDateWithinPeriod(isoDate(matrix.year, matrix.month, day), period)) continue;
          for (const assignment of assignments) {
            if (assignment.status === 'draft') continue;
            const analysis = rows.get(assignment.employeeId);
            if (!analysis) continue;
            incrementMatrixCategory(analysis, shift.colorKey);
            analysis.scheduleSourceCount += 1;
            analysis.totalScheduledAssignments += 1;
          }
        }
      }
    }
  }

  for (const vacation of matrix.vacations) {
    const analysis = rows.get(vacation.employeeId);
    if (!analysis) continue;
    const publishedVacationDays = vacation.ranges?.length
      ? vacation.ranges
        .filter((range) => range.status === 'published')
        .flatMap((range) => Array.from(
          { length: Math.max(0, range.endDay - range.startDay + 1) },
          (_, index) => range.startDay + index,
        ))
      : vacation.daysOff;
    const daysInPeriod = new Set(publishedVacationDays.filter((day) =>
      isIsoDateWithinPeriod(isoDate(matrix.year, matrix.month, day), period),
    ));
    analysis.vacationDays += daysInPeriod.size;
    analysis.scheduleSourceCount += daysInPeriod.size;
  }
}

function accumulateOT(
  rows: Map<string, MutableAnalysisRow>,
  otRows: OTShiftRow[],
  year: number,
  month: number,
  period: AnalysisPeriod,
): void {
  for (const otRow of otRows) {
    if (otRow.archived) continue;
    for (const [dayText, assignments] of Object.entries(otRow.assignments)) {
      const day = Number(dayText);
      if (!isIsoDateWithinPeriod(isoDate(year, month, day), period)) continue;
      const employeeIds = new Set(
        assignments.flatMap((assignment) => assignment.kind === 'employee' ? [assignment.employeeId] : []),
      );
      for (const employeeId of employeeIds) {
        const analysis = rows.get(employeeId);
        if (!analysis) continue;
        analysis.otScheduleShifts += 1;
        analysis.otScheduleHours += otRow.hours;
        analysis.otSourceCount += 1;
        analysis.totalScheduledAssignments += 1;
      }
    }
  }
}

function finalizeRows(rows: Map<string, MutableAnalysisRow>, roster: OfficialEmployee[]): EmployeeAnalysisRow[] {
  return roster.map((employee) => {
    const analysis = rows.get(employee.employeeId)!;
    const { scheduleSourceCount, otSourceCount, ...result } = analysis;
    return {
      ...result,
      source: resolveSource(scheduleSourceCount, otSourceCount),
    };
  });
}

export function aggregateEmployeeAnalysisForPeriod({
  matricesByMonth,
  otRowsByMonth,
  period,
  roster = getOfficialEmployeeRoster(),
}: AggregateEmployeeAnalysisPeriodInput): EmployeeAnalysisRow[] {
  const rows = createAnalysisRows(roster);

  for (const monthKey of getMonthKeysForPeriod(period)) {
    const matrix = matricesByMonth[monthKey];
    if (matrix) accumulateMatrix(rows, matrix, period);

    const otRows = otRowsByMonth[monthKey];
    if (otRows) {
      const [year, month] = monthKey.split('-').map(Number);
      accumulateOT(rows, otRows, year, month - 1, period);
    }
  }

  return finalizeRows(rows, roster);
}

export function aggregateEmployeeAnalysis({
  matrix,
  otRows,
  roster,
}: AggregateEmployeeAnalysisInput): EmployeeAnalysisRow[] {
  const monthKey = `${matrix.year}-${String(matrix.month + 1).padStart(2, '0')}`;
  const period = createAnalysisPeriod('month', `${monthKey}-01`);

  return aggregateEmployeeAnalysisForPeriod({
    matricesByMonth: { [monthKey]: matrix },
    otRowsByMonth: { [monthKey]: otRows },
    period,
    roster,
  });
}
