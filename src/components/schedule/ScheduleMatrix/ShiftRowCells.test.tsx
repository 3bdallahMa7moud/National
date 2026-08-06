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
        employeeId: 'emp-m-1',
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
        legend={[{ code: 'A', fullName: 'Ahmed', fullNameEn: 'Ahmed', employeeId: 'emp-m-1' }]}
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
        legend={[{ code: 'A', fullName: 'Ahmed', fullNameEn: 'Ahmed', employeeId: 'emp-m-1' }]}
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

  it('renders a color-neutral marker label alongside selection, holiday, assignment, and conflict UI', () => {
    const row = testRow();
    row.cellsByDay[1][0].hasConflict = true;
    row.cellsByDay[1][0].conflictReason = 'Vacation conflict';

    render(
      <ShiftRowCells
        row={row}
        rowIndex={0}
        facilityId="whh"
        facilityName="WHH"
        unitId="whh-room"
        unitName="Room 1"
        daysInMonth={1}
        year={2026}
        month={6}
        legend={[{ code: 'A', fullName: 'Ahmed', fullNameEn: 'Ahmed', employeeId: 'emp-m-1' }]}
        highlightedEmployeeId={null}
        selectedCells={[{
          facilityId: 'whh',
          unitId: 'whh-room',
          rowId: row.id,
          day: 1,
        }]}
        isEditable
        isVacationMode={false}
        isBrushMode={false}
        brushEmployeeCodes={[]}
        holidays={[{ id: 'holiday', label: 'Holiday', startDay: 1, endDay: 1 }]}
        cellMarkers={{ 'cell|row-1|1': 'purple' }}
        onCellClick={vi.fn()}
      />,
    );

    const cell = screen.getByRole('gridcell');
    expect(screen.getByLabelText('Modified shift marker')).toHaveClass('sr-only');
    expect(cell).toHaveStyle({ backgroundColor: '#9333EA4D' });
    expect(cell).toHaveAttribute('data-cell-marker-color', 'purple');
    expect(cell).toHaveClass('ring-2');
    expect(cell).toHaveAttribute('data-holiday-day', '1');
    expect(screen.getByTitle('Vacation conflict')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Ahmed - Day Shift - 1 July - WHH Room 1/i });
    expect(chip).toHaveAttribute('title', 'Ahmed (EMP-003)');
    expect(screen.getByText('Ahmed')).toBeInTheDocument();
    expect(screen.queryByText(/^A$/)).not.toBeInTheDocument();
  });
});
