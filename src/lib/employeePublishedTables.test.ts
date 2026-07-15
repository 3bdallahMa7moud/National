import { describe, expect, it } from 'vitest';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import { projectPublishedOTTable, projectPublishedScheduleMatrix } from './employeePublishedTables';
import type { OTShiftRow } from '@/types/lateSchedule';

describe('employee published table projections', () => {
  it('keeps the Schedule structure while hiding other employees, drafts, archives and audit history', () => {
    const matrix = generateScheduleMatrixMock(2026, 6);
    const sourceUnit = matrix.facilities[0].units[0];
    const sourceRow = sourceUnit.rows[0];
    const firstAssignedDay = Number(Object.keys(sourceRow.cellsByDay).find((day) => sourceRow.cellsByDay[Number(day)].length > 0));
    const employeeId = sourceRow.cellsByDay[firstAssignedDay][0].employeeId;
    sourceRow.cellsByDay[firstAssignedDay].push({ employeeId: 'draft-employee', employeeCode: 'DR', status: 'draft' });
    sourceUnit.rows.push({ ...sourceRow, id: 'archived-row', archived: true });

    const projected = projectPublishedScheduleMatrix(matrix, 'dept-1', employeeId)!;

    expect(projected.auditLog).toEqual([]);
    expect(projected.facilities).toHaveLength(matrix.facilities.length);
    expect(projected.facilities[0].units).toHaveLength(matrix.facilities[0].units.length);
    expect(projected.facilities[0].units[0].rows.some((row) => row.id === 'archived-row')).toBe(false);
    expect(projected.facilities[0].units[0].rows[0].cellsByDay[firstAssignedDay])
      .toEqual(sourceRow.cellsByDay[firstAssignedDay].filter((assignment) => assignment.employeeId === employeeId && assignment.status !== 'draft'));
    expect(projected.legend.every((employee) => employee.employeeId === employeeId)).toBe(true);
  });

  it('keeps OT row order but exposes only the linked employee in My Schedule', () => {
    const rows: OTShiftRow[] = [{
      id: 'row-1', unitId: 'unit-1', title: 'OT', location: 'KAMC', timeRange: '17:00-21:00', hours: 4,
      assignments: { 1: [
        { kind: 'employee', employeeId: 'employee-1' },
        { kind: 'employee', employeeId: 'employee-2' },
        { kind: 'unresolved', legacyCode: 'OLD' },
      ] },
    }];
    const projected = projectPublishedOTTable(rows, [{ id: 'unit-1', name: 'KAMC' }], 'employee-1')!;
    expect(projected.rows[0].assignments[1]).toEqual([{ kind: 'employee', employeeId: 'employee-1' }]);
    expect(projected.units.map((unit) => unit.id)).toEqual(['unit-1']);
  });
});
