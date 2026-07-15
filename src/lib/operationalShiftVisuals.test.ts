import { describe, expect, it } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import type { OTShiftRow } from '@/types/lateSchedule';
import { buildOperationalSnapshot } from './operationalSnapshot';
import { operationalShiftGradient } from './occurrenceShiftStyle';
import { collectPublishedShiftVisualsForPeriod } from './operationalShiftVisuals';

function coloredFixtures() {
  const matrix = generateScheduleMatrixMock(2026, 6);
  const employee = OFFICIAL_EMPLOYEE_ROSTER[0];
  const scheduleRow = matrix.facilities[0].units[0].rows[0];
  scheduleRow.backgroundColor = '#6D28D9';
  scheduleRow.textColor = '#FFFFFF';
  scheduleRow.cellsByDay[1] = [{
    employeeId: employee.employeeId,
    employeeCode: employee.code,
    status: 'published',
  }];
  const otRow: OTShiftRow = {
    id: 'colored-ot-row',
    title: 'Colored OT',
    location: 'KAMC',
    timeRange: '17:00 - 21:00',
    hours: 4,
    backgroundColor: '#0F766E',
    textColor: '#FFFFFF',
    assignments: { 1: [{ kind: 'employee', employeeId: employee.employeeId }] },
  };
  return { employee, matrix, scheduleRow, otRow };
}

describe('published operational shift visuals', () => {
  it('carries custom Schedule and OT colors into dashboard metrics and items', () => {
    const { matrix, scheduleRow, otRow } = coloredFixtures();
    const snapshot = buildOperationalSnapshot(
      '2026-07-01',
      matrix,
      [otRow],
      OFFICIAL_EMPLOYEE_ROSTER,
    );

    expect(snapshot.coverage.find((metric) => metric.category === 'day')?.shiftColors)
      .toContainEqual(expect.objectContaining({ backgroundColor: '#6D28D9', textColor: '#FFFFFF' }));
    expect(snapshot.coverage.find((metric) => metric.category === 'ot')?.shiftColors)
      .toContainEqual(expect.objectContaining({ backgroundColor: '#0F766E', textColor: '#FFFFFF' }));
    expect(snapshot.shiftGroups.flatMap((group) => group.items).find((item) => item.rowId === scheduleRow.id))
      .toMatchObject({ backgroundColor: '#6D28D9', textColor: '#FFFFFF' });
    expect(snapshot.shiftGroups.flatMap((group) => group.items).find((item) => item.rowId === otRow.id))
      .toMatchObject({ colorKey: 'overtime', backgroundColor: '#0F766E', textColor: '#FFFFFF' });
  });

  it('collects all distinct published colors used by report categories', () => {
    const { matrix, otRow } = coloredFixtures();
    const visuals = collectPublishedShiftVisualsForPeriod(
      { '2026-07': matrix },
      { '2026-07': [otRow] },
      {
        granularity: 'month',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        label: 'July 2026',
      },
    );

    expect(visuals.day).toContainEqual(expect.objectContaining({ backgroundColor: '#6D28D9' }));
    expect(visuals.ot).toContainEqual(expect.objectContaining({ backgroundColor: '#0F766E' }));
    expect(operationalShiftGradient([
      { colorKey: 'morning', backgroundColor: '#111111' },
      { colorKey: 'morning', backgroundColor: '#222222' },
    ])).toContain('linear-gradient');
  });
});
