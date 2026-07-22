import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Check, Clock3, Plus, X } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { getEmployeeDirectoryRecord } from '@/stores/employeeDirectoryStore';
import { useShiftRequestStore } from '@/stores/shiftRequestStore';
import { useTargetedNotificationStore } from '@/stores/targetedNotificationStore';
import { ShiftRequestCreateModal } from './ShiftRequestsPage';
import {
  resolveEffectiveEmployeeAccess,
} from '@/types/employeeAccess';
import type {
  ShiftAssignmentRef,
  ShiftRequest,
  ShiftRequestAdminRejectionReason,
  ShiftRequestMutationReason,
  ShiftRequestMutationResult,
  ShiftRequestStatus,
} from '@/types/shiftRequest';

/* -------------------------------------------------------------------------- */
/*  Constants & Helpers                                                        */
/* -------------------------------------------------------------------------- */
const CLOSED_STATUSES: ShiftRequestStatus[] = [
  'recipient_rejected', 'admin_rejected', 'cancelled', 'expired', 'stale',
];

const statusVariant: Record<
  ShiftRequestStatus,
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
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

function formatDateTime(value: string, language: string): string {
  const locale = language.startsWith('ar') ? 'ar-SA-u-ca-gregory' : 'en-US';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function requestPartyName(
  party: ShiftRequest['requester'] | ShiftRequest['recipient'],
  language: string,
): string {
  const record = getEmployeeDirectoryRecord(party.accountId);
  if (!record) return party.name;
  const locale = language.startsWith('ar') ? 'ar' : 'en';
  return record.name[locale] || party.name;
}

function timelineActorName(event: ShiftRequest['timeline'][number], language: string): string {
  if (!event.actorAccountId) return event.actorName;
  const record = getEmployeeDirectoryRecord(event.actorAccountId);
  if (!record) return event.actorName;
  const locale = language.startsWith('ar') ? 'ar' : 'en';
  return record.name[locale] || event.actorName;
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
  if (
    reason === 'permission_denied' ||
    reason === 'unlinked_account' ||
    reason === 'inactive_account'
  )
    return 'shiftRequests:messages.permission';
  return 'shiftRequests:messages.generic';
}

/* -------------------------------------------------------------------------- */
/*  Main Page                                                                  */
/* -------------------------------------------------------------------------- */
type TabKey = 'my' | 'incoming';

export default function EmployeeShiftRequestsPage() {
  const { t, i18n } = useTranslation(['shiftRequests']);
  const { addToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const accessProfile = useEmployeeAccessStore(
    (state) => (user ? state.profiles[user.id] : undefined),
  );
  const profiles = useEmployeeAccessStore((state) => state.profiles);
  const visibleForUser = useShiftRequestStore((state) => state.visibleForUser);
  const expirePending = useShiftRequestStore((state) => state.expirePending);
  const createRequest = useShiftRequestStore((state) => state.createRequest);

  const [tab, setTab] = useState<TabKey>('my');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    useShiftRequestStore.getState().reloadFromStorage();
    useTargetedNotificationStore.getState().reloadFromStorage();
    expirePending();
  }, [expirePending, user]);

  if (!user) return null;

  const currentAccess = resolveEffectiveEmployeeAccess(user, accessProfile);
  const canCreate =
    user.role === 'employee' &&
    currentAccess.linked &&
    (currentAccess.permissions['schedule.exchange.create'] ||
      currentAccess.permissions['schedule.replace.create']);

  const allVisible = visibleForUser(user);
  const myRequests = allVisible.filter((r) => r.requester.accountId === user.id);
  const incomingRequests = allVisible.filter((r) => r.recipient.accountId === user.id);

  /* ---- Counts ---- */
  const myPending = myRequests.filter(
    (r) => r.status === 'pending_recipient' || r.status === 'pending_admin',
  ).length;
  const incomingPending = incomingRequests.filter((r) => r.status === 'pending_recipient').length;

  /* ---- Report helper ---- */
  function report(
    result: ShiftRequestMutationResult,
    actionType:
      | 'created'
      | 'cancelled'
      | 'accepted'
      | 'rejected'
      | 'approved'
      | 'overrideApproved'
      | 'rejectAdmin'
      | 'default' = 'default',
  ): boolean {
    if (result.ok) {
      const messageKey =
        actionType !== 'default'
          ? `shiftRequests:actions.${actionType}`
          : 'shiftRequests:messages.saved';
      addToast({ type: 'success', title: t('shiftRequests:messages.saved'), message: t(messageKey) });
      return true;
    }
    const key = mutationMessageKey(result.reason);
    addToast({ type: 'error', title: t(key), message: t(key) });
    return false;
  }

  const canExchange = currentAccess?.permissions['schedule.exchange.create'] === true;
  const canReplace = currentAccess?.permissions['schedule.replace.create'] === true;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
            {t('shiftRequests:title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t('shiftRequests:subtitle')}</p>
        </div>
        {canCreate && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            {t('shiftRequests:newRequest')}
          </Button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton
          active={tab === 'my'}
          onClick={() => setTab('my')}
          badge={myPending}
        >
          {t('shiftRequests:outgoing')} ({myRequests.length})
        </TabButton>
        <TabButton
          active={tab === 'incoming'}
          onClick={() => setTab('incoming')}
          badge={incomingPending}
        >
          {t('shiftRequests:incoming')} ({incomingRequests.length})
        </TabButton>
      </div>

      {/* Tab Content */}
      <ErrorBoundary
        fallback={<div className="p-4 text-xs text-danger">{t('shiftRequests:errors.load')}</div>}
      >
        {tab === 'my' ? (
          <RequestList
            requests={myRequests}
            user={user}
            report={report}
            emptyMessage={t('shiftRequests:empty')}
            showRequesterSection
          />
        ) : (
          <RequestList
            requests={incomingRequests}
            user={user}
            report={report}
            emptyMessage={t('shiftRequests:empty')}
            showIncomingActions
          />
        )}
      </ErrorBoundary>

      {/* Create Modal */}
      {canCreate && (
        <ShiftRequestCreateModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onResult={(result) => {
            if (report(result, 'created')) setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tab Button                                                                 */
/* -------------------------------------------------------------------------- */
function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${active
          ? 'border-primary text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
        }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Request List                                                               */
/* -------------------------------------------------------------------------- */
function RequestList({
  requests,
  user,
  report,
  emptyMessage,
  showRequesterSection = false,
  showIncomingActions = false,
}: {
  requests: ShiftRequest[];
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  report(
    result: ShiftRequestMutationResult,
    actionType?:
      | 'created'
      | 'cancelled'
      | 'accepted'
      | 'rejected'
      | 'approved'
      | 'overrideApproved'
      | 'rejectAdmin'
      | 'default',
  ): boolean;
  emptyMessage: string;
  showRequesterSection?: boolean;
  showIncomingActions?: boolean;
}) {
  if (requests.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-text-secondary">{emptyMessage}</Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          user={user}
          report={report}
          showIncomingActions={showIncomingActions}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Request Card (same design as before, enhanced)                             */
/* -------------------------------------------------------------------------- */
function RequestCard({
  request,
  user,
  report,
  showIncomingActions,
}: {
  request: ShiftRequest;
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  report(result: ShiftRequestMutationResult, actionType?: string): boolean;
  showIncomingActions: boolean;
}) {
  const { t, i18n } = useTranslation(['shiftRequests']);
  const accept = useShiftRequestStore((state) => state.acceptByRecipient);
  const rejectRecipient = useShiftRequestStore((state) => state.rejectByRecipient);
  const cancel = useShiftRequestStore((state) => state.cancelByRequester);
  const accessProfile = useEmployeeAccessStore((state) => state.profiles[user.id]);

  const [showTimeline, setShowTimeline] = useState(false);

  const isRecipient = request.recipient.accountId === user.id;
  const isRequester = request.requester.accountId === user.id;
  const canRespond =
    user.role === 'employee' &&
    resolveEffectiveEmployeeAccess(user, accessProfile).permissions['schedule.requests.respond'];
  const canCancel =
    user.role === 'employee' &&
    resolveEffectiveEmployeeAccess(user, accessProfile).permissions['schedule.requests.cancelOwn'];
  const requesterName = requestPartyName(request.requester, i18n.language);
  const recipientName = requestPartyName(request.recipient, i18n.language);

  return (
    <Card className="space-y-4">
      {/* Card Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-btn bg-primary-50 p-2 text-primary">
            <ArrowLeftRight className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-text-primary">
                {t(`shiftRequests:type.${request.type}`)}
              </h2>
              <Badge variant={statusVariant[request.status]}>
                {t(`shiftRequests:status.${request.status}`)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {requesterName} → {recipientName}
            </p>
          </div>
        </div>
        <span className="text-xs text-text-secondary">
          {formatDateTime(request.createdAt, i18n.language)}
        </span>
      </div>

      {/* Shift Info */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          {t('shiftRequests:beforeChange')}
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          <AssignmentCard
            title={t('shiftRequests:requesterShift')}
            assignment={request.requesterAssignment}
          />
          {request.offeredAssignment && (
            <AssignmentCard
              title={t('shiftRequests:offeredShift')}
              assignment={request.offeredAssignment}
            />
          )}
        </div>
      </div>

      {/* After Approval / Status Notice */}
      {['pending_recipient', 'pending_admin', 'approved'].includes(request.status) ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
            {t('shiftRequests:afterApproval')}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <AssignmentEffectCard
              title={requesterName}
              value={
                request.type === 'exchange' && request.offeredAssignment
                  ? displayAssignment(request.offeredAssignment)
                  : t('shiftRequests:removedFromShift')
              }
            />
            <AssignmentEffectCard
              title={recipientName}
              value={displayAssignment(request.requesterAssignment)}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface-muted/60 p-3.5 text-xs font-medium text-text-secondary flex items-center gap-2.5">
          <span className="inline-block w-2 h-2 rounded-full bg-text-secondary/60 shrink-0" />
          <span>
            {request.status === 'cancelled' && t('shiftRequests:statusNotices.cancelled')}
            {request.status === 'recipient_rejected' &&
              t('shiftRequests:statusNotices.recipient_rejected')}
            {request.status === 'admin_rejected' && t('shiftRequests:statusNotices.admin_rejected')}
            {request.status === 'expired' && t('shiftRequests:statusNotices.expired')}
            {request.status === 'stale' && t('shiftRequests:statusNotices.stale')}
            {request.status === 'admin_rejected' && request.adminRejectionReason && (
              <span className="mt-1 block text-text-primary">
                <strong>{t('shiftRequests:adminReason')}:</strong>{' '}
                {t(`shiftRequests:reasons.${request.adminRejectionReason}`)}
                {request.adminRejectionNote ? (
                  <span className="mt-0.5 block">
                    <strong>{t('shiftRequests:adminNote')}:</strong>{' '}
                    {request.adminRejectionNote}
                  </span>
                ) : null}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Warnings */}
      {['pending_recipient', 'pending_admin'].includes(request.status) &&
        request.warnings.length > 0 && (
          <div className="rounded-card border border-warning/30 bg-warning-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <AlertTriangle className="h-4 w-4 text-warning" /> {t('shiftRequests:warnings')}
            </p>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-text-secondary">
              {request.warnings.map((w, i) => (
                <li key={i}>{t(`shiftRequests:warningCodes.${w.code}`)}</li>
              ))}
            </ul>
          </div>
        )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {/* Incoming: Accept / Reject */}
        {showIncomingActions && isRecipient && canRespond && request.status === 'pending_recipient' && (
          <>
            <Button
              size="sm"
              icon={<Check className="h-4 w-4" />}
              onClick={() => report(accept(request.id, user.id, user.name), 'accepted')}
            >
              {t('shiftRequests:accept')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<X className="h-4 w-4" />}
              onClick={() => report(rejectRecipient(request.id, user.id, user.name), 'rejected')}
            >
              {t('shiftRequests:reject')}
            </Button>
          </>
        )}

        {/* My Requests: Cancel */}
        {isRequester &&
          canCancel &&
          (request.status === 'pending_recipient' || request.status === 'pending_admin') && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => report(cancel(request.id, user.id, user.name), 'cancelled')}
            >
              {t('shiftRequests:cancel')}
            </Button>
          )}

        <Button
          className="ms-auto"
          size="sm"
          variant="ghost"
          onClick={() => setShowTimeline((v) => !v)}
        >
          {t('shiftRequests:timeline')}
        </Button>
      </div>

      {/* Timeline */}
      {showTimeline && (
        <ol className="space-y-2 rounded-card bg-surface-muted p-3">
          {request.timeline.map((event) => (
            <li key={event.id} className="flex gap-2 text-xs text-text-secondary">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                <strong className="text-text-primary">
                  {event.actorRole === 'system' ? t('shiftRequests:systemActor') : timelineActorName(event, i18n.language)}
                </strong>{' '}
                · {t(`shiftRequests:timelineActions.${event.action}`)} ·{' '}
                {formatDateTime(event.createdAt, i18n.language)}
                {event.note ? (
                  <span className="mt-0.5 block text-text-primary">{event.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */
function AssignmentCard({
  title,
  assignment,
}: {
  title: string;
  assignment: ShiftAssignmentRef;
}) {
  const { t } = useTranslation(['shiftRequests']);
  return (
    <div className="min-w-0 rounded-card border border-border bg-surface-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
      <p className="mt-2 break-words text-sm font-medium text-text-primary">
        {displayAssignment(assignment)}
      </p>
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
