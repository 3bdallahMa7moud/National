import { describe, it, expect } from 'vitest';
import {
  parseTimeRange,
  isTimeRangeOverlapping,
  recalculateAllConflicts,
  validateAssignment,
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
    const mockData: ScheduleMatrixData = {
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
    };

    recalculateAllConflicts(mockData);

    // emp-1 on day 5 has a cross-facility conflict between KAMC and KASCH
    const emp1KamcAssignment = mockData.facilities[0].units[0].rows[0].cellsByDay[5][0];
    const emp1KaschAssignment = mockData.facilities[1].units[0].rows[0].cellsByDay[5][0];
    expect(emp1KamcAssignment.hasConflict).toBe(true);
    expect(emp1KamcAssignment.conflictType).toBe('crossFacility');
    expect(emp1KaschAssignment.hasConflict).toBe(true);

    // emp-2 on day 10 has a vacation conflict
    const emp2Assignment = mockData.facilities[1].units[0].rows[0].cellsByDay[10][0];
    expect(emp2Assignment.hasConflict).toBe(true);
    expect(emp2Assignment.conflictType).toBe('vacation');
  });

  it('validates a proposed assignment against existing vacation', () => {
    const mockData: ScheduleMatrixData = {
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
    };

    const res = validateAssignment(mockData, {
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
});
