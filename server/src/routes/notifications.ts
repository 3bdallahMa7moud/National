import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  hideNotificationForViewer,
  markAllNotificationsRead,
  markNotificationRead,
  notificationVisibleToViewer,
  serializeNotification,
} from '../lib/notifications.js';
import { requireAuth } from '../middleware/auth.js';

function toVisibleNotifications(notifications: Awaited<ReturnType<typeof prisma.notification.findMany>>, viewer: NonNullable<Express.Request['viewer']>) {
  return notifications
    .filter((notification) => notificationVisibleToViewer(notification, viewer))
    .map((notification) => serializeNotification(notification, viewer));
}

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const visible = toVisibleNotifications(notifications, req.viewer!).slice(0, limit);
  res.json({
    notifications: visible,
    unreadCount: visible.filter((notification) => !notification.isRead).length,
  });
});

notificationsRouter.post('/read-all', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const visible = notifications.filter((notification) => notificationVisibleToViewer(notification, req.viewer!));
  await markAllNotificationsRead(prisma, visible, req.viewer!);
  const refreshed = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const result = toVisibleNotifications(refreshed, req.viewer!);
  res.json({
    notifications: result,
    unreadCount: result.filter((notification) => !notification.isRead).length,
  });
});

notificationsRouter.post('/:notificationId/read', requireAuth, async (req, res) => {
  const notificationId = Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId;
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || !notificationVisibleToViewer(notification, req.viewer!)) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Notification not found.',
      },
    });
    return;
  }
  const updated = await markNotificationRead(prisma, notification, req.viewer!);
  res.json({
    notification: serializeNotification(updated, req.viewer!),
  });
});

notificationsRouter.delete('/:notificationId', requireAuth, async (req, res) => {
  const notificationId = Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId;
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || !notificationVisibleToViewer(notification, req.viewer!)) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Notification not found.',
      },
    });
    return;
  }
  await hideNotificationForViewer(prisma, notification, req.viewer!);
  res.status(204).send();
});
