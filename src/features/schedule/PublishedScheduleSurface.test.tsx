import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import PublishedScheduleSurface from './PublishedScheduleSurface';

afterEach(cleanup);

function matrixAssignment() {
  const matrix = generateScheduleMatrixMock(2027, 0);
  for (const facility of matrix.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const [dayText, assignments] of Object.entries(row.cellsByDay)) {
          const assignment = assignments[0];
          if (!assignment) continue;
          return { matrix, facility, unit, row, day: Number(dayText), assignment };
        }
      }
    }
  }
  throw new Error('Mock matrix has no assignment');
}

describe('PublishedScheduleSurface employee interactions', () => {
  it('keeps details available while hiding audit history and edit controls in read-only mode', () => {
    const value = matrixAssignment();
    value.matrix.auditLog = [{
      id: 'private-audit',
      actorName: 'Private administrator name',
      action: 'assign',
      rowId: value.row.id,
      day: value.day,
      newValue: 'Private audit value',
      timestamp: new Date().toISOString(),
    }];

    const { container } = render(
      <PublishedScheduleSurface
        tab="schedule"
        year={value.matrix.year}
        month={value.matrix.month}
        matrix={value.matrix}
        otTable={null}
        roster={[]}
        emptyScheduleText="No schedule"
        emptyOTText="No OT"
      />,
    );

    const chip = container.querySelector<HTMLButtonElement>(`button[data-employee-id="${value.assignment.employeeId}"]`);
    expect(chip).not.toBeNull();
    fireEvent.click(chip!);

    expect(screen.queryByText('Private administrator name')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit assignment')).not.toBeInTheDocument();
    expect(screen.getAllByText(value.row.shiftLabel).length).toBeGreaterThan(0);
  });

  it('forwards an own Schedule chip click without exposing admin actions', () => {
    const value = matrixAssignment();
    const onScheduleAssignmentClick = vi.fn();
    const { container } = render(
      <PublishedScheduleSurface
        tab="schedule"
        year={value.matrix.year}
        month={value.matrix.month}
        matrix={value.matrix}
        otTable={null}
        roster={[]}
        emptyScheduleText="No schedule"
        emptyOTText="No OT"
        onScheduleAssignmentClick={onScheduleAssignmentClick}
      />,
    );

    fireEvent.click(container.querySelector<HTMLButtonElement>(`button[data-employee-id="${value.assignment.employeeId}"]`)!);
    expect(onScheduleAssignmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: value.row.id, day: value.day }),
      expect.objectContaining({ employeeId: value.assignment.employeeId }),
      expect.anything(),
    );
    expect(screen.queryByText('Edit assignment')).not.toBeInTheDocument();
  });

  it('forwards an OT employee cell click only when the My Schedule hook is supplied', () => {
    const employee = OFFICIAL_EMPLOYEE_ROSTER[0];
    const onOTAssignmentClick = vi.fn();
    render(
      <PublishedScheduleSurface
        tab="ot"
        year={2027}
        month={0}
        matrix={null}
        otTable={{
          units: [{ id: 'unit-a', name: 'Unit A' }],
          rows: [{
            id: 'ot-row-a',
            unitId: 'unit-a',
            title: 'OT Night',
            location: 'KAMC',
            timeRange: '17:00 - 21:00',
            hours: 4,
            assignments: { 4: [{ kind: 'employee', employeeId: employee.employeeId }] },
          }],
        }}
        roster={[employee]}
        emptyScheduleText="No schedule"
        emptyOTText="No OT"
        onOTAssignmentClick={onOTAssignmentClick}
      />,
    );

    fireEvent.click(screen.getByTestId('ot-cell-ot-row-a-4').querySelector('button')!);
    expect(onOTAssignmentClick).toHaveBeenCalledWith('ot-row-a', 4, employee.employeeId);
  });
});
