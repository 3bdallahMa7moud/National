import { describe, expect, it } from 'vitest';
import type { OperationalAuditDraft, OperationalAuditEntry } from '@/types/operationalAudit';
import {
  createOperationalAuditStore,
  OPERATIONAL_AUDIT_STORAGE_KEY,
  type OperationalAuditStorage,
} from './operationalAuditStore';

function memoryStorage(): OperationalAuditStorage & {
  values: Map<string, string>;
  failWrites: boolean;
} {
  const values = new Map<string, string>();
  return {
    values,
    failWrites: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      values.set(key, value);
    },
  };
}

function draft(entityId: string): OperationalAuditDraft {
  return {
    actorName: 'Administrator',
    action: 'update',
    module: 'schedule',
    entityId,
    entityLabel: `Row ${entityId}`,
    context: { route: '/admin/schedule' },
  };
}

describe('operationalAuditStore', () => {
  it('merges the latest persisted entries before a stale instance records', () => {
    const storage = memoryStorage();
    const first = createOperationalAuditStore({
      storage,
      createId: () => 'audit-a',
      now: () => '2026-07-15T10:00:00.000Z',
    });
    const stale = createOperationalAuditStore({
      storage,
      createId: () => 'audit-b',
      now: () => '2026-07-15T10:01:00.000Z',
    });

    expect(first.getState().record(draft('a'))).toMatchObject({ ok: true });
    expect(stale.getState().record(draft('b'))).toMatchObject({ ok: true });

    const persisted = JSON.parse(storage.values.get(OPERATIONAL_AUDIT_STORAGE_KEY) || '[]') as OperationalAuditEntry[];
    expect(persisted.map((entry) => entry.id)).toEqual(['audit-b', 'audit-a']);
    first.getState().reloadFromStorage();
    expect(first.getState().entries.map((entry) => entry.id)).toEqual(['audit-b', 'audit-a']);
  });

  it('reloads synchronized store instances after a successful change notification', () => {
    const storage = memoryStorage();
    let first = createOperationalAuditStore({ storage: null });
    let second = createOperationalAuditStore({ storage: null });
    first = createOperationalAuditStore({
      storage,
      createId: () => 'audit-a',
      now: () => '2026-07-15T10:00:00.000Z',
      onChanged: () => second.getState().reloadFromStorage(),
    });
    second = createOperationalAuditStore({
      storage,
      createId: () => 'audit-b',
      now: () => '2026-07-15T10:01:00.000Z',
      onChanged: () => first.getState().reloadFromStorage(),
    });

    first.getState().record(draft('a'));
    expect(second.getState().entries.map((entry) => entry.id)).toEqual(['audit-a']);
    second.getState().record(draft('b'));
    expect(first.getState().entries.map((entry) => entry.id)).toEqual(['audit-b', 'audit-a']);
  });

  it('returns a storage error and keeps the previous state when quota is exceeded', () => {
    const storage = memoryStorage();
    const existing: OperationalAuditEntry = {
      ...draft('existing'),
      id: 'audit-existing',
      timestamp: '2026-07-15T09:00:00.000Z',
    };
    storage.values.set(OPERATIONAL_AUDIT_STORAGE_KEY, JSON.stringify([existing]));
    const store = createOperationalAuditStore({
      storage,
      createId: () => 'audit-new',
      now: () => '2026-07-15T10:00:00.000Z',
    });
    storage.failWrites = true;

    const result = store.getState().record(draft('new'));

    expect(result).toMatchObject({ ok: false, reason: 'storage_error' });
    expect(store.getState().entries).toEqual([existing]);
    expect(store.getState().storageError).toContain('Quota');
    expect(JSON.parse(storage.values.get(OPERATIONAL_AUDIT_STORAGE_KEY) || '[]')).toEqual([existing]);
  });
});
