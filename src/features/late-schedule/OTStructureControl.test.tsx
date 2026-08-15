import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OTStructureControl from './OTStructureControl';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';

afterEach(cleanup);

const units: OTUnit[] = [{ id: 'unit-kamc', name: 'KAMC' }];
const rows: OTShiftRow[] = [];

describe('OTStructureControl', () => {
  it('waits to rename a unit until the field is committed', () => {
    const onRenameUnit = vi.fn();
    render(
      <OTStructureControl
        units={units}
        rows={rows}
        onAddUnit={vi.fn()}
        onRenameUnit={onRenameUnit}
        onArchiveUnit={vi.fn()}
        onRestoreUnit={vi.fn()}
        onDeleteUnit={vi.fn()}
        onReorderUnit={vi.fn()}
        onReorderRow={vi.fn()}
        onEditRow={vi.fn()}
        onDeleteRow={vi.fn()}
      />,
    );

    const input = screen.getAllByLabelText('Unit name')[0];
    fireEvent.change(input, { target: { value: 'KAMC Updated' } });
    expect(onRenameUnit).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onRenameUnit).toHaveBeenCalledWith('unit-kamc', 'KAMC Updated');
  });
});
