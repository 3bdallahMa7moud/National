import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { OperationalAuditDraft, OperationalAuditEntry } from '@/types/operationalAudit';

export const OPERATIONAL_AUDIT_STORAGE_KEY = 'ngh_operational_audit_v1';

export interface OperationalAuditStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface OperationalAuditStoreOptions {
  storage?: OperationalAuditStorage | null;
  now?: () => string;
  createId?: () => string;
}

export interface OperationalAuditState {
  entries: OperationalAuditEntry[];
  record(entry: OperationalAuditDraft): OperationalAuditEntry;
  clearForTests(): void;
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

function makeState(
  options: OperationalAuditStoreOptions,
  set: StoreApi<OperationalAuditState>['setState'],
  get: StoreApi<OperationalAuditState>['getState'],
): OperationalAuditState {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => `operational-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const persist = (entries: OperationalAuditEntry[]) => {
    try {
      storage?.setItem(OPERATIONAL_AUDIT_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Audit remains available in memory if browser persistence is unavailable.
    }
  };
  return {
    entries: readEntries(storage),
    record: (draft) => {
      const entry: OperationalAuditEntry = { ...draft, id: createId(), timestamp: now() };
      const entries = [entry, ...get().entries];
      set({ entries });
      persist(entries);
      return entry;
    },
    clearForTests: () => {
      set({ entries: [] });
      persist([]);
    },
  };
}

export function createOperationalAuditStore(
  options: OperationalAuditStoreOptions = {},
): StoreApi<OperationalAuditState> {
  return createStore<OperationalAuditState>()((set, get) => makeState(options, set, get));
}

export const useOperationalAuditStore = create<OperationalAuditState>()(
  (set, get) => makeState({}, set, get),
);
