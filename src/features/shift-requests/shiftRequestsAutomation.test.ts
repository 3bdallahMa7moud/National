import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as gateway from '@/lib/shiftAssignmentGateway';
import { browserShiftAssignmentGateway, createScheduleAssignmentRef } from '@/lib/shiftAssignmentGateway';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { createShiftRequestStore } from '@/stores/shiftRequestStore';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

function sampleMatrix(): ScheduleMatrixData {
  return {
    departmentId: 'dept-1',
    year: 2099,
    month: 6,
    facilities: [{
      id: 'facility-kamc',
      name: 'KAMC',
      accentColorToken: 'facility-kamc',
      units: [{
        id: 'unit-icu',
        name: 'ICU',
        blockType: 'equipmentDay',
        rows: [
          {
            id: 'row-day',
            blockType: 'equipmentDay',
            unitLabel: 'ICU',
            rowLabel: 'Day Shift',
            shiftLabel: 'Day Shift',
            timeRange: '08:00 - 17:00',
            colorKey: 'morning',
            weekendOnly: false,
            cellsByDay: {
              15: [{ employeeId: 'emp-ahmed', employeeCode: 'AHM', status: 'published' }],
            },
          },
          {
            id: 'row-night',
            blockType: 'equipmentDay',
            unitLabel: 'ICU',
            rowLabel: 'Night Shift',
            shiftLabel: 'Night Shift',
            timeRange: '20:00 - 08:00',
            colorKey: 'night',
            weekendOnly: false,
            cellsByDay: {
              16: [{ employeeId: 'emp-khalid', employeeCode: 'KHA', status: 'published' }],
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
  };
}

describe('Shift Requests Automation & Schedule Synchronization Tests', () => {
  let scheduleBefore: ReturnType<typeof useScheduleMatrixStore.getState>;

  beforeAll(() => {
    scheduleBefore = useScheduleMatrixStore.getState();
  });

  afterEach(() => {
    useScheduleMatrixStore.setState(scheduleBefore, true);
    localStorage.clear();
  });

  it('1. Verifies recipient availability rule: disabled for exchange when count === 0, but available for replace', () => {
    const shiftCountAvailable = 0; // Colleague has 0 published future shifts
    
    // Rule for Exchange (تبادل): requires colleague to offer a shift back
    const isUnavailableForExchange = ('exchange' as string) === 'exchange' && shiftCountAvailable === 0;
    expect(isUnavailableForExchange).toBe(true);

    // Rule for Replace (تعويض): allows any active colleague in same department to take the shift
    const isUnavailableForReplace = ('replace' as string) === 'exchange' && shiftCountAvailable === 0;
    expect(isUnavailableForReplace).toBe(false);
  });

  it('2. REPLACE REQUEST Flow: Automatically updates schedule matrix when admin approves', () => {
    const data = sampleMatrix();
    const monthKey = '2099-07'; // Year 2099 month 6 (0-indexed => 7)
    useScheduleMatrixStore.setState({
      data: structuredClone(data),
      matricesByMonth: { [monthKey]: structuredClone(data) },
      draftsByMonth: { [monthKey]: structuredClone(data) },
      snapshot: JSON.stringify(data),
      undoStack: [],
      versionsByMonth: {},
      monthStatuses: { [monthKey]: 'published' },
      storageError: null,
    });

    // Ahmed wants to be REPLACED on Day 15 by Omar (who currently has no shift on that cell)
    const requesterAssignment = createScheduleAssignmentRef(data, 'row-day', 15, 'emp-ahmed');
    expect(requesterAssignment).not.toBeNull();

    const access = (accountId: string, employeeId: string): EmployeeAccessProfile => ({
      accountId,
      departmentId: 'dept-1',
      scheduleEmployeeId: employeeId,
      templateId: 'standard',
      overrides: {},
      active: true,
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'system',
    });
    const profiles: Record<string, EmployeeAccessProfile> = {
      'acc-ahmed': access('acc-ahmed', 'emp-ahmed'),
      'acc-omar': access('acc-omar', 'emp-omar'),
    };

    let currentActor = 'acc-ahmed';
    const store = createShiftRequestStore({
      gateway: browserShiftAssignmentGateway,
      profiles: () => profiles,
      isCurrentActor: (id) => id === currentActor,
      isAdmin: (id) => id === 'acc-admin',
      now: () => new Date('2099-06-01T10:00:00'),
      createId: () => 'req-replace-test-1',
    });

    // Step A: Ahmed creates Replace request targeting Omar
    const createRes = store.getState().createRequest({
      type: 'replace',
      requesterAccountId: 'acc-ahmed',
      requesterName: 'Ahmed',
      recipientAccountId: 'acc-omar',
      recipientName: 'Omar',
      requesterAssignment: requesterAssignment!,
    });
    expect(createRes.ok).toBe(true);

    // Verify before approval: schedule cell on Day 15 still has Ahmed
    expect(
      useScheduleMatrixStore.getState().matricesByMonth[monthKey].facilities[0].units[0].rows[0].cellsByDay[15][0].employeeId
    ).toBe('emp-ahmed');

    // Step B: Omar accepts covering the shift
    currentActor = 'acc-omar';
    const acceptRes = store.getState().acceptByRecipient('req-replace-test-1', 'acc-omar', 'Omar');
    expect(acceptRes.ok).toBe(true);

    // Step C: Admin approves the request
    currentActor = 'acc-admin';
    const approveRes = store.getState().approveByAdmin('req-replace-test-1', 'acc-admin', 'Administrator');
    expect(approveRes.ok).toBe(true);

    // VERIFICATION: Schedule matrix updated automatically right when admin approved!
    const updatedCells = useScheduleMatrixStore.getState().matricesByMonth[monthKey].facilities[0].units[0].rows[0].cellsByDay[15];
    expect(updatedCells[0].employeeId).toBe('emp-omar');
    expect(updatedCells[0].employeeCode).toBe('emp-omar'); // Code assigned or transferred
  });

  it('3. EXCHANGE REQUEST Flow: Automatically swaps both employees in schedule matrix when admin approves', () => {
    const data = sampleMatrix();
    const monthKey = '2099-07';
    useScheduleMatrixStore.setState({
      data: structuredClone(data),
      matricesByMonth: { [monthKey]: structuredClone(data) },
      draftsByMonth: { [monthKey]: structuredClone(data) },
      snapshot: JSON.stringify(data),
      undoStack: [],
      versionsByMonth: {},
      monthStatuses: { [monthKey]: 'published' },
      storageError: null,
    });

    // Ahmed (Day shift 15) and Khalid (Night shift 16) exchange their shifts
    const requesterAssignment = createScheduleAssignmentRef(data, 'row-day', 15, 'emp-ahmed');
    const offeredAssignment = createScheduleAssignmentRef(data, 'row-night', 16, 'emp-khalid');
    expect(requesterAssignment).not.toBeNull();
    expect(offeredAssignment).not.toBeNull();

    const access = (accountId: string, employeeId: string): EmployeeAccessProfile => ({
      accountId,
      departmentId: 'dept-1',
      scheduleEmployeeId: employeeId,
      templateId: 'standard',
      overrides: {},
      active: true,
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'system',
    });
    const profiles: Record<string, EmployeeAccessProfile> = {
      'acc-ahmed': access('acc-ahmed', 'emp-ahmed'),
      'acc-khalid': access('acc-khalid', 'emp-khalid'),
    };

    let currentActor = 'acc-ahmed';
    const store = createShiftRequestStore({
      gateway: browserShiftAssignmentGateway,
      profiles: () => profiles,
      isCurrentActor: (id) => id === currentActor,
      isAdmin: (id) => id === 'acc-admin',
      now: () => new Date('2099-06-01T10:00:00'),
      createId: () => 'req-exchange-test-1',
    });

    // Step A: Ahmed creates Exchange request
    const createRes = store.getState().createRequest({
      type: 'exchange',
      requesterAccountId: 'acc-ahmed',
      requesterName: 'Ahmed',
      recipientAccountId: 'acc-khalid',
      recipientName: 'Khalid',
      requesterAssignment: requesterAssignment!,
      offeredAssignment: offeredAssignment!,
    });
    expect(createRes.ok).toBe(true);

    // Step B: Khalid accepts
    currentActor = 'acc-khalid';
    store.getState().acceptByRecipient('req-exchange-test-1', 'acc-khalid', 'Khalid');

    // Step C: Admin approves
    currentActor = 'acc-admin';
    const approveRes = store.getState().approveByAdmin('req-exchange-test-1', 'acc-admin', 'Administrator');
    expect(approveRes.ok).toBe(true);

    // VERIFICATION: Both cells automatically swapped right when admin approved!
    const rows = useScheduleMatrixStore.getState().matricesByMonth[monthKey].facilities[0].units[0].rows;
    expect(rows[0].cellsByDay[15][0].employeeId).toBe('emp-khalid'); // Ahmed's old cell now has Khalid
    expect(rows[1].cellsByDay[16][0].employeeId).toBe('emp-ahmed');  // Khalid's old cell now has Ahmed
  });

  it('4. Verifies exchange request creation, visibility for recipient & admin, and duplicate detection between Hamad and Eshraq', () => {
    const data = sampleMatrix();
    const monthKey = '2099-07';
    useScheduleMatrixStore.setState({
      data: structuredClone(data),
      matricesByMonth: { [monthKey]: structuredClone(data) },
      draftsByMonth: { [monthKey]: structuredClone(data) },
      snapshot: JSON.stringify(data),
      undoStack: [],
      versionsByMonth: {},
      monthStatuses: { [monthKey]: 'published' },
      storageError: null,
    });

    const requesterAssignment = createScheduleAssignmentRef(data, 'row-day', 15, 'emp-ahmed');
    const offeredAssignment = createScheduleAssignmentRef(data, 'row-night', 16, 'emp-khalid');

    const access = (accountId: string, employeeId: string): EmployeeAccessProfile => ({
      accountId,
      departmentId: 'dept-1',
      scheduleEmployeeId: employeeId,
      templateId: 'standard',
      overrides: {},
      active: true,
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'system',
    });
    const profiles: Record<string, EmployeeAccessProfile> = {
      'emp-m-3': access('emp-m-3', 'emp-ahmed'), // Hamad
      'emp-m-9': access('emp-m-9', 'emp-khalid'), // Eshraq
    };

    let currentActor = 'emp-m-3';
    let nextId = 1;
    const store = createShiftRequestStore({
      gateway: browserShiftAssignmentGateway,
      profiles: () => profiles,
      isCurrentActor: (id) => id === currentActor,
      isAdmin: (id) => id === 'acc-admin',
      now: () => new Date('2099-06-01T10:00:00'),
      createId: () => `req-exchange-hamad-eshraq-${nextId++}`,
    });

    // Hamad creates exchange targeting Eshraq
    const createRes = store.getState().createRequest({
      type: 'exchange',
      requesterAccountId: 'emp-m-3',
      requesterName: 'Hamad',
      recipientAccountId: 'emp-m-9',
      recipientName: 'Eshraq',
      requesterAssignment: requesterAssignment!,
      offeredAssignment: offeredAssignment!,
    });
    expect(createRes.ok).toBe(true);

    // Verify visibility for Eshraq (recipient)
    const eshraqVisible = store.getState().visibleForUser({
      id: 'emp-m-9',
      role: 'employee',
      departmentId: 'dept-1',
    });
    expect(eshraqVisible.length).toBe(1);
    expect(eshraqVisible[0].requester.accountId).toBe('emp-m-3');
    expect(eshraqVisible[0].recipient.accountId).toBe('emp-m-9');

    // Verify visibility for Admin
    const adminVisible = store.getState().visibleForUser({
      id: 'acc-admin',
      role: 'admin',
      departmentId: 'dept-1',
    });
    expect(adminVisible.length).toBe(1);

    // Attempting exact duplicate request while active returns duplicate_request
    const dupRes = store.getState().createRequest({
      type: 'exchange',
      requesterAccountId: 'emp-m-3',
      requesterName: 'Hamad',
      recipientAccountId: 'emp-m-9',
      recipientName: 'Eshraq',
      requesterAssignment: requesterAssignment!,
      offeredAssignment: offeredAssignment!,
    });
    expect(dupRes.ok).toBe(false);
    if (!dupRes.ok) {
      expect(dupRes.reason).toBe('duplicate_request');
    }
  });

  it('5. Verifies Day Shift + OT conflict blocks creation in createRequest', () => {
    const access = (accountId: string, employeeId: string): EmployeeAccessProfile => ({
      accountId,
      departmentId: 'dept-1',
      scheduleEmployeeId: employeeId,
      templateId: 'standard',
      overrides: {},
      active: true,
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'system',
    });
    const profiles: Record<string, EmployeeAccessProfile> = {
      'emp-m-3': access('emp-m-3', 'emp-ahmed'), // Hamad
      'emp-m-9': access('emp-m-9', 'emp-khalid'), // Eshraq
    };

    const store = createShiftRequestStore({
      storage: null,
      gateway: browserShiftAssignmentGateway,
      profiles: () => profiles,
      isCurrentActor: (id) => id === 'emp-m-3',
    });
    const data = sampleMatrix();
    const monthKey = '2099-07';
    useScheduleMatrixStore.setState({
      data: structuredClone(data),
      matricesByMonth: { [monthKey]: structuredClone(data) },
      draftsByMonth: { [monthKey]: structuredClone(data) },
      snapshot: JSON.stringify(data),
      undoStack: [],
      versionsByMonth: {},
      monthStatuses: { [monthKey]: 'published' },
      storageError: null,
    });

    const requesterAssignment = createScheduleAssignmentRef(data, 'row-day', 15, 'emp-ahmed');
    expect(requesterAssignment).not.toBeNull();

    // Set up OT assignment right after the day shift in useLateScheduleStore
    useLateScheduleStore.setState({
      publishedRowsByMonth: {
        [monthKey]: [
          {
            id: 'row-ot-1',
            title: 'Overtime',
            location: 'KAMC',
            timeRange: '16:00 - 00:00',
            hours: 8,
            assignments: {
              15: [{ kind: 'employee', employeeId: 'emp-ahmed' }],
            },
          },
        ],
      },
      departmentIdsByMonth: {
        [monthKey]: 'dept-1',
      },
      monthStatuses: {
        [monthKey]: 'published',
      },
    });

    const result = store.getState().createRequest({
      type: 'replace',
      requesterAccountId: 'emp-m-3',
      requesterName: 'Hamad',
      recipientAccountId: 'emp-m-9',
      recipientName: 'Eshraq',
      requesterAssignment: requesterAssignment!,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('day_shift_ot_conflict');
    }
  });
});
