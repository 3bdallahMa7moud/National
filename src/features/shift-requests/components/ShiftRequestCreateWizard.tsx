import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  Building2,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User,
  RefreshCw,
  UserCheck,
  Search,
  Check,
  AlertTriangle,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import {
  assignmentRequestKey,
  hasDayShiftOTConflict,
  listPublishedAssignmentsForEmployee,
  normalizeShiftTypeCategory,
  type CanonicalShiftType,
} from '@/lib/shiftAssignmentGateway';
import type { ShiftAssignmentRef, ShiftRequestType, ShiftRequestMutationResult } from '@/types/shiftRequest';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import { getEmployeeDirectoryRecord } from '@/stores/employeeDirectoryStore';
import { localizeRowLabel } from '@/lib/scheduleMatrixLocale';

export interface ShiftRequestCreateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: ShiftRequestMutationResult) => void;
  canExchange: boolean;
  canReplace: boolean;
  requesterAssignments: ShiftAssignmentRef[];
  recipients: EmployeeAccessProfile[];
  candidateProfiles: Record<string, EmployeeAccessProfile>;
  user: { id: string; name: string } | null;
  initialAssignment: ShiftAssignmentRef | null;
  createRequest: (input: {
    type: ShiftRequestType;
    requesterAccountId: string;
    recipientAccountId: string;
    requesterAssignment: ShiftAssignmentRef;
    offeredAssignment?: ShiftAssignmentRef;
  }) => ShiftRequestMutationResult;
}

function accountName(accountId: string, language: string): string {
  const record = getEmployeeDirectoryRecord(accountId);
  if (!record) return accountId;
  const locale = language.startsWith('ar') ? 'ar' : 'en';
  return record.name[locale];
}

export function ShiftRequestCreateWizard({
  isOpen,
  onClose,
  onResult,
  canExchange,
  canReplace,
  requesterAssignments,
  recipients,
  candidateProfiles,
  user,
  initialAssignment,
  createRequest,
}: ShiftRequestCreateWizardProps) {
  const { t, i18n } = useTranslation(['shiftRequests', 'common']);
  const isRtl = i18n.language.startsWith('ar');

  const [type, setType] = useState<ShiftRequestType>(
    canExchange ? 'exchange' : canReplace ? 'replace' : 'exchange',
  );
  const [recipientAccountId, setRecipientAccountId] = useState('');
  const [requesterKey, setRequesterKey] = useState('');
  const [offeredKey, setOfferedKey] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const totalSteps = type === 'exchange' ? 4 : 3;

  useEffect(() => {
    if (initialAssignment) {
      setRequesterKey(assignmentRequestKey(initialAssignment));
    }
  }, [initialAssignment]);

  useEffect(() => {
    if (!canExchange && canReplace) setType('replace');
    if (!canReplace && canExchange) setType('exchange');
  }, [canExchange, canReplace]);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setRecipientAccountId('');
      setOfferedKey('');
      if (!initialAssignment) setRequesterKey('');
    }
  }, [isOpen, initialAssignment]);

  const requesterAssignment = useMemo(() => {
    return requesterAssignments.find((a) => assignmentRequestKey(a) === requesterKey) ?? initialAssignment;
  }, [requesterAssignments, requesterKey, initialAssignment]);

  const recipientProfile = candidateProfiles[recipientAccountId];

  const recipientShiftCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const nowMs = Date.now();
    for (const profile of recipients) {
      if (!profile.scheduleEmployeeId) {
        counts[profile.accountId] = 0;
        continue;
      }
      const assignments = listPublishedAssignmentsForEmployee(
        profile.scheduleEmployeeId,
        profile.departmentId,
        requesterAssignment?.source,
      );
      counts[profile.accountId] = assignments.filter((a) => new Date(a.startsAt).getTime() > nowMs).length;
    }
    return counts;
  }, [recipients, requesterAssignment?.source]);

  const offeredAssignments = useMemo(() => {
    if (!recipientProfile?.scheduleEmployeeId || !requesterAssignment) return [];
    return listPublishedAssignmentsForEmployee(
      recipientProfile.scheduleEmployeeId,
      recipientProfile.departmentId,
      requesterAssignment.source,
    ).filter((assignment) => new Date(assignment.startsAt).getTime() > Date.now());
  }, [recipientProfile, requesterAssignment]);

  const offeredAssignment = useMemo(() => {
    return offeredAssignments.find((a) => assignmentRequestKey(a) === offeredKey);
  }, [offeredAssignments, offeredKey]);

  const requesterConflict = useMemo(() => {
    if (!requesterAssignment || !user) return { conflict: false };
    const empId = candidateProfiles[user.id]?.scheduleEmployeeId || requesterAssignment.employeeId || user.id;
    return hasDayShiftOTConflict(requesterAssignment, empId);
  }, [requesterAssignment, candidateProfiles, user]);

  const recipientConflict = useMemo(() => {
    if (!offeredAssignment || !recipientProfile?.scheduleEmployeeId) return { conflict: false };
    return hasDayShiftOTConflict(offeredAssignment, recipientProfile.scheduleEmployeeId);
  }, [offeredAssignment, recipientProfile]);

  const hasConflict = requesterConflict.conflict || recipientConflict.conflict;

  if (!user) return null;

  const stepsList = useMemo(() => {
    if (type === 'replace') {
      return [
        { id: 0, label: t('shiftRequests:wizard.steps.typeAndRecipient') },
        { id: 1, label: t('shiftRequests:wizard.steps.yourShift') },
        { id: 2, label: t('shiftRequests:wizard.steps.review') },
      ];
    }
    return [
      { id: 0, label: t('shiftRequests:wizard.steps.typeAndRecipient') },
      { id: 1, label: t('shiftRequests:wizard.steps.yourShift') },
      { id: 2, label: t('shiftRequests:wizard.steps.theirShift') },
      { id: 3, label: t('shiftRequests:wizard.steps.review') },
    ];
  }, [type, t]);

  const canGoNext = () => {
    if (stepIndex === 0) {
      if (!type || !recipientAccountId) return false;
      if (type === 'exchange' && (recipientShiftCounts[recipientAccountId] || 0) === 0) return false;
      return true;
    }
    if (stepIndex === 1) {
      return Boolean(requesterAssignment) && !requesterConflict.conflict;
    }
    if (stepIndex === 2 && type === 'exchange') {
      return Boolean(offeredAssignment) && !recipientConflict.conflict;
    }
    return true;
  };

  const handleNext = () => {
    if (stepIndex < totalSteps - 1 && canGoNext()) {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesterAssignment || !recipientProfile || hasConflict) return;
    if (type === 'exchange' && !offeredAssignment) return;

    onResult(
      createRequest({
        type,
        requesterAccountId: user.id,
        recipientAccountId,
        requesterAssignment,
        offeredAssignment: type === 'exchange' ? offeredAssignment : undefined,
      }),
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('shiftRequests:wizard.title')} size="xl">
      {requesterAssignments.length === 0 && !initialAssignment ? (
        <p className="rounded-card bg-surface-muted p-4 text-sm text-text-secondary">
          {t('shiftRequests:form.noShifts')}
        </p>
      ) : (
        <div className="flex flex-col space-y-6">
          {/* Stepper Bar */}
          <div className="border-b border-border-subtle pb-4">
            <div className="flex items-center justify-between gap-2 overflow-x-auto px-1 py-1">
              {stepsList.map((step, idx) => {
                const isCurrent = stepIndex === idx;
                const isCompleted = stepIndex > idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      if (isCompleted || (idx === 1 && stepIndex === 0 && canGoNext())) {
                        setStepIndex(idx);
                      }
                    }}
                    disabled={!isCompleted && !(idx === 1 && stepIndex === 0 && canGoNext()) && !isCurrent}
                    className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                      isCurrent
                        ? 'bg-primary text-white shadow-sm shadow-primary/30'
                        : isCompleted
                          ? 'bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-900/30 dark:text-success-300'
                          : 'bg-surface-muted text-text-muted opacity-60'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-white text-primary'
                          : isCompleted
                            ? 'bg-success-600 text-white dark:bg-success-500'
                            : 'bg-surface-elevated text-text-muted'
                      }`}
                    >
                      {isCompleted ? <Check className="h-3 w-3 stroke-[3]" /> : idx + 1}
                    </span>
                    <span className="whitespace-nowrap">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Content Steps */}
          <div className="min-h-[360px]">
            {stepIndex === 0 && (
              <StepTypeAndRecipient
                type={type}
                setType={(newType) => {
                  setType(newType);
                  setOfferedKey('');
                  if (newType === 'exchange' && recipientAccountId && (recipientShiftCounts[recipientAccountId] || 0) === 0) {
                    setRecipientAccountId('');
                  }
                }}
                canExchange={canExchange}
                canReplace={canReplace}
                recipients={recipients}
                recipientShiftCounts={recipientShiftCounts}
                recipientAccountId={recipientAccountId}
                setRecipientAccountId={(id) => {
                  setRecipientAccountId(id);
                  setOfferedKey('');
                }}
                t={t}
                i18n={i18n}
              />
            )}

            {stepIndex === 1 && (
              <StepShiftSelection
                assignments={requesterAssignments}
                selectedKey={requesterKey}
                onSelect={(key) => {
                  setRequesterKey(key);
                  setOfferedKey('');
                }}
                isLocked={Boolean(initialAssignment)}
                title={t('shiftRequests:wizard.steps.yourShift')}
                t={t}
                i18n={i18n}
              />
            )}

            {stepIndex === 2 && type === 'exchange' && (
              <StepShiftSelection
                assignments={offeredAssignments}
                selectedKey={offeredKey}
                onSelect={setOfferedKey}
                isLocked={false}
                title={t('shiftRequests:wizard.steps.theirShift')}
                t={t}
                i18n={i18n}
              />
            )}

            {((stepIndex === 2 && type === 'replace') || (stepIndex === 3 && type === 'exchange')) && (
              <StepReviewAndConfirm
                type={type}
                requesterName={user.name}
                recipientName={accountName(recipientAccountId, i18n.language)}
                requesterAssignment={requesterAssignment}
                offeredAssignment={offeredAssignment}
                requesterConflict={requesterConflict}
                recipientConflict={recipientConflict}
                t={t}
                i18n={i18n}
              />
            )}
          </div>

          {/* Persistent Summary Preview Bar */}
          <div className="rounded-card border border-border-subtle bg-surface-elevated p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
                  {type === 'exchange' ? (
                    <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                  )}
                  {t(`shiftRequests:type.${type}`)}
                </span>
                <span className="text-text-muted">|</span>
                <span className="font-medium text-text-secondary">
                  {t('shiftRequests:wizard.preview.recipient')}:{' '}
                  <strong className="text-text-primary">
                    {recipientAccountId ? accountName(recipientAccountId, i18n.language) : t('shiftRequests:wizard.preview.notSelected')}
                  </strong>
                </span>
                <span className="text-text-muted">|</span>
                <span className="font-medium text-text-secondary">
                  {t('shiftRequests:wizard.preview.yourShift')}:{' '}
                  <strong className="text-text-primary">
                    {requesterAssignment ? `${requesterAssignment.monthKey}-${String(requesterAssignment.day).padStart(2, '0')} (${requesterAssignment.facilityLabel} · ${localizeRowLabel(requesterAssignment.shiftLabel, i18n.language as any)})` : t('shiftRequests:wizard.preview.notSelected')}
                  </strong>
                  {requesterAssignment && !initialAssignment && (
                    <button
                      type="button"
                      onClick={() => {
                        setRequesterKey('');
                        setOfferedKey('');
                      }}
                      title={t('shiftRequests:wizard.clearSelection')}
                      className="ms-1.5 inline-flex items-center justify-center rounded-full bg-surface-muted hover:bg-error/10 text-text-muted hover:text-error h-4 w-4 text-[10px] font-bold"
                    >
                      ×
                    </button>
                  )}
                </span>
                {type === 'exchange' && (
                  <>
                    <span className="text-text-muted">|</span>
                    <span className="font-medium text-text-secondary">
                      {t('shiftRequests:wizard.preview.theirShift')}:{' '}
                      <strong className="text-text-primary">
                        {offeredAssignment ? `${offeredAssignment.monthKey}-${String(offeredAssignment.day).padStart(2, '0')} (${offeredAssignment.facilityLabel} · ${localizeRowLabel(offeredAssignment.shiftLabel, i18n.language as any)})` : t('shiftRequests:wizard.preview.notSelected')}
                      </strong>
                      {offeredAssignment && (
                        <button
                          type="button"
                          onClick={() => setOfferedKey('')}
                          title={t('shiftRequests:wizard.clearSelection')}
                          className="ms-1.5 inline-flex items-center justify-center rounded-full bg-surface-muted hover:bg-error/10 text-text-muted hover:text-error h-4 w-4 text-[10px] font-bold"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer Navigation Buttons */}
          <div className="flex items-center justify-between border-t border-border-subtle pt-4">
            <div>
              {stepIndex > 0 ? (
                <Button type="button" variant="secondary" onClick={handleBack} className="gap-1.5">
                  {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                  {t('shiftRequests:wizard.back')}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t('shiftRequests:form.cancel')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex < totalSteps - 1 ? (
                <Button type="button" variant="primary" onClick={handleNext} disabled={!canGoNext()} className="gap-1.5">
                  {t('shiftRequests:wizard.next')}
                  {isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={
                    !requesterAssignment ||
                    !recipientProfile ||
                    (type === 'exchange' && !offeredAssignment) ||
                    hasConflict
                  }
                  className="gap-1.5 bg-success-600 hover:bg-success-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t('shiftRequests:wizard.submit')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ==========================================================================
 * Sub-Components
 * ========================================================================== */

function StepTypeAndRecipient({
  type,
  setType,
  canExchange,
  canReplace,
  recipients,
  recipientShiftCounts,
  recipientAccountId,
  setRecipientAccountId,
  t,
  i18n,
}: {
  type: ShiftRequestType;
  setType: (t: ShiftRequestType) => void;
  canExchange: boolean;
  canReplace: boolean;
  recipients: EmployeeAccessProfile[];
  recipientShiftCounts: Record<string, number>;
  recipientAccountId: string;
  setRecipientAccountId: (id: string) => void;
  t: (key: string, opt?: Record<string, unknown>) => string;
  i18n: { language: string };
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecipients = useMemo(() => {
    if (!searchQuery.trim()) return recipients;
    const query = searchQuery.toLowerCase();
    return recipients.filter((profile) => {
      const name = accountName(profile.accountId, i18n.language).toLowerCase();
      return name.includes(query) || profile.accountId.toLowerCase().includes(query);
    });
  }, [recipients, searchQuery, i18n.language]);

  return (
    <div className="space-y-6">
      {/* Type Selection Cards */}
      <div className="space-y-2.5">
        <label className="block text-sm font-semibold text-text-primary">
          {t('shiftRequests:wizard.typeLabel')}
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {canExchange && (
            <button
              type="button"
              onClick={() => setType('exchange')}
              className={`flex items-start gap-3.5 rounded-card border p-4 text-start transition-all ${
                type === 'exchange'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border-subtle bg-surface-card hover:border-border-strong'
              }`}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  type === 'exchange' ? 'bg-primary text-white' : 'bg-surface-muted text-text-secondary'
                }`}
              >
                <RefreshCw className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-text-primary">{t('shiftRequests:type.exchange')}</div>
                <div className="mt-1 text-xs text-text-secondary leading-relaxed">
                  {t('shiftRequests:wizard.exchangeDesc')}
                </div>
              </div>
            </button>
          )}

          {canReplace && (
            <button
              type="button"
              onClick={() => setType('replace')}
              className={`flex items-start gap-3.5 rounded-card border p-4 text-start transition-all ${
                type === 'replace'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border-subtle bg-surface-card hover:border-border-strong'
              }`}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  type === 'replace' ? 'bg-primary text-white' : 'bg-surface-muted text-text-secondary'
                }`}
              >
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-text-primary">{t('shiftRequests:type.replace')}</div>
                <div className="mt-1 text-xs text-text-secondary leading-relaxed">
                  {t('shiftRequests:wizard.replaceDesc')}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Recipient Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-text-primary">
            {t('shiftRequests:wizard.recipientLabel')}
          </label>
          <span className="text-xs text-text-muted">
            {filteredRecipients.length} / {recipients.length}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute top-2.5 h-4 w-4 text-text-muted rtl:right-3 ltr:left-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('shiftRequests:wizard.searchRecipient')}
            className="input-field w-full rtl:pr-9 ltr:pl-9"
          />
        </div>

        <div className="max-h-[220px] overflow-y-auto rounded-card border border-border-subtle bg-surface-card divide-y divide-border-subtle">
          {filteredRecipients.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              {t('shiftRequests:empty')}
            </div>
          ) : (
            filteredRecipients.map((profile) => {
              const isSelected = recipientAccountId === profile.accountId;
              const name = accountName(profile.accountId, i18n.language);
              const count = recipientShiftCounts[profile.accountId] || 0;
              const isUnavailableForExchange = type === 'exchange' && count === 0;

              return (
                <button
                  key={profile.accountId}
                  type="button"
                  disabled={isUnavailableForExchange}
                  onClick={() => !isUnavailableForExchange && setRecipientAccountId(profile.accountId)}
                  className={`flex w-full items-center justify-between p-3.5 text-start transition-colors ${
                    isUnavailableForExchange
                      ? 'bg-surface-muted/60 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'hover:bg-surface-hover text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected ? 'bg-primary text-white' : 'bg-surface-muted text-text-secondary'
                      }`}
                    >
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm flex items-center gap-2">
                        <span>{name}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          count > 0
                            ? 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300'
                            : 'bg-surface-muted text-text-muted border border-border-subtle'
                        }`}>
                          {t('shiftRequests:wizard.shiftsCountAvailable', { count })}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted font-normal flex items-center gap-2 mt-0.5">
                        <span>{profile.scheduleEmployeeId || profile.accountId}</span>
                        {isUnavailableForExchange && (
                          <span className="text-error font-medium">· {t('shiftRequests:wizard.noShiftsAvailableExchange')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const BASE_SYSTEM_FACILITIES = ['KAMC', 'KASCH', 'WHH'];

const BASE_SYSTEM_SHIFT_TYPES: CanonicalShiftType[] = [
  'Day',
  'Late',
  'Night',
  'On-call Day',
  'On-call Night',
  'Overtime',
];

function getShiftRingColor(shiftType: string): string {
  switch (shiftType) {
    case 'Day': return 'border-teal-500 dark:border-teal-400';
    case 'Late': return 'border-amber-600 dark:border-amber-400';
    case 'Night': return 'border-blue-500 dark:border-blue-400';
    case 'On-call Day': return 'border-yellow-500 dark:border-yellow-400';
    case 'On-call Night': return 'border-cyan-500 dark:border-cyan-400';
    case 'Overtime': return 'border-purple-500 dark:border-purple-400';
    default: return 'border-primary';
  }
}

function StepShiftSelection({
  assignments,
  selectedKey,
  onSelect,
  isLocked,
  title,
  conflictMessage,
  hasConflict,
  t,
  i18n,
}: {
  assignments: ShiftAssignmentRef[];
  selectedKey: string;
  onSelect: (key: string) => void;
  isLocked: boolean;
  title: string;
  conflictMessage?: string;
  hasConflict?: boolean;
  t: (key: string, opt?: Record<string, unknown>) => string;
  i18n: { language: string };
}) {
  const facilityGroups = useMemo(() => {
    const map = new Map<string, ShiftAssignmentRef[]>();
    for (const item of assignments) {
      const list = map.get(item.facilityLabel) || [];
      list.push(item);
      map.set(item.facilityLabel, list);
    }
    return map;
  }, [assignments]);

  const facilityKeys = useMemo(() => {
    const set = new Set<string>(BASE_SYSTEM_FACILITIES);
    for (const item of assignments) {
      if (item.facilityLabel) set.add(item.facilityLabel);
    }
    return Array.from(set);
  }, [assignments]);

  const [activeFacility, setActiveFacility] = useState<string>(() => {
    if (selectedKey) {
      const found = assignments.find((a) => assignmentRequestKey(a) === selectedKey);
      if (found) return found.facilityLabel;
    }
    return facilityKeys[0] || 'KAMC';
  });

  useEffect(() => {
    if (facilityKeys.length > 0 && (!activeFacility || !facilityKeys.includes(activeFacility))) {
      setActiveFacility(facilityKeys[0]);
    }
  }, [facilityKeys, activeFacility]);

  const facilityAssignments = useMemo(() => {
    return facilityGroups.get(activeFacility) || [];
  }, [facilityGroups, activeFacility]);

  const shiftTypeGroups = useMemo(() => {
    const map = new Map<string, ShiftAssignmentRef[]>();
    for (const item of facilityAssignments) {
      const category = normalizeShiftTypeCategory(item.shiftLabel, item.unitLabel);
      const list = map.get(category) || [];
      list.push(item);
      map.set(category, list);
    }
    return map;
  }, [facilityAssignments]);

  const shiftTypeKeys = useMemo(() => {
    return BASE_SYSTEM_SHIFT_TYPES;
  }, []);

  const [activeShiftType, setActiveShiftType] = useState<string>(() => {
    if (selectedKey) {
      const found = facilityAssignments.find((a) => assignmentRequestKey(a) === selectedKey);
      if (found) return normalizeShiftTypeCategory(found.shiftLabel, found.unitLabel);
    }
    return shiftTypeKeys[0] || 'Day';
  });

  useEffect(() => {
    if (shiftTypeKeys.length > 0 && (!activeShiftType || !shiftTypeKeys.includes(activeShiftType as CanonicalShiftType))) {
      setActiveShiftType(shiftTypeKeys[0]);
    }
  }, [shiftTypeKeys, activeShiftType]);

  const matchingAssignments = useMemo(() => {
    return shiftTypeGroups.get(activeShiftType) || [];
  }, [shiftTypeGroups, activeShiftType]);

  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => {
    if (selectedKey) {
      const found = assignments.find((a) => assignmentRequestKey(a) === selectedKey);
      if (found?.monthKey) return found.monthKey;
    }
    return matchingAssignments[0]?.monthKey || assignments[0]?.monthKey || '2026-07';
  });

  const navigateMonth = (delta: number) => {
    const [yText, mText] = activeMonthKey.split('-');
    let y = Number(yText) || 2026;
    let m = Number(mText) || 7;
    m += delta;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    const nextKey = `${y}-${String(m).padStart(2, '0')}`;
    setActiveMonthKey(nextKey);
  };

  const handleSelectAssignment = (assignment: ShiftAssignmentRef) => {
    const key = assignmentRequestKey(assignment);
    onSelect(key);
    setActiveFacility(assignment.facilityLabel);
    setActiveShiftType(normalizeShiftTypeCategory(assignment.shiftLabel, assignment.unitLabel));
    if (assignment.monthKey !== activeMonthKey) {
      setActiveMonthKey(assignment.monthKey);
    }
  };

  const selectedAssignment = useMemo(() => {
    if (!selectedKey) return null;
    return assignments.find((a) => assignmentRequestKey(a) === selectedKey) || null;
  }, [assignments, selectedKey]);

  const isSelectionInAnotherTab = useMemo(() => {
    if (!selectedAssignment) return false;
    return (
      selectedAssignment.facilityLabel !== activeFacility ||
      normalizeShiftTypeCategory(selectedAssignment.shiftLabel, selectedAssignment.unitLabel) !== activeShiftType ||
      selectedAssignment.monthKey !== activeMonthKey
    );
  }, [selectedAssignment, activeFacility, activeShiftType, activeMonthKey]);

  // Calendar setup for matching assignments
  const [yearText, monthText] = activeMonthKey.split('-');
  const yearNum = Number(yearText) || 2026;
  const monthNum = Number(monthText) || 7;

  const daysInMonth = useMemo(() => {
    return new Date(yearNum, monthNum, 0).getDate();
  }, [yearNum, monthNum]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(yearNum, monthNum - 1, 1).getDay();
  }, [yearNum, monthNum]);

  const assignmentsByDay = useMemo(() => {
    const map = new Map<number, ShiftAssignmentRef>();
    for (const item of matchingAssignments) {
      if (item.monthKey === activeMonthKey) {
        map.set(item.day, item);
      }
    }
    return map;
  }, [matchingAssignments, activeMonthKey]);

  const activeMonthAssignments = useMemo(() => {
    return matchingAssignments.filter((a) => a.monthKey === activeMonthKey);
  }, [matchingAssignments, activeMonthKey]);

  const weekdays = (t('shiftRequests:wizard.weekdays', { returnObjects: true }) as unknown as string[]) || [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
  ];

  return (
    <div className="space-y-5">
      {/* Header title */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          {title}
        </h4>
        {isLocked && (
          <span className="rounded-full bg-warning-100 px-2.5 py-0.5 text-[11px] font-semibold text-warning-800">
            {t('shiftRequests:form.yourShift')}
          </span>
        )}
      </div>

      {hasConflict && conflictMessage && (
        <div className="rounded-card border border-error/30 bg-error/10 p-3.5 text-xs text-error space-y-1 animate-in fade-in duration-200">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            <span>{t('shiftRequests:validation.dayShiftOTConflictTitle')}</span>
          </div>
          <p className="leading-relaxed text-error">{conflictMessage}</p>
        </div>
      )}

      {isSelectionInAnotherTab && selectedAssignment && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary/30 bg-primary/10 p-3 text-xs text-text-primary shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary shrink-0" />
            <span>
              {t('shiftRequests:wizard.selectedInAnotherTab', {
                shift: `${selectedAssignment.monthKey}-${String(selectedAssignment.day).padStart(2, '0')}`,
                branch: selectedAssignment.facilityLabel,
                type: selectedAssignment.shiftLabel,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              onClick={() => {
                setActiveFacility(selectedAssignment.facilityLabel);
                setActiveShiftType(normalizeShiftTypeCategory(selectedAssignment.shiftLabel, selectedAssignment.unitLabel));
                setActiveMonthKey(selectedAssignment.monthKey);
              }}
              className="rounded bg-primary px-2.5 py-1 font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              {t('shiftRequests:wizard.showSelected')}
            </button>
            {!isLocked && (
              <button
                type="button"
                onClick={() => onSelect('')}
                className="rounded border border-border-strong bg-surface-card px-2.5 py-1 font-semibold text-text-secondary hover:bg-error/10 hover:text-error transition-colors"
              >
                {t('shiftRequests:wizard.clearSelection')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step A: Branch (Facility) Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {t('shiftRequests:wizard.branchLabel')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {facilityKeys.length === 0 ? (
            <span className="text-xs text-text-muted">{t('shiftRequests:wizard.noShiftsInBranch')}</span>
          ) : (
            facilityKeys.map((facility) => {
              const count = (facilityGroups.get(facility) || []).length;
              const isSelected = activeFacility === facility;
              return (
                <button
                  key={facility}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setActiveFacility(facility);
                  }}
                  className={`flex items-center gap-2 rounded-card border px-3.5 py-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-border-subtle bg-surface-card text-text-primary hover:border-border-strong'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{facility}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-surface-muted text-text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Step B: Shift Type Selector */}
      {facilityKeys.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {t('shiftRequests:wizard.shiftTypeLabel')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {shiftTypeKeys.length === 0 ? (
              <span className="text-xs text-text-muted">{t('shiftRequests:wizard.noShiftsForType')}</span>
            ) : (
              shiftTypeKeys.map((shiftType) => {
                const count = (shiftTypeGroups.get(shiftType) || []).length;
                const isSelected = activeShiftType === shiftType;
                return (
                  <button
                    key={shiftType}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      setActiveShiftType(shiftType);
                    }}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/30'
                        : 'border-border-subtle bg-surface-card text-text-secondary hover:border-border-strong'
                    }`}
                  >
                    <span className={`inline-block h-2.5 w-2.5 rounded-full border-2 ${getShiftRingColor(shiftType)} shrink-0`} />
                    <span>{localizeRowLabel(shiftType, i18n.language as any)}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Step C: Interactive Calendar Grid & Cards */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {t('shiftRequests:wizard.dateLabel')} ({activeMonthKey})
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              title={t('shiftRequests:wizard.prevMonth')}
              className="inline-flex h-7 px-2.5 items-center justify-center rounded border border-border-subtle bg-surface-card hover:bg-surface-hover text-xs font-medium text-text-secondary transition-colors"
            >
              {i18n.language.startsWith('ar') ? '❯' : '❮'} {t('shiftRequests:wizard.prevMonth')}
            </button>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              title={t('shiftRequests:wizard.nextMonth')}
              className="inline-flex h-7 px-2.5 items-center justify-center rounded border border-border-subtle bg-surface-card hover:bg-surface-hover text-xs font-medium text-text-secondary transition-colors"
            >
              {t('shiftRequests:wizard.nextMonth')} {i18n.language.startsWith('ar') ? '❮' : '❯'}
            </button>
          </div>
        </div>

        <div className="rounded-card border border-border-subtle bg-surface-card p-3.5 shadow-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-bold text-text-muted">
            {weekdays.map((day, idx) => (
              <div key={idx}>{day}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-11 rounded border border-transparent bg-transparent" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const matches = matchingAssignments.filter((a) => a.day === dayNum && a.monthKey === activeMonthKey);
              const isSelectedDay = selectedAssignment?.day === dayNum && selectedAssignment?.monthKey === activeMonthKey;
              const hasAssignment = matches.length > 0;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={!hasAssignment || isLocked}
                  onClick={() => {
                    if (hasAssignment && matches[0]) {
                      handleSelectAssignment(matches[0]);
                    }
                  }}
                  className={`relative flex h-11 flex-col items-center justify-center rounded border p-1 text-xs font-medium transition-all ${
                    isSelectedDay
                      ? 'border-primary bg-primary text-white font-bold shadow-sm'
                      : hasAssignment
                        ? 'border-border bg-surface hover:border-primary/50 text-text-primary cursor-pointer'
                        : 'border-border-subtle/40 bg-surface-muted/20 text-text-muted opacity-60 cursor-not-allowed'
                  }`}
                >
                  <span>{dayNum}</span>
                  {hasAssignment && (
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        isSelectedDay ? 'bg-white' : 'bg-primary'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Cards Section below Calendar */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {t('shiftRequests:wizard.shiftsListLabel')} {activeMonthAssignments.length > 0 && t('shiftRequests:wizard.shiftsCountAvailable', { count: activeMonthAssignments.length })}
          </label>

          {activeMonthAssignments.length === 0 ? (
            <div className="rounded-card border border-border-subtle bg-surface-muted/30 p-8 text-center text-xs text-text-muted">
              {t('shiftRequests:wizard.noShiftsInMonth', { month: activeMonthKey })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {activeMonthAssignments.map((assignment) => {
                const key = assignmentRequestKey(assignment);
                const isSelected = selectedKey === key;
                const dayName = new Date(assignment.startsAt).toLocaleDateString(i18n.language, { weekday: 'short' });

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSelectAssignment(assignment)}
                    className={`flex w-full items-center justify-between rounded-card border p-3 text-start transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-sm'
                        : 'border-border-subtle bg-surface-card hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded font-bold text-xs ${
                          isSelected ? 'bg-primary text-white' : 'bg-surface-muted text-text-primary'
                        }`}
                      >
                        <span className="text-[10px] uppercase leading-none opacity-80">{dayName}</span>
                        <span className="text-sm leading-tight">{assignment.day}</span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-text-primary">
                          {localizeRowLabel(assignment.unitLabel, i18n.language as any)} · {localizeRowLabel(assignment.shiftLabel, i18n.language as any)}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">
                          {assignment.timeRange} · {assignment.facilityLabel}
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepReviewAndConfirm({
  type,
  requesterName,
  recipientName,
  requesterAssignment,
  offeredAssignment,
  requesterConflict,
  recipientConflict,
  t,
  i18n,
}: {
  type: ShiftRequestType;
  requesterName: string;
  recipientName: string;
  requesterAssignment?: ShiftAssignmentRef | null;
  offeredAssignment?: ShiftAssignmentRef | null;
  requesterConflict?: { conflict: boolean; message?: string };
  recipientConflict?: { conflict: boolean; message?: string };
  t: (key: string, opt?: Record<string, unknown>) => string;
  i18n: { language: string };
}) {
  const hasReviewConflict = requesterConflict?.conflict || recipientConflict?.conflict;
  const reviewConflictMsg = requesterConflict?.conflict ? requesterConflict.message : recipientConflict?.message;

  return (
    <div className="space-y-5">
      {hasReviewConflict && reviewConflictMsg && (
        <div className="rounded-card border border-error/30 bg-error/10 p-4 text-xs text-error space-y-1.5 animate-in fade-in duration-200">
          <div className="font-semibold flex items-center gap-1.5 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            <span>{t('shiftRequests:validation.dayShiftOTConflictTitle')}</span>
          </div>
          <p className="leading-relaxed text-error">{reviewConflictMsg}</p>
        </div>
      )}

      <div className="rounded-card bg-primary/5 border border-primary/20 p-4">
        <h4 className="text-sm font-semibold text-primary">
          {t('shiftRequests:wizard.reviewTitle')}
        </h4>
        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
          {t('shiftRequests:wizard.reviewDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Requester / Your Shift Summary Card */}
        <div className="rounded-card border border-border-subtle bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {t('shiftRequests:requesterShift')}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {requesterName}
            </span>
          </div>
          {requesterAssignment ? (
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {requesterAssignment.monthKey}-{String(requesterAssignment.day).padStart(2, '0')}
              </div>
              <div className="text-text-secondary">
                <strong>{t('shiftRequests:wizard.branchLabel')}:</strong> {requesterAssignment.facilityLabel} / {localizeRowLabel(requesterAssignment.unitLabel, i18n.language as any)}
              </div>
              <div className="text-text-secondary">
                <strong>{t('shiftRequests:wizard.shiftTypeLabel')}:</strong> {localizeRowLabel(requesterAssignment.shiftLabel, i18n.language as any)} ({requesterAssignment.timeRange})
              </div>
            </div>
          ) : (
            <div className="text-xs text-text-muted">{t('shiftRequests:wizard.preview.notSelected')}</div>
          )}
        </div>

        {/* Recipient / Their Shift Summary Card */}
        <div className="rounded-card border border-border-subtle bg-surface-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {type === 'exchange' ? t('shiftRequests:offeredShift') : t('shiftRequests:recipient')}
            </span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
              {recipientName || t('shiftRequests:wizard.preview.notSelected')}
            </span>
          </div>
          {type === 'exchange' ? (
            offeredAssignment ? (
              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4 text-success-600" />
                  {offeredAssignment.monthKey}-{String(offeredAssignment.day).padStart(2, '0')}
                </div>
                <div className="text-text-secondary">
                  <strong>{t('shiftRequests:wizard.branchLabel')}:</strong> {offeredAssignment.facilityLabel} / {localizeRowLabel(offeredAssignment.unitLabel, i18n.language as any)}
                </div>
                <div className="text-text-secondary">
                  <strong>{t('shiftRequests:wizard.shiftTypeLabel')}:</strong> {localizeRowLabel(offeredAssignment.shiftLabel, i18n.language as any)} ({offeredAssignment.timeRange})
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-muted">{t('shiftRequests:wizard.preview.notSelected')}</div>
            )
          ) : (
            <div className="py-2 text-xs text-text-secondary leading-relaxed">
              {t('shiftRequests:wizard.replaceDesc')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
