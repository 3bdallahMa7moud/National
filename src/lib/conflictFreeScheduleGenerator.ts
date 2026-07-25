import type {
  Assignment,
  LegendEmployee,
  ScheduleMatrixData,
  ShiftRow,
  VacationRange,
  VacationRow,
} from '@/types/scheduleMatrix';
import { recalculateAllConflicts } from '@/lib/validateAssignment';

const GENERATED_VACATION_RANGE_PREFIX = 'generated-vacation';
const GENERATED_VACATION_EMPLOYEE_RATIO = 0.35;
const GENERATED_VACATION_RANGE_LENGTH = 3;

export interface ConflictFreeScheduleGenerationResult {
  data: ScheduleMatrixData;
  assignedCount: number;
  skippedCount: number;
  eligibleCellCount: number;
  vacationDaysGenerated: number;
  vacationEmployeesGenerated: number;
  conflictCount: number;
}

function cloneData(data: ScheduleMatrixData): ScheduleMatrixData {
  return JSON.parse(JSON.stringify(data));
}

function isSaudiWeekend(year: number, month: number, day: number): boolean {
  const dayOfWeek = new Date(year, month, day).getDay();
  return dayOfWeek === 5 || dayOfWeek === 6;
}

function buildVacationIndex(data: ScheduleMatrixData): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();

  for (const vacation of data.vacations) {
    if (!index.has(vacation.employeeId)) index.set(vacation.employeeId, new Set());
    const days = index.get(vacation.employeeId)!;
    vacation.daysOff.forEach((day) => days.add(day));
  }

  return index;
}

function resetRowCells(row: ShiftRow, daysInMonth: number): void {
  const cellsByDay: Record<number, Assignment[]> = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    cellsByDay[day] = [];
  }
  row.cellsByDay = cellsByDay;
}

function daysInRange(startDay: number, endDay: number): number[] {
  const days: number[] = [];
  for (let day = startDay; day <= endDay; day += 1) days.push(day);
  return days;
}

function generatedVacationRangeId(data: ScheduleMatrixData, employeeId: string): string {
  return `${GENERATED_VACATION_RANGE_PREFIX}-${data.year}-${String(data.month + 1).padStart(2, '0')}-${employeeId}`;
}

function isGeneratedVacationRange(range: VacationRange): boolean {
  return range.id.startsWith(`${GENERATED_VACATION_RANGE_PREFIX}-`);
}

function pruneGeneratedVacations(data: ScheduleMatrixData): void {
  data.vacations = data.vacations
    .map((vacation) => {
      const generatedRanges = vacation.ranges?.filter(isGeneratedVacationRange) ?? [];
      if (generatedRanges.length === 0) return vacation;

      const generatedDays = new Set(generatedRanges.flatMap((range) =>
        daysInRange(range.startDay, range.endDay)));
      const remainingRanges = vacation.ranges?.filter((range) => !isGeneratedVacationRange(range)) ?? [];
      const remainingDays = vacation.daysOff.filter((day) => !generatedDays.has(day));

      return {
        ...vacation,
        daysOff: remainingDays,
        ranges: remainingRanges,
      };
    })
    .filter((vacation) => vacation.daysOff.length > 0 || (vacation.ranges?.length ?? 0) > 0);
}

function createVacationRow(employee: LegendEmployee): VacationRow {
  return {
    employeeId: employee.employeeId,
    employeeCode: employee.code,
    fullName: employee.fullName,
    daysOff: [],
    type: 'annual',
    ranges: [],
  };
}

function addGeneratedVacationRange(
  data: ScheduleMatrixData,
  employee: LegendEmployee,
  startDay: number,
  endDay: number,
): number {
  let vacation = data.vacations.find((row) => row.employeeId === employee.employeeId);
  if (!vacation) {
    vacation = createVacationRow(employee);
    data.vacations.push(vacation);
  }

  const range: VacationRange = {
    id: generatedVacationRangeId(data, employee.employeeId),
    employeeId: employee.employeeId,
    startDay,
    endDay,
    type: 'annual',
    status: 'draft',
  };
  const days = new Set(vacation.daysOff);
  daysInRange(startDay, endDay).forEach((day) => days.add(day));

  vacation.employeeCode = employee.code;
  vacation.fullName = employee.fullName;
  vacation.type = 'annual';
  vacation.daysOff = [...days].sort((left, right) => left - right);
  vacation.ranges = [
    ...(vacation.ranges?.filter((existing) => !isGeneratedVacationRange(existing)) ?? []),
    range,
  ];

  return endDay - startDay + 1;
}

function generateMonthlyVacations(
  data: ScheduleMatrixData,
  daysInMonth: number,
): { vacationDaysGenerated: number; vacationEmployeesGenerated: number } {
  pruneGeneratedVacations(data);
  if (data.legend.length === 0) return { vacationDaysGenerated: 0, vacationEmployeesGenerated: 0 };

  const rosterById = new Map(data.legend.map((employee) => [employee.employeeId, employee]));
  const employeesWithVacations = new Set(
    data.vacations
      .filter((vacation) => vacation.daysOff.length > 0)
      .map((vacation) => vacation.employeeId),
  );
  const targetCount = Math.max(1, Math.ceil(data.legend.length * GENERATED_VACATION_EMPLOYEE_RATIO));
  const selectedEmployees: LegendEmployee[] = [];
  const rotationOffset = ((data.year * 12 + data.month) * 7) % data.legend.length;

  for (let offset = 0; offset < data.legend.length && selectedEmployees.length < targetCount; offset += 1) {
    const employee = data.legend[(rotationOffset + offset) % data.legend.length];
    if (!rosterById.has(employee.employeeId) || employeesWithVacations.has(employee.employeeId)) continue;
    selectedEmployees.push(employee);
  }

  const maxStartDay = Math.max(1, daysInMonth - GENERATED_VACATION_RANGE_LENGTH + 1);
  let vacationDaysGenerated = 0;

  selectedEmployees.forEach((employee, index) => {
    const startDay = 1 + ((data.month * 3 + index * 5) % maxStartDay);
    const endDay = Math.min(daysInMonth, startDay + GENERATED_VACATION_RANGE_LENGTH - 1);
    vacationDaysGenerated += addGeneratedVacationRange(data, employee, startDay, endDay);
  });

  return {
    vacationDaysGenerated,
    vacationEmployeesGenerated: selectedEmployees.length,
  };
}

function makeAssignment(employee: LegendEmployee): Assignment {
  return {
    employeeId: employee.employeeId,
    employeeCode: employee.code,
    status: 'draft',
    hasConflict: false,
    conflictReason: undefined,
    conflictType: undefined,
  };
}

function rotatedRank(index: number, seed: number, total: number): number {
  return (index - seed + total) % total;
}

function selectEmployee(
  roster: LegendEmployee[],
  day: number,
  rowIndex: number,
  usedToday: Set<string>,
  vacationIndex: Map<string, Set<number>>,
  workloadByEmployee: Map<string, number>,
): LegendEmployee | null {
  if (roster.length === 0) return null;
  const seed = (day * 7 + rowIndex * 3) % roster.length;

  return roster
    .map((employee, index) => ({ employee, index }))
    .filter(({ employee }) => {
      if (usedToday.has(employee.employeeId)) return false;
      return !vacationIndex.get(employee.employeeId)?.has(day);
    })
    .sort((left, right) => {
      const leftWorkload = workloadByEmployee.get(left.employee.employeeId) ?? 0;
      const rightWorkload = workloadByEmployee.get(right.employee.employeeId) ?? 0;
      if (leftWorkload !== rightWorkload) return leftWorkload - rightWorkload;

      const leftRank = rotatedRank(left.index, seed, roster.length);
      const rightRank = rotatedRank(right.index, seed, roster.length);
      if (leftRank !== rightRank) return leftRank - rightRank;

      return left.employee.code.localeCompare(right.employee.code);
    })[0]?.employee ?? null;
}

export function countScheduleConflicts(data: ScheduleMatrixData): number {
  const seen = new Set<string>();

  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const [day, assignments] of Object.entries(row.cellsByDay)) {
          assignments.forEach((assignment) => {
            if (assignment.hasConflict) {
              seen.add(`${assignment.employeeId}|${day}|${assignment.conflictReason || row.id}`);
            }
          });
        }
      }
    }
  }

  return seen.size;
}

export function generateConflictFreeScheduleMonth(
  source: ScheduleMatrixData,
): ConflictFreeScheduleGenerationResult {
  const data = cloneData(source);
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const roster = [...data.legend];
  const workloadByEmployee = new Map(roster.map((employee) => [employee.employeeId, 0]));
  const generatedVacations = generateMonthlyVacations(data, daysInMonth);
  const vacationIndex = buildVacationIndex(data);
  let assignedCount = 0;
  let skippedCount = 0;
  let eligibleCellCount = 0;

  const rows = data.facilities.flatMap((facility) =>
    facility.units.flatMap((unit) =>
      unit.rows.map((row) => ({
        row,
        isAvailable: !unit.archived && !row.archived,
      })),
    ),
  );

  rows.forEach(({ row }) => resetRowCells(row, daysInMonth));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekend = isSaudiWeekend(data.year, data.month, day);
    const usedToday = new Set<string>();

    rows.forEach(({ row, isAvailable }, rowIndex) => {
      if (!isAvailable) return;
      const eligible = row.weekendOnly ? weekend : !weekend;
      if (!eligible) return;

      eligibleCellCount += 1;
      const employee = selectEmployee(
        roster,
        day,
        rowIndex,
        usedToday,
        vacationIndex,
        workloadByEmployee,
      );

      if (!employee) {
        skippedCount += 1;
        return;
      }

      row.cellsByDay[day] = [makeAssignment(employee)];
      usedToday.add(employee.employeeId);
      workloadByEmployee.set(employee.employeeId, (workloadByEmployee.get(employee.employeeId) ?? 0) + 1);
      assignedCount += 1;
    });
  }

  recalculateAllConflicts(data);

  return {
    data,
    assignedCount,
    skippedCount,
    eligibleCellCount,
    ...generatedVacations,
    conflictCount: countScheduleConflicts(data),
  };
}
