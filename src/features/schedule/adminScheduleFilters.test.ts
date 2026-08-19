import { describe, expect, it } from 'vitest';
import { createScheduleMatrixFixture, createStructuredScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import { buildAdminScheduleDisplayData } from './adminScheduleFilters';

describe('buildAdminScheduleDisplayData', () => {
  it('keeps configured rows visible when no filters are active', () => {
    const data = createStructuredScheduleMatrixFixture(2026, 7);

    const display = buildAdminScheduleDisplayData(data, {
      facilityFilter: '',
      shiftFilter: '',
      conflictsOnly: false,
    });

    expect(display).not.toBeNull();
    expect(display!.facilities.length).toBeGreaterThan(0);
    expect(display!.facilities.some((facility) =>
      facility.units.some((unit) => unit.rows.length > 0),
    )).toBe(true);
  });

  it('limits rows only when an explicit shift filter is selected', () => {
    const data = createScheduleMatrixFixture(2026, 7);

    const display = buildAdminScheduleDisplayData(data, {
      facilityFilter: '',
      shiftFilter: 'night',
      conflictsOnly: false,
    });

    expect(display).not.toBeNull();
    expect(display!.facilities.every((facility) =>
      facility.units.every((unit) =>
        unit.rows.every((row) => row.colorKey === 'night'),
      ),
    )).toBe(true);
  });

  it('shows only rows with flagged conflicts when the conflict filter is active', () => {
    const data = createStructuredScheduleMatrixFixture(2026, 7);
    const conflictRow = data.facilities[0].units[0].rows[0];
    conflictRow.cellsByDay[1] = [{
      employeeId: 'conflict-employee',
      employeeCode: 'CF1',
      hasConflict: true,
      conflictReason: 'Conflict',
      conflictType: 'timeOverlap',
    }];

    const display = buildAdminScheduleDisplayData(data, {
      facilityFilter: '',
      shiftFilter: '',
      conflictsOnly: true,
    });

    expect(display).not.toBeNull();
    expect(display!.facilities).toHaveLength(1);
    expect(display!.facilities[0].units).toHaveLength(1);
    expect(display!.facilities[0].units[0].rows.map((row) => row.id)).toEqual([conflictRow.id]);
  });
});
