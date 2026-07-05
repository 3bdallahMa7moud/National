// ============================================================
// UnitShiftLabel — Frozen col 2: unit + shift + time
// ============================================================

import { memo } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface UnitShiftLabelProps {
  unitName: string;
  rowLabel?: string;
  shiftLabel: string;
  timeRange: string;
  isOverflowRow?: boolean;
  weekendOnly?: boolean;
  isEditable?: boolean;
  onEditRow?: (anchorRect: DOMRect) => void;
}

function UnitShiftLabel({
  unitName,
  rowLabel,
  shiftLabel,
  timeRange,
  isOverflowRow = false,
  weekendOnly = false,
  isEditable = false,
  onEditRow,
}: UnitShiftLabelProps) {
  const { t } = useTranslation(['schedule']);
  const primaryLabel = rowLabel || unitName;

  return (
    <div
      className={cn(
        'group/label relative flex flex-col justify-center px-2.5 py-1',
        'border-b border-e border-gray-300',
        isOverflowRow ? 'bg-slate-100/80' : 'bg-slate-50',
      )}
      style={{
        width: 'var(--matrix-label-col)',
        minWidth: 'var(--matrix-label-col)',
        height: 'var(--matrix-row-height)',
      }}
    >
      {isEditable && onEditRow && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEditRow(event.currentTarget.getBoundingClientRect());
          }}
          className={cn(
            'absolute top-1 end-1 flex h-6 w-6 items-center justify-center rounded-md',
            'border border-gray-300 bg-white text-slate-500 shadow-sm',
            'opacity-0 transition-opacity group-hover/label:opacity-100 focus:opacity-100',
            'hover:border-primary-teal hover:text-primary-teal',
          )}
          aria-label={t('schedule:rowEdit.editRow')}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <span dir="ltr" className="text-xs font-bold text-ink truncate leading-tight" style={{ unicodeBidi: 'isolate' }}>
        {primaryLabel}
      </span>
      <span dir="ltr" className="text-[11px] font-semibold text-primary-teal truncate leading-tight mt-0.5" style={{ unicodeBidi: 'isolate' }}>
        {shiftLabel}
      </span>
      <span dir="ltr" className="text-[10px] font-medium text-slate-500 truncate leading-tight" style={{ unicodeBidi: 'isolate' }}>
        {weekendOnly ? 'Fri/Sat · ' : ''}{timeRange}
      </span>
    </div>
  );
}

export default memo(UnitShiftLabel);
