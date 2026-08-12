import { describe, it, expect } from 'vitest';
import {
  parseTimeRange,
  isTimeRangeOverlapping,
  recalculateAllConflicts,
  validateAssignment,
  validateAssignmentsForCell,
} from '@/lib/validateAssignment';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

describe('validateAssignment - conflict detection engine', () => {
  it('correctly parses time ranges into minutes', () => {
    expect(parseTimeRange('08:00 - 16:00')).toEqual({ start: 480, end: 960 });
    expect(parseTimeRange('22:00 - 06:00')).toEqual({ start: 1320, end: 1800 });
  });

  it('correctly identifies time range overlaps', () => {
    expect(isTimeRangeOverlapping('08:00 - 16:00', '14:00 - 22:00')).toBe(true);
    expect(isTimeRangeOverlapping('08:00 - 16:00', '16:00 - 24:00')).toBe(false);
    expect(isTimeRangeOverlapping('08:00 - 16:00', '17:00 - 23:00')).toBe(false);
  });

  it('detects cross-facility and vacation conflicts during recalculation', () => {
    const fixtureData: ScheduleMatrixData = {
      departmentId: 'dept-1',
      month: 0,
      year: 2026,
      facilities: [
        {
          id: 'kamc',
          name: 'KAMC',
          accentColorToken: 'facility-kamc',
          units: [
            {
              id: 'unit-1',
              name: 'GE VCT',
              blockType: 'equipmentDay',
              rows: [
                {
                  id: 'row-1',
                  blockType: 'equipmentDay',
                  unitLabel: 'GE VCT',
                  rowLabel: 'Room 1',
                  shiftLabel: 'Morning',
                  timeRange: '08:00 - 16:00',
                  colorKey: 'morning',
                  weekendOnly: false,
                  cellsByDay: {
                    5: [{ employeeId: 'emp-1', employeeCode: 'EMP1' }],
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'kasch',
          name: 'KASCH',
          accentColorToken: 'facility-kasch',
          units: [
            {
              id: 'unit-2',
              name: 'CT Room 2',
              blockType: 'equipmentDay',
              rows: [
                {
                  id: 'row-2',
                  blockType: 'equipmentDay',
                  unitLabel: 'CT Room 2',
                  rowLabel: 'Room 2',
                  shiftLabel: 'Late',
                  timeRange: '14:00 - 22:00',
                  colorKey: 'evening',
                  weekendOnly: false,
                  cellsByDay: {
                    5: [{ employeeId: 'emp-1', employeeCode: 'EMP1' }],
                    10: [{ employeeId: 'emp-2', employeeCode: 'EMP2' }],
                  },
                },
              ],
            },
          ],
        },
      ],
      legend: [
        { employeeId: 'emp-1', code: 'EMP1', fullName: 'Employee One' },
        { employeeId: 'emp-2', code: 'EMP2', fullName: 'Employee Two' },
      ],
      vacations: [
        {
          employeeId: 'emp-2',
          employeeCode: 'EMP2',
          fullName: 'Employee Two',
          daysOff: [10],
        },
      ],
      holidays: [],
      settings: [],
      auditLog: [],
      cellMarkers: {},
    };

    recalculateAllConflicts(fixtureData);

    // emp-1 on day 5 has a cross-facility conflict between KAMC and KASCH
    const emp1KamcAssignment = fixtureData.facilities[0].units[0].rows[0].cellsByDay[5][0];
    const emp1KaschAssignment = fixtureData.facilities[1].units[0].rows[0].cellsByDay[5][0];
    expect(emp1KamcAssignment.hasConflict).toBe(true);
    expect(emp1KamcAssignment.conflictType).toBe('crossFacility');
    expect(emp1KaschAssignment.hasConflict).toBe(true);

    // emp-2 on day 10 has a vacation conflict
    const emp2Assignment = fixtureData.facilities[1].units[0].rows[0].cellsByDay[10][0];
    expect(emp2Assignment.hasConflict).toBe(true);
    expect(emp2Assignment.conflictType).toBe('vacation');
  });

  it('validates a proposed assignment against existing vacation', () => {
    const fixtureData: ScheduleMatrixData = {
      departmentId: 'dept-1',
      month: 0,
      year: 2026,
      facilities: [],
      legend: [],
      vacations: [
        {
          employeeId: 'emp-99',
          employeeCode: 'EMP99',
          fullName: 'Employee 99',
          daysOff: [15],
        },
      ],
      holidays: [],
      settings: [],
      auditLog: [],
      cellMarkers: {},
    };

    const res = validateAssignment(fixtureData, {
      facilityId: 'kamc',
      unitId: 'u1',
      rowId: 'r1',
      day: 15,
      employeeId: 'emp-99',
      timeRange: '08:00 - 16:00',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.conflict.type).toBe('vacation');
    }
  });

  it('blocks an overlapping assignment but ignores the cell being replaced', () => {
    const assignment = { employeeId: 'emp-1', employeeCode: 'EMP1' };
    const fixtureData = {
      departmentId: 'dept-1',
      month: 0,
      year: 2026,
      facilities: [{
        id: 'kamc',
        name: 'KAMC',
        accentColorToken: 'facility-kamc',
        units: [{
          id: 'unit-1',
          name: 'CT',
          blockType: 'equipmentDay' as const,
          rows: [
            {
              id: 'row-1',
              blockType: 'equipmentDay' as const,
              unitLabel: 'CT',
              rowLabel: 'Morning',
              shiftLabel: 'Morning',
              timeRange: '08:00 - 16:00',
              colorKey: 'morning' as const,
              weekendOnly: false,
              cellsByDay: { 5: [assignment] },
            },
            {
              id: 'row-2',
              blockType: 'equipmentDay' as const,
              unitLabel: 'CT',
              rowLabel: 'Late',
              shiftLabel: 'Late',
              timeRange: '14:00 - 22:00',
              colorKey: 'evening' as const,
              weekendOnly: false,
              cellsByDay: { 5: [] },
            },
          ],
        }],
      }],
      legend: [{ employeeId: 'emp-1', code: 'EMP1', fullName: 'Employee One' }],
      vacations: [],
      holidays: [],
      settings: [],
      auditLog: [],
      cellMarkers: {},
    } satisfies ScheduleMatrixData;

    expect(validateAssignment(fixtureData, {
      facilityId: 'kamc',
      unitId: 'unit-1',
      rowId: 'row-1',
      day: 5,
      employeeId: 'emp-1',
      timeRange: '08:00 - 16:00',
    })).toEqual({ ok: true });

    const result = validateAssignment(fixtureData, {
      facilityId: 'kamc',
      unitId: 'unit-1',
      rowId: 'row-2',
      day: 5,
      employeeId: 'emp-1',
      timeRange: '14:00 - 22:00',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict.type).toBe('timeOverlap');
  });

  it('prioritizes a vacation block when another selected employee only has a shift conflict', () => {
    const data: ScheduleMatrixData = {
      departmentId: 'dept-1',
      month: 0,
      year: 2026,
      facilities: [{
        id: 'kamc',
        name: 'KAMC',
        accentColorToken: 'facility-kamc',
        units: [{
          id: 'unit-1',
          name: 'CT',
          blockType: 'equipmentDay',
          rows: [{
            id: 'row-1',
            blockType: 'equipmentDay',
            unitLabel: 'CT',
            rowLabel: 'Morning',
            shiftLabel: 'Morning',
            timeRange: '08:00 - 16:00',
            colorKey: 'morning',
            weekendOnly: false,
            cellsByDay: { 5: [{ employeeId: 'conflict-emp', employeeCode: 'C1' }] },
          }],
        }],
      }],
      legend: [],
      vacations: [{
        employeeId: 'vacation-emp',
        employeeCode: 'V1',
        fullName: 'Vacation Employee',
        daysOff: [5],
      }],
      holidays: [],
      settings: [],
      auditLog: [],
      cellMarkers: {},
    };

    const result = validateAssignmentsForCell(data, {
      facilityId: 'kamc',
      unitId: 'unit-1',
      rowId: 'row-2',
      day: 5,
      timeRange: '09:00 - 17:00',
      assignments: [
        { employeeId: 'conflict-emp', employeeCode: 'C1' },
        { employeeId: 'vacation-emp', employeeCode: 'V1' },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflict.type).toBe('vacation');
  });
});
