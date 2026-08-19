import crypto from 'node:crypto';
import { NotificationAudienceKind, type Notification, type Prisma, type PrismaClient, type UserRole } from '@prisma/client';
import { parseJson } from './json.js';

type NotificationDb = PrismaClient | Prisma.TransactionClient;

export interface NotificationViewer {
  id: string;
  role: UserRole;
  department: {
    id: string;
  };
}

export interface NotificationDraft {
  audience: { kind: 'account'; accountId: string } | { kind: 'departmentRole'; role: UserRole; departmentId: string } | { kind: 'broadcast' };
  type: string;
  title: string;
  message: string;
  isUrgent?: boolean;
  actionUrl?: string;
  departmentId?: string;
  relatedRequestId?: string;
  dedupeKey?: string;
  titleKey?: string;
  messageKey?: string;
  params?: Record<string, string | number>;
}

function roleMatches(expected: UserRole, actual: UserRole) {
  return expected === actual || (expected === 'admin' && actual === 'super_admin');
}

export function notificationVisibleToViewer(notification: Notification, viewer: NotificationViewer) {
  const deletedBy = parseJson<string[]>(notification.deletedByJson, []);
  if (deletedBy.includes(viewer.id)) return false;

  if (notification.audienceKind === NotificationAudienceKind.account) {
    return notification.audienceAccountId === viewer.id;
  }

  if (notification.audienceKind === NotificationAudienceKind.department_role) {
    if (!notification.audienceRole || !roleMatches(notification.audienceRole, viewer.role)) return false;
    return viewer.role === 'super_admin' || notification.departmentId === viewer.department.id;
  }

  return true;
}

export function serializeNotification(notification: Notification, viewer: NotificationViewer) {
  const readBy = parseJson<string[]>(notification.readByJson, []);
  const deletedBy = parseJson<string[]>(notification.deletedByJson, []);

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: readBy.includes(viewer.id),
    isUrgent: notification.isUrgent,
    actionUrl: notification.actionUrl ?? undefined,
    createdAt: notification.createdAt.toISOString(),
    recipientAccountId: notification.audienceAccountId ?? undefined,
    recipientRole: notification.audienceRole ?? undefined,
    departmentId: notification.departmentId ?? undefined,
    relatedRequestId: notification.relatedRequestId ?? undefined,
    dedupeKey: notification.dedupeKey ?? undefined,
    titleKey: notification.titleKey ?? undefined,
    messageKey: notification.messageKey ?? undefined,
    params: parseJson<Record<string, string | number>>(notification.paramsJson, {}),
    readByAccountIds: readBy,
    deletedForAccountIds: deletedBy,
    audience: notification.audienceKind === NotificationAudienceKind.broadcast
      ? { kind: 'broadcast' as const }
      : notification.audienceKind === NotificationAudienceKind.account
        ? { kind: 'account' as const, accountId: notification.audienceAccountId! }
        : { kind: 'departmentRole' as const, role: notification.audienceRole!, departmentId: notification.departmentId! },
  };
}

export async function createNotification(db: NotificationDb, draft: NotificationDraft) {
  const audienceKind = draft.audience.kind === 'broadcast'
    ? NotificationAudienceKind.broadcast
    : draft.audience.kind === 'account'
      ? NotificationAudienceKind.account
      : NotificationAudienceKind.department_role;

  if (draft.dedupeKey) {
    const existing = await db.notification.findUnique({
      where: { dedupeKey: draft.dedupeKey },
    });
    if (existing) return existing;
  }

  return db.notification.create({
    data: {
      id: draft.dedupeKey ? `notification:${draft.dedupeKey}` : `notification-${crypto.randomUUID()}`,
      audienceKind,
      audienceAccountId: draft.audience.kind === 'account' ? draft.audience.accountId : null,
      audienceRole: draft.audience.kind === 'departmentRole' ? draft.audience.role : null,
      departmentId: draft.audience.kind === 'departmentRole'
        ? draft.audience.departmentId
        : draft.departmentId ?? null,
      type: draft.type,
      title: draft.title,
      message: draft.message,
      isUrgent: draft.isUrgent ?? false,
      actionUrl: draft.actionUrl ?? null,
      relatedRequestId: draft.relatedRequestId ?? null,
      dedupeKey: draft.dedupeKey ?? null,
      titleKey: draft.titleKey ?? null,
      messageKey: draft.messageKey ?? null,
      paramsJson: draft.params ? JSON.stringify(draft.params) : null,
    },
  });
}

export async function markNotificationRead(db: NotificationDb, notification: Notification, viewer: NotificationViewer) {
  const readBy = [...new Set([...parseJson<string[]>(notification.readByJson, []), viewer.id])];
  return db.notification.update({
    where: { id: notification.id },
    data: { readByJson: JSON.stringify(readBy) },
  });
}

export async function markAllNotificationsRead(db: NotificationDb, notifications: Notification[], viewer: NotificationViewer) {
  const unreadNotifications = notifications.filter((notification) => {
    const readBy = parseJson<string[]>(notification.readByJson, []);
    return !readBy.includes(viewer.id);
  });

  for (const notification of unreadNotifications) {
    const readBy = [...new Set([...parseJson<string[]>(notification.readByJson, []), viewer.id])];
    await db.notification.update({
      where: { id: notification.id },
      data: { readByJson: JSON.stringify(readBy) },
    });
  }
}

export async function hideNotificationForViewer(db: NotificationDb, notification: Notification, viewer: NotificationViewer) {
  const deletedBy = [...new Set([...parseJson<string[]>(notification.deletedByJson, []), viewer.id])];
  return db.notification.update({
    where: { id: notification.id },
    data: { deletedByJson: JSON.stringify(deletedBy) },
  });
}
