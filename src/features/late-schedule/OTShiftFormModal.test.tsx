import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OTShiftFormModal from './OTShiftFormModal';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';

afterEach(cleanup);

const units: OTUnit[] = [
  { id: 'unit-kamc', name: 'KAMC' },
  { id: 'unit-whh', name: 'WHH' },
];

const row: OTShiftRow = {
  id: 'ot-row-1',
  unitId: 'unit-kamc',
  title: 'Evening OT',
  location: 'KAMC',
  timeRange: '17:00-21:00',
  hours: 4,
  shortCode: 'EV',
  icon: '⭐',
  assignments: {},
};

describe('OTShiftFormModal', () => {
  it('preserves existing row metadata and previews the updated location when changing units', () => {
    const onSave = vi.fn();
    render(
      <OTShiftFormModal
        isOpen
        row={row}
        units={units}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Current location')).toBeInTheDocument();
    expect(screen.getAllByText('KAMC')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'unit-whh' } });
    expect(screen.getAllByText('WHH')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Save OT shift' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      unitId: 'unit-whh',
      location: 'WHH',
      shortCode: 'EV',
      icon: '⭐',
    }));
  });
});
