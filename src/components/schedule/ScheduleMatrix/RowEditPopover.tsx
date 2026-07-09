// ============================================================
// RowEditPopover — Edit row label / shift / time / type in the grid
// ============================================================

import { memo, useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { SHIFT_COLOR_KEYS } from '@/lib/shiftColorOptions';
import type { ShiftColorKey, ShiftRow } from '@/types/scheduleMatrix';

export interface RowEditTarget {
  row: ShiftRow;
  unitName: string;
  anchorRect: DOMRect;
}

interface RowEditPopoverProps {
  target: RowEditTarget | null;
  onClose: () => void;
  onSave: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly'>>,
  ) => void;
}

function RowEditPopover({ target, onClose, onSave }: RowEditPopoverProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [rowLabel, setRowLabel] = useState('');
  const [shiftLabel, setShiftLabel] = useState('');
  const [timeRange, setTimeRange] = useState('');
  const [colorKey, setColorKey] = useState<ShiftColorKey>('morning');
  const [weekendOnly, setWeekendOnly] = useState(false);

  useEffect(() => {
    if (!target) return;
    const { row, unitName } = target;
    setRowLabel(row.rowLabel || unitName);
    setShiftLabel(row.shiftLabel);
    setTimeRange(row.timeRange);
    setColorKey(row.colorKey);
    setWeekendOnly(row.weekendOnly);
  }, [target]);

  const handleSave = useCallback(() => {
    if (!target) return;
    onSave(target.row.id, {
      rowLabel: rowLabel.trim(),
      shiftLabel: shiftLabel.trim(),
      timeRange: timeRange.trim(),
      colorKey,
      weekendOnly,
    });
    onClose();
  }, [target, rowLabel, shiftLabel, timeRange, colorKey, weekendOnly, onSave, onClose]);

  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter') handleSave();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target, onClose, handleSave]);

  if (!target) return null;

  const top = Math.min(target.anchorRect.bottom + 8, window.innerHeight - 380);
  const left = Math.max(16, Math.min(target.anchorRect.left, window.innerWidth - 320));

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[240] cursor-default bg-transparent"
        aria-label={t('schedule:rowEdit.cancel')}
        onClick={onClose}
      />
      <div
        className="fixed z-[250] w-[300px] rounded-lg border border-border bg-surface p-3 shadow-2xl"
        style={{ top, left }}
        role="dialog"
        aria-label={t('schedule:rowEdit.title')}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">{t('schedule:rowEdit.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-hover"
            aria-label={t('schedule:rowEdit.cancel')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {t('schedule:rowEdit.rowLabel')}
            </span>
            <input
              value={rowLabel}
              onChange={(e) => setRowLabel(e.target.value)}
              className="h-8 w-full rounded-md border border-border px-2 text-xs font-semibold text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {t('schedule:rowEdit.shiftLabel')}
            </span>
            <input
              value={shiftLabel}
              onChange={(e) => setShiftLabel(e.target.value)}
              className="h-8 w-full rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {t('schedule:rowEdit.timeRange')}
            </span>
            <input
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              dir="ltr"
              className="h-8 w-full rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {t('schedule:rowEdit.shiftType')}
            </span>
            <select
              value={colorKey}
              onChange={(e) => setColorKey(e.target.value as ShiftColorKey)}
              className="h-8 w-full rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
            >
              {SHIFT_COLOR_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`schedule:shiftColors.${key}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={weekendOnly}
              onChange={(e) => setWeekendOnly(e.target.checked)}
              className="rounded border-border text-primary-teal focus:ring-primary-teal"
            />
            <span className="text-xs font-medium text-text-secondary">{t('schedule:rowEdit.weekendOnly')}</span>
          </label>
        </div>

        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-lg bg-primary-teal px-3 py-2 text-xs font-bold text-white hover:bg-primary-teal/90"
          >
            {t('schedule:rowEdit.save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-bold text-text-secondary hover:bg-hover',
            )}
          >
            {t('schedule:rowEdit.cancel')}
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(RowEditPopover);
