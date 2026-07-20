import { useMemo, useState } from 'react';
import {
  ArchiveRestore,
  ClipboardPaste,
  Copy,
  FilePlus2,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export type MonthControlStatus = 'draft' | 'published';
export type MonthControlResult = { ok: boolean; message?: string };

export interface MonthTableClipboardSummary {
  sourceMonthLabel: string;
  assignmentCount: number;
}

interface AdminMonthControlProps {
  status: MonthControlStatus;
  monthLabel: string;
  assignmentCount: number;
  tableClipboard: MonthTableClipboardSummary | null;
  storageError?: string | null;
  onCopy(): MonthControlResult;
  onPaste(): MonthControlResult;
  onClear(): MonthControlResult;
  onReset(): MonthControlResult;
}

type ConfirmedAction = 'CLEAR' | 'RESET' | 'PASTE';

export default function AdminMonthControl(props: AdminMonthControlProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [confirmedAction, setConfirmedAction] = useState<ConfirmedAction | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState('');

  const statusLabel = useMemo(
    () => props.status === 'published'
      ? (isRtl ? 'منشور' : 'Published')
      : (isRtl ? 'مسودة' : 'Draft'),
    [props.status, isRtl],
  );

  const run = (action: () => MonthControlResult, fallbackSuccess: string) => {
    const result = action();
    setMessage(
      result.ok
        ? result.message || fallbackSuccess
        : result.message || (isRtl ? 'تعذر تنفيذ العملية' : 'The action could not be completed'),
    );
    return result.ok;
  };

  const openConfirmation = (action: ConfirmedAction) => {
    setConfirmedAction(action);
    setConfirmText('');
  };

  const closeConfirmation = () => {
    setConfirmedAction(null);
    setConfirmText('');
  };

  const confirmAction = () => {
    if (!confirmedAction || confirmText !== confirmedAction) return;
    const ok = confirmedAction === 'CLEAR'
      ? run(props.onClear, isRtl ? 'تم مسح التعيينات' : 'Assignments cleared')
      : confirmedAction === 'RESET'
        ? run(props.onReset, isRtl ? 'تمت إعادة الجدول للوضع الافتراضي' : 'Schedule reset to the default layout')
        : run(props.onPaste, isRtl ? 'تم لصق الجدول' : 'Table pasted');
    if (ok) closeConfirmation();
  };

  const confirmationDescription = confirmedAction === 'CLEAR'
    ? (isRtl
        ? 'سيتم مسح تعيينات الموظفين فقط مع الحفاظ على الوحدات والشفتات والإجازات.'
        : 'Only employee assignments will be cleared; units, shifts and vacations remain.')
    : confirmedAction === 'RESET'
      ? (isRtl
          ? 'سيتم استبدال هيكل الشهر بالترتيب الافتراضي ومسح التعيينات والإجازات.'
          : 'The month will return to the default layout; assignments and vacations will be cleared.')
      : (isRtl
          ? `سيتم استبدال جدول ${props.monthLabel} بالكامل بالجدول المنسوخ من ${props.tableClipboard?.sourceMonthLabel || ''}. سيتم استبدال الوحدات والشفتات والترتيب والألوان والتعيينات، مع إنشاء نسخة استعادة للجدول الحالي أولًا.`
          : `This will overwrite the entire ${props.monthLabel} table with the copied table from ${props.tableClipboard?.sourceMonthLabel || ''}. Units, shifts, order, colors and assignments will be replaced after creating a recovery version of the current table.`);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card" aria-label={isRtl ? 'إجراءات الشهر' : 'Month actions'}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm sm:text-base font-extrabold text-text-primary">{isRtl ? 'إجراءات الشهر' : 'Month actions'}</h2>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${props.status === 'published' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-text-secondary">
            {props.monthLabel} · {props.assignmentCount.toLocaleString()} {isRtl ? 'تعيين' : 'assignments'}
          </p>
          {props.tableClipboard && (
            <p className="mt-1 text-xs sm:text-sm font-semibold text-primary">
              {isRtl ? 'الجدول المنسوخ' : 'Copied table'}: {props.tableClipboard.sourceMonthLabel} · {props.tableClipboard.assignmentCount.toLocaleString()} {isRtl ? 'تعيين' : 'assignments'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 sm:flex-initial min-h-10"
            icon={<Copy className="h-4 w-4" />}
            onClick={() => run(props.onCopy, isRtl ? 'تم نسخ الجدول' : 'Table copied')}
          >
            <span className="text-xs sm:text-sm">{isRtl ? 'نسخ الجدول' : 'Copy Table'}</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 sm:flex-initial min-h-10"
            icon={<ClipboardPaste className="h-4 w-4" />}
            disabled={!props.tableClipboard}
            onClick={() => openConfirmation('PASTE')}
          >
            <span className="text-xs sm:text-sm">{isRtl ? 'لصق الجدول' : 'Paste Table'}</span>
          </Button>
          <Button size="sm" variant="secondary" className="flex-1 sm:flex-initial min-h-10" icon={<UsersRound className="h-4 w-4" />} onClick={() => openConfirmation('CLEAR')}>
            <span className="text-xs sm:text-sm">{isRtl ? 'مسح التعيينات' : 'Clear assignments'}</span>
          </Button>
          <Button size="sm" variant="secondary" className="flex-1 sm:flex-initial min-h-10" icon={<ArchiveRestore className="h-4 w-4" />} onClick={() => openConfirmation('RESET')}>
            <span className="text-xs sm:text-sm">{isRtl ? 'إعادة الجدول' : 'Reset table'}</span>
          </Button>
        </div>
      </div>

      {(message || props.storageError) && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${props.storageError ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`} aria-live="polite">
          {props.storageError || message}
        </p>
      )}

      <Modal
        isOpen={!!confirmedAction}
        onClose={closeConfirmation}
        title={confirmedAction === 'PASTE'
          ? (isRtl ? 'تأكيد لصق الجدول' : 'Confirm table paste')
          : (isRtl ? 'تأكيد إجراء حساس' : 'Confirm sensitive action')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{confirmationDescription}</p>
          {confirmedAction === 'PASTE' && props.tableClipboard ? (
            <div className="rounded-lg bg-surface-muted p-3 text-xs font-bold text-text-primary">
              <p>{isRtl ? 'المصدر' : 'Source'}: {props.tableClipboard.sourceMonthLabel}</p>
              <p className="mt-1">{isRtl ? 'الهدف' : 'Target'}: {props.monthLabel}</p>
              <p className="mt-1">{props.tableClipboard.assignmentCount.toLocaleString()} {isRtl ? 'تعيين سيتم نسخه' : 'assignments will be copied'}</p>
            </div>
          ) : (
            <p className="rounded-lg bg-surface-muted p-3 text-xs font-bold text-text-primary">
              {props.monthLabel} · {props.assignmentCount.toLocaleString()}
            </p>
          )}
          <label className="block text-xs font-semibold text-text-secondary">
            {isRtl ? `اكتب ${confirmedAction} للتأكيد` : `Type ${confirmedAction} to confirm`}
            <input
              className="input-field mt-2 min-h-11 font-mono"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value.toUpperCase())}
              autoFocus
              data-modal-autofocus
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeConfirmation}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant="danger" disabled={confirmText !== confirmedAction} icon={<FilePlus2 className="h-4 w-4" />} onClick={confirmAction}>
              {isRtl ? 'تنفيذ' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
