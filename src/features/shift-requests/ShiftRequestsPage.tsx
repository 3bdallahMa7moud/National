import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Check, Clock3, Plus, X } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { getStoredLanguage } from '@/i18n/constants';
import { listPublishedAssignmentsForEmployee } from '@/lib/shiftAssignmentGateway';
import { mockEmployeesSource } from '@/mocks/sources';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { useShiftRequestStore } from '@/stores/shiftRequestStore';
import { useTargetedNotificationStore } from '@/stores/targetedNotificationStore';
import { ShiftRequestCreateWizard } from './components/ShiftRequestCreateWizard';
import { effectivePermissions, resolveEffectiveEmployeeAccess, type EmployeeAccessProfile } from '@/types/employeeAccess';
import type {
  ShiftAssignmentRef,
  ShiftRequest,
  ShiftRequestAdminRejectionReason,
  ShiftRequestMutationReason,
  ShiftRequestMutationResult,
  ShiftRequestStatus,
  ShiftRequestType,
} from '@/types/shiftRequest';

type RequestFilter = 'all' | 'incoming' | 'outgoing';
type StatusFilter = 'all' | ShiftRequestStatus | 'closed';

const ACTIVE_STATUSES: ShiftRequestStatus[] = ['pending_recipient', 'pending_admin', 'approved'];
const CLOSED_STATUSES: ShiftRequestStatus[] = [
  'recipient_rejected', 'admin_rejected', 'cancelled', 'expired', 'stale',
];
const closedStatuses = CLOSED_STATUSES;

const rejectionReasons: ShiftRequestAdminRejectionReason[] = [
  'staff_shortage', 'skill_mismatch', 'approved_leave', 'operational_need', 'other',
];

const statusVariant: Record<ShiftRequestStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending_recipient: 'warning',
  pending_admin: 'info',
  approved: 'success',
  recipient_rejected: 'danger',
  admin_rejected: 'danger',
  cancelled: 'default',
  expired: 'default',
  stale: 'danger',
};

function displayAssignment(ref: ShiftAssignmentRef): string {
  return `${ref.monthKey}-${String(ref.day).padStart(2, '0')} · ${ref.facilityLabel} / ${ref.unitLabel} · ${ref.shiftLabel} (${ref.timeRange})`;
}

function accountName(accountId: string): string {
  const source = mockEmployeesSource.find((employee) => employee.id === accountId);
  if (!source) return accountId;
  return source.name[getStoredLanguage()];
}

function formatDateTime(value: string, language: string): string {
  const locale = language.startsWith('ar') ? 'ar-SA-u-ca-gregory' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function mutationMessageKey(reason: ShiftRequestMutationReason): string {
  if (reason === 'day_shift_ot_conflict') return 'shiftRequests:messages.dayShiftOTConflict';
  if (reason === 'duplicate_request') return 'shiftRequests:messages.duplicate';
  if (reason === 'not_published') return 'shiftRequests:messages.notPublished';
  if (reason === 'not_found') return 'shiftRequests:messages.notFound';
  if (reason === 'offered_shift_required') return 'shiftRequests:messages.offeredRequired';
  if (reason === 'invalid_status') return 'shiftRequests:messages.invalidStatus';
  if (reason === 'storage_error') return 'shiftRequests:messages.storage';
  if (reason === 'stale' || reason === 'past_shift') return 'shiftRequests:messages.stale';
  if (reason === 'conflict_requires_override') return 'shiftRequests:messages.conflict';
  if (reason === 'draft_conflict') return 'shiftRequests:messages.draftConflict';
  if (reason === 'rejection_note_required') return 'shiftRequests:messages.rejectionNoteRequired';
  if (reason === 'rejection_reason_required') return 'shiftRequests:messages.rejectionReasonRequired';
  if (reason === 'permission_denied' || reason === 'unlinked_account' || reason === 'inactive_account') {
    return 'shiftRequests:messages.permission';
  }
  return 'shiftRequests:messages.generic';
}

export default function ShiftRequestsPage() {
  const { t } = useTranslation(['shiftRequests']);
  const { addToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const requests = useShiftRequestStore((state) => state.requests);
  const accessProfile = useEmployeeAccessStore((state) => user ? state.profiles[user.id] : undefined);
  const visibleForUser = useShiftRequestStore((state) => state.visibleForUser);
  const expirePending = useShiftRequestStore((state) => state.expirePending);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    useShiftRequestStore.getState().reloadFromStorage();
    useTargetedNotificationStore.getState().reloadFromStorage();
    expirePending();
  }, [expirePending, user]);

  let visibleForAccount: ShiftRequest[] = [];
  if (user) {
    const all = visibleForUser(user);
    visibleForAccount = filter === 'incoming'
      ? all.filter((request) => request.recipient.accountId === user.id)
      : filter === 'outgoing'
        ? all.filter((request) => request.requester.accountId === user.id)
        : all;
  }
  void requests;

  if (!user) return null;
  const currentAccess = resolveEffectiveEmployeeAccess(user, accessProfile);
  const canCreate = user.role === 'employee'
    && currentAccess.linked
    && (currentAccess.permissions['schedule.exchange.create'] || currentAccess.permissions['schedule.replace.create']);
  const statusCounts = {
    total: visibleForAccount.length,
    pending_recipient: visibleForAccount.filter((request) => request.status === 'pending_recipient').length,
    pending_admin: visibleForAccount.filter((request) => request.status === 'pending_admin').length,
    approved: visibleForAccount.filter((request) => request.status === 'approved').length,
    closed: visibleForAccount.filter((request) => CLOSED_STATUSES.includes(request.status)).length,
  };
  
  const counterCards = [
    { label: 'total', count: statusCounts.total, color: 'text-text-primary' },
    { label: 'pendingRecipient', count: statusCounts.pending_recipient, color: 'text-warning' },
    { label: 'pendingAdmin', count: statusCounts.pending_admin, color: 'text-info' },
    { label: 'approved', count: statusCounts.approved, color: 'text-success' },
    { label: 'closed', count: statusCounts.closed, color: 'text-text-secondary' },
  ];

  const visible = statusFilter === 'all'
    ? visibleForAccount
    : statusFilter === 'closed'
      ? visibleForAccount.filter((request) => CLOSED_STATUSES.includes(request.status))
      : visibleForAccount.filter((request) => request.status === statusFilter);

  const report = (
    result: ShiftRequestMutationResult,
    actionType: 'created' | 'cancelled' | 'accepted' | 'rejected' | 'approved' | 'overrideApproved' | 'rejectAdmin' | 'default' = 'default',
  ) => {
    if (result.ok) {
      const messageKey = actionType !== 'default' ? `shiftRequests:actions.${actionType}` : 'shiftRequests:messages.saved';
      addToast({ type: 'success', title: t('shiftRequests:messages.saved'), message: t(messageKey) });
      return true;
    }
    const key = mutationMessageKey(result.reason);
    addToast({ type: 'error', title: t(key), message: t(key) });
    return false;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
            {t(user.role === 'admin' ? 'shiftRequests:adminTitle' : 'shiftRequests:title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t('shiftRequests:subtitle')}</p>
        </div>
        {canCreate && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            {t('shiftRequests:newRequest')}
          </Button>
        )}
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label={t('shiftRequests:counters.title')}>
        {counterCards.map(({ label, count, color }) => (
          <div key={label} className="rounded-card border border-border bg-surface-card p-3 shadow-xs">
            <p className="text-xs font-semibold text-text-secondary">{t(`shiftRequests:counters.${label}`)}</p>
            <p className={`mt-1 text-xl font-bold sm:text-2xl ${color}`}>{count}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'incoming', 'outgoing'] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={filter === item ? 'primary' : 'ghost'}
              onClick={() => setFilter(item)}
            >
              {t(`shiftRequests:${item}`)}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>{t('shiftRequests:statusFilter')}</span>
          <select
            className="input-field py-1"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">{t('shiftRequests:all')}</option>
            {ACTIVE_STATUSES.map((status) => (
              <option key={status} value={status}>{t(`shiftRequests:status.${status}`)}</option>
            ))}
            <option value="closed">{t('shiftRequests:counters.closed')}</option>
          </select>
        </div>
      </div>

      <ErrorBoundary fallback={<div className="p-4 text-xs text-danger">{t('shiftRequests:errors.load')}</div>}>
        {visible.length === 0 ? (
          <Card className="text-center text-xs text-text-secondary">
            {t('shiftRequests:empty')}
          </Card>
        ) : (
          <div className="space-y-4">
            {visible.map((request) => (
              <RequestCard key={request.id} request={request} user={user} report={report} />
            ))}
          </div>
        )}
      </ErrorBoundary>

      <ShiftRequestCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onResult={(result) => {
          if (report(result, 'created')) setCreateOpen(false);
        }}
      />
    </div>
  );
}

function RequestCard({
  request,
  user,
  report,
}: {
  request: ShiftRequest;
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  report(
    result: ShiftRequestMutationResult,
    actionType?: 'created' | 'cancelled' | 'accepted' | 'rejected' | 'approved' | 'overrideApproved' | 'rejectAdmin' | 'default',
  ): boolean;
}) {
  const { t, i18n } = useTranslation(['shiftRequests']);
  const accept = useShiftRequestStore((state) => state.acceptByRecipient);
  const rejectRecipient = useShiftRequestStore((state) => state.rejectByRecipient);
  const cancel = useShiftRequestStore((state) => state.cancelByRequester);
  const approve = useShiftRequestStore((state) => state.approveByAdmin);
  const rejectAdmin = useShiftRequestStore((state) => state.rejectByAdmin);
  const [showTimeline, setShowTimeline] = useState(false);
  const [overridePending, setOverridePending] = useState(false);
  const [reason, setReason] = useState<ShiftRequestAdminRejectionReason>('operational_need');
  const [note, setNote] = useState('');
  const accessProfile = useEmployeeAccessStore((state) => state.profiles[user.id]);

  const isRecipient = request.recipient.accountId === user.id;
  const isRequester = request.requester.accountId === user.id;
  const admin = user.role === 'admin';
  const canRespond = user.role === 'employee'
    && resolveEffectiveEmployeeAccess(user, accessProfile).permissions['schedule.requests.respond'];
  const canCancel = user.role === 'employee'
    && resolveEffectiveEmployeeAccess(user, accessProfile).permissions['schedule.requests.cancelOwn'];

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-btn bg-primary-50 p-2 text-primary"><ArrowLeftRight className="h-5 w-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-text-primary">{t(`shiftRequests:type.${request.type}`)}</h2>
              <Badge variant={statusVariant[request.status]}>{t(`shiftRequests:status.${request.status}`)}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{request.requester.name} → {request.recipient.name}</p>
          </div>
        </div>
        <span className="text-xs text-text-secondary">{formatDateTime(request.createdAt, i18n.language)}</span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          {t('shiftRequests:beforeChange')}
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <AssignmentCard title={t('shiftRequests:requesterShift')} assignment={request.requesterAssignment} />
          {request.offeredAssignment && <AssignmentCard title={t('shiftRequests:offeredShift')} assignment={request.offeredAssignment} />}
        </div>
      </div>

      {['pending_recipient', 'pending_admin', 'approved'].includes(request.status) ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
            {t('shiftRequests:afterApproval')}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <AssignmentEffectCard
              title={request.requester.name}
              value={request.type === 'exchange' && request.offeredAssignment
                ? displayAssignment(request.offeredAssignment)
                : t('shiftRequests:removedFromShift')}
            />
            <AssignmentEffectCard
              title={request.recipient.name}
              value={displayAssignment(request.requesterAssignment)}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface-muted/60 p-3.5 text-xs font-medium text-text-secondary flex items-center gap-2.5">
          <span className="inline-block w-2 h-2 rounded-full bg-text-secondary/60 shrink-0" />
          <span>
            {request.status === 'cancelled' && t('shiftRequests:statusNotices.cancelled')}
            {request.status === 'recipient_rejected' && t('shiftRequests:statusNotices.recipient_rejected')}
            {request.status === 'admin_rejected' && t('shiftRequests:statusNotices.admin_rejected')}
            {request.status === 'expired' && t('shiftRequests:statusNotices.expired')}
            {request.status === 'stale' && t('shiftRequests:statusNotices.stale')}
          </span>
        </div>
      )}

      {['pending_recipient', 'pending_admin'].includes(request.status) && request.warnings.length > 0 && (
        <div className="rounded-card border border-warning/30 bg-warning-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <AlertTriangle className="h-4 w-4 text-warning" /> {t('shiftRequests:warnings')}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-text-secondary">
            {request.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{t(`shiftRequests:warningCodes.${warning.code}`)}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {isRecipient && canRespond && request.status === 'pending_recipient' && (
          <>
            <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={() => report(accept(request.id, user.id, user.name), 'accepted')}>
              {t('shiftRequests:accept')}
            </Button>
            <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} onClick={() => report(rejectRecipient(request.id, user.id, user.name), 'rejected')}>
              {t('shiftRequests:reject')}
            </Button>
          </>
        )}
        {isRequester && canCancel && (request.status === 'pending_recipient' || request.status === 'pending_admin') && (
          <Button size="sm" variant="secondary" onClick={() => report(cancel(request.id, user.id, user.name), 'cancelled')}>
            {t('shiftRequests:cancel')}
          </Button>
        )}
        {admin && request.status === 'pending_admin' && (
          <>
            <Button
              size="sm"
              onClick={() => {
                const result = approve(request.id, user.id, user.name, false);
                if (!result.ok && result.reason === 'conflict_requires_override') setOverridePending(true);
                report(result, 'approved');
              }}
            >
              {t('shiftRequests:approve')}
            </Button>
            {overridePending && (
              <Button size="sm" variant="danger" onClick={() => {
                if (report(approve(request.id, user.id, user.name, true), 'overrideApproved')) setOverridePending(false);
              }}>
                {t('shiftRequests:approveOverride')}
              </Button>
            )}
            <select aria-label={t('shiftRequests:adminReason')} className="input-field min-w-[12rem]" value={reason} onChange={(event) => setReason(event.target.value as ShiftRequestAdminRejectionReason)}>
              {rejectionReasons.map((item) => <option key={item} value={item}>{t(`shiftRequests:reasons.${item}`)}</option>)}
            </select>
            <input
              className="input-field min-w-[12rem] flex-1"
              aria-label={t('shiftRequests:adminNote')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('shiftRequests:adminNote')}
            />
            <Button size="sm" variant="danger" onClick={() => report(rejectAdmin(request.id, user.id, user.name, reason, note), 'rejectAdmin')}>
              {t('shiftRequests:rejectAdmin')}
            </Button>
          </>
        )}
        <Button className="ms-auto" size="sm" variant="ghost" onClick={() => setShowTimeline((value) => !value)}>
          {t('shiftRequests:timeline')}
        </Button>
      </div>

      {showTimeline && (
        <ol className="space-y-2 rounded-card bg-surface-muted p-3">
          {request.timeline.map((event) => (
            <li key={event.id} className="flex gap-2 text-xs text-text-secondary">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                <strong className="text-text-primary">
                  {event.actorRole === 'system' ? t('shiftRequests:systemActor') : event.actorName}
                </strong> · {t(`shiftRequests:timelineActions.${event.action}`)} · {formatDateTime(event.createdAt, i18n.language)}
                {event.note ? <span className="mt-0.5 block text-text-primary">{event.note}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function AssignmentCard({ title, assignment }: { title: string; assignment: ShiftAssignmentRef }) {
  const { t } = useTranslation(['shiftRequests']);
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
      <p className="mt-2 break-words text-sm font-medium text-text-primary">{displayAssignment(assignment)}</p>
      <Badge className="mt-2" variant={assignment.source === 'ot' ? 'warning' : 'info'}>
        {t(`shiftRequests:source.${assignment.source}`)}
      </Badge>
    </div>
  );
}

function AssignmentEffectCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-w-0 rounded-card border border-primary/20 bg-primary-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
      <p className="mt-2 break-words text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

export function ShiftRequestCreateModal({
  isOpen,
  onClose,
  onResult,
  initialAssignment,
}: {
  isOpen: boolean;
  onClose(): void;
  onResult(result: ShiftRequestMutationResult): void;
  initialAssignment?: ShiftAssignmentRef;
}) {
  const { t } = useTranslation(['shiftRequests']);
  const user = useAuthStore((state) => state.user);
  const profiles = useEmployeeAccessStore((state) => state.profiles);
  const createRequest = useShiftRequestStore((state) => state.createRequest);

  const currentAccess = user ? resolveEffectiveEmployeeAccess(user, profiles[user.id]) : null;
  const requesterAssignments = currentAccess?.scheduleEmployeeId
    ? listPublishedAssignmentsForEmployee(currentAccess.scheduleEmployeeId, currentAccess.departmentId)
      .filter((assignment) => new Date(assignment.startsAt).getTime() > Date.now())
    : [];
  const candidateProfiles = useMemo(() => {
    const combined: Record<string, EmployeeAccessProfile> = { ...profiles };
    for (const employee of mockEmployeesSource) {
      if (employee.role !== 'employee' || !employee.scheduleEmployeeId || combined[employee.id]) continue;
      combined[employee.id] = {
        accountId: employee.id,
        departmentId: employee.departmentId,
        scheduleEmployeeId: employee.scheduleEmployeeId,
        templateId: 'standard',
        overrides: {},
        active: employee.isActive,
        updatedAt: new Date(0).toISOString(),
        updatedBy: 'system',
      };
    }
    return combined;
  }, [profiles]);
  const canExchange = currentAccess?.permissions['schedule.exchange.create'] === true;
  const canReplace = currentAccess?.permissions['schedule.replace.create'] === true;
  const recipients = useMemo(() => Object.values(candidateProfiles).filter((profile) =>
    profile.active
    && profile.departmentId === currentAccess?.departmentId
    && Boolean(profile.scheduleEmployeeId)
    && profile.accountId !== user?.id
    && effectivePermissions(profile.templateId, profile.overrides)['schedule.requests.respond'],
  ), [candidateProfiles, currentAccess?.departmentId, user?.id]);

  if (!user) return null;

  if (!currentAccess?.linked) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={t('shiftRequests:newRequest')} size="lg">
        <p className="rounded-card border border-warning/30 bg-warning-50 p-4 text-sm text-text-primary">{t('shiftRequests:form.unlinked')}</p>
      </Modal>
    );
  }

  return (
    <ShiftRequestCreateWizard
      isOpen={isOpen}
      onClose={onClose}
      onResult={onResult}
      canExchange={canExchange}
      canReplace={canReplace}
      requesterAssignments={requesterAssignments}
      recipients={recipients}
      candidateProfiles={candidateProfiles}
      user={user}
      initialAssignment={initialAssignment ?? null}
      createRequest={createRequest}
    />
  );
}

function assignmentRequestKey(assignment: ShiftAssignmentRef): string {
  return `${assignment.source}|${assignment.monthKey}|${assignment.rowId}|${assignment.day}|${assignment.employeeId}`;
}
