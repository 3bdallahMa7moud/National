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
  canPublish: false,
  onPublish: vi.fn(),
  onDiscard: vi.fn(),
  conflictCount: 0,
  highlightedEmployeeId: null,
  onClearHighlight: vi.fn(),
  selectedCellCount: 0,
  onClearSelection: vi.fn(),
  activeCellMarkerTool: null,
  onCellMarkerToolChange: vi.fn(),
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

  it('enables marker tools in edit mode without requiring a cell selection', () => {
    const onCellMarkerToolChange = vi.fn();
    render(
      <MemoryRouter>
        <MatrixToolbar
          {...baseProps}
          adminMode="edit"
          onCellMarkerToolChange={onCellMarkerToolChange}
        />
      </MemoryRouter>,
    );

    const yellowTool = screen.getByRole('button', { name: 'Yellow marker' });
    expect(yellowTool).toBeEnabled();
    fireEvent.click(yellowTool);
    expect(onCellMarkerToolChange).toHaveBeenCalledWith('yellow');
    expect(screen.getByText('Choose a color, then click any cells to mark them')).toBeInTheDocument();
  });

  it('keeps marker tools disabled until edit mode is active', () => {
    renderToolbar();

    ['Yellow', 'Green', 'Red', 'Blue', 'Orange', 'Purple'].forEach((color) => {
      expect(screen.getByRole('button', { name: `${color} marker` })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Remove Marker' })).toBeDisabled();
    expect(screen.getByText('Open Edit mode to use cell markers')).toBeInTheDocument();
  });

  it('shows the selected marker tool as active and toggles remove mode', () => {
    const onCellMarkerToolChange = vi.fn();
    render(
      <MemoryRouter>
        <MatrixToolbar
          {...baseProps}
          adminMode="edit"
          activeCellMarkerTool="remove"
          onCellMarkerToolChange={onCellMarkerToolChange}
        />
      </MemoryRouter>,
    );

    const removeTool = screen.getByRole('button', { name: 'Remove Marker' });
    expect(removeTool).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Marker tool is active — click cells to apply it; press Esc to stop')).toBeInTheDocument();
    fireEvent.click(removeTool);
    expect(onCellMarkerToolChange).toHaveBeenCalledWith('remove');
  });

  it('exposes the exact employee publication action for a never-published draft', () => {
    const onPublish = vi.fn();
    render(
      <MemoryRouter>
        <MatrixToolbar
          {...baseProps}
          canPublish
          isDirty
          pendingDraftCount={3}
          onPublish={onPublish}
        />
      </MemoryRouter>,
    );

    const publishButton = screen.getByRole('button', { name: 'Publish to Employees' });
    expect(publishButton).toBeEnabled();
    fireEvent.click(publishButton);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Draft saved automatically')).toBeInTheDocument();
    expect(screen.getByText('Employees will keep seeing the last published version until you publish this draft.')).toBeInTheDocument();
  });

  it('keeps the standalone publish action visible but disabled without a draft', () => {
    renderToolbar();

    expect(screen.getByRole('button', { name: 'Publish to Employees' })).toBeDisabled();
  });
});
