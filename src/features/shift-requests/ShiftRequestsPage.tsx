import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Check, Clock3, Plus, RefreshCw, X } from 'lucide-react';
import Badge from '@/components/ui/Badge';
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

const closedStatuses: ShiftRequestStatus[] = [
  'recipient_rejected', 'admin_rejected', 'cancelled', 'expired', 'stale',
];

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
    expirePending();
  }, [expirePending]);

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
    closed: visibleForAccount.filter((request) => closedStatuses.includes(request.status)).length,
  };
  const visible = statusFilter === 'all'
    ? visibleForAccount
    : statusFilter === 'closed'
      ? visibleForAccount.filter((request) => closedStatuses.includes(request.status))
      : visibleForAccount.filter((request) => request.status === statusFilter);

  const report = (result: ShiftRequestMutationResult, created = false) => {
    if (result.ok) {
      addToast({ type: 'success', title: t('shiftRequests:messages.saved'), message: t(created ? 'shiftRequests:messages.created' : 'shiftRequests:messages.saved') });
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
        {([
          ['all', 'total'],
          ['pending_recipient', 'pendingRecipient'],
          ['pending_admin', 'pendingAdmin'],
          ['approved', 'approved'],
          ['closed', 'closed'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rounded-card border p-3 text-start transition-colors ${
              statusFilter === value ? 'border-primary bg-primary-50' : 'border-border bg-surface hover:bg-hover'
            }`}
            onClick={() => setStatusFilter(value)}
          >
            <span className="block text-xl font-extrabold text-text-primary">
              {value === 'all' ? statusCounts.total : statusCounts[value]}
            </span>
            <span className="mt-1 block text-xs font-semibold text-text-secondary">
              {t(`shiftRequests:counters.${label}`)}
            </span>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {user.role !== 'admin' && (['all', 'incoming', 'outgoing'] as RequestFilter[]).map((item) => (
          <Button key={item} size="sm" variant={filter === item ? 'primary' : 'secondary'} onClick={() => setFilter(item)}>
            {t(`shiftRequests:${item}`)}
          </Button>
        ))}
        <label className="ms-auto flex min-w-[13rem] items-center gap-2 text-xs font-semibold text-text-secondary">
          <span>{t('shiftRequests:statusFilter')}</span>
          <select
            className="input-field min-w-0 flex-1"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">{t('shiftRequests:all')}</option>
            {(Object.keys(statusVariant) as ShiftRequestStatus[]).map((status) => (
              <option key={status} value={status}>{t(`shiftRequests:status.${status}`)}</option>
            ))}
            <option value="closed">{t('shiftRequests:counters.closed')}</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-text-secondary">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          {t('shiftRequests:empty')}
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((request) => (
            <RequestCard key={request.id} request={request} user={user} report={report} />
          ))}
        </div>
      )}

      <ShiftRequestCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onResult={(result) => {
          if (report(result, true)) setCreateOpen(false);
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
  report(result: ShiftRequestMutationResult): boolean;
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

      {request.warnings.length > 0 && (
        <div className="rounded-card border border-warning/30 bg-warning-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <AlertTriangle className="h-4 w-4 text-warning" /> {t('shiftRequests:warnings')}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-text-secondary">
            {request.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}>{t(`shiftRequests:warningCodes.${warning.code}`)}</li>)}
          </ul>
        </div>
      )}

      {request.status === 'admin_rejected' && request.adminRejectionReason && (
        <p className="rounded-card border border-danger/20 bg-danger-50 p-3 text-xs text-text-primary">
          <strong>{t('shiftRequests:adminReason')}:</strong> {t(`shiftRequests:reasons.${request.adminRejectionReason}`)}
          {request.adminRejectionNote ? ` · ${request.adminRejectionNote}` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {isRecipient && canRespond && request.status === 'pending_recipient' && (
          <>
            <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={() => report(accept(request.id, user.id, user.name))}>
              {t('shiftRequests:accept')}
            </Button>
            <Button size="sm" variant="danger" icon={<X className="h-4 w-4" />} onClick={() => report(rejectRecipient(request.id, user.id, user.name))}>
              {t('shiftRequests:reject')}
            </Button>
          </>
        )}
        {isRequester && canCancel && (request.status === 'pending_recipient' || request.status === 'pending_admin') && (
          <Button size="sm" variant="secondary" onClick={() => report(cancel(request.id, user.id, user.name))}>
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
                report(result);
              }}
            >
              {t('shiftRequests:approve')}
            </Button>
            {overridePending && (
              <Button size="sm" variant="danger" onClick={() => {
                if (report(approve(request.id, user.id, user.name, true))) setOverridePending(false);
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
            <Button size="sm" variant="danger" onClick={() => report(rejectAdmin(request.id, user.id, user.name, reason, note))}>
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
  const [type, setType] = useState<ShiftRequestType>('exchange');
  const [requesterKey, setRequesterKey] = useState('');
  const [recipientAccountId, setRecipientAccountId] = useState('');
  const [offeredKey, setOfferedKey] = useState('');

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
  const requesterAssignment = requesterAssignments.find((assignment) => assignmentRequestKey(assignment) === requesterKey)
    ?? initialAssignment;
  const recipientProfile = candidateProfiles[recipientAccountId];
  const offeredAssignments = useMemo(() => {
    if (!recipientProfile?.scheduleEmployeeId || !requesterAssignment) return [];
    return listPublishedAssignmentsForEmployee(recipientProfile.scheduleEmployeeId, recipientProfile.departmentId, requesterAssignment.source)
      .filter((assignment) => new Date(assignment.startsAt).getTime() > Date.now());
  }, [recipientProfile, requesterAssignment]);

  useEffect(() => {
    if (initialAssignment) setRequesterKey(assignmentRequestKey(initialAssignment));
  }, [initialAssignment]);

  useEffect(() => {
    if (!canExchange && canReplace) setType('replace');
    if (!canReplace && canExchange) setType('exchange');
  }, [canExchange, canReplace]);

  if (!user) return null;
  const offeredAssignment = offeredAssignments.find((assignment) => assignmentRequestKey(assignment) === offeredKey);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('shiftRequests:newRequest')} size="lg">
      {!currentAccess?.linked ? (
        <p className="rounded-card border border-warning/30 bg-warning-50 p-4 text-sm text-text-primary">{t('shiftRequests:form.unlinked')}</p>
      ) : requesterAssignments.length === 0 && !initialAssignment ? (
        <p className="rounded-card bg-surface-muted p-4 text-sm text-text-secondary">{t('shiftRequests:form.noShifts')}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!requesterAssignment || !recipientProfile) return;
            onResult(createRequest({
              type,
              requesterAccountId: user.id,
              requesterName: user.name,
              recipientAccountId,
              recipientName: accountName(recipientAccountId),
              requesterAssignment,
              offeredAssignment: type === 'exchange' ? offeredAssignment : undefined,
            }));
          }}
        >
          <SelectField label={t('shiftRequests:form.type')} value={type} onChange={(value) => { setType(value as ShiftRequestType); setOfferedKey(''); }}>
            {canExchange && <option value="exchange">{t('shiftRequests:type.exchange')}</option>}
            {canReplace && <option value="replace">{t('shiftRequests:type.replace')}</option>}
          </SelectField>
          <SelectField label={t('shiftRequests:form.yourShift')} value={requesterKey} onChange={(value) => { setRequesterKey(value); setOfferedKey(''); }} disabled={Boolean(initialAssignment)}>
            <option value="">{t('shiftRequests:form.choose')}</option>
            {requesterAssignments.map((assignment) => (
              <option key={assignmentRequestKey(assignment)} value={assignmentRequestKey(assignment)}>{displayAssignment(assignment)}</option>
            ))}
          </SelectField>
          <SelectField label={t('shiftRequests:form.recipient')} value={recipientAccountId} onChange={(value) => { setRecipientAccountId(value); setOfferedKey(''); }}>
            <option value="">{t('shiftRequests:form.choose')}</option>
            {recipients.map((profile) => <option key={profile.accountId} value={profile.accountId}>{accountName(profile.accountId)}</option>)}
          </SelectField>
          {type === 'exchange' && (
            <SelectField label={t('shiftRequests:form.theirShift')} value={offeredKey} onChange={setOfferedKey}>
              <option value="">{t('shiftRequests:form.choose')}</option>
              {offeredAssignments.map((assignment) => (
                <option key={assignmentRequestKey(assignment)} value={assignmentRequestKey(assignment)}>{displayAssignment(assignment)}</option>
              ))}
            </SelectField>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>{t('shiftRequests:form.cancel')}</Button>
            <Button type="submit" disabled={!requesterAssignment || !recipientProfile || (type === 'exchange' && !offeredAssignment)}>
              {t('shiftRequests:form.submit')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-text-primary">
      <span className="mb-1.5 block">{label}</span>
      <select className="input-field w-full" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  );
}

function assignmentRequestKey(assignment: ShiftAssignmentRef): string {
  return `${assignment.source}|${assignment.monthKey}|${assignment.rowId}|${assignment.day}|${assignment.employeeId}`;
}
