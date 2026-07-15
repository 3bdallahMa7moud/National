import { describe, expect, it } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import type { OTShiftRow } from '@/types/lateSchedule';
import { occurrenceShiftStyle } from './occurrenceShiftStyle';
import { collectPublishedOperationalOccurrences } from './operationalSchedule';

describe('operational occurrence colors', () => {
  it('preserves custom Schedule and OT colors while building occurrences', () => {
    const matrix = generateScheduleMatrixMock(2026, 6);
    const scheduleEmployee = OFFICIAL_EMPLOYEE_ROSTER[0];
    const scheduleRow = matrix.facilities[0].units[0].rows[0];
    scheduleRow.backgroundColor = '#6D28D9';
    scheduleRow.textColor = '#FEF3C7';
    scheduleRow.cellsByDay[1] = [{
      employeeId: scheduleEmployee.employeeId,
      employeeCode: scheduleEmployee.code,
      status: 'published',
    }];

    const otRow: OTShiftRow = {
      id: 'ot-colored-row',
      title: 'Colored OT',
      location: 'KAMC',
      timeRange: '17:00 - 21:00',
      hours: 4,
      backgroundColor: '#134E4A',
      textColor: '#CCFBF1',
      assignments: {
        1: [{ kind: 'employee', employeeId: scheduleEmployee.employeeId }],
      },
    };

    const occurrences = collectPublishedOperationalOccurrences(
      { startDate: '2026-07-01', endDate: '2026-07-01' },
      { '2026-07': matrix },
      { '2026-07': [otRow] },
      OFFICIAL_EMPLOYEE_ROSTER,
    );

    expect(occurrences.find((entry) => entry.rowId === scheduleRow.id)).toMatchObject({
      colorKey: scheduleRow.colorKey,
      backgroundColor: '#6D28D9',
      textColor: '#FEF3C7',
    });
    expect(occurrences.find((entry) => entry.rowId === otRow.id)).toMatchObject({
      colorKey: 'overtime',
      backgroundColor: '#134E4A',
      textColor: '#CCFBF1',
    });
  });

  it('resolves custom colors and keeps the shared palette as the fallback', () => {
    expect(occurrenceShiftStyle({
      colorKey: 'night',
      backgroundColor: '#111827',
      textColor: '#F9FAFB',
    })).toEqual({
      backgroundColor: '#111827',
      color: '#F9FAFB',
      borderColor: '#111827',
    });

    expect(occurrenceShiftStyle({ colorKey: 'night' })).toEqual({
      backgroundColor: 'var(--chip-night-bg)',
      color: 'var(--chip-night-text)',
      borderColor: 'var(--chip-night-border)',
    });
  });
});
