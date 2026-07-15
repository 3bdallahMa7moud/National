// ============================================================
// RowEditPopover — Edit row label / shift / time / type in the grid
// ============================================================

import { memo, useCallback, useEffect, useState } from 'react';
import { Archive, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getShiftChipStyle } from './getShiftChipClasses';
import { useTranslation } from 'react-i18next';
import type { ShiftDefinition, ShiftRow } from '@/types/scheduleMatrix';

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
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly' | 'shiftDefinitionId'>>,
  ) => void;
  shiftDefinitions?: ShiftDefinition[];
  onArchive?: (rowId: string) => void;
  onDelete?: (rowId: string) => void;
}

function RowEditPopover({ target, onClose, onSave, shiftDefinitions = [], onArchive, onDelete }: RowEditPopoverProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [rowLabel, setRowLabel] = useState('');
  const [shiftDefinitionId, setShiftDefinitionId] = useState('');
  const [weekendOnly, setWeekendOnly] = useState(false);

  useEffect(() => {
    if (!target) return;
    const { row, unitName } = target;
    setRowLabel(row.rowLabel || unitName);
    setShiftDefinitionId(row.shiftDefinitionId || '');
    setWeekendOnly(row.weekendOnly);
  }, [target]);

  const handleSave = useCallback(() => {
    if (!target) return;
    onSave(target.row.id, {
      rowLabel: rowLabel.trim(),
      shiftDefinitionId,
      weekendOnly,
    });
    onClose();
  }, [target, rowLabel, shiftDefinitionId, weekendOnly, onSave, onClose]);

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
  const selectedDefinition = shiftDefinitions.find((definition) => definition.id === shiftDefinitionId);

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
              {t('schedule:rowEdit.shiftType')}
            </span>
            <select
              value={shiftDefinitionId}
              onChange={(e) => setShiftDefinitionId(e.target.value)}
              className="h-8 w-full rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
            >
              {shiftDefinitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.englishName || definition.label} · {definition.timeRange}
                </option>
              ))}
            </select>
          </label>
          {selectedDefinition && (
            <div className="rounded-md border border-border bg-surface-muted px-2 py-2 text-[11px] text-text-secondary">
              <span
                className="me-2 inline-block h-3 w-3 rounded-full align-middle"
                style={getShiftChipStyle(
                  selectedDefinition.colorKey,
                  selectedDefinition.backgroundColor,
                  selectedDefinition.textColor,
                )}
              />
              <span
                className="rounded px-1.5 py-0.5 font-semibold"
                style={getShiftChipStyle(
                  selectedDefinition.colorKey,
                  selectedDefinition.backgroundColor,
                  selectedDefinition.textColor,
                )}
              >
                {selectedDefinition.englishName || selectedDefinition.label}
              </span>
              <span dir="ltr" className="ms-1" style={{ unicodeBidi: 'isolate' }}>{selectedDefinition.timeRange}</span>
            </div>
          )}
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
          {onArchive && (
            <button
              type="button"
              onClick={() => {
                onArchive(target.row.id);
                onClose();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-text-secondary hover:bg-hover"
              aria-label={t('schedule:settingsPanel.archive', 'Archive')}
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(target.row.id);
                onClose();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-50 text-danger hover:bg-danger hover:text-white"
              aria-label={t('common:actions.delete', 'Delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(RowEditPopover);
