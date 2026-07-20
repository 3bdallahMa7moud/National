import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  Search,
  X,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { getStoredLanguage } from '@/i18n/constants';
import { useAuthStore } from '@/stores/authStore';
import { useShiftRequestStore } from '@/stores/shiftRequestStore';
import { useTargetedNotificationStore } from '@/stores/targetedNotificationStore';
import type {
  ShiftRequest,
  ShiftRequestAdminRejectionReason,
  ShiftRequestMutationReason,
  ShiftRequestMutationResult,
  ShiftRequestStatus,
  ShiftRequestType,
} from '@/types/shiftRequest';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */
const rejectionReasons: ShiftRequestAdminRejectionReason[] = [
  'staff_shortage',
  'skill_mismatch',
  'approved_leave',
  'operational_need',
  'other',
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

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function formatDateTime(value: string, language: string): string {
  const locale = language.startsWith('ar') ? 'ar-SA-u-ca-gregory' : 'en-US';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatDate(value: string, language: string): string {
  const locale = language.startsWith('ar') ? 'ar-SA-u-ca-gregory' : 'en-US';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}

function mutationMessageKey(reason: ShiftRequestMutationReason): string {
  if (reason === 'day_shift_ot_conflict') return 'shiftRequests:messages.dayShiftOTConflict';
  if (reason === 'duplicate_request') return 'shiftRequests:messages.duplicate';
  if (reason === 'not_published') return 'shiftRequests:messages.notPublished';
  if (reason === 'not_found') return 'shiftRequests:messages.notFound';
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

function getEmployeeResponseDate(request: ShiftRequest): string | null {
  const event = request.timeline.find(
    (e) => e.action === 'recipient_accepted' || e.action === 'recipient_rejected',
  );
  return event?.createdAt ?? null;
}

function getAdminDecisionDate(request: ShiftRequest): string | null {
  const event = request.timeline.find(
    (e) => e.action === 'admin_approved' || e.action === 'admin_rejected',
  );
  return event?.createdAt ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */
type SortField = 'createdAt' | 'updatedAt' | 'status' | 'type';
type SortDir = 'asc' | 'desc';

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */
export default function AdminShiftRequestsPage() {
  const { t, i18n } = useTranslation(['shiftRequests']);
  const { addToast } = useToast();
  const user = useAuthStore((state) => state.user);
  const requests = useShiftRequestStore((state) => state.requests);
  const expirePending = useShiftRequestStore((state) => state.expirePending);
  const approveByAdmin = useShiftRequestStore((state) => state.approveByAdmin);
  const rejectByAdmin = useShiftRequestStore((state) => state.rejectByAdmin);

  /* ---- local ui state ---- */
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ShiftRequestType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ShiftRequestStatus | 'closed'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<ShiftRequestAdminRejectionReason>('operational_need');
  const [rejectNote, setRejectNote] = useState('');
  const [overridePendingId, setOverridePendingId] = useState<string | null>(null);

  useEffect(() => {
    useShiftRequestStore.getState().reloadFromStorage();
    useTargetedNotificationStore.getState().reloadFromStorage();
    expirePending();
  }, [expirePending, user]);

  /* ---- Filtered & sorted data ---- */
  const CLOSED_STATUSES: ShiftRequestStatus[] = [
    'recipient_rejected', 'admin_rejected', 'cancelled', 'expired', 'stale',
  ];

  const filtered = useMemo(() => {
    let result = [...requests];
    if (typeFilter !== 'all') result = result.filter((r) => r.type === typeFilter);
    if (statusFilter === 'closed') {
      result = result.filter((r) => CLOSED_STATUSES.includes(r.status));
    } else if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.requester.name.toLowerCase().includes(q) ||
          r.recipient.name.toLowerCase().includes(q) ||
          r.requesterAssignment.facilityLabel.toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      if (sortField === 'createdAt') { aVal = a.createdAt; bVal = b.createdAt; }
      else if (sortField === 'updatedAt') { aVal = a.updatedAt; bVal = b.updatedAt; }
      else if (sortField === 'status') { aVal = a.status; bVal = b.status; }
      else if (sortField === 'type') { aVal = a.type; bVal = b.type; }
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return result;
  }, [requests, typeFilter, statusFilter, search, sortField, sortDir]);

  /* ---- Counters ---- */
  const counts = useMemo(() => ({
    total: requests.length,
    pending_recipient: requests.filter((r) => r.status === 'pending_recipient').length,
    pending_admin: requests.filter((r) => r.status === 'pending_admin').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    closed: requests.filter((r) => CLOSED_STATUSES.includes(r.status)).length,
  }), [requests]);

  /* ---- Actions ---- */
  function report(
    result: ShiftRequestMutationResult,
    actionType: 'approved' | 'overrideApproved' | 'rejectAdmin' = 'approved',
  ): boolean {
    if (result.ok) {
      addToast({
        type: 'success',
        title: t('shiftRequests:messages.saved'),
        message: t(`shiftRequests:actions.${actionType}`),
      });
      return true;
    }
    const key = mutationMessageKey(result.reason);
    addToast({ type: 'error', title: t(key), message: t(key) });
    return false;
  }

  function handleApprove(requestId: string) {
    if (!user) return;
    const result = approveByAdmin(requestId, user.id, user.name, false);
    if (!result.ok && result.reason === 'conflict_requires_override') {
      setOverridePendingId(requestId);
    }
    report(result, 'approved');
  }

  function handleOverrideApprove(requestId: string) {
    if (!user) return;
    if (report(approveByAdmin(requestId, user.id, user.name, true), 'overrideApproved')) {
      setOverridePendingId(null);
    }
  }

  function handleRejectOpen(requestId: string) {
    setRejectModalId(requestId);
    setRejectReason('operational_need');
    setRejectNote('');
  }

  function handleRejectSubmit() {
    if (!user || !rejectModalId) return;
    if (report(rejectByAdmin(rejectModalId, user.id, user.name, rejectReason, rejectNote), 'rejectAdmin')) {
      setRejectModalId(null);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  if (!user) return null;

  const lang = i18n.language;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
            {t('shiftRequests:adminTitle')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t('shiftRequests:subtitle')}</p>
        </div>
      </header>

      {/* Counters */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { key: 'total', count: counts.total, color: 'text-text-primary' },
          { key: 'pendingRecipient', count: counts.pending_recipient, color: 'text-warning' },
          { key: 'pendingAdmin', count: counts.pending_admin, color: 'text-info' },
          { key: 'approved', count: counts.approved, color: 'text-success' },
          { key: 'closed', count: counts.closed, color: 'text-text-secondary' },
        ].map(({ key, count, color }) => (
          <div key={key} className="rounded-card border border-border bg-surface-card p-3 shadow-xs">
            <p className="text-xs font-semibold text-text-secondary">{t(`shiftRequests:counters.${key}`)}</p>
            <p className={`mt-1 text-xl font-bold sm:text-2xl ${color}`}>{count}</p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-card p-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute top-2.5 h-4 w-4 text-text-muted rtl:right-3 ltr:left-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={getStoredLanguage() === 'ar' ? 'ابحث باسم الموظف أو رقم الطلب...' : 'Search by employee or request ID...'}
            className="input-field w-full rtl:pr-9 ltr:pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-text-secondary" />
          <select
            className="input-field py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="all">{t('shiftRequests:all')}</option>
            <option value="exchange">{t('shiftRequests:type.exchange')}</option>
            <option value="replace">{t('shiftRequests:type.replace')}</option>
          </select>
          <select
            className="input-field py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">{t('shiftRequests:all')}</option>
            <option value="pending_recipient">{t('shiftRequests:status.pending_recipient')}</option>
            <option value="pending_admin">{t('shiftRequests:status.pending_admin')}</option>
            <option value="approved">{t('shiftRequests:status.approved')}</option>
            <option value="closed">{t('shiftRequests:counters.closed')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <ErrorBoundary fallback={<div className="p-4 text-xs text-danger">{t('shiftRequests:errors.load')}</div>}>
        {filtered.length === 0 ? (
          <Card className="py-12 text-center text-sm text-text-secondary">
            {t('shiftRequests:empty')}
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface-card shadow-xs">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'رقم الطلب' : 'ID'}</th>
                  <th className="px-4 py-3 text-start">
                    <button className="flex items-center gap-1 hover:text-text-primary" onClick={() => toggleSort('type')}>
                      {getStoredLanguage() === 'ar' ? 'النوع' : 'Type'}
                      {sortField === 'type' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'مقدم الطلب' : 'Requester'}</th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'الموظف المستهدف' : 'Target Employee'}</th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'الفرع' : 'Branch'}</th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'تاريخ الشفت' : 'Shift Date'}</th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'تفاصيل الشفت' : 'Shift Details'}</th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'رد الموظف' : 'Employee Response'}</th>
                  <th className="px-4 py-3 text-start">
                    <button className="flex items-center gap-1 hover:text-text-primary" onClick={() => toggleSort('status')}>
                      {getStoredLanguage() === 'ar' ? 'حالة الأدمن' : 'Admin Status'}
                      {sortField === 'status' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-start">
                    <button className="flex items-center gap-1 hover:text-text-primary" onClick={() => toggleSort('createdAt')}>
                      {getStoredLanguage() === 'ar' ? 'التاريخ' : 'Created'}
                      {sortField === 'createdAt' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-start">
                    <button className="flex items-center gap-1 hover:text-text-primary" onClick={() => toggleSort('updatedAt')}>
                      {getStoredLanguage() === 'ar' ? 'آخر تحديث' : 'Updated'}
                      {sortField === 'updatedAt' ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-start">{getStoredLanguage() === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((request) => {
                  const isExpanded = expandedId === request.id;
                  const isOverridePending = overridePendingId === request.id;
                  const empResponseDate = getEmployeeResponseDate(request);
                  const adminDecisionDate = getAdminDecisionDate(request);
                  const shiftDate = `${request.requesterAssignment.monthKey}-${String(request.requesterAssignment.day).padStart(2, '0')}`;
                  const isEmployeeAccepted = ['pending_admin', 'approved', 'admin_rejected'].includes(request.status);
                  const isEmployeeRejected = request.status === 'recipient_rejected';
                  const isPendingEmployee = request.status === 'pending_recipient';

                  return (
                    <>
                      <tr
                        key={request.id}
                        className="group hover:bg-surface-muted/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      >
                        {/* ID */}
                        <td className="px-4 py-3">
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                            {request.id.slice(0, 12)}…
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 font-medium text-text-primary">
                            <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                            {t(`shiftRequests:type.${request.type}`)}
                          </span>
                        </td>

                        {/* Requester */}
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {request.requester.name}
                          <div className="text-[11px] font-normal text-text-muted">
                            {request.requester.employeeCode}
                          </div>
                        </td>

                        {/* Target */}
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {request.recipient.name}
                          <div className="text-[11px] font-normal text-text-muted">
                            {request.recipient.employeeCode}
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="px-4 py-3 text-text-secondary">
                          {request.requesterAssignment.facilityLabel}
                        </td>

                        {/* Shift Date */}
                        <td className="px-4 py-3 text-text-secondary">{shiftDate}</td>

                        {/* Shift Details */}
                        <td className="px-4 py-3 text-text-secondary">
                          <div>{request.requesterAssignment.shiftLabel}</div>
                          <div className="text-[11px] text-text-muted">{request.requesterAssignment.timeRange}</div>
                        </td>

                        {/* Employee Response */}
                        <td className="px-4 py-3">
                          {isPendingEmployee && (
                            <Badge variant="warning">{getStoredLanguage() === 'ar' ? 'بانتظار الرد' : 'Pending'}</Badge>
                          )}
                          {isEmployeeAccepted && (
                            <div>
                              <Badge variant="success">{getStoredLanguage() === 'ar' ? 'وافق' : 'Accepted'}</Badge>
                              {empResponseDate && (
                                <div className="mt-0.5 text-[10px] text-text-muted">
                                  {formatDate(empResponseDate, lang)}
                                </div>
                              )}
                            </div>
                          )}
                          {isEmployeeRejected && (
                            <Badge variant="danger">{getStoredLanguage() === 'ar' ? 'رفض' : 'Rejected'}</Badge>
                          )}
                        </td>

                        {/* Admin Status */}
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[request.status]}>
                            {t(`shiftRequests:status.${request.status}`)}
                          </Badge>
                          {adminDecisionDate && (
                            <div className="mt-0.5 text-[10px] text-text-muted">
                              {formatDate(adminDecisionDate, lang)}
                            </div>
                          )}
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {formatDateTime(request.createdAt, lang)}
                        </td>

                        {/* Updated */}
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {formatDateTime(request.updatedAt, lang)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {request.status === 'pending_admin' && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isOverridePending ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => handleOverrideApprove(request.id)}
                                >
                                  {t('shiftRequests:approveOverride')}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  icon={<Check className="h-3.5 w-3.5" />}
                                  onClick={() => handleApprove(request.id)}
                                >
                                  {t('shiftRequests:approve')}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<X className="h-3.5 w-3.5" />}
                                onClick={() => handleRejectOpen(request.id)}
                              >
                                {t('shiftRequests:rejectAdmin')}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Row: Timeline */}
                      {isExpanded && (
                        <tr key={`${request.id}-detail`} className="bg-surface-muted/40">
                          <td colSpan={12} className="px-6 py-4">
                            <div className="space-y-3">
                              {/* Shift info */}
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-card border border-border bg-surface-card p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                                    {t('shiftRequests:requesterShift')}
                                  </p>
                                  <p className="text-sm font-medium text-text-primary">
                                    {request.requesterAssignment.shiftLabel} · {request.requesterAssignment.timeRange}
                                  </p>
                                  <p className="text-xs text-text-secondary mt-0.5">
                                    {request.requesterAssignment.facilityLabel} / {request.requesterAssignment.unitLabel}
                                  </p>
                                </div>
                                {request.offeredAssignment && (
                                  <div className="rounded-card border border-border bg-surface-card p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                                      {t('shiftRequests:offeredShift')}
                                    </p>
                                    <p className="text-sm font-medium text-text-primary">
                                      {request.offeredAssignment.shiftLabel} · {request.offeredAssignment.timeRange}
                                    </p>
                                    <p className="text-xs text-text-secondary mt-0.5">
                                      {request.offeredAssignment.facilityLabel} / {request.offeredAssignment.unitLabel}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Admin rejection reason */}
                              {request.status === 'admin_rejected' && request.adminRejectionReason && (
                                <div className="rounded-card border border-danger/20 bg-danger-50 p-3 text-xs text-text-primary">
                                  <strong>{t('shiftRequests:adminReason')}:</strong>{' '}
                                  {t(`shiftRequests:reasons.${request.adminRejectionReason}`)}
                                  {request.adminRejectionNote ? ` · ${request.adminRejectionNote}` : ''}
                                </div>
                              )}

                              {/* Warnings */}
                              {request.warnings.length > 0 && (
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

                              {/* Timeline */}
                              <ol className="space-y-2 rounded-card bg-surface-muted p-3">
                                <p className="text-xs font-semibold text-text-secondary mb-2">
                                  {t('shiftRequests:timeline')}
                                </p>
                                {request.timeline.map((event) => (
                                  <li key={event.id} className="flex gap-2 text-xs text-text-secondary">
                                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span>
                                      <strong className="text-text-primary">
                                        {event.actorRole === 'system' ? t('shiftRequests:systemActor') : event.actorName}
                                      </strong>{' '}
                                      · {t(`shiftRequests:timelineActions.${event.action}`)} ·{' '}
                                      {formatDateTime(event.createdAt, lang)}
                                      {event.note ? (
                                        <span className="mt-0.5 block text-text-primary">{event.note}</span>
                                      ) : null}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ErrorBoundary>

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectModalId)}
        onClose={() => setRejectModalId(null)}
        title={t('shiftRequests:rejectAdmin')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t('shiftRequests:adminReason')}
            </label>
            <select
              className="input-field w-full"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value as ShiftRequestAdminRejectionReason)}
            >
              {rejectionReasons.map((r) => (
                <option key={r} value={r}>
                  {t(`shiftRequests:reasons.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              {t('shiftRequests:adminNote')}
              {rejectReason === 'other' && <span className="text-danger ms-1">*</span>}
            </label>
            <textarea
              className="input-field w-full resize-none"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder={t('shiftRequests:adminNote')}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setRejectModalId(null)}>
              {getStoredLanguage() === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="danger" onClick={handleRejectSubmit}>
              {t('shiftRequests:rejectAdmin')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
