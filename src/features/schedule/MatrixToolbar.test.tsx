import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MatrixToolbar from './MatrixToolbar';

afterEach(cleanup);

const baseProps = {
  adminMode: 'view' as const,
  onModeChange: vi.fn(),
  facilityFilter: '',
  onFacilityFilterChange: vi.fn(),
  month: 6,
  year: 2026,
  onPrevMonth: vi.fn(),
  onNextMonth: vi.fn(),
  isDirty: false,
  pendingDraftCount: 0,
  onPublish: vi.fn(),
  onDiscard: vi.fn(),
  conflictCount: 0,
  highlightedEmployeeId: null,
  onClearHighlight: vi.fn(),
  selectedCellCount: 0,
  onClearSelection: vi.fn(),
  brushEmployeeCodes: [],
  onClearBrush: vi.fn(),
  searchQuery: '',
  onSearchQueryChange: vi.fn(),
  searchMatchCount: 0,
  onJumpToSearchMatch: vi.fn(),
  shiftFilter: '' as const,
  onShiftFilterChange: vi.fn(),
  conflictsOnly: false,
  onToggleConflictsOnly: vi.fn(),
  colorblindMode: false,
  onToggleColorblindMode: vi.fn(),
};

function renderToolbar(onGenerateSchedule = vi.fn()) {
  render(
    <MemoryRouter>
      <MatrixToolbar
        {...baseProps}
        onGenerateSchedule={onGenerateSchedule}
      />
    </MemoryRouter>,
  );
  return onGenerateSchedule;
}

describe('MatrixToolbar', () => {
  it('renders the generator button and calls the provided handler', () => {
    const onGenerateSchedule = renderToolbar();

    fireEvent.click(screen.getByLabelText('Generate Schedule'));

    expect(onGenerateSchedule).toHaveBeenCalledTimes(1);
  });
});
