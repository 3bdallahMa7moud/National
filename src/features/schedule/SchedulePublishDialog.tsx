import { AlertTriangle, CalendarDays, Tag, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface SchedulePublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: () => void;
  onReviewConflicts: () => void;
  monthLabel: string;
  year: number;
  departmentLabel: string;
  markerCount: number;
  draftChangeCount: number;
  conflictCount: number;
}

export default function SchedulePublishDialog({
  isOpen,
  onClose,
  onPublish,
  onReviewConflicts,
  monthLabel,
  year,
  departmentLabel,
  markerCount,
  draftChangeCount,
  conflictCount,
}: SchedulePublishDialogProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const hasConflicts = conflictCount > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('schedule:publishDialog.title')}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-secondary">
          {t('schedule:publishDialog.description')}
        </p>

        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <dt className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <CalendarDays className="h-4 w-4 text-primary-teal" aria-hidden="true" />
              {t('schedule:publishDialog.month')}
            </dt>
            <dd className="mt-1 text-sm font-bold text-text-primary">{monthLabel} {year}</dd>
          </div>
          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <dt className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <UsersRound className="h-4 w-4 text-primary-teal" aria-hidden="true" />
              {t('schedule:publishDialog.department')}
            </dt>
            <dd className="mt-1 text-sm font-bold text-text-primary">{departmentLabel}</dd>
          </div>
          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <dt className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <Tag className="h-4 w-4 text-primary-teal" aria-hidden="true" />
              {t('schedule:publishDialog.markers')}
            </dt>
            <dd className="mt-1 text-sm font-bold text-text-primary">{markerCount}</dd>
          </div>
          <div className="rounded-lg border border-border bg-surface-muted p-3">
            <dt className="text-xs font-semibold text-text-secondary">
              {t('schedule:publishDialog.conflicts')}
            </dt>
            <dd className="mt-1 text-sm font-bold text-text-primary">{conflictCount}</dd>
          </div>
          {draftChangeCount > 0 && (
            <div className="rounded-lg border border-border bg-surface-muted p-3 sm:col-span-2">
              <dt className="text-xs font-semibold text-text-secondary">
                {t('schedule:publishDialog.draftChanges')}
              </dt>
              <dd className="mt-1 text-sm font-bold text-text-primary">{draftChangeCount}</dd>
            </div>
          )}
        </dl>

        {hasConflicts && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-text-primary">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">{t('schedule:publishDialog.conflictWarningTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                {t('schedule:publishDialog.conflictWarning', { count: conflictCount })}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          {hasConflicts && (
            <Button variant="secondary" size="sm" onClick={onReviewConflicts}>
              {t('schedule:publishDialog.reviewConflicts')}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onPublish} data-modal-autofocus>
            {hasConflicts
              ? t('schedule:publishDialog.publishAnyway')
              : t('schedule:toolbar.publishToEmployees')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
