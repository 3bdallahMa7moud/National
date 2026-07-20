import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateScheduleMatrixMock } from '@/mocks/scheduleMatrixMock';
import ScheduleMatrix from './ScheduleMatrix';

afterEach(cleanup);

describe('ScheduleMatrix arrange mode', () => {
  it('renders direct unit and row handles on desktop plus a touch ordering surface on mobile', () => {
    const data = generateScheduleMatrixMock(2026, 6);
    const facility = data.facilities.find((item) => item.units.some((unit) => unit.rows.length > 0))!;
    const unit = facility.units.find((item) => item.rows.length > 0)!;
    const row = unit.rows[0];
    facility.units.push({
      id: 'empty-order-unit',
      name: 'Empty Unit',
      blockType: 'equipmentDay',
      rows: [],
    });

    render(
      <ScheduleMatrix
        data={data}
        adminMode="order"
        onReorder={vi.fn(() => ({
          ok: true,
          kind: 'row',
          affectedAssignments: 0,
          sourceUnitId: unit.id,
          targetUnitId: unit.id,
        } as const))}
        onUpdateRow={vi.fn()}
        onAddRow={vi.fn()}
        onArchiveRow={vi.fn()}
        onDeleteRow={vi.fn()}
      />,
    );

    expect(screen.getByTestId('mobile-matrix-order')).toBeInTheDocument();
    expect(screen.getByText(/right-side handle/i)).toBeInTheDocument();
    expect(screen.getByTestId(`matrix-order-handle-unit-${unit.id}`)).toHaveClass('cursor-grab');
    expect(screen.getByTestId(`matrix-order-handle-row-${row.id}`)).toHaveClass('cursor-grab');
    expect(screen.getAllByLabelText(`Drag unit ${unit.name}`).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByLabelText(`Drag shift ${row.rowLabel || row.shiftLabel}`).length).toBeGreaterThanOrEqual(2);
    const emptyGroup = screen.getByTestId('unit-group-empty-order-unit');
    expect(within(emptyGroup).getByLabelText('Add row')).toBeInTheDocument();
  }, 30000);

  it('adds the first unit directly from an empty facility on the mobile ordering surface', () => {
    const data = generateScheduleMatrixMock(2026, 6);
    const facility = data.facilities[0];
    facility.units = [];
    const onAddUnit = vi.fn();

    render(
      <ScheduleMatrix
        data={data}
        adminMode="order"
        onReorder={vi.fn(() => ({
          ok: false,
          reason: 'same_position',
        } as const))}
        onAddUnit={onAddUnit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Add first unit/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'New CT Unit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add unit/i }));

    expect(onAddUnit).toHaveBeenCalledWith(facility.id, 'New CT Unit');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 30000);

  it('opens direct unit actions with the affected assignment count and delegates safe deletion', () => {
    const data = generateScheduleMatrixMock(2026, 6);
    const facility = data.facilities.find((item) => item.units.some((candidate) => candidate.rows.length > 0))!;
    const unit = facility.units.find((candidate) => candidate.rows.length > 0)!;
    const affectedAssignments = unit.rows.reduce((unitTotal, row) => unitTotal
      + Object.values(row.cellsByDay).reduce((rowTotal, assignments) => rowTotal + assignments.length, 0), 0);
    const onDeleteUnit = vi.fn();

    render(
      <ScheduleMatrix
        data={data}
        adminMode="order"
        onReorder={vi.fn(() => ({
          ok: true,
          kind: 'unit',
          affectedAssignments: 0,
          sourceUnitId: unit.id,
          targetUnitId: unit.id,
        } as const))}
        onAddUnit={vi.fn()}
        onRenameUnit={vi.fn()}
        onArchiveUnit={vi.fn()}
        onDeleteUnit={onDeleteUnit}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Manage unit|Unit actions/i })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(new RegExp(`${affectedAssignments} assignments affected`, 'i'))).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Delete/i }));

    expect(onDeleteUnit).toHaveBeenCalledWith(facility.id, unit.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 30000);
});
