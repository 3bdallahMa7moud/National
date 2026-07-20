import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import { getStoredLanguage } from '@/i18n/constants';
import {
  assignmentCellHasEmployee,
  assignmentRequestKey,
  browserShiftAssignmentGateway,
  hasDayShiftOTConflict,
  reloadPublishedAssignmentSnapshots,
} from '@/lib/shiftAssignmentGateway';
import { mockEmployeesSource } from '@/mocks/sources';
import type { AuthUser } from '@/types/employee';
import {
  EMPLOYEE_PERMISSION_TEMPLATES,
  effectivePermissions,
  type EmployeeAccessProfile,
  type EmployeePermission,
} from '@/types/employeeAccess';
import type { TargetedNotificationDraft } from '@/types/notification';
import type {
  CreateShiftRequestInput,
  ShiftAssignmentGateway,
  ShiftRequest,
  ShiftRequestAdminRejectionReason,
  ShiftRequestMutationReason,
  ShiftRequestMutationResult,
  ShiftRequestStatus,
  ShiftRequestTimelineEvent,
} from '@/types/shiftRequest';
import { useEmployeeAccessStore } from './employeeAccessStore';
import { useAuthStore } from './authStore';
import { useOperationalAuditStore } from './operationalAuditStore';
import { useTargetedNotificationStore } from './targetedNotificationStore';

export const SHIFT_REQUEST_STORAGE_KEY = 'ngh_shift_requests_v1';
export const SHIFT_REQUEST_TRANSACTION_STORAGE_KEY = 'ngh_shift_request_tx_v1';

export interface ShiftRequestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ShiftRequestPersistedState {
  version: 1;
  requests: ShiftRequest[];
}

interface ShiftRequestTransactionJournal {
  version: 1;
  requestId: string;
  receipt: import('@/types/shiftRequest').ShiftApplyReceipt;
  createdAt: string;
}

type ShiftRequestAuditAction = 'request' | 'approve' | 'reject' | 'cancel' | 'expire';

type ShiftRequestAuditResult =
  | void
  | { ok: true; rollback?: () => boolean }
  | { ok: false; reason: 'storage_error'; message?: string };

interface ShiftRequestAuditCommand {
  request: ShiftRequest;
  action: ShiftRequestAuditAction;
  actorName: string;
}

interface ShiftRequestStoreOptions {
  storage?: ShiftRequestStorage | null;
  gateway?: ShiftAssignmentGateway;
  now?: () => Date;
  createId?: () => string;
  profiles?: () => Record<string, EmployeeAccessProfile>;
  isAdmin?: (accountId: string) => boolean;
  isCurrentActor?: (accountId: string) => boolean;
  notify?: (drafts: TargetedNotificationDraft[]) => boolean;
  onChanged?: (event: { scheduleChanged: boolean }) => void;
  recordAudit?: (request: ShiftRequest, action: ShiftRequestAuditAction, actorName: string) => ShiftRequestAuditResult;
}

export interface ShiftRequestState {
  requests: ShiftRequest[];
  storageError: string | null;
  createRequest(input: CreateShiftRequestInput): ShiftRequestMutationResult;
  acceptByRecipient(requestId: string, accountId: string, actorName: string): ShiftRequestMutationResult;
  rejectByRecipient(requestId: string, accountId: string, actorName: string): ShiftRequestMutationResult;
  cancelByRequester(requestId: string, accountId: string, actorName: string): ShiftRequestMutationResult;
  approveByAdmin(requestId: string, adminAccountId: string, actorName: string, overrideConflicts?: boolean): ShiftRequestMutationResult;
  rejectByAdmin(
    requestId: string,
    adminAccountId: string,
    actorName: string,
    reason: ShiftRequestAdminRejectionReason | undefined,
    note?: string,
  ): ShiftRequestMutationResult;
  expirePending(): number;
  visibleForUser(user: Pick<AuthUser, 'id' | 'role' | 'departmentId' | 'scheduleEmployeeId'>): ShiftRequest[];
  reloadFromStorage(): void;
  clearForTests(): void;
}

const ACTIVE_STATUSES: ShiftRequestStatus[] = ['pending_recipient', 'pending_admin'];

function browserStorage(): ShiftRequestStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isStatus(value: unknown): value is ShiftRequestStatus {
  return [
    'pending_recipient', 'pending_admin', 'approved', 'recipient_rejected',
    'admin_rejected', 'cancelled', 'expired', 'stale',
  ].includes(String(value));
}

function isRequest(value: unknown): value is ShiftRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Partial<ShiftRequest>;
  const party = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    return typeof item.accountId === 'string'
      && typeof item.employeeId === 'string'
      && typeof item.employeeCode === 'string'
      && typeof item.name === 'string';
  };
  const assignment = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const item = candidate as Record<string, unknown>;
    return (item.source === 'schedule' || item.source === 'ot')
      && typeof item.departmentId === 'string'
      && typeof item.monthKey === 'string'
      && Number.isInteger(item.year)
      && Number.isInteger(item.month)
      && Number.isInteger(item.day)
      && typeof item.rowId === 'string'
      && typeof item.employeeId === 'string'
      && typeof item.employeeCode === 'string'
      && typeof item.fingerprint === 'string'
      && typeof item.startsAt === 'string';
  };
  return typeof request.id === 'string'
    && (request.type === 'exchange' || request.type === 'replace')
    && typeof request.departmentId === 'string'
    && party(request.requester)
    && party(request.recipient)
    && assignment(request.requesterAssignment)
    && (request.type === 'exchange' ? assignment(request.offeredAssignment) : request.offeredAssignment === undefined)
    && isStatus(request.status)
    && Array.isArray(request.timeline)
    && typeof request.createdAt === 'string'
    && typeof request.updatedAt === 'string'
    && typeof request.expiresAt === 'string';
}

function readRequests(storage: ShiftRequestStorage | null): ShiftRequest[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SHIFT_REQUEST_STORAGE_KEY) || 'null') as Partial<ShiftRequestPersistedState> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.requests)) return [];
    return parsed.requests.filter(isRequest);
  } catch {
    return [];
  }
}

function defaultIsAdmin(accountId: string): boolean {
  const current = useAuthStore.getState().user;
  return current?.id === accountId && current.role === 'admin';
}

function defaultAudit(
  request: ShiftRequest,
  action: ShiftRequestAuditAction,
  actorName: string,
): ShiftRequestAuditResult {
  const auditStore = useOperationalAuditStore.getState();
  const result = auditStore.record({
    actorName,
    action,
    module: 'shift_requests',
    entityId: request.id,
    entityLabel: `${request.type === 'exchange' ? 'Exchange' : 'Replace'} shift request`,
    before: request.timeline.length > 1 ? request.timeline[1]?.action : undefined,
    after: request.status,
    context: {
      year: request.requesterAssignment.year,
      month: request.requesterAssignment.month,
      rowId: request.requesterAssignment.rowId,
      day: request.requesterAssignment.day,
      route: action === 'approve' || (action === 'reject' && request.status === 'admin_rejected')
        ? '/admin/shift-requests'
        : '/shift-requests',
    },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    rollback: () => useOperationalAuditStore.getState().remove(result.entry.id).ok,
  };
}

function defaultNotify(drafts: TargetedNotificationDraft[]): boolean {
  return useTargetedNotificationStore.getState().pushMany(drafts).ok;
}

function fallbackProfile(accountId: string): EmployeeAccessProfile | undefined {
  const source = mockEmployeesSource.find((employee) => employee.id === accountId && employee.role === 'employee');
  if (!source) return undefined;
  return {
    accountId: source.id,
    departmentId: source.departmentId,
    scheduleEmployeeId: source.scheduleEmployeeId,
    templateId: 'standard',
    overrides: {},
    active: source.isActive,
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
  };
}

function hasPermission(profile: EmployeeAccessProfile, permission: EmployeePermission): boolean {
  return profile.active && effectivePermissions(profile.templateId, profile.overrides)[permission];
}

function localCopy(en: string, ar: string): string {
  return getStoredLanguage() === 'ar' ? ar : en;
}

function notificationDrafts(event: string, request: ShiftRequest): TargetedNotificationDraft[] {
  const typeLabel = request.type === 'exchange'
    ? localCopy('Exchange', 'تبديل')
    : localCopy('Replace', 'استبدال');
  const common = { departmentId: request.departmentId, relatedRequestId: request.id, isUrgent: false } as const;
  if (event === 'created') return [{
    ...common,
    recipientAccountId: request.recipient.accountId,
    type: 'shift_request_received',
    title: localCopy(`New ${typeLabel} request`, `طلب ${typeLabel} جديد`),
    message: localCopy(`${request.requester.name} sent you a shift request.`, `أرسل لك ${request.requester.name} طلبًا بخصوص الشفت.`),
    actionUrl: '/shift-requests',
  }];
  if (event === 'recipient_accepted') return [{
    ...common,
    recipientRole: 'admin',
    type: 'shift_request_recipient_accepted',
    title: localCopy(`${typeLabel} request awaiting approval`, `طلب ${typeLabel} بانتظار الاعتماد`),
    message: localCopy(`${request.recipient.name} accepted the request.`, `وافق ${request.recipient.name} على الطلب.`),
    actionUrl: '/admin/shift-requests',
    isUrgent: true,
  }];
  if (event === 'recipient_rejected') return [{
    ...common,
    recipientAccountId: request.requester.accountId,
    type: 'shift_request_rejected',
    title: localCopy(`${typeLabel} request rejected`, `تم رفض طلب ${typeLabel}`),
    message: localCopy(`${request.recipient.name} rejected your request.`, `رفض ${request.recipient.name} طلبك.`),
    actionUrl: '/shift-requests',
  }];
  if (event === 'approved') return [request.requester, request.recipient].map((party) => ({
    ...common,
    recipientAccountId: party.accountId,
    type: 'shift_request_approved' as const,
    title: localCopy(`${typeLabel} request approved`, `تم اعتماد طلب ${typeLabel}`),
    message: localCopy('The administrator approved the request and the published schedule was updated.', 'اعتمد الأدمن الطلب وتم تحديث الجدول المنشور.'),
    actionUrl: '/shift-requests',
    isUrgent: true,
  }));
  if (event === 'admin_rejected') return [request.requester, request.recipient].map((party) => ({
    ...common,
    recipientAccountId: party.accountId,
    type: 'shift_request_rejected' as const,
    title: localCopy(`${typeLabel} request declined by admin`, `رفض الأدمن طلب ${typeLabel}`),
    message: localCopy('The administrator did not approve this request.', 'لم يعتمد الأدمن هذا الطلب.'),
    actionUrl: '/shift-requests',
  }));
  if (event === 'stale') return [request.requester, request.recipient].map((party) => ({
    ...common,
    recipientAccountId: party.accountId,
    type: 'shift_request_stale' as const,
    title: localCopy(`${typeLabel} request is no longer valid`, `طلب ${typeLabel} لم يعد صالحًا`),
    message: localCopy('The shift changed or another request was approved first.', 'تغير الشفت أو تم اعتماد طلب آخر عليه أولًا.'),
    actionUrl: '/shift-requests',
  }));
  if (event === 'cancelled') return [{
    ...common,
    recipientAccountId: request.recipient.accountId,
    type: 'shift_request_rejected',
    title: localCopy(`${typeLabel} request cancelled`, `تم إلغاء طلب ${typeLabel}`),
    message: localCopy(`${request.requester.name} cancelled the request.`, `ألغى ${request.requester.name} الطلب.`),
    actionUrl: '/shift-requests',
  }];
  if (event === 'expired') return [request.requester, request.recipient].map((party) => ({
    ...common,
    recipientAccountId: party.accountId,
    type: 'shift_request_stale' as const,
    title: localCopy(`${typeLabel} request expired`, `انتهت صلاحية طلب ${typeLabel}`),
    message: localCopy('The shift started before the approval flow was completed.', 'بدأ الشفت قبل اكتمال الموافقات.'),
    actionUrl: '/shift-requests',
  }));
  return [];
}

function assignmentKeys(request: ShiftRequest): string[] {
  return [
    assignmentRequestKey(request.requesterAssignment),
    ...(request.offeredAssignment ? [assignmentRequestKey(request.offeredAssignment)] : []),
  ];
}

function timelineEvent(
  action: ShiftRequestTimelineEvent['action'],
  actorRole: ShiftRequestTimelineEvent['actorRole'],
  actorName: string,
  createdAt: string,
  createId: () => string,
  actorAccountId?: string,
  note?: string,
): ShiftRequestTimelineEvent {
  return { id: createId(), action, actorRole, actorName, actorAccountId, createdAt, note };
}

function makeState(
  options: ShiftRequestStoreOptions,
  set: StoreApi<ShiftRequestState>['setState'],
  get: StoreApi<ShiftRequestState>['getState'],
): ShiftRequestState {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const gateway = options.gateway ?? browserShiftAssignmentGateway;
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => `shift-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const profiles = options.profiles ?? (() => useEmployeeAccessStore.getState().profiles);
  const isAdmin = options.isAdmin ?? defaultIsAdmin;
  const isCurrentActor = options.isCurrentActor ?? ((accountId: string) => useAuthStore.getState().user?.id === accountId);
  const notify = options.notify ?? defaultNotify;
  const recordAudit = options.recordAudit ?? defaultAudit;

  const initialRequests = readRequests(storage);
  try {
    const journal = JSON.parse(storage?.getItem(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY) || 'null') as ShiftRequestTransactionJournal | null;
    if (journal?.version === 1 && journal.receipt) {
      const committed = initialRequests.some((request) => request.id === journal.requestId && request.status === 'approved');
      if (!committed) gateway.rollback(journal.receipt);
      storage?.setItem(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY, 'null');
    }
  } catch {
    // Invalid recovery metadata is ignored; normal stale validation still prevents a second application.
  }

  const currentProfile = (accountId: string) => profiles()[accountId] ?? fallbackProfile(accountId);
  const persist = (requests: ShiftRequest[]): boolean => {
    try {
      storage?.setItem(SHIFT_REQUEST_STORAGE_KEY, JSON.stringify({ version: 1, requests } satisfies ShiftRequestPersistedState));
      return true;
    } catch {
      return false;
    }
  };

  const commit = (
    previous: ShiftRequest[],
    requests: ShiftRequest[],
    drafts: TargetedNotificationDraft[],
    scheduleChanged = false,
  ): boolean => {
    if (!persist(requests)) {
      set({ storageError: 'Unable to save shift requests.' });
      return false;
    }
    if (!notify(drafts)) {
      persist(previous);
      set({ requests: previous, storageError: 'Unable to save request notifications.' });
      return false;
    }
    set({ requests, storageError: null });
    options.onChanged?.({ scheduleChanged });
    return true;
  };

  const rollbackAudits = (rollbacks: Array<() => boolean>) => {
    for (const rollback of [...rollbacks].reverse()) {
      try {
        rollback();
      } catch {
        // A failed audit rollback is surfaced by the audit store when available.
      }
    }
  };

  const commitWithAudit = (
    previous: ShiftRequest[],
    requests: ShiftRequest[],
    drafts: TargetedNotificationDraft[],
    audits: ShiftRequestAuditCommand[],
    scheduleChanged = false,
  ): boolean => {
    const auditRollbacks: Array<() => boolean> = [];
    for (const audit of audits) {
      let result: ShiftRequestAuditResult;
      try {
        result = recordAudit(audit.request, audit.action, audit.actorName);
      } catch (error) {
        rollbackAudits(auditRollbacks);
        set({ storageError: error instanceof Error ? error.message : 'Unable to save the operational audit.' });
        return false;
      }
      if (result && !result.ok) {
        rollbackAudits(auditRollbacks);
        set({ storageError: result.message || 'Unable to save the operational audit.' });
        return false;
      }
      if (result?.ok && result.rollback) auditRollbacks.push(result.rollback);
    }
    if (!commit(previous, requests, drafts, scheduleChanged)) {
      rollbackAudits(auditRollbacks);
      return false;
    }
    return true;
  };

  const replaceRequest = (updated: ShiftRequest) => get().requests.map((request) => request.id === updated.id ? updated : request);
  const fail = (reason: ShiftRequestMutationReason, request?: ShiftRequest, message?: string): ShiftRequestMutationResult => ({
    ok: false, reason, request, message,
  });

  return {
    requests: initialRequests,
    storageError: null,
    createRequest: (input) => {
      if (!isCurrentActor(input.requesterAccountId)) return fail('wrong_actor');
      const requesterProfile = currentProfile(input.requesterAccountId);
      const recipientProfile = currentProfile(input.recipientAccountId);
      if (!requesterProfile?.scheduleEmployeeId) return fail('unlinked_account');
      if (!requesterProfile.active) return fail('inactive_account');
      if (!recipientProfile?.scheduleEmployeeId) return fail('recipient_not_linked');
      if (!recipientProfile.active) return fail('inactive_account');
      const requiredPermission: EmployeePermission = input.type === 'exchange'
        ? 'schedule.exchange.create'
        : 'schedule.replace.create';
      if (!hasPermission(requesterProfile, requiredPermission)) return fail('permission_denied');
      if (!hasPermission(recipientProfile, 'schedule.requests.respond')) return fail('permission_denied');
      if (requesterProfile.departmentId !== recipientProfile.departmentId
        || input.requesterAssignment.departmentId !== requesterProfile.departmentId) return fail('cross_department');
      if (requesterProfile.scheduleEmployeeId === recipientProfile.scheduleEmployeeId) return fail('same_employee');
      if (input.requesterAssignment.employeeId !== requesterProfile.scheduleEmployeeId) return fail('wrong_actor');
      if (input.type === 'exchange' && !input.offeredAssignment) return fail('offered_shift_required');
      if (input.type === 'replace' && input.offeredAssignment) return fail('offered_shift_not_allowed');
      if (input.offeredAssignment) {
        if (input.offeredAssignment.source !== input.requesterAssignment.source) return fail('source_mismatch');
        if (input.offeredAssignment.departmentId !== requesterProfile.departmentId) return fail('cross_department');
        if (input.offeredAssignment.employeeId !== recipientProfile.scheduleEmployeeId) return fail('wrong_actor');
        if (
          input.offeredAssignment.monthKey === input.requesterAssignment.monthKey
          && input.offeredAssignment.rowId === input.requesterAssignment.rowId
          && input.offeredAssignment.day === input.requesterAssignment.day
        ) return fail('same_cell');
      }
      if (assignmentCellHasEmployee(input.requesterAssignment, recipientProfile.scheduleEmployeeId)) {
        return fail('target_already_assigned');
      }
      if (input.offeredAssignment && assignmentCellHasEmployee(input.offeredAssignment, requesterProfile.scheduleEmployeeId)) {
        return fail('target_already_assigned');
      }

      const validation = gateway.validate(input.requesterAssignment, now());
      if (!validation.ok) return fail(validation.reason === 'past_shift' ? 'past_shift' : validation.reason);
      const requesterConflict = hasDayShiftOTConflict(validation.assignment, requesterProfile.scheduleEmployeeId);
      if (requesterConflict.conflict) {
        return fail('day_shift_ot_conflict', undefined, requesterConflict.message);
      }
      let offered = input.offeredAssignment;
      if (offered) {
        const offeredValidation = gateway.validate(offered, now());
        if (!offeredValidation.ok) return fail(offeredValidation.reason === 'past_shift' ? 'past_shift' : offeredValidation.reason);
        offered = offeredValidation.assignment;
        const recipientConflict = hasDayShiftOTConflict(offered, recipientProfile.scheduleEmployeeId);
        if (recipientConflict.conflict) {
          return fail('day_shift_ot_conflict', undefined, recipientConflict.message);
        }
      }

      const keys = [assignmentRequestKey(validation.assignment), ...(offered ? [assignmentRequestKey(offered)] : [])];
      const requestKeySignature = [...keys].sort().join('||');
      const duplicate = get().requests.some((request) =>
        ACTIVE_STATUSES.includes(request.status)
        && request.type === input.type
        && request.requester.accountId === input.requesterAccountId
        && request.recipient.accountId === input.recipientAccountId
        && [...assignmentKeys(request)].sort().join('||') === requestKeySignature,
      );
      if (duplicate) return fail('duplicate_request');
      const createdAt = now().toISOString();
      const recipientCode = offered?.employeeCode
        ?? OFFICIAL_EMPLOYEE_ROSTER.find((employee) => employee.employeeId === recipientProfile.scheduleEmployeeId)?.code
        ?? recipientProfile.scheduleEmployeeId;
      const request: ShiftRequest = {
        id: createId(),
        type: input.type,
        departmentId: requesterProfile.departmentId,
        requester: {
          accountId: input.requesterAccountId,
          employeeId: requesterProfile.scheduleEmployeeId,
          employeeCode: validation.assignment.employeeCode,
          name: input.requesterName,
        },
        recipient: {
          accountId: input.recipientAccountId,
          employeeId: recipientProfile.scheduleEmployeeId,
          employeeCode: recipientCode,
          name: input.recipientName,
        },
        requesterAssignment: validation.assignment,
        offeredAssignment: offered,
        status: 'pending_recipient',
        warnings: [],
        createdAt,
        updatedAt: createdAt,
        expiresAt: [validation.assignment.startsAt, ...(offered ? [offered.startsAt] : [])].sort()[0],
        timeline: [timelineEvent('created', 'requester', input.requesterName, createdAt, createId, input.requesterAccountId)],
      };
      request.warnings = gateway.inspectWarnings(request);
      const previous = get().requests;
      const requests = [request, ...previous];
      if (!commitWithAudit(previous, requests, notificationDrafts('created', request), [
        { request, action: 'request', actorName: input.requesterName },
      ])) return fail('storage_error');
      return { ok: true, request };
    },
    acceptByRecipient: (requestId, accountId, actorName) => {
      const request = get().requests.find((candidate) => candidate.id === requestId);
      if (!request) return fail('not_found');
      if (!isCurrentActor(accountId)) return fail('wrong_actor', request);
      if (request.recipient.accountId !== accountId) return fail('wrong_actor', request);
      const profile = currentProfile(accountId);
      if (!profile || !hasPermission(profile, 'schedule.requests.respond')) return fail('permission_denied', request);
      if (request.status !== 'pending_recipient') return fail('invalid_status', request);
      if (new Date(request.expiresAt).getTime() <= now().getTime()) {
        get().expirePending();
        return fail('past_shift', get().requests.find((candidate) => candidate.id === request.id));
      }
      const requesterValidation = gateway.validate(request.requesterAssignment, now());
      const offeredValidation = request.offeredAssignment
        ? gateway.validate(request.offeredAssignment, now())
        : null;
      if (!requesterValidation.ok || (offeredValidation && !offeredValidation.ok)) {
        const staleAt = now().toISOString();
        const stale: ShiftRequest = {
          ...request,
          status: 'stale',
          updatedAt: staleAt,
          timeline: [timelineEvent('stale', 'system', 'System', staleAt, createId), ...request.timeline],
        };
        const previous = get().requests;
        if (!commitWithAudit(previous, replaceRequest(stale), notificationDrafts('stale', stale), [
          { request: stale, action: 'expire', actorName: 'System' },
        ])) return fail('storage_error', request);
        return fail('stale', stale);
      }
      const updatedAt = now().toISOString();
      const updated: ShiftRequest = {
        ...request,
        status: 'pending_admin',
        updatedAt,
        timeline: [timelineEvent('recipient_accepted', 'recipient', actorName, updatedAt, createId, accountId), ...request.timeline],
      };
      const previous = get().requests;
      if (!commitWithAudit(previous, replaceRequest(updated), notificationDrafts('recipient_accepted', updated), [
        { request: updated, action: 'request', actorName },
      ])) return fail('storage_error', request);
      return { ok: true, request: updated };
    },
    rejectByRecipient: (requestId, accountId, actorName) => {
      const request = get().requests.find((candidate) => candidate.id === requestId);
      if (!request) return fail('not_found');
      if (!isCurrentActor(accountId)) return fail('wrong_actor', request);
      if (request.recipient.accountId !== accountId) return fail('wrong_actor', request);
      const profile = currentProfile(accountId);
      if (!profile || !hasPermission(profile, 'schedule.requests.respond')) return fail('permission_denied', request);
      if (request.status !== 'pending_recipient') return fail('invalid_status', request);
      if (new Date(request.expiresAt).getTime() <= now().getTime()) {
        get().expirePending();
        return fail('past_shift', get().requests.find((candidate) => candidate.id === request.id));
      }
      const updatedAt = now().toISOString();
      const updated: ShiftRequest = {
        ...request,
        status: 'recipient_rejected',
        updatedAt,
        timeline: [timelineEvent('recipient_rejected', 'recipient', actorName, updatedAt, createId, accountId), ...request.timeline],
      };
      const previous = get().requests;
      if (!commitWithAudit(previous, replaceRequest(updated), notificationDrafts('recipient_rejected', updated), [
        { request: updated, action: 'reject', actorName },
      ])) return fail('storage_error', request);
      return { ok: true, request: updated };
    },
    cancelByRequester: (requestId, accountId, actorName) => {
      const request = get().requests.find((candidate) => candidate.id === requestId);
      if (!request) return fail('not_found');
      if (!isCurrentActor(accountId)) return fail('wrong_actor', request);
      if (request.requester.accountId !== accountId) return fail('wrong_actor', request);
      const profile = currentProfile(accountId);
      if (!profile || !hasPermission(profile, 'schedule.requests.cancelOwn')) return fail('permission_denied', request);
      if (!ACTIVE_STATUSES.includes(request.status)) return fail('invalid_status', request);
      if (new Date(request.expiresAt).getTime() <= now().getTime()) {
        get().expirePending();
        return fail('past_shift', get().requests.find((candidate) => candidate.id === request.id));
      }
      const updatedAt = now().toISOString();
      const updated: ShiftRequest = {
        ...request,
        status: 'cancelled',
        updatedAt,
        timeline: [timelineEvent('cancelled', 'requester', actorName, updatedAt, createId, accountId), ...request.timeline],
      };
      const previous = get().requests;
      if (!commitWithAudit(previous, replaceRequest(updated), notificationDrafts('cancelled', updated), [
        { request: updated, action: 'cancel', actorName },
      ])) return fail('storage_error', request);
      return { ok: true, request: updated };
    },
    approveByAdmin: (requestId, adminAccountId, actorName, overrideConflicts = false) => {
      const request = get().requests.find((candidate) => candidate.id === requestId);
      if (!request) return fail('not_found');
      if (!isCurrentActor(adminAccountId)) return fail('wrong_actor', request);
      if (!isAdmin(adminAccountId)) return fail('permission_denied', request);
      if (request.status !== 'pending_admin') return fail('invalid_status', request);
      if (new Date(request.expiresAt).getTime() <= now().getTime()) {
        get().expirePending();
        return fail('past_shift', get().requests.find((candidate) => candidate.id === request.id));
      }
      const warnings = gateway.inspectWarnings(request);
      if (warnings.length > 0 && !overrideConflicts) return { ok: false, reason: 'conflict_requires_override', request, warnings };
      const applyResult = gateway.apply(request, { actorName, overrideConflicts });
      if (!applyResult.ok) return fail(
        applyResult.reason === 'draft_conflict' ? 'draft_conflict'
          : applyResult.reason === 'stale' || applyResult.reason === 'not_found' ? 'stale'
            : applyResult.reason === 'storage_error' ? 'storage_error' : 'apply_failed',
        request,
        applyResult.message,
      );
      try {
        storage?.setItem(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY, JSON.stringify({
          version: 1,
          requestId: request.id,
          receipt: applyResult.receipt,
          createdAt: now().toISOString(),
        } satisfies ShiftRequestTransactionJournal));
      } catch {
        gateway.rollback(applyResult.receipt);
        return fail('storage_error', request);
      }
      const updatedAt = now().toISOString();
      const timeline = [
        timelineEvent('admin_approved', 'admin', actorName, updatedAt, createId, adminAccountId),
        ...(overrideConflicts && warnings.length > 0
          ? [timelineEvent('conflict_overridden', 'admin', actorName, updatedAt, createId, adminAccountId)]
          : []),
        ...request.timeline,
      ];
      const approved: ShiftRequest = {
        ...request,
        status: 'approved',
        warnings,
        conflictOverride: overrideConflicts && warnings.length > 0,
        updatedAt,
        timeline,
      };
      const approvedKeys = assignmentKeys(request);
      const staleRequests: ShiftRequest[] = [];
      const requests = get().requests.map((candidate) => {
        if (candidate.id === request.id) return approved;
        if (!ACTIVE_STATUSES.includes(candidate.status)
          || !assignmentKeys(candidate).some((key) => approvedKeys.includes(key))) return candidate;
        const stale: ShiftRequest = {
          ...candidate,
          status: 'stale',
          updatedAt,
          timeline: [timelineEvent('stale', 'system', 'System', updatedAt, createId), ...candidate.timeline],
        };
        staleRequests.push(stale);
        return stale;
      });
      const previous = get().requests;
      const drafts = [
        ...notificationDrafts('approved', approved),
        ...staleRequests.flatMap((candidate) => notificationDrafts('stale', candidate)),
      ];
      const auditCommands: ShiftRequestAuditCommand[] = [
        { request: approved, action: 'approve', actorName },
        ...staleRequests.map((stale) => ({ request: stale, action: 'expire' as const, actorName: 'System' })),
      ];
      if (!commitWithAudit(previous, requests, drafts, auditCommands, true)) {
        gateway.rollback(applyResult.receipt);
        try { storage?.setItem(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY, 'null'); } catch { /* recovered on next load */ }
        return fail('storage_error', request);
      }
      try { storage?.setItem(SHIFT_REQUEST_TRANSACTION_STORAGE_KEY, 'null'); } catch { /* committed journal is cleared on next load */ }
      return { ok: true, request: approved };
    },
    rejectByAdmin: (requestId, adminAccountId, actorName, reason, note) => {
      const request = get().requests.find((candidate) => candidate.id === requestId);
      if (!request) return fail('not_found');
      if (!isCurrentActor(adminAccountId)) return fail('wrong_actor', request);
      if (!isAdmin(adminAccountId)) return fail('permission_denied', request);
      if (request.status !== 'pending_admin') return fail('invalid_status', request);
      if (new Date(request.expiresAt).getTime() <= now().getTime()) {
        get().expirePending();
        return fail('past_shift', get().requests.find((candidate) => candidate.id === request.id));
      }
      if (!reason) return fail('rejection_reason_required', request);
      if (reason === 'other' && !note?.trim()) return fail('rejection_note_required', request);
      const updatedAt = now().toISOString();
      const updated: ShiftRequest = {
        ...request,
        status: 'admin_rejected',
        adminRejectionReason: reason,
        adminRejectionNote: note?.trim() || undefined,
        updatedAt,
        timeline: [timelineEvent('admin_rejected', 'admin', actorName, updatedAt, createId, adminAccountId, note?.trim()), ...request.timeline],
      };
      const previous = get().requests;
      if (!commitWithAudit(previous, replaceRequest(updated), notificationDrafts('admin_rejected', updated), [
        { request: updated, action: 'reject', actorName },
      ])) return fail('storage_error', request);
      return { ok: true, request: updated };
    },
    expirePending: () => {
      const timestamp = now();
      const updatedAt = timestamp.toISOString();
      const expired: ShiftRequest[] = [];
      const requests = get().requests.map((request) => {
        if (!ACTIVE_STATUSES.includes(request.status) || new Date(request.expiresAt).getTime() > timestamp.getTime()) return request;
        const updated: ShiftRequest = {
          ...request,
          status: 'expired',
          updatedAt,
          timeline: [timelineEvent('expired', 'system', 'System', updatedAt, createId), ...request.timeline],
        };
        expired.push(updated);
        return updated;
      });
      if (expired.length === 0) return 0;
      const previous = get().requests;
      if (!commitWithAudit(
        previous,
        requests,
        expired.flatMap((request) => notificationDrafts('expired', request)),
        expired.map((request) => ({ request, action: 'expire', actorName: 'System' })),
      )) return 0;
      return expired.length;
    },
    visibleForUser: (user) => {
      if (user.role === 'admin') return get().requests;
      const profile = currentProfile(user.id);
      if (!profile) return [];
      if (hasPermission(profile, 'schedule.department.requests.view')) {
        return get().requests.filter((request) => request.departmentId === profile.departmentId);
      }
      return get().requests.filter((request) =>
        request.departmentId === profile.departmentId
        && (request.requester.accountId === user.id || request.recipient.accountId === user.id),
      );
    },
    reloadFromStorage: () => set({ requests: readRequests(storage), storageError: null }),
    clearForTests: () => {
      persist([]);
      set({ requests: [], storageError: null });
    },
  };
}

export function createShiftRequestStore(options: ShiftRequestStoreOptions = {}): StoreApi<ShiftRequestState> {
  return createStore<ShiftRequestState>()((set, get) => makeState(options, set, get));
}

let shiftRequestChannel: BroadcastChannel | null = null;
const broadcastShiftRequests = (event: { scheduleChanged: boolean }) => {
  try {
    shiftRequestChannel?.postMessage({ type: 'shift-requests-changed', scheduleChanged: event.scheduleChanged });
  } catch {
    // Cross-tab sync is best-effort after local persistence succeeds.
  }
};

export const useShiftRequestStore = create<ShiftRequestState>()(
  (set, get) => makeState({ onChanged: broadcastShiftRequests }, set, get),
);

if (typeof window !== 'undefined') {
  try {
    if ('BroadcastChannel' in window) {
      shiftRequestChannel = new BroadcastChannel('ngh-shift-requests');
      shiftRequestChannel.addEventListener('message', (event) => {
        useShiftRequestStore.getState().reloadFromStorage();
        if (event.data?.scheduleChanged === true) reloadPublishedAssignmentSnapshots();
      });
    }
    window.addEventListener('storage', (event) => {
      if (event.key === SHIFT_REQUEST_STORAGE_KEY) {
        const approvedBefore = new Set(useShiftRequestStore.getState().requests
          .filter((request) => request.status === 'approved')
          .map((request) => request.id));
        useShiftRequestStore.getState().reloadFromStorage();
        const hasNewApproval = useShiftRequestStore.getState().requests.some((request) =>
          request.status === 'approved' && !approvedBefore.has(request.id),
        );
        if (hasNewApproval) reloadPublishedAssignmentSnapshots();
      }
    });
    window.addEventListener('focus', () => {
      useShiftRequestStore.getState().reloadFromStorage();
    });
  } catch {
    // The active tab remains functional without cross-tab events.
  }
}

export function employeeShiftRequestPermission(
  user: Pick<AuthUser, 'id' | 'departmentId' | 'scheduleEmployeeId'>,
  permission: 'schedule.exchange.create' | 'schedule.replace.create' | 'schedule.requests.respond',
): boolean {
  const profile = useEmployeeAccessStore.getState().profiles[user.id]
    ?? fallbackProfile(user.id)
    ?? {
      accountId: user.id,
      departmentId: user.departmentId,
      scheduleEmployeeId: user.scheduleEmployeeId,
      templateId: 'standard' as const,
      overrides: {},
      active: true,
      updatedAt: new Date(0).toISOString(),
      updatedBy: 'system',
    };
  return Boolean(profile.scheduleEmployeeId)
    && (profile.overrides[permission] ?? EMPLOYEE_PERMISSION_TEMPLATES[profile.templateId].permissions[permission]);
}
