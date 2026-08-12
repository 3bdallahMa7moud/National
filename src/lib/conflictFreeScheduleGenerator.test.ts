import { describe, expect, it } from 'vitest';
import { createScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import {
  countScheduleConflicts,
  generateConflictFreeScheduleMonth,
} from './conflictFreeScheduleGenerator';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

function forEachAssignment(
  data: ScheduleMatrixData,
  visit: (assignment: { employeeId: string; employeeCode: string }, day: number) => void,
): void {
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const [dayText, assignments] of Object.entries(row.cellsByDay)) {
          assignments.forEach((assignment) => visit(assignment, Number(dayText)));
        }
      }
    }
  }
}

describe('conflict-free schedule generator', () => {
  it('generates a month with zero current app conflicts', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    const result = generateConflictFreeScheduleMonth(source);

    expect(result.assignedCount).toBeGreaterThan(0);
    expect(result.conflictCount).toBe(0);
    expect(countScheduleConflicts(result.data)).toBe(0);
  });

  it('reuses employees only across conflict-free shifts in the same facility', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    const result = generateConflictFreeScheduleMonth(source);
    const occurrencesByEmployeeDay = new Map<string, Array<{
      facilityId: string;
      timeRange: string;
    }>>();

    for (const facility of result.data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const [day, assignments] of Object.entries(row.cellsByDay)) {
            assignments.forEach((assignment) => {
              const key = `${assignment.employeeId}|${day}`;
              const occurrences = occurrencesByEmployeeDay.get(key) ?? [];
              occurrences.push({ facilityId: facility.id, timeRange: row.timeRange });
              occurrencesByEmployeeDay.set(key, occurrences);
            });
          }
        }
      }
    }

    expect([...occurrencesByEmployeeDay.values()].some((occurrences) => occurrences.length > 1)).toBe(true);
    expect(result.conflictCount).toBe(0);
  });

  it('does not assign employees on registered vacation days', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    const result = generateConflictFreeScheduleMonth(source);
    const vacationByEmployee = new Map(source.vacations.map((vacation) => [
      vacation.employeeId,
      new Set(vacation.daysOff),
    ]));

    forEachAssignment(result.data, (assignment, day) => {
      expect(vacationByEmployee.get(assignment.employeeId)?.has(day)).not.toBe(true);
    });
  });

  it('generates vacation rows when the month has no vacation plan yet', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    source.vacations = [];

    const result = generateConflictFreeScheduleMonth(source);
    const generatedVacationDays = new Map(result.data.vacations.map((vacation) => [
      vacation.employeeId,
      new Set(vacation.daysOff),
    ]));

    expect(result.vacationEmployeesGenerated).toBeGreaterThan(0);
    expect(result.vacationDaysGenerated).toBeGreaterThan(0);
    expect(result.data.vacations.length).toBeGreaterThan(0);

    forEachAssignment(result.data, (assignment, day) => {
      expect(generatedVacationDays.get(assignment.employeeId)?.has(day)).not.toBe(true);
    });
  });

  it('leaves eligible cells empty when there are not enough safe employees', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    source.legend = source.legend.slice(0, 1);
    source.vacations = [];

    const result = generateConflictFreeScheduleMonth(source);

    expect(result.skippedCount).toBeGreaterThan(0);
    expect(result.eligibleCellCount).toBeGreaterThan(result.skippedCount);

    const assignmentsPerDay = new Map<number, number>();
    forEachAssignment(result.data, (_assignment, day) => {
      assignmentsPerDay.set(day, (assignmentsPerDay.get(day) ?? 0) + 1);
    });
    expect([...assignmentsPerDay.values()].every((count) => count <= 3)).toBe(true);
  });

  it('covers WHH fairly and supports multiple employees in one cell', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    const result = generateConflictFreeScheduleMonth(source, { rotationSeed: 17 });
    const whh = result.data.facilities.find((facility) => facility.id === 'whh');

    expect(whh).toBeDefined();
    whh!.units.flatMap((unit) => unit.rows).forEach((row) => {
      Object.entries(row.cellsByDay).forEach(([dayText, assignments]) => {
        const day = Number(dayText);
        const dayOfWeek = new Date(result.data.year, result.data.month, day).getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
        if (row.weekendOnly === isWeekend) {
          expect(assignments.length, `${row.id} day ${day}`).toBeGreaterThan(0);
        }
      });
    });
    expect(result.multiStaffCellCount).toBeGreaterThan(0);
    expect(whh!.units.flatMap((unit) => unit.rows)
      .flatMap((row) => Object.values(row.cellsByDay))
      .some((assignments) => assignments.length > 1)).toBe(true);
  });

  it('changes employee placement when a new rotation seed is used', () => {
    const source = createScheduleMatrixFixture(2026, 6);
    const first = generateConflictFreeScheduleMonth(source, { rotationSeed: 101 });
    const second = generateConflictFreeScheduleMonth(source, { rotationSeed: 202 });
    const placementSignature = (data: ScheduleMatrixData) => data.facilities.flatMap((facility) =>
      facility.units.flatMap((unit) =>
        unit.rows.flatMap((row) =>
          Object.entries(row.cellsByDay).map(([day, assignments]) =>
            `${row.id}|${day}|${assignments.map((assignment) => assignment.employeeId).join(',')}`),
        ),
      ),
    ).join(';');

    expect(placementSignature(first.data)).not.toBe(placementSignature(second.data));
  });
});
