import { describe, expect, it, vi } from 'vitest';
import { createShiftRequestStore, SHIFT_REQUEST_STORAGE_KEY, SHIFT_REQUEST_TRANSACTION_STORAGE_KEY } from './shiftRequestStore';
import type { ShiftRequestStorage } from './shiftRequestStore';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import type {
  ShiftApplyReceipt,
  ShiftAssignmentGateway,
  ShiftAssignmentRef,
} from '@/types/shiftRequest';
import { createTargetedNotificationStore } from './targetedNotificationStore';

function memoryStorage(): ShiftRequestStorage & { values: Map<string, string>; failKey?: string } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.failKey === key) throw new Error('quota');
      values.set(key, value);
    },
  };
}

function profile(accountId: string, employeeId: string): EmployeeAccessProfile {
  return {
    accountId,
    departmentId: 'dept-1',
    scheduleEmployeeId: employeeId,
    templateId: 'standard',
    overrides: {},
    active: true,
    updatedAt: '2026-07-01T00:00:00.000Z',
    updatedBy: 'Admin',
  };
}

function assignment(employeeId: string, rowId: string, day: number): ShiftAssignmentRef {
  return {
    source: 'schedule', departmentId: 'dept-1', monthKey: '2026-07', year: 2026, month: 6,
    day, rowId, employeeId, employeeCode: employeeId, facilityId: 'facility-a', unitId: 'unit-a',
    facilityLabel: 'Facility', unitLabel: 'Unit', shiftLabel: 'Day', timeRange: '08:00 - 17:00',
    fingerprint: `${rowId}-${day}-${employeeId}`, startsAt: `2026-07-${String(day).padStart(2, '0')}T08:00:00`,
  };
}

function gateway() {
  const rollback = vi.fn();
  const apply = vi.fn(() => ({
    ok: true as const,
    warnings: [],
    receipt: { id: 'receipt-1', before: { value: 'before' }, after: { value: 'after' } } satisfies ShiftApplyReceipt,
  }));
  const value: ShiftAssignmentGateway = {
    validate: (ref) => ({ ok: true, assignment: ref }),
    inspectWarnings: () => [],
    apply,
    rollback,
  };
  return { value, apply, rollback };
}

const profiles = {
  requester: profile('requester', 'employee-a'),
  recipient: profile('recipient', 'employee-b'),
};

function createInput() {
  return {
    type: 'exchange' as const,
    requesterAccountId: 'requester',
    recipientAccountId: 'recipient',
    requesterAssignment: assignment('employee-a', 'row-a', 20),
    offeredAssignment: assignment('employee-b', 'row-b', 21),
  };
}

describe('shiftRequestStore', () => {
  it('completes the in-browser requester, recipient, and admin notification journey once', () => {
    const fakeGateway = gateway();
    const notificationStore = createTargetedNotificationStore({
      storage: memoryStorage(),
      now: () => '2026-07-15T10:00:00.000Z',
    });
    let currentAccount = 'requester';
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: fakeGateway.value, profiles: () => profiles,
      isAdmin: (id) => id === 'admin', isCurrentActor: (id) => id === currentAccount,
      notify: (drafts) => notificationStore.getState().pushMany(drafts).ok,
      recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'),
      createId: (() => { let id = 0; return () => `journey-${++id}`; })(),
    });
    const requester = { id: 'requester', role: 'employee' as const, departmentId: 'dept-1' };
    const recipient = { id: 'recipient', role: 'employee' as const, departmentId: 'dept-1' };
    const admin = { id: 'admin', role: 'admin' as const, departmentId: 'dept-1' };

    const created = store.getState().createRequest(createInput());
    if (!created.ok) throw new Error(created.reason);
    expect(notificationStore.getState().forUser(requester).map((item) => item.type))
      .toEqual(['shift_request_submitted']);
    expect(notificationStore.getState().forUser(recipient).map((item) => item.type))
      .toEqual(['shift_request_received']);
    expect(notificationStore.getState().forUser(admin)).toHaveLength(0);

    currentAccount = 'recipient';
    expect(store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: true });
    expect(notificationStore.getState().forUser(admin)).toHaveLength(1);
    expect(notificationStore.getState().forUser(admin)[0]).toMatchObject({
      type: 'shift_request_recipient_accepted', isUrgent: true,
    });
    expect(store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient'))
      .toMatchObject({ ok: false, reason: 'invalid_status' });
    expect(notificationStore.getState().forUser(admin)).toHaveLength(1);

    currentAccount = 'admin';
    expect(store.getState().approveByAdmin(created.request.id, 'admin', 'Administrator'))
      .toMatchObject({ ok: true, request: { status: 'approved' } });
    expect(fakeGateway.apply).toHaveBeenCalledTimes(1);
    expect(notificationStore.getState().forUser(requester).some((item) => item.type === 'shift_request_approved')).toBe(true);
    expect(notificationStore.getState().forUser(recipient).some((item) => item.type === 'shift_request_approved')).toBe(true);
  });

  it('runs recipient approval then admin approval and records the published application', () => {
    const fakeGateway = gateway();
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: fakeGateway.value, profiles: () => profiles,
      isAdmin: (id) => id === 'admin', isCurrentActor: () => true, notify: () => true, recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'), createId: (() => { let id = 0; return () => `id-${++id}`; })(),
    });
    const created = store.getState().createRequest(createInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: true, request: { status: 'pending_admin' } });
    expect(store.getState().approveByAdmin(created.request.id, 'admin', 'Administrator')).toMatchObject({ ok: true, request: { status: 'approved' } });
    expect(fakeGateway.apply).toHaveBeenCalledTimes(1);
  });

  it('notifies requester and recipient on creation, then requester and admin after recipient acceptance', () => {
    const batches: Array<Array<{ audience?: unknown; dedupeKey?: string }>> = [];
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: gateway().value, profiles: () => profiles,
      isAdmin: (id) => id === 'admin', isCurrentActor: () => true,
      notify: (drafts) => { batches.push(drafts); return true; },
      recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'),
    });

    const created = store.getState().createRequest(createInput());
    if (!created.ok) throw new Error(created.reason);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0].map((draft) => draft.audience)).toEqual(expect.arrayContaining([
      { kind: 'account', accountId: 'requester' },
      { kind: 'account', accountId: 'recipient' },
    ]));
    expect(new Set(batches[0].map((draft) => draft.dedupeKey)).size).toBe(2);

    expect(store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: true });
    expect(batches[1]).toHaveLength(2);
    expect(batches[1].map((draft) => draft.audience)).toEqual(expect.arrayContaining([
      { kind: 'account', accountId: 'requester' },
      { kind: 'departmentRole', role: 'admin', departmentId: 'dept-1' },
    ]));
  });

  it('allows competing requests for one shift and marks the remaining request stale after approval', () => {
    const fakeGateway = gateway();
    const competingProfiles = {
      ...profiles,
      recipient2: profile('recipient2', 'employee-c'),
    };
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: fakeGateway.value, profiles: () => competingProfiles,
      isAdmin: (id) => id === 'admin', isCurrentActor: () => true, notify: () => true, recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'), createId: (() => { let id = 0; return () => `competing-${++id}`; })(),
    });
    const first = store.getState().createRequest(createInput());
    expect(first.ok).toBe(true);
    expect(store.getState().createRequest(createInput())).toMatchObject({ ok: false, reason: 'duplicate_request' });
    const second = store.getState().createRequest({
      ...createInput(),
      recipientAccountId: 'recipient2',
      offeredAssignment: assignment('employee-c', 'row-c', 22),
    });
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(store.getState().acceptByRecipient(first.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: true });
    expect(store.getState().acceptByRecipient(second.request.id, 'recipient2', 'Recipient 2')).toMatchObject({ ok: true });
    expect(store.getState().approveByAdmin(first.request.id, 'admin', 'Administrator')).toMatchObject({ ok: true });
    expect(store.getState().requests.find((request) => request.id === second.request.id)).toMatchObject({
      status: 'stale',
    });
    expect(fakeGateway.apply).toHaveBeenCalledTimes(1);
  });

  it('allows recipient rejection without a reason and requires a note for admin Other', () => {
    const batches: Array<Array<{ audience?: unknown; params?: Record<string, string | number>; type?: string }>> = [];
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: gateway().value, profiles: () => profiles,
      isAdmin: () => true, isCurrentActor: () => true,
      notify: (drafts) => { batches.push(drafts); return true; },
      recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'),
    });
    const first = store.getState().createRequest(createInput());
    expect(first.ok && store.getState().rejectByRecipient(first.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: true, request: { status: 'recipient_rejected' } });
    store.getState().clearForTests();
    const second = store.getState().createRequest(createInput());
    if (!second.ok) throw new Error(second.reason);
    store.getState().acceptByRecipient(second.request.id, 'recipient', 'Recipient');
    expect(store.getState().rejectByAdmin(second.request.id, 'admin', 'Admin', 'other')).toMatchObject({ ok: false, reason: 'rejection_note_required' });
    expect(store.getState().rejectByAdmin(second.request.id, 'admin', 'Admin', 'other', 'Coverage rule')).toMatchObject({ ok: true, request: { status: 'admin_rejected' } });
    const rejectionBatch = batches[batches.length - 1] || [];
    expect(rejectionBatch).toHaveLength(2);
    expect(rejectionBatch.map((draft) => draft.audience)).toEqual(expect.arrayContaining([
      { kind: 'account', accountId: 'requester' },
      { kind: 'account', accountId: 'recipient' },
    ]));
    expect(rejectionBatch.every((draft) => draft.type === 'shift_request_rejected')).toBe(true);
    expect(rejectionBatch.every((draft) => draft.params?.adminRejectionReasonKey === 'other')).toBe(true);
    expect(rejectionBatch.every((draft) => draft.params?.adminRejectionReason === 'Coverage rule')).toBe(true);

    store.getState().clearForTests();
    const third = store.getState().createRequest(createInput());
    if (!third.ok) throw new Error(third.reason);
    expect(store.getState().approveByAdmin(third.request.id, 'admin', 'Admin')).toMatchObject({
      ok: false,
      reason: 'invalid_status',
    });
    expect(store.getState().rejectByAdmin(third.request.id, 'admin', 'Admin', 'staff_shortage'))
      .toMatchObject({ ok: true, request: { status: 'admin_rejected' } });
  });

  it('requires a separate explicit override before approving operational warnings', () => {
    const fakeGateway = gateway();
    const warning = {
      code: 'schedule_conflict' as const,
      employeeId: 'employee-b',
      assignment: createInput().requesterAssignment,
      message: 'Overlapping assignment',
    };
    fakeGateway.value.inspectWarnings = () => [warning];
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: fakeGateway.value, profiles: () => profiles,
      isAdmin: () => true, isCurrentActor: () => true, notify: () => true, recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'),
    });
    const created = store.getState().createRequest(createInput());
    if (!created.ok) throw new Error(created.reason);
    store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient');

    expect(store.getState().approveByAdmin(created.request.id, 'admin', 'Admin', false)).toMatchObject({
      ok: false,
      reason: 'conflict_requires_override',
      warnings: [warning],
    });
    expect(fakeGateway.apply).not.toHaveBeenCalled();
    expect(store.getState().requests.find((request) => request.id === created.request.id)?.status).toBe('pending_admin');
    expect(store.getState().approveByAdmin(created.request.id, 'admin', 'Admin', true)).toMatchObject({
      ok: true,
      request: { status: 'approved', conflictOverride: true },
    });
    expect(fakeGateway.apply).toHaveBeenCalledTimes(1);
  });

  it('does not create a request or notification when its audit write fails', () => {
    const notify = vi.fn(() => true);
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: gateway().value, profiles: () => profiles,
      isAdmin: () => true, isCurrentActor: () => true, notify,
      recordAudit: () => ({ ok: false, reason: 'storage_error', message: 'Audit quota exceeded.' }),
      now: () => new Date('2026-07-15T10:00:00'),
    });

    expect(store.getState().createRequest(createInput())).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(store.getState().requests).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('rolls the schedule back when request persistence fails after apply', () => {
    const fakeGateway = gateway();
    const storage = memoryStorage();
    const rollbackAudit = vi.fn(() => true);
    const store = createShiftRequestStore({
      storage, gateway: fakeGateway.value, profiles: () => profiles,
      isAdmin: () => true, isCurrentActor: () => true, notify: () => true,
      recordAudit: () => ({ ok: true, rollback: rollbackAudit }),
      now: () => new Date('2026-07-15T10:00:00'),
    });
    const created = store.getState().createRequest(createInput());
    if (!created.ok) throw new Error(created.reason);
    store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient');
    storage.failKey = SHIFT_REQUEST_STORAGE_KEY;
    expect(store.getState().approveByAdmin(created.request.id, 'admin', 'Admin')).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(fakeGateway.rollback).toHaveBeenCalledTimes(1);
    expect(rollbackAudit).toHaveBeenCalledTimes(1);
    expect(store.getState().requests.find((request) => request.id === created.request.id)?.status).toBe('pending_admin');
  });

  it('does not commit approval state or notifications and rolls the schedule back when audit persistence fails', () => {
    const fakeGateway = gateway();
    const storage = memoryStorage();
    const notify = vi.fn(() => true);
    const store = createShiftRequestStore({
      storage, gateway: fakeGateway.value, profiles: () => profiles,
      isAdmin: () => true, isCurrentActor: () => true, notify,
      recordAudit: (_request, action) => action === 'approve'
        ? { ok: false as const, reason: 'storage_error' as const, message: 'Audit quota exceeded.' }
        : undefined,
      now: () => new Date('2026-07-15T10:00:00'),
    });
    const created = store.getState().createRequest(createInput());
    if (!created.ok) throw new Error(created.reason);
    store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient');
    const notificationsBeforeApproval = notify.mock.calls.length;

    expect(store.getState().approveByAdmin(created.request.id, 'admin', 'Admin')).toMatchObject({
      ok: false,
      reason: 'storage_error',
    });
    expect(fakeGateway.rollback).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(notificationsBeforeApproval);
    expect(store.getState().requests.find((request) => request.id === created.request.id)?.status).toBe('pending_admin');
    expect(store.getState().storageError).toContain('Audit quota');
    const persisted = JSON.parse(storage.values.get(SHIFT_REQUEST_STORAGE_KEY) || '{"requests":[]}') as { requests: Array<{ id: string; status: string }> };
    expect(persisted.requests.find((request) => request.id === created.request.id)?.status).toBe('pending_admin');
    expect(storage.values.get(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY)).toBe('null');
  });

  it('recovers an unfinished approval journal on startup', () => {
    const fakeGateway = gateway();
    const storage = memoryStorage();
    storage.values.set(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY, JSON.stringify({
      version: 1,
      requestId: 'unfinished',
      receipt: { id: 'receipt', before: { old: true }, after: { new: true } },
      createdAt: '2026-07-15T10:00:00.000Z',
    }));
    createShiftRequestStore({ storage, gateway: fakeGateway.value, profiles: () => profiles, notify: () => true, recordAudit: () => undefined });
    expect(fakeGateway.rollback).toHaveBeenCalledTimes(1);
    expect(storage.values.get(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY)).toBe('null');
  });

  it('migrates an active legacy request with unresolvable parties to stale and records the reason', () => {
    const storage = memoryStorage();
    const original = createShiftRequestStore({
      storage, gateway: gateway().value, profiles: () => profiles,
      isCurrentActor: () => true, notify: () => true, recordAudit: () => undefined,
      now: () => new Date('2026-07-15T10:00:00'), createId: () => 'legacy-request',
    });
    expect(original.getState().createRequest(createInput())).toMatchObject({ ok: true });

    const migrated = createShiftRequestStore({
      storage, gateway: gateway().value, profiles: () => profiles,
      notify: () => true, recordAudit: () => undefined, migrateLegacy: true,
    });
    expect(migrated.getState().requests[0]).toMatchObject({
      status: 'stale',
      timeline: expect.arrayContaining([
        expect.objectContaining({ action: 'stale', note: expect.stringContaining('directory migration') }),
      ]),
    });
  });

  it('binds employee mutations to the current account and expires late responses', () => {
    let currentAccount = 'requester';
    let currentTime = new Date('2026-07-15T10:00:00');
    const store = createShiftRequestStore({
      storage: memoryStorage(), gateway: gateway().value, profiles: () => profiles,
      isAdmin: () => true, isCurrentActor: (accountId) => accountId === currentAccount,
      notify: () => true, recordAudit: () => undefined, now: () => currentTime,
    });
    const created = store.getState().createRequest(createInput());
    if (!created.ok) throw new Error(created.reason);
    expect(store.getState().acceptByRecipient(created.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: false, reason: 'wrong_actor' });
    currentAccount = 'recipient';
    currentTime = new Date('2026-07-22T10:00:00');
    expect(store.getState().rejectByRecipient(created.request.id, 'recipient', 'Recipient')).toMatchObject({ ok: false, reason: 'past_shift' });
    expect(store.getState().requests.find((request) => request.id === created.request.id)?.status).toBe('expired');
  });
});
