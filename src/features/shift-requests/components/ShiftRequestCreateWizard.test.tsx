import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import { ShiftRequestCreateWizard } from './ShiftRequestCreateWizard';
import type { ShiftAssignmentRef } from '@/types/shiftRequest';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';

function makeAssignment(id: string, facilityLabel: string, shiftLabel: string, day: number): ShiftAssignmentRef {
  return {
    source: 'schedule',
    departmentId: 'dept-1',
    monthKey: '2026-07',
    year: 2026,
    month: 7,
    day,
    rowId: `row-${id}`,
    employeeId: `emp-${id}`,
    employeeCode: `code-${id}`,
    facilityId: `fac-${facilityLabel}`,
    unitId: 'unit-1',
    facilityLabel,
    unitLabel: 'Room 1',
    shiftLabel,
    timeRange: '08:00 - 17:00',
    startsAt: new Date('2026-07-20T08:00:00Z').toISOString(),
    fingerprint: `fp-${id}`,
  };
}

function makeProfile(accountId: string, scheduleEmployeeId: string): EmployeeAccessProfile {
  return {
    accountId,
    departmentId: 'dept-1',
    scheduleEmployeeId,
    templateId: 'standard',
    overrides: {},
    active: true,
    updatedAt: '2026-07-01T00:00:00Z',
    updatedBy: 'system',
  };
}

describe('ShiftRequestCreateWizard', () => {
  afterEach(() => {
    cleanup();
  });
  const user = { id: 'user-1', name: 'User One' };
  const mockAssignments = [
    makeAssignment('1', 'KAMC', 'Day Shift', 15),
    makeAssignment('2', 'KAMC', 'Night Shift', 16),
    makeAssignment('3', 'KASCH', 'Day Shift', 17),
  ];
  const mockRecipients = [
    makeProfile('rec-1', 'emp-rec-1'),
  ];
  const candidateProfiles = {
    'rec-1': makeProfile('rec-1', 'emp-rec-1'),
  };

  it('renders wizard step 1 (Type & Recipient) initially', () => {
    const onClose = vi.fn();
    const onResult = vi.fn();
    const createRequest = vi.fn();

    render(
      <ShiftRequestCreateWizard
        isOpen
        onClose={onClose}
        onResult={onResult}
        canExchange
        canReplace
        requesterAssignments={mockAssignments}
        recipients={mockRecipients}
        candidateProfiles={candidateProfiles}
        user={user}
        initialAssignment={null}
        createRequest={createRequest}
      />
    );

    expect(screen.getAllByText('rec-1')[0]).toBeInTheDocument();
  });

  it('allows selecting replace and advancing to step 2 to select assignment via branch and shift type tabs', () => {
    const onClose = vi.fn();
    const onResult = vi.fn();
    const createRequest = vi.fn();

    render(
      <ShiftRequestCreateWizard
        isOpen
        onClose={onClose}
        onResult={onResult}
        canExchange
        canReplace
        requesterAssignments={mockAssignments}
        recipients={mockRecipients}
        candidateProfiles={candidateProfiles}
        user={user}
        initialAssignment={null}
        createRequest={createRequest}
      />
    );

    // Select Replace type
    const replaceBtns = screen.getAllByText('Replace');
    fireEvent.click(replaceBtns[0]);

    // Select Recipient
    const recipientBtn = screen.getAllByText('rec-1')[0];
    fireEvent.click(recipientBtn);

    // Click Next step
    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);

    // Now in Step 2: Your Shift
    expect(screen.getByText('KAMC')).toBeInTheDocument();
    expect(screen.getByText('KASCH')).toBeInTheDocument();

    // Click on KAMC facility
    fireEvent.click(screen.getByText('KAMC'));

    // Check Day Shift is present
    expect(screen.getByText('Day Shift')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Day Shift'));

    // Calendar day 15 button should be rendered and clickable
    const dayBtn = screen.getAllByText('15')[0];
    fireEvent.click(dayBtn);

    // Click Next to go to review
    fireEvent.click(screen.getByText('Next'));

    // Submit button should be enabled in review step
    const submitBtn = screen.getByText('Confirm & Send Request');
    expect(submitBtn).not.toBeDisabled();
  });
});
