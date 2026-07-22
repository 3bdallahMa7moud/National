// ============================================================
// UnitShiftLabel — Frozen col 2: unit + shift + time
// ============================================================

import { memo, type ReactNode } from 'react';
import { Archive, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';

interface UnitShiftLabelProps {
  unitName: string;
  rowLabel?: string;
  rowId?: string;
  shiftLabel: string;
  timeRange: string;
  isOverflowRow?: boolean;
  weekendOnly?: boolean;
  isEditable?: boolean;
  onEditRow?: (anchorRect: DOMRect) => void;
  onAddRow?: (anchorRect: DOMRect) => void;
  onArchiveRow?: () => void;
  onDeleteRow?: () => void;
  onManageUnit?: (anchorRect: DOMRect) => void;
  showUnitName?: boolean;
  expandedCellsView?: boolean;
  orderControls?: ReactNode;
  dragProps?: {
    setActivatorNodeRef: (node: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  } | null;
  onRowResizeStart?: (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
}

function UnitShiftLabel({
  unitName,
  rowLabel,
  rowId,
  shiftLabel,
  timeRange,
  isOverflowRow = false,
  weekendOnly = false,
  isEditable = false,
  onEditRow,
  onAddRow,
  onArchiveRow,
  onDeleteRow,
  onManageUnit,
  showUnitName = true,
  expandedCellsView = false,
  orderControls,
  dragProps,
  onRowResizeStart,
}: UnitShiftLabelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const primaryLabel = showUnitName ? unitName : (rowLabel || shiftLabel);

  return (
    <div
      ref={dragProps?.setActivatorNodeRef}
      {...(dragProps ? dragProps.attributes : {})}
      {...(dragProps ? dragProps.listeners : {})}
      data-testid={dragProps && rowId ? `matrix-order-handle-row-${rowId}` : undefined}
      aria-label={dragProps ? `Drag shift ${rowLabel || shiftLabel}` : undefined}
      className={cn(
        'group/label relative flex flex-col justify-center',
        'px-2.5 py-1 transition-all duration-150',
        orderControls ? 'ps-[46px]' : '',
        'border-b border-e border-border',
        isOverflowRow ? 'bg-surface-muted/80' : 'bg-surface-muted',
        dragProps && 'cursor-grab active:cursor-grabbing touch-none hover:bg-surface-muted/60'
      )}
      style={{
        width: 'var(--matrix-label-col)',
        minWidth: 'var(--matrix-label-col)',
        minHeight: 'var(--matrix-row-height)',
        height: expandedCellsView ? 'auto' : 'var(--matrix-row-height)',
      }}
    >
      {orderControls && (
        <div
          className="absolute start-1 top-1 z-30 flex items-center gap-1 rounded-lg bg-surface-muted/90 p-0.5 shadow-sm ring-1 ring-primary/15"
          data-testid="matrix-order-controls"
        >
          {orderControls}
        </div>
      )}
      {isEditable && (
        <div
          className={cn(
            'absolute top-1 end-1 z-20 flex items-center gap-0.5',
            'transition-opacity group-hover/label:opacity-100 focus-within:opacity-100',
            orderControls ? 'opacity-100' : 'opacity-0',
          )}
        >
          {onAddRow && showUnitName && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddRow(event.currentTarget.getBoundingClientRect());
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-sm hover:border-primary-teal hover:text-primary-teal"
              aria-label={t('schedule:matrix.addRow', 'Add row')}
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
          {onManageUnit && showUnitName && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onManageUnit(event.currentTarget.getBoundingClientRect());
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-sm hover:border-primary-teal hover:text-primary-teal"
              aria-label={t('schedule:matrix.unitActions', { defaultValue: 'Unit actions' })}
            >
              <Settings2 className="h-3 w-3" />
            </button>
          )}
          {onEditRow && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEditRow(event.currentTarget.getBoundingClientRect());
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-sm hover:border-primary-teal hover:text-primary-teal"
              aria-label={t('schedule:rowEdit.editRow', 'Edit row')}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onArchiveRow && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onArchiveRow();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface text-text-secondary shadow-sm hover:border-primary-teal hover:text-primary-teal"
              aria-label={t('schedule:settingsPanel.archive', 'Archive')}
            >
              <Archive className="h-3 w-3" />
            </button>
          )}
          {onDeleteRow && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteRow();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-danger/30 bg-surface text-danger shadow-sm hover:bg-danger hover:text-white"
              aria-label={t('common:actions.delete', 'Delete')}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <span dir="ltr" className="text-xs font-bold text-ink truncate leading-tight" style={{ unicodeBidi: 'isolate' }}>
        {primaryLabel}
      </span>
      {showUnitName && rowLabel && rowLabel !== unitName && (
        <span dir="ltr" className="text-[10px] font-semibold text-primary-teal truncate leading-tight" style={{ unicodeBidi: 'isolate' }}>
          {rowLabel}
        </span>
      )}
      <span dir="ltr" className="text-[10px] font-medium text-text-secondary truncate leading-tight" style={{ unicodeBidi: 'isolate' }}>
        {showUnitName ? `${shiftLabel} · ` : ''}{weekendOnly ? 'Fri/Sat · ' : ''}{timeRange}
      </span>

      {/* Row Height Resizer */}
      {onRowResizeStart && (
        <div
          className="absolute bottom-[-3px] start-0 end-0 h-[6px] z-30 cursor-row-resize touch-none opacity-0 group-hover/label:opacity-100 hover:bg-primary-teal/50 transition-opacity"
          onMouseDown={onRowResizeStart}
          onTouchStart={onRowResizeStart}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default memo(UnitShiftLabel);
