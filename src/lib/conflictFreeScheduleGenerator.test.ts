import { describe, expect, it } from 'vitest';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
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
    const source = generateScheduleMatrixMock(2026, 6);
    const result = generateConflictFreeScheduleMonth(source);

    expect(result.assignedCount).toBeGreaterThan(0);
    expect(result.conflictCount).toBe(0);
    expect(countScheduleConflicts(result.data)).toBe(0);
  });

  it('never assigns an employee more than once on the same day', () => {
    const source = generateScheduleMatrixMock(2026, 6);
    const result = generateConflictFreeScheduleMonth(source);
    const usedByDay = new Map<number, Set<string>>();

    forEachAssignment(result.data, (assignment, day) => {
      if (!usedByDay.has(day)) usedByDay.set(day, new Set());
      const usedToday = usedByDay.get(day)!;
      expect(usedToday.has(assignment.employeeId)).toBe(false);
      usedToday.add(assignment.employeeId);
    });
  });

  it('does not assign employees on registered vacation days', () => {
    const source = generateScheduleMatrixMock(2026, 6);
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
    const source = generateScheduleMatrixMock(2026, 6);
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
    const source = generateScheduleMatrixMock(2026, 6);
    source.legend = source.legend.slice(0, 1);
    source.vacations = [];

    const result = generateConflictFreeScheduleMonth(source);

    expect(result.skippedCount).toBeGreaterThan(0);
    expect(result.eligibleCellCount).toBe(result.assignedCount + result.skippedCount);

    const assignmentsPerDay = new Map<number, number>();
    forEachAssignment(result.data, (_assignment, day) => {
      assignmentsPerDay.set(day, (assignmentsPerDay.get(day) ?? 0) + 1);
    });
    expect([...assignmentsPerDay.values()].every((count) => count <= 1)).toBe(true);
  });
});
