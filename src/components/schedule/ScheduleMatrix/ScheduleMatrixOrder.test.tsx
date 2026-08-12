import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import ScheduleMatrix from './ScheduleMatrix';

afterEach(cleanup);

describe('ScheduleMatrix arrange mode', () => {
  it('renders direct unit and row handles on desktop plus a touch ordering surface on mobile', async () => {
    // Pre-transform the production-lazy DnD module so parallel Vitest workers do not
    // turn chunk compilation time into a flaky Suspense timeout.
    await import('./MatrixOrderDnd');
    const data = createScheduleMatrixFixture(2026, 6);
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
    expect(screen.getByTestId('desktop-schedule-matrix')).toBeInTheDocument();
    expect(screen.getByText(/right-side handle/i)).toBeInTheDocument();
    const unitHandles = await screen.findAllByLabelText(
      `Drag unit ${unit.name}`,
      {},
      { timeout: 5000 },
    );
    const rowHandles = await screen.findAllByLabelText(
      `Drag shift ${row.rowLabel || row.shiftLabel}`,
      {},
      { timeout: 5000 },
    );
    expect(unitHandles.length).toBeGreaterThanOrEqual(1);
    expect(rowHandles.length).toBeGreaterThanOrEqual(1);
    expect(unitHandles.some((handle) => handle.className.includes('cursor-grab'))).toBe(true);
    expect(rowHandles.some((handle) => handle.className.includes('cursor-grab'))).toBe(true);
  }, 30000);

  it('adds the first unit directly from an empty facility on the mobile ordering surface', async () => {
    const data = createScheduleMatrixFixture(2026, 6);
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

    fireEvent.click(await screen.findByRole(
      'button',
      { name: /Add first unit/i },
      { timeout: 5000 },
    ));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'New CT Unit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add unit/i }));

    expect(onAddUnit).toHaveBeenCalledWith(facility.id, 'New CT Unit');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 30000);

  it('opens direct unit actions with the affected assignment count and delegates safe deletion', async () => {
    const data = createScheduleMatrixFixture(2026, 6);
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

    fireEvent.click((await screen.findAllByRole(
      'button',
      { name: /Manage unit|Unit actions/i },
      { timeout: 5000 },
    ))[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(new RegExp(`${affectedAssignments} assignments affected`, 'i'))).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Delete/i }));

    expect(onDeleteUnit).toHaveBeenCalledWith(facility.id, unit.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 30000);
});
