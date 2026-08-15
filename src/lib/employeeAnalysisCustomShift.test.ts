import { describe, expect, it } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/test/fixtures/officialEmployeeRoster';
import { createScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import { aggregateEmployeeAnalysis } from './employeeAnalysis';

describe('employeeAnalysis custom shift classification', () => {
  it('counts custom on-call abbreviations as on-call instead of day shifts', () => {
    const matrix = createScheduleMatrixFixture(2026, 7);
    const employee = OFFICIAL_EMPLOYEE_ROSTER[0];

    for (const facility of matrix.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          row.cellsByDay = Object.fromEntries(
            Object.keys(row.cellsByDay).map((day) => [Number(day), []]),
          );
        }
      }
    }

    const row = matrix.facilities[0].units[0].rows[0];

    row.colorKey = 'morning';
    row.shiftLabel = 'Call DSY';
    row.rowLabel = 'On Cal';
    row.shiftDefinitionId = 'custom-oncall-day';
    row.cellsByDay[1] = [{
      employeeId: employee.employeeId,
      employeeCode: employee.code,
      status: 'published',
    }];

    const [analysis] = aggregateEmployeeAnalysis({
      matrix,
      otRows: [],
      roster: [employee],
    });

    expect(analysis.day).toBe(0);
    expect(analysis.onCallDay).toBe(1);
    expect(analysis.totalScheduledAssignments).toBe(1);
  });
});
