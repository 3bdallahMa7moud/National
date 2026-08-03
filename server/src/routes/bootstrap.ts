import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { parseJson } from '../lib/json.js';
import { notificationVisibleToViewer, serializeNotification } from '../lib/notifications.js';
import { serializeOvertimeState, serializeScheduleState } from '../lib/scheduleState.js';
import { serializeShiftRequest, shiftRequestVisibleToViewer } from '../lib/shiftRequests.js';

export const bootstrapRouter = Router();

bootstrapRouter.get('/', requireAuth, async (req, res) => {
  const [
    departments,
    users,
    accessProfiles,
    notifications,
    auditEntries,
    shiftRequests,
    scheduleMonths,
    overtimeMonths,
  ] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.user.findMany({ include: { department: true }, orderBy: { employeeNumber: 'asc' } }),
    prisma.employeeAccessProfile.findMany(),
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.auditEntry.findMany({ orderBy: { timestamp: 'desc' }, take: 500 }),
    prisma.shiftRequest.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.scheduleMonth.findMany({ orderBy: { monthKey: 'asc' } }),
    prisma.overtimeMonth.findMany({ orderBy: { monthKey: 'asc' } }),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const visibleNotifications = notifications
    .filter((notification) => notificationVisibleToViewer(notification, req.viewer!))
    .map((notification) => serializeNotification(notification, req.viewer!));
  const visibleAuditEntries = req.viewer!.role === 'employee'
    ? []
    : auditEntries;
  const visibleShiftRequests = shiftRequests
    .filter((request) => shiftRequestVisibleToViewer(request, req.viewer!))
    .map((request) => serializeShiftRequest(
      request,
      userById.get(request.requesterUserId)!,
      userById.get(request.recipientUserId)!,
    ));
  const fullSchedule = serializeScheduleState(scheduleMonths);
  const fullOvertime = serializeOvertimeState(overtimeMonths);
  const schedule = req.viewer!.role === 'employee'
    ? {
      ...fullSchedule,
      draftsByMonth: {},
      versionsByMonth: {},
    }
    : fullSchedule;
  const overtime = req.viewer!.role === 'employee'
    ? {
      ...fullOvertime,
      rowsByMonth: fullOvertime.publishedRowsByMonth,
      unitsByMonth: fullOvertime.publishedUnitsByMonth,
      versionsByMonth: {},
    }
    : fullOvertime;

  res.json({
    departments: departments.map((department) => ({
      id: department.id,
      name: {
        en: department.nameEn,
        ar: department.nameAr,
      },
      description: {
        en: department.descriptionEn,
        ar: department.descriptionAr,
      },
      managerId: department.managerId,
    })),
    employees: users.map((user) => ({
      id: user.id,
      name: {
        en: user.nameEn,
        ar: user.nameAr,
      },
      email: user.email ?? '',
      phone: user.phone,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: {
        en: user.department.nameEn,
        ar: user.department.nameAr,
      },
      position: {
        en: user.positionEn,
        ar: user.positionAr,
      },
      employeeNumber: user.employeeNumber,
      code: user.code,
      avatar: user.avatar,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString().slice(0, 10),
      scheduleEmployeeId: user.scheduleEmployeeId,
    })),
    accessProfiles: Object.fromEntries(accessProfiles.map((profile) => [
      profile.userId,
      {
        accountId: profile.userId,
        departmentId: users.find((user) => user.id === profile.userId)?.departmentId ?? 'dept-1',
        scheduleEmployeeId: users.find((user) => user.id === profile.userId)?.scheduleEmployeeId ?? undefined,
        templateId: profile.templateId,
        overrides: parseJson<Record<string, boolean>>(profile.overridesJson, {}),
        active: profile.isActive,
        updatedAt: profile.updatedAt.toISOString(),
        updatedBy: profile.updatedByLabel,
      },
    ])),
    notifications: visibleNotifications,
    auditEntries: visibleAuditEntries.map((entry) => ({
      id: entry.id,
      actorName: entry.actorName,
      action: entry.action,
      module: entry.module,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      timestamp: entry.timestamp.toISOString(),
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
      context: parseJson<Record<string, unknown>>(entry.contextJson, {}),
    })),
    shiftRequests: visibleShiftRequests,
    schedule,
    overtime,
  });
});
