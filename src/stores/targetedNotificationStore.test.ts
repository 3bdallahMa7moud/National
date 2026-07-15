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
      { type: 'shift_request_received', title: 'Employee', message: 'A', isUrgent: false, recipientAccountId: 'employee-a' },
      { type: 'shift_request_recipient_accepted', title: 'Admin', message: 'B', isUrgent: true, recipientRole: 'admin', departmentId: 'dept-1' },
    ]);
    expect(store.getState().forUser({ id: 'employee-a', role: 'employee', departmentId: 'dept-1' })).toHaveLength(1);
    expect(store.getState().forUser({ id: 'admin-a', role: 'admin', departmentId: 'dept-1' })).toHaveLength(1);
    expect(store.getState().forUser({ id: 'admin-b', role: 'admin', departmentId: 'dept-2' })).toHaveLength(0);
  });
});
