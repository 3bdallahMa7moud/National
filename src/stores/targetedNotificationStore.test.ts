import { describe, expect, it } from 'vitest';
import { createTargetedNotificationStore } from './targetedNotificationStore';
import type { TargetedNotificationStorage } from './targetedNotificationStore';

function storage(): TargetedNotificationStorage {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe('targetedNotificationStore', () => {
  it('delivers account and department-role notifications only to their targets', () => {
    let id = 0;
    const store = createTargetedNotificationStore({ storage: storage(), createId: () => `n-${++id}`, now: () => '2026-07-15T10:00:00.000Z' });
    store.getState().pushMany([
      { audience: { kind: 'account', accountId: 'employee-a' }, type: 'shift_request_received', title: 'Employee', message: 'A', isUrgent: false },
      { audience: { kind: 'departmentRole', role: 'admin', departmentId: 'dept-1' }, type: 'shift_request_recipient_accepted', title: 'Admin', message: 'B', isUrgent: true },
    ]);
    expect(store.getState().forUser({ id: 'employee-a', role: 'employee', departmentId: 'dept-1' })).toHaveLength(1);
    expect(store.getState().forUser({ id: 'admin-a', role: 'admin', departmentId: 'dept-1' })).toHaveLength(1);
    expect(store.getState().forUser({ id: 'admin-b', role: 'admin', departmentId: 'dept-2' })).toHaveLength(0);
  });

  it('deduplicates request notifications and rejects notifications without an explicit target', () => {
    let id = 0;
    const store = createTargetedNotificationStore({ storage: storage(), createId: () => `n-${++id}` });
    const draft = {
      audience: { kind: 'account' as const, accountId: 'employee-a' },
      type: 'shift_request_received' as const,
      title: 'Request',
      message: 'Request message',
      isUrgent: false,
      dedupeKey: 'request-1:created:employee-a',
    };

    expect(store.getState().pushMany([draft, draft])).toMatchObject({ ok: true });
    expect(store.getState().notifications).toHaveLength(1);
    expect(store.getState().push({
      type: 'general', title: 'Untargeted', message: 'Hidden', isUrgent: false,
    })).toMatchObject({ ok: false, reason: 'invalid_audience' });
    expect(store.getState().notifications).toHaveLength(1);
    expect(store.getState().forUser({ id: 'employee-a', role: 'employee', departmentId: 'dept-1' })).toHaveLength(1);
  });

  it('isolates read and deletion state for every account in a shared audience', () => {
    const store = createTargetedNotificationStore({ storage: storage(), createId: () => 'shared' });
    store.getState().push({
      audience: { kind: 'departmentRole', role: 'admin', departmentId: 'dept-1' },
      type: 'general', title: 'Shared', message: 'Shared notification', isUrgent: false,
    });
    const adminA = { id: 'admin-a', role: 'admin' as const, departmentId: 'dept-1' };
    const adminB = { id: 'admin-b', role: 'admin' as const, departmentId: 'dept-1' };

    store.getState().markRead('shared', adminA);
    expect(store.getState().forUser(adminA)[0]?.isRead).toBe(true);
    expect(store.getState().forUser(adminB)[0]?.isRead).toBe(false);

    store.getState().remove('shared', adminA);
    expect(store.getState().forUser(adminA)).toHaveLength(0);
    expect(store.getState().forUser(adminB)).toHaveLength(1);
  });
});
