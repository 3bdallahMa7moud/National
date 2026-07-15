import { useMemo } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, MoveRight, Plus, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ManualOrderRow {
  id: string;
  label: string;
  meta?: string;
  color?: string;
}

export interface ManualOrderUnit {
  id: string;
  label: string;
  rows: ManualOrderRow[];
}

interface ManualTableOrderProps {
  units: ManualOrderUnit[];
  onReorderUnit(sourceUnitId: string, targetUnitId: string, position: 'before' | 'after'): void;
  onReorderRow(
    sourceRowId: string,
    sourceUnitId: string,
    targetUnitId: string,
    targetRowId?: string,
    position?: 'before' | 'after',
  ): void;
  onAddRow?: (unitId: string, anchorRect: DOMRect) => void;
  onManageUnit?: (unitId: string, anchorRect: DOMRect) => void;
}

type SortableData =
  | { kind: 'unit'; unitId: string }
  | { kind: 'row'; rowId: string; unitId: string };

const unitSortableId = (unitId: string) => `manual-unit:${unitId}`;
const rowSortableId = (unitId: string, rowId: string) => `manual-row:${unitId}:${rowId}`;

function SortableRowCard({
  row,
  unit,
  units,
  rowIndex,
  onReorderRow,
}: {
  row: ManualOrderRow;
  unit: ManualOrderUnit;
  units: ManualOrderUnit[];
  rowIndex: number;
  onReorderRow: ManualTableOrderProps['onReorderRow'];
}) {
  const { t } = useTranslation('schedule');
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: rowSortableId(unit.id, row.id),
    data: { kind: 'row', rowId: row.id, unitId: unit.id } satisfies SortableData,
  });

  return (
    <div
      ref={setNodeRef}
      data-order-row-id={row.id}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 transition-shadow',
        isDragging ? 'z-20 border-primary shadow-lg opacity-75' : 'border-border',
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 shrink-0 touch-none items-center justify-center rounded-md text-text-muted hover:bg-hover active:cursor-grabbing"
        aria-label={t('matrix.order.dragRow', { label: row.label, defaultValue: `Drag shift ${row.label}` })}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: row.color || 'rgb(var(--color-primary))' }}
        aria-hidden="true"
      />
      <div className="min-w-36 flex-1">
        <p className="truncate text-xs font-bold text-text-primary">{row.label}</p>
        {row.meta && <p className="truncate text-[11px] text-text-secondary" dir="ltr">{row.meta}</p>}
      </div>
      <select
        className="input-field min-h-11 w-36 py-1 text-xs"
        value={unit.id}
        aria-label={t('matrix.order.moveRowToUnit', { label: row.label, defaultValue: `Move ${row.label} to unit` })}
        onChange={(event) => onReorderRow(row.id, unit.id, event.target.value)}
      >
        {units.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
      </select>
      <MoveRight className="h-3.5 w-3.5 text-text-muted rtl:rotate-180" aria-hidden="true" />
      <Button
        size="sm"
        variant="ghost"
        disabled={rowIndex === 0}
        aria-label={t('matrix.order.moveRowUp', { label: row.label, defaultValue: `Move ${row.label} up` })}
        onClick={() => onReorderRow(row.id, unit.id, unit.id, unit.rows[rowIndex - 1].id, 'before')}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={rowIndex === unit.rows.length - 1}
        aria-label={t('matrix.order.moveRowDown', { label: row.label, defaultValue: `Move ${row.label} down` })}
        onClick={() => onReorderRow(row.id, unit.id, unit.id, unit.rows[rowIndex + 1].id, 'after')}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SortableUnitCard({
  unit,
  unitIndex,
  units,
  onReorderUnit,
  onReorderRow,
  onAddRow,
  onManageUnit,
}: {
  unit: ManualOrderUnit;
  unitIndex: number;
  units: ManualOrderUnit[];
  onReorderUnit: ManualTableOrderProps['onReorderUnit'];
  onReorderRow: ManualTableOrderProps['onReorderRow'];
  onAddRow?: ManualTableOrderProps['onAddRow'];
  onManageUnit?: ManualTableOrderProps['onManageUnit'];
}) {
  const { t } = useTranslation('schedule');
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: unitSortableId(unit.id),
    data: { kind: 'unit', unitId: unit.id } satisfies SortableData,
  });

  return (
    <article
      ref={setNodeRef}
      data-order-unit-id={unit.id}
      className={cn(
        'overflow-hidden rounded-xl border bg-surface transition-shadow',
        isDragging ? 'z-10 border-primary shadow-xl opacity-75' : 'border-border',
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-3 py-2.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 touch-none items-center justify-center rounded-md text-text-muted hover:bg-hover active:cursor-grabbing"
          aria-label={t('matrix.order.dragUnit', { label: unit.label, defaultValue: `Drag unit ${unit.label}` })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-extrabold text-primary">{unitIndex + 1}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-text-primary">{unit.label}</span>
        {onManageUnit && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('matrix.unitActions', { defaultValue: `Manage ${unit.label}` })}
            onClick={(event) => onManageUnit(unit.id, event.currentTarget.getBoundingClientRect())}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={unitIndex === 0}
          aria-label={t('matrix.order.moveUnitUp', { label: unit.label, defaultValue: `Move ${unit.label} up` })}
          onClick={() => onReorderUnit(unit.id, units[unitIndex - 1].id, 'before')}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={unitIndex === units.length - 1}
          aria-label={t('matrix.order.moveUnitDown', { label: unit.label, defaultValue: `Move ${unit.label} down` })}
          onClick={() => onReorderUnit(unit.id, units[unitIndex + 1].id, 'after')}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext
        items={unit.rows.map((row) => rowSortableId(unit.id, row.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 p-3">
          {unit.rows.map((row, rowIndex) => (
            <SortableRowCard
              key={row.id}
              row={row}
              unit={unit}
              units={units}
              rowIndex={rowIndex}
              onReorderRow={onReorderRow}
            />
          ))}
          {unit.rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-secondary">
              {t('matrix.order.emptyUnit', { defaultValue: 'Drag a shift here or choose this unit from the move list.' })}
            </p>
          )}
          {onAddRow && (
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 text-xs font-bold text-primary hover:bg-primary/5"
              onClick={(event) => onAddRow(unit.id, event.currentTarget.getBoundingClientRect())}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('matrix.addRow', { defaultValue: 'Add row' })}
            </button>
          )}
        </div>
      </SortableContext>
    </article>
  );
}

export default function ManualTableOrder({ units, onReorderUnit, onReorderRow, onAddRow, onManageUnit }: ManualTableOrderProps) {
  const { t } = useTranslation('schedule');
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const itemIds = useMemo(() => units.map((unit) => unitSortableId(unit.id)), [units]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const source = active.data.current as SortableData | undefined;
    const target = over.data.current as SortableData | undefined;
    if (!source || !target) return;

    if (source.kind === 'unit') {
      const targetUnitId = target.unitId;
      if (source.unitId === targetUnitId) return;
      const sourceIndex = units.findIndex((unit) => unit.id === source.unitId);
      const targetIndex = units.findIndex((unit) => unit.id === targetUnitId);
      onReorderUnit(source.unitId, targetUnitId, sourceIndex < targetIndex ? 'after' : 'before');
      return;
    }

    if (target.kind === 'row') {
      const sourceUnit = units.find((unit) => unit.id === source.unitId);
      const targetUnit = units.find((unit) => unit.id === target.unitId);
      const sourceIndex = sourceUnit?.rows.findIndex((row) => row.id === source.rowId) ?? -1;
      const targetIndex = targetUnit?.rows.findIndex((row) => row.id === target.rowId) ?? -1;
      const position = source.unitId === target.unitId && sourceIndex < targetIndex ? 'after' : 'before';
      onReorderRow(source.rowId, source.unitId, target.unitId, target.rowId, position);
      return;
    }

    onReorderRow(source.rowId, source.unitId, target.unitId, undefined, 'after');
  };

  if (units.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-secondary">
        {t('matrix.order.noUnits', { defaultValue: 'There are no units to order.' })}
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {units.map((unit, unitIndex) => (
            <SortableUnitCard
              key={unit.id}
              unit={unit}
              unitIndex={unitIndex}
              units={units}
              onReorderUnit={onReorderUnit}
              onReorderRow={onReorderRow}
              onAddRow={onAddRow}
              onManageUnit={onManageUnit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
