import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import ScheduleMatrix from './ScheduleMatrix';

afterEach(cleanup);

describe('ScheduleMatrix row editing', () => {
  it('limits shift-type choices to the row facility', async () => {
    const data = generateScheduleMatrixMock(2026, 6);
    const facility = data.facilities.find((candidate) => candidate.units.some((unit) => unit.rows.length > 0))!;
    const foreignFacility = data.facilities.find((candidate) => candidate.id !== facility.id)!;
    const row = facility.units.find((unit) => unit.rows.length > 0)!.rows[0];
    const localSettings = data.settings.find((entry) => entry.facilityId === facility.id)!;
    const foreignSettings = data.settings.find((entry) => entry.facilityId === foreignFacility.id)!;
    const localDefinition = localSettings.shiftDefinitions[0];
    const foreignDefinition = foreignSettings.shiftDefinitions[0];

    localDefinition.label = 'Local Only Shift';
    localDefinition.englishName = 'Local Only Shift';
    row.shiftDefinitionId = localDefinition.id;
    row.shiftLabel = localDefinition.englishName;
    row.timeRange = localDefinition.timeRange;
    row.colorKey = localDefinition.colorKey;
    row.backgroundColor = localDefinition.backgroundColor;
    row.textColor = localDefinition.textColor;

    foreignDefinition.label = 'Foreign Only Shift';
    foreignDefinition.englishName = 'Foreign Only Shift';
    foreignDefinition.timeRange = '22:00 - 23:00';

    render(
      <ScheduleMatrix
        data={data}
        editable
        onUpdateRow={vi.fn()}
      />,
    );

    fireEvent.click((await screen.findAllByRole('button', { name: /Edit row/i }))[0]);

    const dialog = screen.getByRole('dialog', { name: /Edit schedule row/i });
    const select = within(dialog).getByRole('combobox');
    const optionNames = within(select).getAllByRole('option').map((option) => option.textContent);

    expect(optionNames.some((name) => name?.includes('Local Only Shift'))).toBe(true);
    expect(optionNames.some((name) => name?.includes('Foreign Only Shift'))).toBe(false);
  });
});
