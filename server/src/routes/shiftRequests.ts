import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { type Prisma, type ShiftRequest, type User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { hasEmployeePermission } from '../lib/employeeAccess.js';
import {
  applyApprovedShiftRequest,
  createShiftRequestAudit,
  createShiftRequestNotifications,
  inspectRequestWarnings,
  serializeShiftRequest,
  shiftRequestVisibleToViewer,
  timelineEvent,
  type ShiftAssignmentRef,
  type ShiftRequestParty,
  validateAssignmentRef,
} from '../lib/shiftRequests.js';
import { parseJson } from '../lib/json.js';

const assignmentSchema = z.object({
  source: z.enum(['schedule', 'ot']),
  departmentId: z.string().trim().min(1),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
  day: z.number().int().min(1).max(31),
  rowId: z.string().trim().min(1),
  employeeId: z.string().trim().min(1),
  employeeCode: z.string().trim().min(1),
  facilityId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  facilityLabel: z.string().trim().default(''),
  unitLabel: z.string().trim().default(''),
  shiftLabel: z.string().trim().default(''),
  timeRange: z.string().trim().default(''),
  fingerprint: z.string().trim().min(1),
  startsAt: z.string().trim().default(''),
});

const createRequestSchema = z.object({
  type: z.enum(['exchange', 'replace']),
  requesterAccountId: z.string().trim().min(1).optional(),
  recipientAccountId: z.string().trim().min(1),
  requesterAssignment: assignmentSchema,
  offeredAssignment: assignmentSchema.optional(),
});

const rejectAdminSchema = z.object({
  reason: z.enum(['staff_shortage', 'skill_mismatch', 'approved_leave', 'operational_need', 'other']),
  note: z.string().trim().optional(),
});

const approveSchema = z.object({
  overrideConflicts: z.boolean().default(false),
});

type UserWithAccess = Prisma.UserGetPayload<{
  include: {
    accessProfile: true;
  };
}>;

function viewerAsManagedUser(viewer: NonNullable<Express.Request['viewer']>) {
  return {
    role: viewer.role,
    access: viewer.access ? {
      templateId: viewer.access.templateId,
      overrides: viewer.access.overrides,
      active: viewer.access.active,
    } : null,
  };
}

function canCreate(viewer: NonNullable<Express.Request['viewer']>, type: 'exchange' | 'replace') {
  if (viewer.role === 'admin' || viewer.role === 'super_admin') return true;
  return hasEmployeePermission(viewerAsManagedUser(viewer), type === 'exchange' ? 'schedule.exchange.create' : 'schedule.replace.create');
}

function canRespond(viewer: NonNullable<Express.Request['viewer']>) {
  if (viewer.role === 'admin' || viewer.role === 'super_admin') return true;
  return hasEmployeePermission(viewerAsManagedUser(viewer), 'schedule.requests.respond');
}

function canCancel(viewer: NonNullable<Express.Request['viewer']>) {
  if (viewer.role === 'admin' || viewer.role === 'super_admin') return true;
  return hasEmployeePermission(viewerAsManagedUser(viewer), 'schedule.requests.cancelOwn');
}

function ensureRecipientVisible(viewer: NonNullable<Express.Request['viewer']>, recipient: UserWithAccess) {
  if (viewer.role === 'super_admin') return true;
  return recipient.departmentId === viewer.department.id;
}

async function loadUsers(tx: Prisma.TransactionClient, requesterUserId: string, recipientUserId: string) {
  const [requester, recipient] = await Promise.all([
    tx.user.findUnique({
      where: { id: requesterUserId },
      include: { accessProfile: true },
    }),
    tx.user.findUnique({
      where: { id: recipientUserId },
      include: { accessProfile: true },
    }),
  ]);
  return { requester, recipient };
}

async function serializeRequestFromDb(tx: Prisma.TransactionClient | typeof prisma, request: ShiftRequest) {
  const [requester, recipient] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: request.requesterUserId } }),
    tx.user.findUniqueOrThrow({ where: { id: request.requesterUserId === request.recipientUserId ? request.requesterUserId : request.recipientUserId } }),
  ]);
  return serializeShiftRequest(request, requester, recipient);
}

async function expireDueRequests(tx: Prisma.TransactionClient | typeof prisma) {
  const expired = await tx.shiftRequest.findMany({
    where: {
      status: { in: ['pending_recipient', 'pending_admin'] },
      expiresAt: { lte: new Date() },
    },
  });

  for (const request of expired) {
    const timeline = [
      timelineEvent('expired', 'system', 'System'),
      ...parseJson(request.timelineJson ? request.timelineJson : '[]', []),
    ];
    const updated = await tx.shiftRequest.update({
      where: { id: request.id },
      data: {
        status: 'expired',
        timelineJson: JSON.stringify(timeline),
      },
    });
    const serialized = await serializeRequestFromDb(tx, updated);
    await createShiftRequestNotifications(tx, 'expired', serialized);
    await createShiftRequestAudit(tx, 'expire', null, 'System', serialized);
  }
}

async function getRequestOr404(
  tx: Prisma.TransactionClient | typeof prisma,
  requestId: string,
  viewer: NonNullable<Express.Request['viewer']>,
) {
  const request = await tx.shiftRequest.findUnique({
    where: { id: requestId },
  });
  if (!request || !shiftRequestVisibleToViewer(request, viewer)) return null;
  return request;
}

function isCrossDepartment(requester: UserWithAccess, recipient: UserWithAccess, viewer: NonNullable<Express.Request['viewer']>) {
  if (viewer.role === 'super_admin') return false;
  return requester.departmentId !== recipient.departmentId || requester.departmentId !== viewer.department.id;
}

function sameCell(left: ShiftAssignmentRef, right: ShiftAssignmentRef) {
  return left.monthKey === right.monthKey && left.rowId === right.rowId && left.day === right.day && left.source === right.source;
}

function assignmentOwnedBy(assignment: ShiftAssignmentRef, scheduleEmployeeId?: string | null) {
  return Boolean(scheduleEmployeeId && assignment.employeeId === scheduleEmployeeId);
}

async function staleRequestDueToValidation(tx: Prisma.TransactionClient, request: ShiftRequest, actorName = 'System') {
  const timeline = [
    timelineEvent('stale', 'system', actorName),
    ...parseJson(request.timelineJson ? request.timelineJson : '[]', []),
  ];
  const updated = await tx.shiftRequest.update({
    where: { id: request.id },
    data: {
      status: 'stale',
      timelineJson: JSON.stringify(timeline),
    },
  });
  const serialized = await serializeRequestFromDb(tx, updated);
  await createShiftRequestNotifications(tx, 'stale', serialized);
  await createShiftRequestAudit(tx, 'expire', null, actorName, serialized);
  return serialized;
}

function fallbackUser(id: string): User {
  return {
    id,
    employeeNumber: 'N/A',
    code: 'N/A',
    nameEn: 'Unknown User',
    nameAr: 'مستخدم غير معروف',
    email: null,
    emailVerifiedAt: null,
    phone: '',
    role: 'employee',
    departmentId: 'dept-1',
    positionEn: 'Employee',
    positionAr: 'موظف',
    avatar: null,
    isActive: false,
    passwordHash: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    scheduleEmployeeId: null,
  };
}

export const shiftRequestsRouter = Router();

shiftRequestsRouter.get('/', requireAuth, async (req, res) => {
  await prisma.$transaction(async (tx) => {
    await expireDueRequests(tx);
  });
  const requests = await prisma.shiftRequest.findMany({
    orderBy: { createdAt: 'desc' },
  });
  const visible = requests.filter((request) => shiftRequestVisibleToViewer(request, req.viewer!));
  const parties = new Map<string, User>();
  const userIds = [...new Set(visible.flatMap((request) => [request.requesterUserId, request.recipientUserId]))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  users.forEach((user) => parties.set(user.id, user));
  res.json({
    shiftRequests: visible.map((request) => serializeShiftRequest(
      request,
      parties.get(request.requesterUserId) ?? fallbackUser(request.requesterUserId),
      parties.get(request.recipientUserId) ?? fallbackUser(request.recipientUserId),
    )),
  });
});

shiftRequestsRouter.get('/:requestId', requireAuth, async (req, res) => {
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const request = await getRequestOr404(prisma, requestId, req.viewer!);
  if (!request) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Shift request not found.',
      },
    });
    return;
  }
  const serialized = await serializeRequestFromDb(prisma, request);
  res.json({ request: serialized });
});

shiftRequestsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid shift request payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }
  if (!canCreate(req.viewer!, parsed.data.type)) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'You are not allowed to create this shift request.',
      },
    });
    return;
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      let effectiveRequesterUserId = req.viewer!.id;
      if (req.viewer!.role === 'admin' || req.viewer!.role === 'super_admin') {
        if (parsed.data.requesterAccountId) {
          effectiveRequesterUserId = parsed.data.requesterAccountId;
        } else {
          const cleanEmployeeId = parsed.data.requesterAssignment.employeeId.replace(/^directory-account:/, '');
          const linkedUser = await tx.user.findFirst({
            where: {
              OR: [
                { scheduleEmployeeId: cleanEmployeeId },
                { scheduleEmployeeId: parsed.data.requesterAssignment.employeeId },
                { id: cleanEmployeeId },
                { id: parsed.data.requesterAssignment.employeeId },
                { code: parsed.data.requesterAssignment.employeeCode },
              ],
              ...(req.viewer!.role === 'admin' ? { departmentId: req.viewer!.department.id } : {}),
            },
          });
          if (linkedUser) {
            effectiveRequesterUserId = linkedUser.id;
          }
        }
      }

      const { requester, recipient } = await loadUsers(tx, effectiveRequesterUserId, parsed.data.recipientAccountId);
      if (!requester || !recipient || !ensureRecipientVisible(req.viewer!, recipient)) {
        throw new Error('RECIPIENT_NOT_FOUND');
      }
      if (!requester.isActive || !recipient.isActive) throw new Error('INACTIVE_ACCOUNT');
      if (!recipient.scheduleEmployeeId) throw new Error('RECIPIENT_NOT_LINKED');
      if (isCrossDepartment(requester, recipient, req.viewer!)) throw new Error('CROSS_DEPARTMENT');
      if (parsed.data.type === 'exchange' && !parsed.data.offeredAssignment) throw new Error('OFFERED_REQUIRED');
      if (parsed.data.type === 'replace' && parsed.data.offeredAssignment) throw new Error('OFFERED_NOT_ALLOWED');
      if (parsed.data.offeredAssignment && parsed.data.requesterAssignment.source !== parsed.data.offeredAssignment.source) {
        throw new Error('SOURCE_MISMATCH');
      }
      if (requester.scheduleEmployeeId && recipient.scheduleEmployeeId && requester.scheduleEmployeeId === recipient.scheduleEmployeeId) {
        throw new Error('SAME_EMPLOYEE');
      }
      if (req.viewer!.role === 'employee' && !assignmentOwnedBy(parsed.data.requesterAssignment, requester.scheduleEmployeeId)) {
        throw new Error('WRONG_ACTOR');
      }

      const requesterValidation = await validateAssignmentRef(tx, parsed.data.requesterAssignment, new Date());
      if (!requesterValidation.ok) throw new Error(requesterValidation.reason.toUpperCase());
      let offeredAssignment: ShiftAssignmentRef | undefined;
      if (parsed.data.offeredAssignment) {
        const offeredValidation = await validateAssignmentRef(tx, parsed.data.offeredAssignment, new Date());
        if (!offeredValidation.ok) throw new Error(offeredValidation.reason.toUpperCase());
        offeredAssignment = offeredValidation.assignment;
      }

      if (offeredAssignment && !assignmentOwnedBy(offeredAssignment, recipient.scheduleEmployeeId)) {
        throw new Error('WRONG_ACTOR');
      }
      if (offeredAssignment && sameCell(requesterValidation.assignment, offeredAssignment)) {
        throw new Error('SAME_CELL');
      }

      const activeRequests = await tx.shiftRequest.findMany({
        where: {
          status: { in: ['pending_recipient', 'pending_admin'] },
          requesterUserId: requester.id,
          recipientUserId: recipient.id,
          type: parsed.data.type,
        },
      });
      const nextSignature = [
        `${requesterValidation.assignment.source}|${requesterValidation.assignment.monthKey}|${requesterValidation.assignment.rowId}|${requesterValidation.assignment.day}|${requesterValidation.assignment.employeeId}`,
        ...(offeredAssignment ? [`${offeredAssignment.source}|${offeredAssignment.monthKey}|${offeredAssignment.rowId}|${offeredAssignment.day}|${offeredAssignment.employeeId}`] : []),
      ].sort().join('||');
      const duplicate = activeRequests.some((request) => {
        const current = [
          parseJson<ShiftAssignmentRef>(request.requesterAssignmentJson, {} as ShiftAssignmentRef),
          ...(() => {
            const offered = parseJson<ShiftAssignmentRef | undefined>(request.offeredAssignmentJson, undefined);
            return offered ? [offered] : [];
          })(),
        ].map((assignment) => `${assignment.source}|${assignment.monthKey}|${assignment.rowId}|${assignment.day}|${assignment.employeeId}`)
          .sort()
          .join('||');
        return current === nextSignature;
      });
      if (duplicate) throw new Error('DUPLICATE_REQUEST');

      const requesterParty: ShiftRequestParty = {
        accountId: requester.id,
        employeeId: requesterValidation.assignment.employeeId,
        employeeCode: requesterValidation.assignment.employeeCode,
        name: requester.nameAr || requester.nameEn,
      };
      const recipientParty: ShiftRequestParty = {
        accountId: recipient.id,
        employeeId: recipient.scheduleEmployeeId,
        employeeCode: offeredAssignment?.employeeCode || recipient.code,
        name: recipient.nameAr || recipient.nameEn,
      };
      const warnings = await inspectRequestWarnings(tx, {
        type: parsed.data.type,
        requester: requesterParty,
        recipient: recipientParty,
        requesterAssignment: requesterValidation.assignment,
        offeredAssignment,
      });

      const expiresAt = [requesterValidation.assignment.startsAt, ...(offeredAssignment ? [offeredAssignment.startsAt] : [])]
        .sort()[0];
      const createdRequest = await tx.shiftRequest.create({
        data: {
          id: `request-${crypto.randomUUID()}`,
          type: parsed.data.type,
          status: 'pending_recipient',
          departmentId: requester.departmentId,
          requesterUserId: requester.id,
          recipientUserId: recipient.id,
          requesterAssignmentJson: JSON.stringify(requesterValidation.assignment),
          offeredAssignmentJson: offeredAssignment ? JSON.stringify(offeredAssignment) : null,
          warningsJson: JSON.stringify(warnings),
          timelineJson: JSON.stringify([
            timelineEvent(
              'created',
              req.viewer!.id !== requester.id ? 'admin' : 'requester',
              req.viewer!.name.en || requesterParty.name,
              req.viewer!.id,
              req.viewer!.id !== requester.id ? 'Created by administrator on behalf of employee' : undefined,
            ),
          ]),
          expiresAt: new Date(expiresAt),
        },
      });

      const serialized = serializeShiftRequest(createdRequest, requester, recipient);
      await createShiftRequestNotifications(tx, 'created', serialized);
      await createShiftRequestAudit(tx, 'request', req.viewer!.id, req.viewer!.name.en, serialized);
      return serialized;
    });

    res.status(201).json({ request: created });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'REQUEST_FAILED';
    const codeMap: Record<string, [number, string, string]> = {
      RECIPIENT_NOT_FOUND: [404, 'NOT_FOUND', 'Recipient account was not found.'],
      INACTIVE_ACCOUNT: [400, 'INACTIVE_ACCOUNT', 'Both accounts must be active.'],
      RECIPIENT_NOT_LINKED: [400, 'RECIPIENT_NOT_LINKED', 'Recipient account is not linked to the roster.'],
      CROSS_DEPARTMENT: [400, 'CROSS_DEPARTMENT', 'Shift requests must stay within the same department.'],
      OFFERED_REQUIRED: [400, 'OFFERED_REQUIRED', 'Exchange requests require an offered assignment.'],
      OFFERED_NOT_ALLOWED: [400, 'OFFERED_NOT_ALLOWED', 'Replace requests cannot include an offered assignment.'],
      SOURCE_MISMATCH: [400, 'SOURCE_MISMATCH', 'Schedule and overtime assignments cannot be mixed in one request.'],
      SAME_EMPLOYEE: [400, 'SAME_EMPLOYEE', 'A request must involve two different employees.'],
      SAME_CELL: [400, 'SAME_CELL', 'The requester and recipient assignments cannot point to the same cell.'],
      WRONG_ACTOR: [403, 'FORBIDDEN', 'You can only create requests for your own assignment.'],
      NOT_FOUND: [409, 'STALE_ASSIGNMENT', 'One of the assignments no longer exists.'],
      NOT_PUBLISHED: [409, 'NOT_PUBLISHED', 'The assignment month is not published.'],
      PAST_SHIFT: [409, 'PAST_SHIFT', 'Past shifts cannot be requested.'],
      STALE: [409, 'STALE_ASSIGNMENT', 'One of the assignments has changed.'],
      DUPLICATE_REQUEST: [409, 'DUPLICATE_REQUEST', 'An active request already exists for those assignments.'],
    };
    const [status, code, message] = codeMap[reason] ?? [400, 'SHIFT_REQUEST_FAILED', 'Unable to create the shift request.'];
    res.status(status).json({ error: { code, message } });
  }
});

shiftRequestsRouter.post('/:requestId/accept', requireAuth, async (req, res) => {
  if (!canRespond(req.viewer!)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not allowed to respond to shift requests.' } });
    return;
  }
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  const result = await prisma.$transaction(async (tx) => {
    const request = await getRequestOr404(tx, requestId, req.viewer!);
    if (!request) return null;
    if (request.recipientUserId !== req.viewer!.id) throw new Error('WRONG_ACTOR');
    if (request.status !== 'pending_recipient') throw new Error('INVALID_STATUS');

    const requesterValidation = await validateAssignmentRef(tx, parseJson(request.requesterAssignmentJson, {} as ShiftAssignmentRef), new Date());
    const offeredAssignment = parseJson<ShiftAssignmentRef | undefined>(request.offeredAssignmentJson, undefined);
    const offeredValidation = offeredAssignment ? await validateAssignmentRef(tx, offeredAssignment, new Date()) : null;
    if (!requesterValidation.ok || (offeredValidation && !offeredValidation.ok)) {
      return staleRequestDueToValidation(tx, request);
    }

    const updated = await tx.shiftRequest.update({
      where: { id: request.id },
      data: {
        status: 'pending_admin',
        timelineJson: JSON.stringify([
          timelineEvent('recipient_accepted', 'recipient', req.viewer!.name.en, req.viewer!.id),
          ...parseJson(request.timelineJson, []),
        ]),
      },
    });
    const serialized = await serializeRequestFromDb(tx, updated);
    await createShiftRequestNotifications(tx, 'recipient_accepted', serialized);
    await createShiftRequestAudit(tx, 'request', req.viewer!.id, req.viewer!.name.en, serialized);
    return serialized;
  });

  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift request not found.' } });
    return;
  }
  res.json({ request: result });
});

shiftRequestsRouter.post('/:requestId/reject', requireAuth, async (req, res) => {
  if (!canRespond(req.viewer!)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not allowed to respond to shift requests.' } });
    return;
  }
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await getRequestOr404(tx, requestId, req.viewer!);
      if (!request) return null;
      if (request.recipientUserId !== req.viewer!.id) throw new Error('WRONG_ACTOR');
      if (request.status !== 'pending_recipient') throw new Error('INVALID_STATUS');
      const updated = await tx.shiftRequest.update({
        where: { id: request.id },
        data: {
          status: 'recipient_rejected',
          timelineJson: JSON.stringify([
            timelineEvent('recipient_rejected', 'recipient', req.viewer!.name.en, req.viewer!.id),
            ...parseJson(request.timelineJson, []),
          ]),
        },
      });
      const serialized = await serializeRequestFromDb(tx, updated);
      await createShiftRequestNotifications(tx, 'recipient_rejected', serialized);
      await createShiftRequestAudit(tx, 'reject', req.viewer!.id, req.viewer!.name.en, serialized);
      return serialized;
    });
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift request not found.' } });
      return;
    }
    res.json({ request: result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'REJECT_FAILED';
    res.status(reason === 'WRONG_ACTOR' ? 403 : 409).json({
      error: {
        code: reason === 'WRONG_ACTOR' ? 'FORBIDDEN' : 'INVALID_STATUS',
        message: reason === 'WRONG_ACTOR' ? 'Only the recipient can reject this request.' : 'This request can no longer be rejected.',
      },
    });
  }
});

shiftRequestsRouter.post('/:requestId/cancel', requireAuth, async (req, res) => {
  if (!canCancel(req.viewer!)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not allowed to cancel shift requests.' } });
    return;
  }
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await getRequestOr404(tx, requestId, req.viewer!);
      if (!request) return null;
      if (request.requesterUserId !== req.viewer!.id) throw new Error('WRONG_ACTOR');
      if (!['pending_recipient', 'pending_admin'].includes(request.status)) throw new Error('INVALID_STATUS');
      const updated = await tx.shiftRequest.update({
        where: { id: request.id },
        data: {
          status: 'cancelled',
          timelineJson: JSON.stringify([
            timelineEvent('cancelled', 'requester', req.viewer!.name.en, req.viewer!.id),
            ...parseJson(request.timelineJson, []),
          ]),
        },
      });
      const serialized = await serializeRequestFromDb(tx, updated);
      await createShiftRequestNotifications(tx, 'cancelled', serialized);
      await createShiftRequestAudit(tx, 'cancel', req.viewer!.id, req.viewer!.name.en, serialized);
      return serialized;
    });
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift request not found.' } });
      return;
    }
    res.json({ request: result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'CANCEL_FAILED';
    res.status(reason === 'WRONG_ACTOR' ? 403 : 409).json({
      error: {
        code: reason === 'WRONG_ACTOR' ? 'FORBIDDEN' : 'INVALID_STATUS',
        message: reason === 'WRONG_ACTOR' ? 'Only the requester can cancel this request.' : 'This request can no longer be cancelled.',
      },
    });
  }
});

shiftRequestsRouter.post('/:requestId/approve', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid approval payload.', details: parsed.error.flatten() } });
    return;
  }
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await getRequestOr404(tx, requestId, req.viewer!);
      if (!request) return null;
      if (req.viewer!.role === 'admin' && request.departmentId !== req.viewer!.department.id) throw new Error('FORBIDDEN');
      if (request.status !== 'pending_admin') throw new Error('INVALID_STATUS');

      const serializedCurrent = await serializeRequestFromDb(tx, request);
      const warnings = await inspectRequestWarnings(tx, serializedCurrent);
      if (warnings.length > 0 && !parsed.data.overrideConflicts) {
        throw Object.assign(new Error('CONFLICT_REQUIRES_OVERRIDE'), { warnings });
      }
      const apply = await applyApprovedShiftRequest(tx, serializedCurrent, req.viewer!.name.en);
      if (!apply.ok) throw new Error(apply.reason.toUpperCase());

      const timeline = [
        timelineEvent('admin_approved', 'admin', req.viewer!.name.en, req.viewer!.id),
        ...(parsed.data.overrideConflicts && warnings.length > 0
          ? [timelineEvent('conflict_overridden', 'admin', req.viewer!.name.en, req.viewer!.id)]
          : []),
        ...serializedCurrent.timeline,
      ];
      const updated = await tx.shiftRequest.update({
        where: { id: request.id },
        data: {
          status: 'approved',
          warningsJson: JSON.stringify(warnings),
          conflictOverride: parsed.data.overrideConflicts && warnings.length > 0,
          timelineJson: JSON.stringify(timeline),
        },
      });
      const serialized = await serializeRequestFromDb(tx, updated);
      await createShiftRequestNotifications(tx, 'approved', serialized);
      await createShiftRequestAudit(tx, 'approve', req.viewer!.id, req.viewer!.name.en, serialized);

      const overlapping = await tx.shiftRequest.findMany({
        where: {
          id: { not: request.id },
          departmentId: request.departmentId,
          status: { in: ['pending_recipient', 'pending_admin'] },
        },
      });
      const cleanId = (id: string | undefined) => (id ? id.replace(/^directory-account:/, '') : '');
      const matchKey = (ref: ShiftAssignmentRef) => `${ref.source}|${ref.monthKey}|${ref.rowId}|${ref.day}|${cleanId(ref.employeeId)}`;
      const approvedKeys = [
        matchKey(serialized.requesterAssignment),
        ...(serialized.offeredAssignment ? [matchKey(serialized.offeredAssignment)] : []),
      ];
      for (const candidate of overlapping) {
        const candidateRequester = parseJson<ShiftAssignmentRef>(candidate.requesterAssignmentJson, {} as ShiftAssignmentRef);
        const candidateOffered = parseJson<ShiftAssignmentRef | undefined>(candidate.offeredAssignmentJson, undefined);
        const candidateKeys = [
          matchKey(candidateRequester),
          ...(candidateOffered ? [matchKey(candidateOffered)] : []),
        ];
        if (!candidateKeys.some((key) => approvedKeys.includes(key))) continue;
        const stale = await tx.shiftRequest.update({
          where: { id: candidate.id },
          data: {
            status: 'stale',
            timelineJson: JSON.stringify([timelineEvent('stale', 'system', 'System'), ...parseJson(candidate.timelineJson, [])]),
          },
        });
        const staleSerialized = await serializeRequestFromDb(tx, stale);
        await createShiftRequestNotifications(tx, 'stale', staleSerialized);
        await createShiftRequestAudit(tx, 'expire', null, 'System', staleSerialized);
      }
      return serialized;
    });
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift request not found.' } });
      return;
    }
    res.json({ request: result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'APPROVE_FAILED';
    const warnings = typeof error === 'object' && error && 'warnings' in error ? (error as { warnings?: unknown }).warnings : undefined;
    const map: Record<string, [number, string, string]> = {
      FORBIDDEN: [403, 'FORBIDDEN', 'You are not allowed to approve this request.'],
      INVALID_STATUS: [409, 'INVALID_STATUS', 'Only accepted requests can be approved.'],
      CONFLICT_REQUIRES_OVERRIDE: [409, 'CONFLICT_REQUIRES_OVERRIDE', 'Approval requires conflict override.'],
      NOT_FOUND: [409, 'STALE_ASSIGNMENT', 'The request assignment no longer exists.'],
      DRAFT_CONFLICT: [409, 'DRAFT_CONFLICT', 'A draft changed after the request was created.'],
      STALE: [409, 'STALE_ASSIGNMENT', 'The request assignment has changed.'],
    };
    const [status, code, message] = map[reason] ?? [400, 'APPROVE_FAILED', 'Unable to approve the request.'];
    res.status(status).json({ error: { code, message }, ...(warnings ? { warnings } : {}) });
  }
});

shiftRequestsRouter.post('/:requestId/reject-admin', requireRoles('admin', 'super_admin'), async (req, res) => {
  const parsed = rejectAdminSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid rejection payload.', details: parsed.error.flatten() } });
    return;
  }
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await getRequestOr404(tx, requestId, req.viewer!);
      if (!request) return null;
      if (req.viewer!.role === 'admin' && request.departmentId !== req.viewer!.department.id) throw new Error('FORBIDDEN');
      if (!['pending_recipient', 'pending_admin'].includes(request.status)) throw new Error('INVALID_STATUS');
      if (parsed.data.reason === 'other' && !parsed.data.note?.trim()) throw new Error('NOTE_REQUIRED');
      const updated = await tx.shiftRequest.update({
        where: { id: request.id },
        data: {
          status: 'admin_rejected',
          adminRejectionReason: parsed.data.reason,
          adminRejectionNote: parsed.data.reason === 'other' ? parsed.data.note?.trim() ?? '' : parsed.data.note?.trim() ?? null,
          timelineJson: JSON.stringify([
            timelineEvent('admin_rejected', 'admin', req.viewer!.name.en, req.viewer!.id, parsed.data.note?.trim()),
            ...parseJson(request.timelineJson, []),
          ]),
        },
      });
      const serialized = await serializeRequestFromDb(tx, updated);
      await createShiftRequestNotifications(tx, 'admin_rejected', serialized);
      await createShiftRequestAudit(tx, 'reject', req.viewer!.id, req.viewer!.name.en, serialized);
      return serialized;
    });
    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift request not found.' } });
      return;
    }
    res.json({ request: result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'REJECT_FAILED';
    const map: Record<string, [number, string, string]> = {
      FORBIDDEN: [403, 'FORBIDDEN', 'You are not allowed to reject this request.'],
      INVALID_STATUS: [409, 'INVALID_STATUS', 'This request can no longer be rejected.'],
      NOTE_REQUIRED: [400, 'NOTE_REQUIRED', 'A note is required when the rejection reason is Other.'],
    };
    const [status, code, message] = map[reason] ?? [400, 'REJECT_FAILED', 'Unable to reject the request.'];
    res.status(status).json({ error: { code, message } });
  }
});

shiftRequestsRouter.delete('/clear-closed', requireRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const whereClause: Prisma.ShiftRequestWhereInput = {
      status: { in: ['recipient_rejected', 'admin_rejected', 'cancelled', 'expired', 'stale'] },
      ...(req.viewer!.role === 'admin' ? { departmentId: req.viewer!.department.id } : {}),
    };
    const result = await prisma.shiftRequest.deleteMany({
      where: whereClause,
    });
    res.json({ ok: true, count: result.count });
  } catch {
    res.status(500).json({ error: { code: 'DELETE_FAILED', message: 'Unable to clear closed requests.' } });
  }
});

shiftRequestsRouter.delete('/:requestId', requireRoles('admin', 'super_admin'), async (req, res) => {
  const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
  try {
    const request = await prisma.shiftRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || !shiftRequestVisibleToViewer(request, req.viewer!)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift request not found.' } });
      return;
    }
    if (req.viewer!.role === 'admin' && request.departmentId !== req.viewer!.department.id) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not allowed to delete this request.' } });
      return;
    }
    await prisma.shiftRequest.delete({
      where: { id: requestId },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: { code: 'DELETE_FAILED', message: 'Unable to delete shift request.' } });
  }
});
