import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  Building2,
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
import type {
  CreateShiftRequestInput,
  ShiftAssignmentRef,
  ShiftRequestMutationResult,
  ShiftRequestType,
} from '@/types/shiftRequest';
import type { EmployeeAccessProfile } from '@/types/employeeAccess';
import { isAdminOrSuperAdmin, type UserRole } from '@/types';
import { getEmployeeDirectoryRecord } from '@/stores/employeeDirectoryStore';
import { useShiftRequestStore } from '@/stores/shiftRequestStore';
import { localizeRowLabel } from '@/lib/scheduleMatrixLocale';
import type { Language } from '@/i18n/constants';

export interface ShiftRequestCreateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: ShiftRequestMutationResult) => void;
  canExchange: boolean;
  canReplace: boolean;
  requesterAssignments: ShiftAssignmentRef[];
  recipients: EmployeeAccessProfile[];
  candidateProfiles: Record<string, EmployeeAccessProfile>;
  user: { id: string; name: string; role?: UserRole } | null;
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

function toSupportedLanguage(language: string): Language {
  return language === 'ar' ? 'ar' : 'en';
}

export function ShiftRequestCreateWizard({
  user,
  ...props
}: ShiftRequestCreateWizardProps) {
  if (!user) return null;

  return <ShiftRequestCreateWizardContent {...props} user={user} />;
}

type ShiftRequestCreateWizardContentProps = Omit<ShiftRequestCreateWizardProps, 'user'> & {
  user: NonNullable<ShiftRequestCreateWizardProps['user']>;
};

function ShiftRequestCreateWizardContent({
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
}: ShiftRequestCreateWizardContentProps) {
  const { t, i18n } = useTranslation(['shiftRequests', 'common']);
  const isRtl = i18n.language.startsWith('ar');
  const createBatchRequestsStore = useShiftRequestStore((state) => state.createBatchRequests);

  const [type, setType] = useState<ShiftRequestType>(
    canExchange ? 'exchange' : canReplace ? 'replace' : 'exchange',
  );
  const [recipientAccountId, setRecipientAccountId] = useState('');
  const [requesterKey, setRequesterKey] = useState('');
  const [offeredKey, setOfferedKey] = useState('');
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('single');
  const [selectedRequesterKeys, setSelectedRequesterKeys] = useState<string[]>([]);
  const [selectedOfferedKeys, setSelectedOfferedKeys] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);

  const totalSteps = type === 'exchange' ? 4 : 3;

  useEffect(() => {
    if (initialAssignment) {
      const key = assignmentRequestKey(initialAssignment);
      setRequesterKey(key);
      setSelectedRequesterKeys([key]);
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
      setSelectedOfferedKeys([]);
      setSelectionMode('single');
      if (!initialAssignment) {
        setRequesterKey('');
        setSelectedRequesterKeys([]);
      }
    }
  }, [isOpen, initialAssignment]);

  const requesterAssignmentsSelected = useMemo(() => {
    if (selectedRequesterKeys.length > 0) {
      return requesterAssignments.filter((a) => selectedRequesterKeys.includes(assignmentRequestKey(a)));
    }
    const found = requesterAssignments.find((a) => assignmentRequestKey(a) === requesterKey) ?? initialAssignment;
    return found ? [found] : [];
  }, [requesterAssignments, selectedRequesterKeys, requesterKey, initialAssignment]);

  const requesterAssignment = requesterAssignmentsSelected[0] ?? null;

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
      );
      counts[profile.accountId] = assignments.filter((a) => new Date(a.startsAt).getTime() > nowMs).length;
    }
    return counts;
  }, [recipients]);

  const offeredAssignments = useMemo(() => {
    if (type !== 'exchange' || !recipientProfile?.scheduleEmployeeId) return [];
    return listPublishedAssignmentsForEmployee(
      recipientProfile.scheduleEmployeeId,
      recipientProfile.departmentId,
    ).filter((assignment) => new Date(assignment.startsAt).getTime() > Date.now());
  }, [type, recipientProfile]);

  const offeredAssignmentsSelected = useMemo(() => {
    if (selectedOfferedKeys.length > 0) {
      return offeredAssignments.filter((a) => selectedOfferedKeys.includes(assignmentRequestKey(a)));
    }
    const found = offeredAssignments.find((a) => assignmentRequestKey(a) === offeredKey);
    return found ? [found] : [];
  }, [offeredAssignments, selectedOfferedKeys, offeredKey]);

  const offeredAssignment = offeredAssignmentsSelected[0] ?? null;

  const requesterConflict = useMemo(() => {
    if (requesterAssignmentsSelected.length === 0 || !user) return { conflict: false };
    for (const assignment of requesterAssignmentsSelected) {
      const empId = candidateProfiles[user.id]?.scheduleEmployeeId || assignment.employeeId || user.id;
      const res = hasDayShiftOTConflict(assignment, empId);
      if (res.conflict) return res;
    }
    return { conflict: false };
  }, [requesterAssignmentsSelected, candidateProfiles, user]);

  const recipientConflict = useMemo(() => {
    if (offeredAssignmentsSelected.length === 0 || !recipientProfile?.scheduleEmployeeId) return { conflict: false };
    for (const assignment of offeredAssignmentsSelected) {
      const res = hasDayShiftOTConflict(assignment, recipientProfile.scheduleEmployeeId);
      if (res.conflict) return res;
    }
    return { conflict: false };
  }, [offeredAssignmentsSelected, recipientProfile]);

  const hasConflict = Boolean(requesterConflict.conflict || recipientConflict.conflict);

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
      return requesterAssignmentsSelected.length > 0 && !requesterConflict?.conflict;
    }
    if (stepIndex === 2 && type === 'exchange') {
      return offeredAssignmentsSelected.length > 0 && !recipientConflict?.conflict;
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
    if (requesterAssignmentsSelected.length === 0 || !recipientProfile || hasConflict) return;
    if (type === 'exchange' && offeredAssignmentsSelected.length === 0) return;

    let inputs: CreateShiftRequestInput[] = [];

    if (type === 'replace') {
      inputs = requesterAssignmentsSelected.map((reqAssignment) => ({
        type: 'replace',
        requesterAccountId: user.id,
        recipientAccountId,
        requesterAssignment: reqAssignment,
      }));
    } else {
      // Pair 1-to-1 up to min count to prevent duplicate offered shift reuse
      const pairCount = Math.min(requesterAssignmentsSelected.length, offeredAssignmentsSelected.length);
      for (let i = 0; i < pairCount; i++) {
        const reqAssignment = requesterAssignmentsSelected[i];
        const offAssignment = offeredAssignmentsSelected[i];
        if (reqAssignment && offAssignment) {
          inputs.push({
            type: 'exchange',
            requesterAccountId: user.id,
            recipientAccountId,
            requesterAssignment: reqAssignment,
            offeredAssignment: offAssignment,
          });
        }
      }
    }

    if (inputs.length === 0) return;

    if (inputs.length === 1 && inputs[0]) {
      onResult(createRequest(inputs[0]));
    } else {
      const batchRes = createBatchRequestsStore(inputs);
      if (batchRes.ok && batchRes.results.find((r) => r.ok)) {
        const firstSuccess = batchRes.results.find((r) => r.ok)!;
        onResult(firstSuccess);
      } else {
        const firstFail = batchRes.results.find((r) => !r.ok);
        onResult(firstFail || { ok: false, reason: 'storage_error' });
      }
    }
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
                  setSelectedRequesterKeys(key ? [key] : []);
                  setOfferedKey('');
                  setSelectedOfferedKeys([]);
                }}
                selectedKeys={selectedRequesterKeys}
                onSelectKeys={(keys) => {
                  setSelectedRequesterKeys(keys);
                  if (keys[0]) setRequesterKey(keys[0]);
                  setOfferedKey('');
                  setSelectedOfferedKeys([]);
                }}
                selectionMode={selectionMode}
                onToggleSelectionMode={setSelectionMode}
                isLocked={Boolean(initialAssignment)}
                title={isAdminOrSuperAdmin(user) && !initialAssignment
                  ? (i18n.language.startsWith('ar') ? 'اختر شفت الموظف الأول (طالب التبادل)' : 'Select Requester Shift')
                  : t('shiftRequests:wizard.steps.yourShift')}
                t={t}
                i18n={i18n}
              />
            )}

            {stepIndex === 2 && type === 'exchange' && (
              <StepShiftSelection
                assignments={offeredAssignments}
                selectedKey={offeredKey}
                onSelect={(key) => {
                  setOfferedKey(key);
                  setSelectedOfferedKeys(key ? [key] : []);
                }}
                selectedKeys={selectedOfferedKeys}
                onSelectKeys={(keys) => {
                  setSelectedOfferedKeys(keys);
                  if (keys[0]) setOfferedKey(keys[0]);
                }}
                selectionMode={selectionMode}
                onToggleSelectionMode={setSelectionMode}
                isLocked={false}
                title={recipientAccountId
                  ? (i18n.language.startsWith('ar')
                      ? `اختر شفت الموظف المقابل (${accountName(recipientAccountId, i18n.language)})`
                      : `Select Recipient Shift (${accountName(recipientAccountId, i18n.language)})`)
                  : t('shiftRequests:wizard.steps.theirShift')}
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
                    {requesterAssignment ? `${requesterAssignment.monthKey}-${String(requesterAssignment.day).padStart(2, '0')} (${requesterAssignment.facilityLabel} · ${localizeRowLabel(requesterAssignment.shiftLabel, toSupportedLanguage(i18n.language))})` : t('shiftRequests:wizard.preview.notSelected')}
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
                        {offeredAssignment ? `${offeredAssignment.monthKey}-${String(offeredAssignment.day).padStart(2, '0')} (${offeredAssignment.facilityLabel} · ${localizeRowLabel(offeredAssignment.shiftLabel, toSupportedLanguage(i18n.language))})` : t('shiftRequests:wizard.preview.notSelected')}
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
                    requesterAssignmentsSelected.length === 0 ||
                    !recipientProfile ||
                    (type === 'exchange' && offeredAssignmentsSelected.length === 0) ||
                    hasConflict
                  }
                  className="gap-1.5 bg-success-600 hover:bg-success-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {requesterAssignmentsSelected.length > 1
                    ? (i18n.language.startsWith('ar') ? `تقديم ${requesterAssignmentsSelected.length} طلبات` : `Submit ${requesterAssignmentsSelected.length} Requests`)
                    : t('shiftRequests:wizard.submit')}
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
  'Night',
  'On-call Day',
  'On-call Night',
  'Overtime',
];

function getShiftRingColor(shiftType: string): string {
  switch (shiftType) {
    case 'Day': return 'border-teal-500 dark:border-teal-400';
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
  selectedKeys,
  onSelectKeys,
  selectionMode = 'single',
  onToggleSelectionMode,
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
  selectedKeys?: string[];
  onSelectKeys?: (keys: string[]) => void;
  selectionMode?: 'single' | 'range';
  onToggleSelectionMode?: (mode: 'single' | 'range') => void;
  isLocked: boolean;
  title: string;
  conflictMessage?: string;
  hasConflict?: boolean;
  t: (key: string, opt?: Record<string, unknown>) => string;
  i18n: { language: string };
}) {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'schedule' | 'ot'>('all');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');

  const distinctEmployees = useMemo(() => {
    const map = new Map<string, { employeeId: string; name: string; code: string }>();
    for (const a of assignments) {
      if (a.employeeId && !map.has(a.employeeId)) {
        const name = accountName(a.employeeId, i18n.language) || a.employeeCode || a.employeeId;
        map.set(a.employeeId, { employeeId: a.employeeId, name, code: a.employeeCode });
      }
    }
    return Array.from(map.values());
  }, [assignments, i18n.language]);

  const activeSelectedKeys = useMemo(() => {
    if (selectionMode === 'range' && selectedKeys) return selectedKeys;
    return selectedKey ? [selectedKey] : [];
  }, [selectionMode, selectedKeys, selectedKey]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (selectedEmployeeFilter !== 'all' && item.employeeId !== selectedEmployeeFilter) return false;
      const dateStr = `${item.monthKey}-${String(item.day).padStart(2, '0')}`;
      if (fromDate && dateStr < fromDate) return false;
      if (toDate && dateStr > toDate) return false;
      return true;
    });
  }, [assignments, sourceFilter, selectedEmployeeFilter, fromDate, toDate]);

  // Handle auto-selecting date range when fromDate and toDate are chosen in range mode
  useEffect(() => {
    if (selectionMode === 'range' && fromDate && toDate && onSelectKeys) {
      const rangeKeys = assignments
        .filter((item) => {
          const dateStr = `${item.monthKey}-${String(item.day).padStart(2, '0')}`;
          return dateStr >= fromDate && dateStr <= toDate;
        })
        .map(assignmentRequestKey);
      if (rangeKeys.length > 0) {
        onSelectKeys(Array.from(new Set(rangeKeys)));
      }
    }
  }, [fromDate, toDate, selectionMode, assignments, onSelectKeys]);

  const facilityGroups = useMemo(() => {
    const map = new Map<string, ShiftAssignmentRef[]>();
    for (const item of filteredAssignments) {
      const list = map.get(item.facilityLabel) || [];
      list.push(item);
      map.set(item.facilityLabel, list);
    }
    return map;
  }, [filteredAssignments]);

  const facilityKeys = useMemo(() => {
    const set = new Set<string>(BASE_SYSTEM_FACILITIES);
    for (const item of filteredAssignments) {
      if (item.facilityLabel) set.add(item.facilityLabel);
    }
    return Array.from(set);
  }, [filteredAssignments]);

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

  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => {
    if (selectedKey) {
      const found = assignments.find((a) => assignmentRequestKey(a) === selectedKey);
      if (found?.monthKey) return found.monthKey;
    }
    return filteredAssignments[0]?.monthKey || '2026-07';
  });

  const facilityAssignments = useMemo(() => {
    return facilityGroups.get(activeFacility) || [];
  }, [facilityGroups, activeFacility]);

  const monthFacilityAssignments = useMemo(() => {
    return facilityAssignments.filter((item) => item.monthKey === activeMonthKey);
  }, [facilityAssignments, activeMonthKey]);

  const shiftTypeGroups = useMemo(() => {
    const map = new Map<string, ShiftAssignmentRef[]>();
    for (const item of monthFacilityAssignments) {
      const category = normalizeShiftTypeCategory(item.shiftLabel, item.unitLabel);
      const list = map.get(category) || [];
      list.push(item);
      map.set(category, list);
    }
    return map;
  }, [monthFacilityAssignments]);

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
    if (selectionMode === 'range' && onSelectKeys) {
      const current = selectedKeys || [];
      if (current.includes(key)) {
        onSelectKeys(current.filter((k) => k !== key));
      } else {
        onSelectKeys([...current, key]);
      }
    } else {
      onSelect(key);
      if (onSelectKeys) onSelectKeys([key]);
    }
    setActiveFacility(assignment.facilityLabel);
    setActiveShiftType(normalizeShiftTypeCategory(assignment.shiftLabel, assignment.unitLabel));
    if (assignment.monthKey !== activeMonthKey) {
      setActiveMonthKey(assignment.monthKey);
    }
  };

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

  const activeMonthAssignments = useMemo(() => {
    return matchingAssignments.filter((a) => a.monthKey === activeMonthKey);
  }, [matchingAssignments, activeMonthKey]);

  const weekdays = (t('shiftRequests:wizard.weekdays', { returnObjects: true }) as unknown as string[]) || [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
  ];

  const availableMonthsSet = useMemo(() => {
    const set = new Set<number>();
    for (const item of assignments) {
      const [y, m] = item.monthKey.split('-');
      if (Number(y) === yearNum) {
        set.add(Number(m));
      }
    }
    return set;
  }, [assignments, yearNum]);

  const selectedAssignmentsList = useMemo(() => {
    return assignments.filter((a) => activeSelectedKeys.includes(assignmentRequestKey(a)));
  }, [assignments, activeSelectedKeys]);

  return (
    <div className="space-y-5">
      {/* Header title & Range Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          {title}
        </h4>
        <div className="flex items-center gap-2">
          {onToggleSelectionMode && (
            <div className="flex items-center gap-1 bg-surface-muted/80 p-1 rounded-full border border-border-subtle text-xs">
              <button
                type="button"
                onClick={() => onToggleSelectionMode('single')}
                className={`px-3 py-1 font-semibold rounded-full transition-colors ${
                  selectionMode === 'single' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {i18n.language.startsWith('ar') ? 'شفت واحد' : 'Single Shift'}
              </button>
              <button
                type="button"
                onClick={() => onToggleSelectionMode('range')}
                className={`px-3 py-1 font-semibold rounded-full transition-colors ${
                  selectionMode === 'range' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {i18n.language.startsWith('ar') ? 'نطاق أيام / شفتات متعددة' : 'Date Range / Multi-Shift'}
              </button>
            </div>
          )}
          {isLocked && (
            <span className="rounded-full bg-warning-100 px-2.5 py-0.5 text-[11px] font-semibold text-warning-800">
              {t('shiftRequests:form.yourShift')}
            </span>
          )}
        </div>
      </div>

      {/* Employee Filter Bar when multiple employees exist */}
      {distinctEmployees.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card border border-primary/20 bg-primary/5 p-3 animate-in fade-in duration-200 shadow-sm">
          <label className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <User className="h-4 w-4 text-primary" />
            <span>{i18n.language.startsWith('ar') ? 'تصفية الشفتات بحسب الموظف:' : 'Filter Shifts by Employee:'}</span>
          </label>
          <select
            value={selectedEmployeeFilter}
            onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
            className="input-field max-w-xs text-xs font-semibold py-1.5 px-3 bg-surface-card border-primary/30 text-text-primary"
          >
            <option value="all">
              {i18n.language.startsWith('ar') ? `جميع موظفي القسم (${distinctEmployees.length})` : `All Department Employees (${distinctEmployees.length})`}
            </option>
            {distinctEmployees.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.name} {emp.code ? `(${emp.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasConflict && conflictMessage && (
        <div className="rounded-card border border-error/30 bg-error/10 p-3.5 text-xs text-error space-y-1 animate-in fade-in duration-200">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            <span>{t('shiftRequests:validation.dayShiftOTConflictTitle')}</span>
          </div>
          <p className="leading-relaxed text-error">{conflictMessage}</p>
        </div>
      )}

      {/* Date Range Selection (From Date - To Date) for Range Mode */}
      {selectionMode === 'range' && (
        <div className="rounded-card border border-primary/30 bg-primary/5 p-3.5 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-semibold text-primary">
            <span>{i18n.language.startsWith('ar') ? 'تحديد نطاق التاريخ (من - إلى)' : 'Date Range Selection (From - To)'}</span>
            {activeSelectedKeys.length > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-white">
                {i18n.language.startsWith('ar') ? `${activeSelectedKeys.length} شفتات محدودة` : `${activeSelectedKeys.length} Shifts Selected`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                {i18n.language.startsWith('ar') ? 'من تاريخ' : 'From Date'}
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input-field w-full text-xs py-1.5 px-2.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-muted mb-1">
                {i18n.language.startsWith('ar') ? 'إلى تاريخ' : 'To Date'}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input-field w-full text-xs py-1.5 px-2.5"
              />
            </div>
          </div>
        </div>
      )}

      {/* Selected Range Pills Box */}
      {selectionMode === 'range' && selectedAssignmentsList.length > 0 && (
        <div className="rounded-card border border-border-subtle bg-surface-card p-3 space-y-2 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
            <span>{i18n.language.startsWith('ar') ? 'الشفتات المحددة في النطاق:' : 'Selected Range Shifts:'}</span>
            <button
              type="button"
              onClick={() => onSelectKeys && onSelectKeys([])}
              className="text-[11px] text-error hover:underline font-semibold"
            >
              {i18n.language.startsWith('ar') ? 'مسح الكل' : 'Clear All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {selectedAssignmentsList.map((a) => {
              const k = assignmentRequestKey(a);
              return (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  <span>{a.monthKey}-{String(a.day).padStart(2, '0')} ({a.shiftLabel})</span>
                  <button
                    type="button"
                    onClick={() => onSelectKeys && onSelectKeys(activeSelectedKeys.filter((item) => item !== k))}
                    className="hover:text-error transition-colors"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Month Selection Bar (1 - 12) & Source Filter */}
      <div className="rounded-card border border-border-subtle bg-surface-card p-3.5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-text-primary">
              {i18n.language.startsWith('ar') ? 'اختر الشهر (1 - 12)' : 'Select Month (1 - 12)'}
            </span>
          </div>
          <span className="text-xs font-bold text-text-muted">{yearNum}</span>
        </div>

        {/* 12 Month Buttons */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const isSelected = m === monthNum;
            const hasShifts = availableMonthsSet.has(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  const nextKey = `${yearNum}-${String(m).padStart(2, '0')}`;
                  setActiveMonthKey(nextKey);
                }}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-btn text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30'
                    : hasShifts
                      ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                      : 'bg-surface-muted text-text-muted hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <span>{m}</span>
                <span className="text-[10px] font-normal opacity-80">
                  {new Intl.DateTimeFormat(i18n.language, { month: 'narrow' }).format(new Date(yearNum, m - 1, 1))}
                </span>
                {hasShifts && (
                  <span
                    className={`absolute top-1 end-1 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-primary'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Shift Source Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5 text-xs">
          <span className="font-medium text-text-muted">
            {t('shiftRequests:wizard.sourceFilterLabel')}
          </span>
          <div className="flex items-center gap-1 bg-surface-muted/60 p-1 rounded-card border border-border-subtle">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1 text-[11px] font-semibold rounded transition-colors ${
                sourceFilter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t('shiftRequests:wizard.allSources')}
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('schedule')}
              className={`px-3 py-1 text-[11px] font-semibold rounded transition-colors ${
                sourceFilter === 'schedule' ? 'bg-teal-600 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t('shiftRequests:wizard.scheduleSource')}
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('ot')}
              className={`px-3 py-1 text-[11px] font-semibold rounded transition-colors ${
                sourceFilter === 'ot' ? 'bg-purple-600 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t('shiftRequests:wizard.otSource')}
            </button>
          </div>
        </div>
      </div>

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
              const count = (facilityGroups.get(facility) || []).filter((item) => item.monthKey === activeMonthKey).length;
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
                    <span>{localizeRowLabel(shiftType, toSupportedLanguage(i18n.language))}</span>
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

        {/* Calendar Grid Container */}
        <div className="rounded-card border border-border-subtle bg-surface-card p-3 shadow-sm">
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
              const isSelectedDay = matches.some((a) => activeSelectedKeys.includes(assignmentRequestKey(a)));
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
                      ? 'border-primary bg-primary text-white font-bold shadow-sm ring-2 ring-primary/40'
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
            {t('shiftRequests:wizard.shiftsListLabel')} ({activeMonthAssignments.length})
          </label>

          {activeMonthAssignments.length === 0 ? (
            <div className="rounded-card border border-border-subtle bg-surface-muted/30 p-8 text-center text-xs text-text-muted">
              {t('shiftRequests:wizard.noShiftsInMonth', { month: activeMonthKey })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {activeMonthAssignments.map((assignment) => {
                const key = assignmentRequestKey(assignment);
                const isSelected = activeSelectedKeys.includes(key);
                const dayName = new Date(assignment.startsAt).toLocaleDateString(i18n.language, { weekday: 'short' });
                const empName = accountName(assignment.employeeId, i18n.language) || assignment.employeeCode || assignment.employeeId;

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
                        <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                          <span>{localizeRowLabel(assignment.unitLabel, toSupportedLanguage(i18n.language))} · {localizeRowLabel(assignment.shiftLabel, toSupportedLanguage(i18n.language))}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            assignment.source === 'ot'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                              : 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                          }`}>
                            {assignment.source === 'ot' ? t('shiftRequests:wizard.otBadge') : t('shiftRequests:wizard.scheduleBadge')}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5 flex flex-wrap items-center gap-1">
                          <span>{assignment.timeRange} · {assignment.facilityLabel}</span>
                          {empName && <span className="font-semibold text-primary/80">· ({empName})</span>}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
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
                <strong>{t('shiftRequests:wizard.branchLabel')}:</strong> {requesterAssignment.facilityLabel} / {localizeRowLabel(requesterAssignment.unitLabel, toSupportedLanguage(i18n.language))}
              </div>
              <div className="text-text-secondary">
                <strong>{t('shiftRequests:wizard.shiftTypeLabel')}:</strong> {localizeRowLabel(requesterAssignment.shiftLabel, toSupportedLanguage(i18n.language))} ({requesterAssignment.timeRange})
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
                  <strong>{t('shiftRequests:wizard.branchLabel')}:</strong> {offeredAssignment.facilityLabel} / {localizeRowLabel(offeredAssignment.unitLabel, toSupportedLanguage(i18n.language))}
                </div>
                <div className="text-text-secondary">
                  <strong>{t('shiftRequests:wizard.shiftTypeLabel')}:</strong> {localizeRowLabel(offeredAssignment.shiftLabel, toSupportedLanguage(i18n.language))} ({offeredAssignment.timeRange})
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
