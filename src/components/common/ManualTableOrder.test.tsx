import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ManualTableOrder from './ManualTableOrder';

const units = [
  {
    id: 'unit-a',
    label: 'Unit A',
    rows: [
      { id: 'row-a', label: 'Shift A' },
      { id: 'row-a-2', label: 'Shift A2' },
    ],
  },
  { id: 'unit-b', label: 'Unit B', rows: [{ id: 'row-b', label: 'Shift B' }] },
];

afterEach(cleanup);

describe('ManualTableOrder', () => {
  it('keeps mouse, touch and keyboard drag handles accessible and offers button fallbacks', () => {
    const onReorderUnit = vi.fn();
    const onReorderRow = vi.fn();
    render(<ManualTableOrder units={units} onReorderUnit={onReorderUnit} onReorderRow={onReorderRow} />);

    expect(screen.getByLabelText('Drag unit Unit A')).toHaveAttribute('tabindex', '0');
    expect(screen.getByLabelText('Drag shift Shift A')).toHaveAttribute('tabindex', '0');

    fireEvent.click(screen.getByLabelText('Move Unit A down'));
    expect(onReorderUnit).toHaveBeenCalledWith('unit-a', 'unit-b', 'after');

    fireEvent.click(screen.getByLabelText('Move Shift A down'));
    expect(onReorderRow).toHaveBeenCalledWith('row-a', 'unit-a', 'unit-a', 'row-a-2', 'after');
  });

  it('moves a row into another unit and exposes Add Row for an empty unit', () => {
    const onReorderRow = vi.fn();
    const onAddRow = vi.fn();
    const withEmpty = [...units, { id: 'unit-c', label: 'Unit C', rows: [] }];
    render(
      <ManualTableOrder
        units={withEmpty}
        onReorderUnit={vi.fn()}
        onReorderRow={onReorderRow}
        onAddRow={onAddRow}
      />,
    );

    fireEvent.change(screen.getByLabelText('Move Shift A to unit'), { target: { value: 'unit-b' } });
    expect(onReorderRow).toHaveBeenCalledWith('row-a', 'unit-a', 'unit-b');

    const addButtons = screen.getAllByText('Add row');
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(onAddRow).toHaveBeenCalledWith('unit-c', expect.anything());
  });
});
