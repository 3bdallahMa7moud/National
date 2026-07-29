import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LateScheduleToolbar from './LateScheduleToolbar';

afterEach(cleanup);

const baseProps = {
  monthLabel: 'July 2026',
  canEdit: true,
  isEditMode: false,
  onToggleEdit: vi.fn(),
  activeCellMarkerTool: null,
  onCellMarkerToolChange: vi.fn(),
  canPublish: false,
  onPublish: vi.fn(),
  viewMode: 'grid' as const,
  onViewModeChange: vi.fn(),
  onPreviousMonth: vi.fn(),
  onNextMonth: vi.fn(),
  onExportExcel: vi.fn(),
  onExportPdf: vi.fn(),
  onAddShift: vi.fn(),
};

describe('LateScheduleToolbar edit, marker, and publish controls', () => {
  it('keeps marker tools disabled until OT Edit mode is enabled', () => {
    render(<LateScheduleToolbar {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Yellow marker' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish to Employees' })).toBeDisabled();
    expect(screen.getByText('Open Edit mode to use cell markers')).toBeInTheDocument();
  });

  it('selects a persistent marker tool and exposes standalone OT publishing', () => {
    const onCellMarkerToolChange = vi.fn();
    const onPublish = vi.fn();
    render(
      <LateScheduleToolbar
        {...baseProps}
        isEditMode
        activeCellMarkerTool="purple"
        onCellMarkerToolChange={onCellMarkerToolChange}
        canPublish
        onPublish={onPublish}
      />,
    );

    const purpleTool = screen.getByRole('button', { name: 'Purple marker' });
    expect(purpleTool).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(purpleTool);
    expect(onCellMarkerToolChange).toHaveBeenCalledWith('purple');

    const publishButton = screen.getByRole('button', { name: 'Publish to Employees' });
    expect(publishButton).toBeEnabled();
    fireEvent.click(publishButton);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Draft saved automatically')).toBeInTheDocument();
  });
});
