import type {
  Assignment,
  LegendEmployee,
  ScheduleMatrixData,
  ShiftRow,
  VacationRange,
  VacationRow,
} from '@/types/scheduleMatrix';
import { isTimeRangeOverlapping, recalculateAllConflicts } from '@/lib/validateAssignment';

const GENERATED_VACATION_RANGE_PREFIX = 'generated-vacation';
const GENERATED_VACATION_EMPLOYEE_RATIO = 0.35;
const GENERATED_VACATION_RANGE_LENGTH = 3;

export interface ConflictFreeScheduleGenerationResult {
  data: ScheduleMatrixData;
  assignedCount: number;
  skippedCount: number;
  eligibleCellCount: number;
  multiStaffCellCount: number;
  vacationDaysGenerated: number;
  vacationEmployeesGenerated: number;
  conflictCount: number;
}

export interface ConflictFreeScheduleGenerationOptions {
  /** Changes row and employee rotation so repeated generation produces a fresh layout. */
  rotationSeed?: number;
  /** The generator may safely place multiple employees in the same shift cell. */
  maxAssignmentsPerCell?: number;
}

interface GenerationRow {
  facilityId: string;
  row: ShiftRow;
  isAvailable: boolean;
}

interface DailyEmployeeAssignment {
  facilityId: string;
  timeRange: string;
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
  return ((index - seed) % total + total) % total;
}

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length <= 1) return items;
  const normalizedOffset = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function interleaveRowsByFacility(
  rows: GenerationRow[],
  day: number,
  rotationSeed: number,
): GenerationRow[] {
  const rowsByFacility = new Map<string, GenerationRow[]>();

  rows.forEach((entry) => {
    const facilityRows = rowsByFacility.get(entry.facilityId) ?? [];
    facilityRows.push(entry);
    rowsByFacility.set(entry.facilityId, facilityRows);
  });

  const facilityIds = rotate(
    [...rowsByFacility.keys()],
    rotationSeed + day,
  );
  const queues = new Map(
    facilityIds.map((facilityId, facilityIndex) => [
      facilityId,
      rotate(
        rowsByFacility.get(facilityId) ?? [],
        rotationSeed + day * 3 + facilityIndex,
      ),
    ]),
  );
  const orderedRows: GenerationRow[] = [];
  let queueIndex = 0;

  while ([...queues.values()].some((queue) => queueIndex < queue.length)) {
    facilityIds.forEach((facilityId) => {
      const row = queues.get(facilityId)?.[queueIndex];
      if (row) orderedRows.push(row);
    });
    queueIndex += 1;
  }

  return orderedRows;
}

function selectEmployee(
  roster: LegendEmployee[],
  day: number,
  rowIndex: number,
  facilityId: string,
  timeRange: string,
  rotationSeed: number,
  employeesInCell: Set<string>,
  dailyAssignmentsByEmployee: Map<string, DailyEmployeeAssignment[]>,
  vacationIndex: Map<string, Set<number>>,
  workloadByEmployee: Map<string, number>,
): LegendEmployee | null {
  if (roster.length === 0) return null;
  const seed = (rotationSeed + day * 7 + rowIndex * 3) % roster.length;

  return roster
    .map((employee, index) => ({ employee, index }))
    .filter(({ employee }) => {
      if (employeesInCell.has(employee.employeeId)) return false;
      if (vacationIndex.get(employee.employeeId)?.has(day)) return false;

      const existingAssignments = dailyAssignmentsByEmployee.get(employee.employeeId) ?? [];
      return existingAssignments.every((assignment) =>
        assignment.facilityId === facilityId
        && !isTimeRangeOverlapping(assignment.timeRange, timeRange));
    })
    .sort((left, right) => {
      const leftAssignedToday = dailyAssignmentsByEmployee.get(left.employee.employeeId)?.length ?? 0;
      const rightAssignedToday = dailyAssignmentsByEmployee.get(right.employee.employeeId)?.length ?? 0;
      if ((leftAssignedToday > 0) !== (rightAssignedToday > 0)) {
        return leftAssignedToday > 0 ? -1 : 1;
      }

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
  options: ConflictFreeScheduleGenerationOptions = {},
): ConflictFreeScheduleGenerationResult {
  const data = cloneData(source);
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const roster = [...data.legend];
  const rotationSeed = Number.isFinite(options.rotationSeed)
    ? Math.trunc(options.rotationSeed ?? 0)
    : 0;
  const maxAssignmentsPerCell = Math.max(1, Math.trunc(options.maxAssignmentsPerCell ?? 2));
  const workloadByEmployee = new Map(roster.map((employee) => [employee.employeeId, 0]));
  const generatedVacations = generateMonthlyVacations(data, daysInMonth);
  const vacationIndex = buildVacationIndex(data);
  let assignedCount = 0;
  let skippedCount = 0;
  let eligibleCellCount = 0;

  const rows: GenerationRow[] = data.facilities.flatMap((facility) =>
    facility.units.flatMap((unit) =>
      unit.rows.map((row) => ({
        facilityId: facility.id,
        row,
        isAvailable: !unit.archived && !row.archived,
      })),
    ),
  );

  rows.forEach(({ row }) => resetRowCells(row, daysInMonth));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekend = isSaudiWeekend(data.year, data.month, day);
    const eligibleRows = interleaveRowsByFacility(
      rows.filter(({ row, isAvailable }) =>
        isAvailable && (row.weekendOnly ? weekend : !weekend)),
      day,
      rotationSeed,
    );
    const dailyAssignmentsByEmployee = new Map<string, DailyEmployeeAssignment[]>();
    eligibleCellCount += eligibleRows.length;

    for (let pass = 0; pass < maxAssignmentsPerCell; pass += 1) {
      // Keep the first coverage pass interleaved so a large facility cannot
      // consume the roster before smaller facilities (such as WHH) are reached.
      const rowsForPass = pass === 0
        ? eligibleRows
        : rotate(eligibleRows, rotationSeed + day + pass * 5);

      rowsForPass.forEach(({ facilityId, row }, rowIndex) => {
        const assignments = row.cellsByDay[day];
        if (assignments.length > pass) return;

        const employee = selectEmployee(
          roster,
          day,
          rowIndex,
          facilityId,
          row.timeRange,
          rotationSeed + pass * 11,
          new Set(assignments.map((assignment) => assignment.employeeId)),
          dailyAssignmentsByEmployee,
          vacationIndex,
          workloadByEmployee,
        );

        if (!employee) {
          if (pass === 0) skippedCount += 1;
          return;
        }

        assignments.push(makeAssignment(employee));
        const employeeAssignments = dailyAssignmentsByEmployee.get(employee.employeeId) ?? [];
        employeeAssignments.push({ facilityId, timeRange: row.timeRange });
        dailyAssignmentsByEmployee.set(employee.employeeId, employeeAssignments);
        workloadByEmployee.set(employee.employeeId, (workloadByEmployee.get(employee.employeeId) ?? 0) + 1);
        assignedCount += 1;
      });
    }
  }

  recalculateAllConflicts(data);
  const multiStaffCellCount = rows.reduce((total, { row }) =>
    total + Object.values(row.cellsByDay).filter((assignments) => assignments.length > 1).length, 0);

  return {
    data,
    assignedCount,
    skippedCount,
    eligibleCellCount,
    multiStaffCellCount,
    ...generatedVacations,
    conflictCount: countScheduleConflicts(data),
  };
}
