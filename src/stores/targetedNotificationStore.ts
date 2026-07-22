import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AuthUser } from '@/types/employee';
import type { AppNotification, TargetedNotificationDraft } from '@/types/notification';

export const TARGETED_NOTIFICATION_STORAGE_KEY = 'ngh_targeted_notifications_v1';

export interface TargetedNotificationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PersistedTargetedNotifications {
  version: 1;
  notifications: AppNotification[];
}

interface TargetedNotificationStoreOptions {
  storage?: TargetedNotificationStorage | null;
  now?: () => string;
  createId?: () => string;
  onChanged?: () => void;
}

export interface TargetedNotificationState {
  notifications: AppNotification[];
  storageError: string | null;
  push(draft: TargetedNotificationDraft): { ok: true; notification: AppNotification } | { ok: false; reason: 'storage_error' | 'invalid_audience' };
  pushMany(drafts: TargetedNotificationDraft[]): { ok: true; notifications: AppNotification[] } | { ok: false; reason: 'storage_error' | 'invalid_audience' };
  markRead(id: string, user: Pick<AuthUser, 'id' | 'role' | 'departmentId'>): boolean;
  markAllRead(user: Pick<AuthUser, 'id' | 'role' | 'departmentId'>): boolean;
  remove(id: string, user: Pick<AuthUser, 'id' | 'role' | 'departmentId'>): boolean;
  forUser(user: Pick<AuthUser, 'id' | 'role' | 'departmentId'>): AppNotification[];
  reloadFromStorage(): void;
  clearForTests(): void;
}

function browserStorage(): TargetedNotificationStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isNotificationForUser(
  notification: AppNotification,
  user: Pick<AuthUser, 'id' | 'role' | 'departmentId'>,
): boolean {
  if (notification.deletedForAccountIds?.includes(user.id)) return false;
  if (notification.audience?.kind === 'account') return notification.audience.accountId === user.id;
  if (notification.audience?.kind === 'departmentRole') {
    return notification.audience.role === user.role && notification.audience.departmentId === user.departmentId;
  }
  if (notification.audience?.kind === 'broadcast') return true;
  // Legacy targeted notifications are accepted during the v1 migration only.
  if (notification.recipientAccountId) return notification.recipientAccountId === user.id;
  if (notification.recipientRole && notification.recipientRole !== user.role) return false;
  if (notification.departmentId && notification.departmentId !== user.departmentId) return false;
  return Boolean(notification.recipientRole || notification.departmentId);
}

export function notificationForUser(
  notification: AppNotification,
  user: Pick<AuthUser, 'id' | 'role' | 'departmentId'>,
): AppNotification | null {
  if (!isNotificationForUser(notification, user)) return null;
  const explicitlyRead = notification.readByAccountIds?.includes(user.id) === true;
  const legacyRead = notification.isRead && !notification.readByAccountIds?.length;
  return { ...notification, isRead: explicitlyRead || legacyRead };
}

function isNotification(value: unknown): value is AppNotification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<AppNotification>;
  return typeof item.id === 'string'
    && typeof item.type === 'string'
    && typeof item.title === 'string'
    && typeof item.message === 'string'
    && typeof item.isRead === 'boolean'
    && typeof item.isUrgent === 'boolean'
    && typeof item.createdAt === 'string';
}

function readNotifications(storage: TargetedNotificationStorage | null): AppNotification[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(TARGETED_NOTIFICATION_STORAGE_KEY) || 'null') as Partial<PersistedTargetedNotifications> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.notifications)) return [];
    return parsed.notifications.filter(isNotification).map((notification) => {
      if (notification.audience) return notification;
      if (notification.recipientAccountId) {
        return { ...notification, audience: { kind: 'account', accountId: notification.recipientAccountId } };
      }
      if (notification.recipientRole && notification.departmentId) {
        return {
          ...notification,
          audience: { kind: 'departmentRole', role: notification.recipientRole, departmentId: notification.departmentId },
        };
      }
      return notification;
    });
  } catch {
    return [];
  }
}

function makeState(
  options: TargetedNotificationStoreOptions,
  set: StoreApi<TargetedNotificationState>['setState'],
  get: StoreApi<TargetedNotificationState>['getState'],
): TargetedNotificationState {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const commit = (notifications: AppNotification[]): boolean => {
    try {
      storage?.setItem(TARGETED_NOTIFICATION_STORAGE_KEY, JSON.stringify({ version: 1, notifications } satisfies PersistedTargetedNotifications));
    } catch {
      set({ storageError: 'Unable to save notifications.' });
      return false;
    }
    set({ notifications, storageError: null });
    options.onChanged?.();
    return true;
  };

  return {
    notifications: readNotifications(storage),
    storageError: null,
    push: (draft) => {
      if (!draft.audience) return { ok: false, reason: 'invalid_audience' };
      const existing = draft.dedupeKey
        ? get().notifications.find((notification) => notification.dedupeKey === draft.dedupeKey)
        : undefined;
      if (existing) return { ok: true, notification: existing };
      const notification: AppNotification = {
        ...draft,
        id: draft.dedupeKey ? `notification:${draft.dedupeKey}` : createId(),
        createdAt: now(),
        isRead: draft.isRead ?? false,
        readByAccountIds: [],
        deletedForAccountIds: [],
      };
      const notifications = [notification, ...get().notifications].slice(0, 500);
      if (!commit(notifications)) return { ok: false, reason: 'storage_error' };
      return { ok: true, notification };
    },
    pushMany: (drafts) => {
      if (drafts.some((draft) => !draft.audience)) return { ok: false, reason: 'invalid_audience' };
      const current = get().notifications;
      const delivered: AppNotification[] = [];
      const created: AppNotification[] = [];
      for (const draft of drafts) {
        const existing = draft.dedupeKey
          ? [...created, ...current].find((notification) => notification.dedupeKey === draft.dedupeKey)
          : undefined;
        if (existing) {
          delivered.push(existing);
          continue;
        }
        const notification: AppNotification = {
          ...draft,
          id: draft.dedupeKey ? `notification:${draft.dedupeKey}` : createId(),
          createdAt: now(),
          isRead: draft.isRead ?? false,
          readByAccountIds: [],
          deletedForAccountIds: [],
        };
        created.push(notification);
        delivered.push(notification);
      }
      if (created.length > 0 && !commit([...created, ...current].slice(0, 500))) return { ok: false, reason: 'storage_error' };
      return { ok: true, notifications: delivered };
    },
    markRead: (id, user) => commit(get().notifications.map((item) => {
      if (item.id !== id || !isNotificationForUser(item, user)) return item;
      return { ...item, readByAccountIds: [...new Set([...(item.readByAccountIds || []), user.id])] };
    })),
    markAllRead: (user) => commit(get().notifications.map((item) => {
      if (!isNotificationForUser(item, user)) return item;
      return { ...item, readByAccountIds: [...new Set([...(item.readByAccountIds || []), user.id])] };
    })),
    remove: (id, user) => commit(get().notifications.map((item) => {
      if (item.id !== id || !isNotificationForUser(item, user)) return item;
      return { ...item, deletedForAccountIds: [...new Set([...(item.deletedForAccountIds || []), user.id])] };
    })),
    forUser: (user) => get().notifications
      .map((item) => notificationForUser(item, user))
      .filter((item): item is AppNotification => Boolean(item)),
    reloadFromStorage: () => set({ notifications: readNotifications(storage), storageError: null }),
    clearForTests: () => commit([]),
  };
}

export function createTargetedNotificationStore(
  options: TargetedNotificationStoreOptions = {},
): StoreApi<TargetedNotificationState> {
  return createStore<TargetedNotificationState>()((set, get) => makeState(options, set, get));
}

let notificationChannel: BroadcastChannel | null = null;
const broadcastNotifications = () => {
  try {
    notificationChannel?.postMessage({ type: 'notifications-changed' });
  } catch {
    // Cross-tab delivery is best-effort after local persistence succeeds.
  }
};

export const useTargetedNotificationStore = create<TargetedNotificationState>()(
  (set, get) => makeState({ onChanged: broadcastNotifications }, set, get),
);

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      notificationChannel = new BroadcastChannel('ngh-targeted-notifications');
      notificationChannel.addEventListener('message', () => useTargetedNotificationStore.getState().reloadFromStorage());
    }
    window.addEventListener('storage', (event) => {
      if (event.key === TARGETED_NOTIFICATION_STORAGE_KEY) useTargetedNotificationStore.getState().reloadFromStorage();
    });
    window.addEventListener('focus', () => {
      useTargetedNotificationStore.getState().reloadFromStorage();
    });
  } catch {
    // The current tab continues to work without a cross-tab channel.
  }
}
