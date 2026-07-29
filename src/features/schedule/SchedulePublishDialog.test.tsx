import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SchedulePublishDialog from './SchedulePublishDialog';

afterEach(cleanup);

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onPublish: vi.fn(),
  onReviewConflicts: vi.fn(),
  monthLabel: 'July',
  year: 2026,
  departmentLabel: 'CT Scan',
  markerCount: 3,
  draftChangeCount: 5,
  conflictCount: 0,
};

describe('SchedulePublishDialog', () => {
  it('shows the publication summary and zero-conflict confirmation', () => {
    render(<SchedulePublishDialog {...baseProps} />);

    expect(screen.getByText('July 2026')).toBeInTheDocument();
    expect(screen.getByText('CT Scan')).toBeInTheDocument();
    expect(screen.getByText('Cell markers')).toBeInTheDocument();
    expect(screen.getByText('Draft changes')).toBeInTheDocument();
    expect(screen.getByText('Current conflicts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish to Employees' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Review Conflicts' })).not.toBeInTheDocument();
  });

  it('warns about conflicts while keeping review and publish-anyway actions enabled', () => {
    const onReviewConflicts = vi.fn();
    const onPublish = vi.fn();
    render(
      <SchedulePublishDialog
        {...baseProps}
        conflictCount={2}
        onReviewConflicts={onReviewConflicts}
        onPublish={onPublish}
      />,
    );

    expect(screen.getByText('This schedule contains conflicts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review Conflicts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish Anyway' }));
    expect(onReviewConflicts).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
