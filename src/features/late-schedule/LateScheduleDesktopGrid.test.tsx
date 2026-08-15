import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LateScheduleDesktopGrid from './LateScheduleDesktopGrid';
import type { OTShiftRow } from '@/types/lateSchedule';
import { createOfficialEmployeeDirectoryRecordsFixture } from '@/test/fixtures/employeeDirectory';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';

beforeEach(() => {
  useEmployeeDirectoryStore.setState({ records: createOfficialEmployeeDirectoryRecordsFixture() });
});

afterEach(() => {
  cleanup();
  useEmployeeDirectoryStore.setState({ records: [] });
});

function makeRows(): OTShiftRow[] {
  return [
    {
      id: 'row-1',
      title: 'NCAP',
      location: 'KASCH',
      timeRange: '17:00-21:00',
      hours: 4,
      assignments: {
        1: [{ kind: 'employee', employeeId: 'emp-m-1' }],
      },
    },
  ];
}

describe('LateScheduleDesktopGrid', () => {
  it('renders employee names and employee numbers instead of internal IDs', () => {
    const { container } = render(
      <LateScheduleDesktopGrid
        year={2026}
        month={6}
        rows={makeRows()}
        roster={[]}
        canEdit={false}
        onAssignmentClick={vi.fn()}
      />,
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(container.querySelector('[title="Ahmed (EMP-003)"]')).toBeInTheDocument();
    expect(screen.queryByText('emp-m-1')).not.toBeInTheDocument();
  });
});
