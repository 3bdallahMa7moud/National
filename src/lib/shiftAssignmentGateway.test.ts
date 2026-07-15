import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { browserShiftAssignmentGateway, createOTAssignmentRef, createScheduleAssignmentRef } from './shiftAssignmentGateway';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { createShiftRequestStore } from '@/stores/shiftRequestStore';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';
import type { ShiftRequest } from '@/types/shiftRequest';

function matrix(): ScheduleMatrixData {
  return {
    departmentId: 'dept-1',
    year: 2026,
    month: 6,
    facilities: [{
      id: 'facility-a', name: 'Facility', accentColorToken: 'facility-kamc', units: [{
        id: 'unit-a', name: 'Unit', blockType: 'equipmentDay', rows: [{
          id: 'row-a', blockType: 'equipmentDay', unitLabel: 'Unit', rowLabel: 'Row',
          shiftLabel: 'Day', timeRange: '08:00 - 17:00', colorKey: 'morning', weekendOnly: false,
          cellsByDay: { 20: [{ employeeId: 'employee-a', employeeCode: 'A', status: 'published' }] },
        }],
      }],
    }],
    legend: [], vacations: [], holidays: [], settings: [], auditLog: [],
  };
}

describe('shiftAssignmentGateway references', () => {
  it('rejects cross-department Schedule references and fingerprints unit moves', () => {
    const data = matrix();
    expect(createScheduleAssignmentRef(data, 'row-a', 20, 'employee-a', 'dept-2')).toBeNull();
    const before = createScheduleAssignmentRef(data, 'row-a', 20, 'employee-a', 'dept-1');
    if (!before) throw new Error('missing reference');
    data.facilities[0].units[0].id = 'unit-b';
    const after = createScheduleAssignmentRef(data, 'row-a', 20, 'employee-a', 'dept-1');
    expect(after?.fingerprint).not.toBe(before.fingerprint);
  });

  it('does not expose OT rows whose parent unit is archived', () => {
    const rows: OTShiftRow[] = [{
      id: 'ot-row', unitId: 'ot-unit', title: 'OT', location: 'Facility', timeRange: '17:00 - 21:00', hours: 4,
      assignments: { 20: [{ kind: 'employee', employeeId: 'employee-a' }] },
    }];
    const units: OTUnit[] = [{ id: 'ot-unit', name: 'OT Unit', archived: true }];
    expect(createOTAssignmentRef(rows, 2026, 6, 'ot-row', 20, 'employee-a', 'dept-1', units)).toBeNull();
  });
});

describe('shiftAssignmentGateway published application', () => {
  let scheduleBefore: ReturnType<typeof useScheduleMatrixStore.getState>;
  let otBefore: ReturnType<typeof useLateScheduleStore.getState>;

  beforeAll(() => {
    scheduleBefore = useScheduleMatrixStore.getState();
    otBefore = useLateScheduleStore.getState();
  });

  afterEach(() => {
    useScheduleMatrixStore.setState(scheduleBefore, true);
    useLateScheduleStore.setState(otBefore, true);
    localStorage.clear();
  });

  function requestFrom(
    type: 'exchange' | 'replace',
    requesterAssignment: NonNullable<ReturnType<typeof createScheduleAssignmentRef>> | NonNullable<ReturnType<typeof createOTAssignmentRef>>,
    offeredAssignment?: NonNullable<ReturnType<typeof createScheduleAssignmentRef>> | NonNullable<ReturnType<typeof createOTAssignmentRef>>,
  ): ShiftRequest {
    return {
      id: 'request-integration',
      type,
      departmentId: 'dept-1',
      requester: { accountId: 'account-a', employeeId: 'employee-a', employeeCode: 'A', name: 'A' },
      recipient: { accountId: 'account-b', employeeId: 'employee-b', employeeCode: 'B', name: 'B' },
      requesterAssignment,
      offeredAssignment,
      status: 'pending_admin',
      warnings: [],
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
      expiresAt: requesterAssignment.startsAt,
      timeline: [],
    };
  }

  it('exchanges only the selected Schedule employees and rebases draft, snapshot, and undo', () => {
    const data = matrix();
    data.facilities[0].units[0].rows.push({
      ...data.facilities[0].units[0].rows[0],
      id: 'row-b',
      rowLabel: 'Row B',
      cellsByDay: { 21: [
        { employeeId: 'employee-b', employeeCode: 'B', status: 'published' },
        { employeeId: 'employee-d', employeeCode: 'D', status: 'published' },
      ] },
    });
    data.facilities[0].units[0].rows[0].cellsByDay[20].push(
      { employeeId: 'employee-c', employeeCode: 'C', status: 'published' },
    );
    const key = '2026-07';
    const draft = structuredClone(data);
    const undoData = structuredClone(data);
    useScheduleMatrixStore.setState({
      data: structuredClone(data),
      matricesByMonth: { [key]: structuredClone(data) },
      draftsByMonth: { [key]: draft },
      snapshot: JSON.stringify(data),
      draftCellKeys: ['settings|unrelated'],
      undoStack: [{ data: undoData, draftCellKeys: [], brushEmployeeCodes: [] }],
      versionsByMonth: {},
      monthStatuses: { [key]: 'published' },
      storageError: null,
    });
    const first = createScheduleAssignmentRef(data, 'row-a', 20, 'employee-a');
    const second = createScheduleAssignmentRef(data, 'row-b', 21, 'employee-b');
    if (!first || !second) throw new Error('missing Schedule refs');

    const result = browserShiftAssignmentGateway.apply(requestFrom('exchange', first, second), {
      actorName: 'Administrator', overrideConflicts: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = useScheduleMatrixStore.getState();
    const publishedRows = state.matricesByMonth[key].facilities[0].units[0].rows;
    expect(publishedRows[0].cellsByDay[20].map((item) => item.employeeId)).toEqual(['employee-c', 'employee-b']);
    expect(publishedRows[1].cellsByDay[21].map((item) => item.employeeId)).toEqual(['employee-d', 'employee-a']);
    expect(state.draftsByMonth[key].facilities[0].units[0].rows[0].cellsByDay[20]).toEqual(publishedRows[0].cellsByDay[20]);
    expect((JSON.parse(state.snapshot) as ScheduleMatrixData).facilities[0].units[0].rows[1].cellsByDay[21]).toEqual(publishedRows[1].cellsByDay[21]);
    expect(state.undoStack[0].data.facilities[0].units[0].rows[0].cellsByDay[20]).toEqual(publishedRows[0].cellsByDay[20]);
    expect(state.versionsByMonth[key]).toHaveLength(1);

    browserShiftAssignmentGateway.rollback(result.receipt);
    expect(useScheduleMatrixStore.getState().matricesByMonth[key].facilities[0].units[0].rows[0].cellsByDay[20][0].employeeId).toBe('employee-a');
  });

  it('runs the complete employee-to-employee-to-admin exchange against the real published gateway', () => {
    const data = matrix();
    data.year = 2099;
    data.month = 0;
    data.facilities[0].units[0].rows[0].cellsByDay = { 20: [
      { employeeId: 'employee-a', employeeCode: 'A', status: 'published' },
      { employeeId: 'employee-c', employeeCode: 'C', status: 'published' },
    ] };
    data.facilities[0].units[0].rows.push({
      ...structuredClone(data.facilities[0].units[0].rows[0]),
      id: 'row-b',
      rowLabel: 'Row B',
      cellsByDay: { 21: [
        { employeeId: 'employee-b', employeeCode: 'B', status: 'published' },
        { employeeId: 'employee-d', employeeCode: 'D', status: 'published' },
      ] },
    });
    const key = '2099-01';
    useScheduleMatrixStore.setState({
      data: structuredClone(data),
      matricesByMonth: { [key]: structuredClone(data) },
      draftsByMonth: { [key]: structuredClone(data) },
      snapshot: JSON.stringify(data),
      undoStack: [],
      versionsByMonth: {},
      monthStatuses: { [key]: 'published' },
      draftCellKeys: [],
      storageError: null,
    });
    const requesterAssignment = createScheduleAssignmentRef(data, 'row-a', 20, 'employee-a');
    const offeredAssignment = createScheduleAssignmentRef(data, 'row-b', 21, 'employee-b');
    if (!requesterAssignment || !offeredAssignment) throw new Error('missing future exchange references');

    const access = (accountId: string, employeeId: string): EmployeeAccessProfile => ({
      accountId,
      departmentId: 'dept-1',
      scheduleEmployeeId: employeeId,
      templateId: 'standard',
      overrides: {},
      active: true,
      updatedAt: '2098-12-01T00:00:00.000Z',
      updatedBy: 'Admin',
    });
    const profiles = {
      requester: access('requester', 'employee-a'),
      recipient: access('recipient', 'employee-b'),
    };
    let currentActor = 'requester';
    const notify = vi.fn(() => true);
    const recordAudit = vi.fn(() => undefined);
    const values = new Map<string, string>();
    const requestStore = createShiftRequestStore({
      storage: {
        getItem: (storageKey) => values.get(storageKey) ?? null,
        setItem: (storageKey, value) => { values.set(storageKey, value); },
      },
      gateway: browserShiftAssignmentGateway,
      profiles: () => profiles,
      isCurrentActor: (accountId) => accountId === currentActor,
      isAdmin: (accountId) => accountId === 'admin',
      notify,
      recordAudit,
      now: () => new Date('2098-12-01T10:00:00'),
      createId: (() => { let index = 0; return () => `full-flow-${++index}`; })(),
    });

    const created = requestStore.getState().createRequest({
      type: 'exchange',
      requesterAccountId: 'requester',
      requesterName: 'Requester',
      recipientAccountId: 'recipient',
      recipientName: 'Recipient',
      requesterAssignment,
      offeredAssignment,
    });
    expect(created).toMatchObject({ ok: true, request: { status: 'pending_recipient' } });
    if (!created.ok) return;
    currentActor = 'recipient';
    expect(requestStore.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient')).toMatchObject({
      ok: true,
      request: { status: 'pending_admin' },
    });
    currentActor = 'admin';
    expect(requestStore.getState().approveByAdmin(created.request.id, 'admin', 'Administrator')).toMatchObject({
      ok: true,
      request: { status: 'approved' },
    });

    const publishedRows = useScheduleMatrixStore.getState().matricesByMonth[key].facilities[0].units[0].rows;
    expect(publishedRows[0].cellsByDay[20].map((assignment) => assignment.employeeId)).toEqual(['employee-c', 'employee-b']);
    expect(publishedRows[1].cellsByDay[21].map((assignment) => assignment.employeeId)).toEqual(['employee-d', 'employee-a']);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(recordAudit).toHaveBeenCalledTimes(3);
  });

  it('blocks approval when the same Schedule cell has an unresolved draft change', () => {
    const data = matrix();
    data.year = 2099;
    data.month = 2;
    data.facilities[0].units[0].rows.push({
      ...structuredClone(data.facilities[0].units[0].rows[0]),
      id: 'row-b',
      cellsByDay: { 21: [{ employeeId: 'employee-b', employeeCode: 'B', status: 'published' }] },
    });
    const key = '2099-03';
    const draft = structuredClone(data);
    draft.facilities[0].units[0].rows[0].cellsByDay[20].push({
      employeeId: 'draft-only', employeeCode: 'DRAFT', status: 'draft',
    });
    useScheduleMatrixStore.setState({
      data: structuredClone(draft),
      matricesByMonth: { [key]: structuredClone(data) },
      draftsByMonth: { [key]: draft },
      versionsByMonth: {},
      monthStatuses: { [key]: 'draft' },
      storageError: null,
    });
    const first = createScheduleAssignmentRef(data, 'row-a', 20, 'employee-a');
    const second = createScheduleAssignmentRef(data, 'row-b', 21, 'employee-b');
    if (!first || !second) throw new Error('missing draft-conflict refs');

    expect(browserShiftAssignmentGateway.apply(requestFrom('exchange', first, second), {
      actorName: 'Administrator', overrideConflicts: true,
    })).toMatchObject({ ok: false, reason: 'draft_conflict' });
    expect(useScheduleMatrixStore.getState().matricesByMonth[key].facilities[0].units[0]
      .rows[0].cellsByDay[20].map((assignment) => assignment.employeeId)).toEqual(['employee-a']);
    expect(useScheduleMatrixStore.getState().versionsByMonth[key]).toBeUndefined();
  });

  it('replaces one OT employee while preserving every co-assignment and supports rollback', () => {
    const key = '2026-07';
    const rows: OTShiftRow[] = [{
      id: 'ot-row', unitId: 'ot-unit', title: 'OT', location: 'Facility', timeRange: '17:00 - 21:00', hours: 4,
      assignments: { 20: [
        { kind: 'employee', employeeId: 'employee-a' },
        { kind: 'employee', employeeId: 'employee-c' },
      ] },
    }];
    const units: OTUnit[] = [{ id: 'ot-unit', name: 'OT Unit' }];
    useLateScheduleStore.setState({
      year: 2026,
      month: 6,
      rows: structuredClone(rows),
      rowsByMonth: { [key]: structuredClone(rows) },
      unitsByMonth: { [key]: structuredClone(units) },
      publishedRowsByMonth: { [key]: structuredClone(rows) },
      publishedUnitsByMonth: { [key]: structuredClone(units) },
      departmentIdsByMonth: { [key]: 'dept-1' },
      versionsByMonth: {},
      monthStatuses: { [key]: 'published' },
      storageError: null,
    });
    const ref = createOTAssignmentRef(rows, 2026, 6, 'ot-row', 20, 'employee-a', 'dept-1', units);
    if (!ref) throw new Error('missing OT ref');

    const result = browserShiftAssignmentGateway.apply(requestFrom('replace', ref), {
      actorName: 'Administrator', overrideConflicts: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const assignments = useLateScheduleStore.getState().publishedRowsByMonth[key][0].assignments[20];
    expect(assignments).toEqual([
      { kind: 'employee', employeeId: 'employee-c' },
      { kind: 'employee', employeeId: 'employee-b' },
    ]);
    expect(useLateScheduleStore.getState().rowsByMonth[key][0].assignments[20]).toEqual(assignments);
    expect(useLateScheduleStore.getState().versionsByMonth[key]).toHaveLength(1);

    browserShiftAssignmentGateway.rollback(result.receipt);
    expect(useLateScheduleStore.getState().publishedRowsByMonth[key][0].assignments[20]).toEqual(rows[0].assignments[20]);
  });

  it('exchanges OT assignments between two published months and versions both months', () => {
    const januaryKey = '2099-01';
    const februaryKey = '2099-02';
    const januaryRows: OTShiftRow[] = [{
      id: 'ot-january', unitId: 'ot-unit', title: 'January OT', location: 'Facility', timeRange: '17:00 - 21:00', hours: 4,
      assignments: { 20: [
        { kind: 'employee', employeeId: 'employee-a' },
        { kind: 'employee', employeeId: 'employee-c' },
      ] },
    }];
    const februaryRows: OTShiftRow[] = [{
      id: 'ot-february', unitId: 'ot-unit', title: 'February OT', location: 'Facility', timeRange: '17:00 - 21:00', hours: 4,
      assignments: { 21: [
        { kind: 'employee', employeeId: 'employee-b' },
        { kind: 'employee', employeeId: 'employee-d' },
      ] },
    }];
    const units: OTUnit[] = [{ id: 'ot-unit', name: 'OT Unit' }];
    useLateScheduleStore.setState({
      year: 2099,
      month: 0,
      rows: structuredClone(januaryRows),
      rowsByMonth: {
        [januaryKey]: structuredClone(januaryRows),
        [februaryKey]: structuredClone(februaryRows),
      },
      unitsByMonth: { [januaryKey]: structuredClone(units), [februaryKey]: structuredClone(units) },
      publishedRowsByMonth: {
        [januaryKey]: structuredClone(januaryRows),
        [februaryKey]: structuredClone(februaryRows),
      },
      publishedUnitsByMonth: { [januaryKey]: structuredClone(units), [februaryKey]: structuredClone(units) },
      departmentIdsByMonth: { [januaryKey]: 'dept-1', [februaryKey]: 'dept-1' },
      versionsByMonth: {},
      monthStatuses: { [januaryKey]: 'published', [februaryKey]: 'published' },
      storageError: null,
    });
    const januaryRef = createOTAssignmentRef(januaryRows, 2099, 0, 'ot-january', 20, 'employee-a', 'dept-1', units);
    const februaryRef = createOTAssignmentRef(februaryRows, 2099, 1, 'ot-february', 21, 'employee-b', 'dept-1', units);
    if (!januaryRef || !februaryRef) throw new Error('missing cross-month OT refs');

    const result = browserShiftAssignmentGateway.apply(requestFrom('exchange', januaryRef, februaryRef), {
      actorName: 'Administrator', overrideConflicts: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = useLateScheduleStore.getState();
    expect(state.publishedRowsByMonth[januaryKey][0].assignments[20]).toEqual([
      { kind: 'employee', employeeId: 'employee-c' },
      { kind: 'employee', employeeId: 'employee-b' },
    ]);
    expect(state.publishedRowsByMonth[februaryKey][0].assignments[21]).toEqual([
      { kind: 'employee', employeeId: 'employee-d' },
      { kind: 'employee', employeeId: 'employee-a' },
    ]);
    expect(state.versionsByMonth[januaryKey]).toHaveLength(1);
    expect(state.versionsByMonth[februaryKey]).toHaveLength(1);

    browserShiftAssignmentGateway.rollback(result.receipt);
    expect(useLateScheduleStore.getState().publishedRowsByMonth[januaryKey]).toEqual(januaryRows);
    expect(useLateScheduleStore.getState().publishedRowsByMonth[februaryKey]).toEqual(februaryRows);
  });
});
