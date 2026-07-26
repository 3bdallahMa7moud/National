import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShiftRowCells from './ShiftRowCells';
import type { ShiftRow } from '@/types/scheduleMatrix';

afterEach(cleanup);

function testRow(): ShiftRow {
  return {
    id: 'row-1',
    blockType: 'equipmentDay',
    unitLabel: 'Room 1',
    rowLabel: 'Room 1',
    shiftLabel: 'Day Shift',
    timeRange: '08:00 - 17:00',
    colorKey: 'morning',
    icon: '☀',
    weekendOnly: false,
    cellsByDay: {
      1: [{
        employeeId: 'employee-1',
        employeeCode: 'A',
        status: 'draft',
      }],
    },
  };
}

describe('ShiftRowCells symbols and colors mode', () => {
  it('shows the configured shift symbol when symbols mode is enabled', () => {
    render(
      <ShiftRowCells
        row={testRow()}
        rowIndex={0}
        facilityId="whh"
        facilityName="WHH"
        unitId="whh-room"
        unitName="Room 1"
        daysInMonth={1}
        year={2026}
        month={6}
        legend={[{ code: 'A', fullName: 'Ahmed', employeeId: 'employee-1' }]}
        highlightedEmployeeId={null}
        selectedCells={[]}
        isEditable={false}
        isVacationMode={false}
        isBrushMode={false}
        brushEmployeeCodes={[]}
        onCellClick={vi.fn()}
        colorblindMode
      />,
    );

    expect(screen.getByTestId('shift-symbol')).toHaveTextContent('☀');
  });

  it('hides shift symbols when symbols mode is disabled', () => {
    render(
      <ShiftRowCells
        row={testRow()}
        rowIndex={0}
        facilityId="whh"
        facilityName="WHH"
        unitId="whh-room"
        unitName="Room 1"
        daysInMonth={1}
        year={2026}
        month={6}
        legend={[{ code: 'A', fullName: 'Ahmed', employeeId: 'employee-1' }]}
        highlightedEmployeeId={null}
        selectedCells={[]}
        isEditable={false}
        isVacationMode={false}
        isBrushMode={false}
        brushEmployeeCodes={[]}
        onCellClick={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('shift-symbol')).not.toBeInTheDocument();
  });
});
