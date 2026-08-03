import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { ShiftRequestCreateWizard } from './ShiftRequestCreateWizard';
import type { ShiftAssignmentRef } from '@/types/shiftRequest';
import type { EmployeeDirectoryRecord } from '@/types/employeeDirectory';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

function sampleMatrix(): ScheduleMatrixData {
  return {
    departmentId: 'dept-1',
    year: 2099,
    month: 6,
    facilities: [{
      id: 'fac-KAMC',
      name: 'KAMC',
      accentColorToken: 'facility-kamc',
      units: [{
        id: 'unit-1',
        name: 'Room 1',
        blockType: 'equipmentDay',
        rows: [
          {
            id: 'row-1',
            blockType: 'equipmentDay',
            unitLabel: 'Room 1',
            rowLabel: 'Day Shift',
            shiftLabel: 'Day Shift',
            timeRange: '08:00 - 17:00',
            colorKey: 'morning',
            weekendOnly: false,
            cellsByDay: {
              15: [{ employeeId: 'emp-1', employeeCode: 'code-1', status: 'published' }],
              16: [{ employeeId: 'emp-2', employeeCode: 'code-2', status: 'published' }],
              17: [{ employeeId: 'emp-3', employeeCode: 'code-3', status: 'published' }],
            },
          },
        ],
      }],
    }],
    legend: [],
    vacations: [],
    holidays: [],
    settings: [],
    auditLog: [],
    cellMarkers: {},
  };
}

import { createScheduleAssignmentRef } from '@/lib/shiftAssignmentGateway';

function makeAssignment(id: string, facilityLabel: string, shiftLabel: string, day: number): ShiftAssignmentRef {
  const matrix = useScheduleMatrixStore.getState().matricesByMonth['2099-07']!;
  return createScheduleAssignmentRef(matrix, 'row-1', day, `emp-${id}`, 'dept-1')!;
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

function directoryRecord(
  accountId: string,
  role: EmployeeDirectoryRecord['role'],
  code: string,
  name: string,
  scheduleEmployeeId?: string,
): EmployeeDirectoryRecord {
  return {
    accountId,
    name: { ar: name, en: name },
    email: '',
    phone: '',
    role,
    departmentId: 'dept-1',
    departmentName: { ar: 'CT', en: 'CT' },
    position: { ar: role === 'admin' ? 'Admin' : 'Employee', en: role === 'admin' ? 'Admin' : 'Employee' },
    employeeNumber: accountId,
    code,
    active: true,
    createdAt: '2026-07-01T00:00:00Z',
    scheduleEmployeeId,
    origin: 'custom',
    issues: [],
    access: {
      templateId: 'standard',
      overrides: {},
      updatedAt: '2026-07-01T00:00:00Z',
      updatedBy: 'system',
    },
  };
}

describe('ShiftRequestCreateWizard', () => {
  beforeEach(() => {
    const data = sampleMatrix();
    useScheduleMatrixStore.setState({
      data,
      matricesByMonth: { '2099-07': data },
      draftsByMonth: { '2099-07': data },
      snapshot: JSON.stringify(data),
      undoStack: [],
      versionsByMonth: {},
      monthStatuses: { '2099-07': 'published' },
      storageError: null,
    });
    useAuthStore.setState({
      user: {
        id: 'user-1',
        name: 'User One',
        email: '',
        role: 'admin',
        departmentId: 'dept-1',
        departmentName: 'CT',
      },
    });
    useEmployeeAccessStore.setState({
      profiles: {
        'user-1': makeProfile('user-1', 'emp-user-1'),
        'rec-1': makeProfile('rec-1', 'emp-rec-1'),
      },
    });
    useEmployeeDirectoryStore.setState({
      records: [
        directoryRecord('user-1', 'admin', 'USR-1', 'User One', 'emp-user-1'),
        directoryRecord('rec-1', 'employee', 'REC-1', 'Recipient One', 'emp-rec-1'),
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  const user = { id: 'user-1', name: 'User One', role: 'admin' as const };
  const getMockAssignments = () => [
    makeAssignment('1', 'KAMC', 'Day Shift', 15),
    makeAssignment('2', 'KAMC', 'Day Shift', 16),
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
        requesterAssignments={getMockAssignments()}
        recipients={mockRecipients}
        candidateProfiles={candidateProfiles}
        user={user}
        initialAssignment={null}
        createRequest={createRequest}
      />
    );

    expect(screen.getAllByText(/Recipient One|rec-1/)[0]).toBeInTheDocument();
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
        requesterAssignments={getMockAssignments()}
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
    const recipientBtn = screen.getAllByText(/Recipient One|rec-1/)[0];
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
    expect(screen.getAllByText(/Day Shift/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByText(/Day Shift/)[0]);

    // Calendar day 15 button should be rendered and clickable
    const dayBtn = screen.getAllByText('15')[0];
    fireEvent.click(dayBtn);

    // Click Next to go to review
    fireEvent.click(screen.getByText('Next'));

    // Submit button should be enabled in review step
    const submitBtn = screen.getByText('Confirm & Send Request');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);
    expect(createRequest).toHaveBeenCalledTimes(1);
  });

  it('supports selecting range mode for multiple replace requests by an admin', async () => {
    const onClose = vi.fn();
    const onResult = vi.fn();
    const createRequest = vi.fn().mockResolvedValue({ ok: true, request: { id: 'req-1' } });
    const createBatchRequests = vi.fn().mockResolvedValue({
      ok: true,
      createdCount: 2,
      results: [
        { ok: true, request: { id: 'req-1' } },
        { ok: true, request: { id: 'req-2' } },
      ],
    });

    render(
      <ShiftRequestCreateWizard
        isOpen
        onClose={onClose}
        onResult={onResult}
        canExchange
        canReplace
        requesterAssignments={getMockAssignments()}
        recipients={mockRecipients}
        candidateProfiles={candidateProfiles}
        user={user}
        initialAssignment={null}
        createRequest={createRequest}
        createBatchRequests={createBatchRequests}
      />
    );

    // Select Replace type
    const replaceBtns = screen.getAllByText('Replace');
    fireEvent.click(replaceBtns[0]);

    // Select Recipient
    const recipientBtn = screen.getAllByText(/Recipient One|rec-1/)[0];
    fireEvent.click(recipientBtn);

    // Click Next step
    fireEvent.click(screen.getByText('Next'));

    // Switch to Range Mode
    const rangeToggle = screen.getByText('Date Range / Multi-Shift');
    fireEvent.click(rangeToggle);

    // Click day 15 and day 16 (both Day Shift)
    const day15Btn = screen.getAllByText('15')[0];
    const day16Btn = screen.getAllByText('16')[0];
    fireEvent.click(day15Btn);
    fireEvent.click(day16Btn);

    // Click Next step to Review
    fireEvent.click(screen.getByText('Next'));

    // Check batch submit button label
    const submitBtn = screen.getByText('Submit 2 Requests');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createBatchRequests).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    });
  });

  it('safely handles null, valid, changed valid, and null user transitions', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      onResult: vi.fn(),
      canExchange: true,
      canReplace: true,
      requesterAssignments: getMockAssignments(),
      recipients: mockRecipients,
      candidateProfiles,
      initialAssignment: null,
      createRequest: vi.fn(),
    };
    const changedUser = {
      id: 'user-2',
      name: 'User Two',
      role: 'admin' as const,
    };

    const { container, rerender } = render(
      <ShiftRequestCreateWizard {...props} user={null} />,
    );

    expect(container).toBeEmptyDOMElement();

    expect(() => {
      rerender(<ShiftRequestCreateWizard {...props} user={user} />);
    }).not.toThrow();
    expect(screen.getAllByText(/Recipient One|rec-1/)[0]).toBeInTheDocument();

    expect(() => {
      rerender(<ShiftRequestCreateWizard {...props} user={changedUser} />);
    }).not.toThrow();
    expect(screen.getAllByText(/Recipient One|rec-1/)[0]).toBeInTheDocument();

    expect(() => {
      rerender(<ShiftRequestCreateWizard {...props} user={null} />);
    }).not.toThrow();
    expect(container).toBeEmptyDOMElement();

    const hookDiagnostic =
      /Rendered more hooks|Rendered fewer hooks|change in the order of Hooks/i;
    const diagnostics = [...errorSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map(String)
      .filter((message) => hookDiagnostic.test(message));

    expect(diagnostics).toEqual([]);
  });
});
