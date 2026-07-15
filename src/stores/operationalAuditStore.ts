import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { OperationalAuditDraft, OperationalAuditEntry } from '@/types/operationalAudit';

export const OPERATIONAL_AUDIT_STORAGE_KEY = 'ngh_operational_audit_v1';

export interface OperationalAuditStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OperationalAuditStoreOptions {
  storage?: OperationalAuditStorage | null;
  now?: () => string;
  createId?: () => string;
  onChanged?: () => void;
}

export interface OperationalAuditWriteFailure {
  ok: false;
  reason: 'storage_error';
  message: string;
}

export type OperationalAuditRecordResult =
  | { ok: true; entry: OperationalAuditEntry }
  | OperationalAuditWriteFailure;

export type OperationalAuditMutationResult =
  | { ok: true }
  | OperationalAuditWriteFailure;

export interface OperationalAuditState {
  entries: OperationalAuditEntry[];
  storageError: string | null;
  record(entry: OperationalAuditDraft): OperationalAuditRecordResult;
  remove(entryId: string): OperationalAuditMutationResult;
  reloadFromStorage(): void;
  clearForTests(): OperationalAuditMutationResult;
}

function browserStorage(): OperationalAuditStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is OperationalAuditEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Partial<OperationalAuditEntry>;
  return typeof entry.id === 'string'
    && typeof entry.actorName === 'string'
    && typeof entry.action === 'string'
    && typeof entry.module === 'string'
    && typeof entry.entityId === 'string'
    && typeof entry.entityLabel === 'string'
    && typeof entry.timestamp === 'string'
    && !!entry.context
    && typeof entry.context.route === 'string';
}

function readEntries(storage: OperationalAuditStorage | null): OperationalAuditEntry[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(OPERATIONAL_AUDIT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function mergeEntries(...groups: OperationalAuditEntry[][]): OperationalAuditEntry[] {
  const byId = new Map<string, OperationalAuditEntry>();
  for (const group of groups) {
    for (const entry of group) {
      if (!byId.has(entry.id)) byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function storageFailure(error: unknown): OperationalAuditWriteFailure {
  const detail = error && typeof error === 'object' && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : undefined;
  return {
    ok: false,
    reason: 'storage_error',
    message: detail
      ? `Unable to save the operational audit: ${detail}`
      : 'Unable to save the operational audit.',
  };
}

function makeState(
  options: OperationalAuditStoreOptions,
  set: StoreApi<OperationalAuditState>['setState'],
  get: StoreApi<OperationalAuditState>['getState'],
): OperationalAuditState {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => `operational-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const persist = (entries: OperationalAuditEntry[]): OperationalAuditMutationResult => {
    try {
      storage?.setItem(OPERATIONAL_AUDIT_STORAGE_KEY, JSON.stringify(entries));
      return { ok: true };
    } catch (error) {
      return storageFailure(error);
    }
  };

  const publish = (entries: OperationalAuditEntry[]) => {
    set({ entries, storageError: null });
    options.onChanged?.();
  };

  return {
    entries: readEntries(storage),
    storageError: null,
    record: (draft) => {
      const entry: OperationalAuditEntry = { ...draft, id: createId(), timestamp: now() };
      // Read immediately before writing so a stale tab cannot overwrite audit rows
      // that another tab persisted after this store instance was created.
      const entries = mergeEntries([entry], readEntries(storage), get().entries);
      const result = persist(entries);
      if (!result.ok) {
        set({ storageError: result.message });
        return result;
      }
      publish(entries);
      return { ok: true, entry };
    },
    remove: (entryId) => {
      const entries = mergeEntries(readEntries(storage), get().entries)
        .filter((entry) => entry.id !== entryId);
      const result = persist(entries);
      if (!result.ok) {
        set({ storageError: result.message });
        return result;
      }
      publish(entries);
      return { ok: true };
    },
    reloadFromStorage: () => {
      set({ entries: readEntries(storage), storageError: null });
    },
    clearForTests: () => {
      const result = persist([]);
      if (!result.ok) {
        set({ storageError: result.message });
        return result;
      }
      publish([]);
      return { ok: true };
    },
  };
}

export function createOperationalAuditStore(
  options: OperationalAuditStoreOptions = {},
): StoreApi<OperationalAuditState> {
  return createStore<OperationalAuditState>()((set, get) => makeState(options, set, get));
}

let operationalAuditChannel: BroadcastChannel | null = null;
const broadcastOperationalAudit = () => {
  try {
    operationalAuditChannel?.postMessage({ type: 'operational-audit-changed' });
  } catch {
    // Persistence already succeeded; other tabs still receive the storage event.
  }
};

export const useOperationalAuditStore = create<OperationalAuditState>()(
  (set, get) => makeState({ onChanged: broadcastOperationalAudit }, set, get),
);

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      operationalAuditChannel = new BroadcastChannel('ngh-operational-audit');
      operationalAuditChannel.addEventListener('message', () => {
        useOperationalAuditStore.getState().reloadFromStorage();
      });
    }
    window.addEventListener('storage', (event) => {
      if (event.key === OPERATIONAL_AUDIT_STORAGE_KEY) {
        useOperationalAuditStore.getState().reloadFromStorage();
      }
    });
  } catch {
    // The current tab remains functional without a cross-tab channel.
  }
}
