import { type ReactNode } from 'react';
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
import { GripHorizontal, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { Facility, MatrixReorderCommand, MatrixReorderResult } from '@/types/scheduleMatrix';

type MatrixSortableData =
  | { kind: 'unit'; facilityId: string; unitId: string }
  | { kind: 'row'; facilityId: string; unitId: string; rowId: string };

const unitSortableId = (facilityId: string, unitId: string) => `matrix-unit:${facilityId}:${unitId}`;
const rowSortableId = (facilityId: string, unitId: string, rowId: string) => (
  `matrix-row:${facilityId}:${unitId}:${rowId}`
);

export function MatrixFacilityOrderContext({
  facility,
  enabled,
  onReorder,
  children,
}: {
  facility: Facility;
  enabled: boolean;
  onReorder?: (command: MatrixReorderCommand) => MatrixReorderResult;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!enabled || !over || active.id === over.id || !onReorder) return;
    const source = active.data.current as MatrixSortableData | undefined;
    const target = over.data.current as MatrixSortableData | undefined;
    if (!source || !target || source.facilityId !== target.facilityId) return;

    if (source.kind === 'unit') {
      const targetUnitId = target.unitId;
      if (source.unitId === targetUnitId) return;
      const sourceIndex = facility.units.findIndex((unit) => unit.id === source.unitId);
      const targetIndex = facility.units.findIndex((unit) => unit.id === targetUnitId);
      onReorder({
        kind: 'unit',
        facilityId: facility.id,
        sourceUnitId: source.unitId,
        targetUnitId,
        position: sourceIndex < targetIndex ? 'after' : 'before',
      });
      return;
    }

    if (target.kind === 'row') {
      const sourceUnit = facility.units.find((unit) => unit.id === source.unitId);
      const targetUnit = facility.units.find((unit) => unit.id === target.unitId);
      const sourceIndex = sourceUnit?.rows.findIndex((row) => row.id === source.rowId) ?? -1;
      const targetIndex = targetUnit?.rows.findIndex((row) => row.id === target.rowId) ?? -1;
      onReorder({
        kind: 'row',
        facilityId: facility.id,
        sourceUnitId: source.unitId,
        sourceRowId: source.rowId,
        targetUnitId: target.unitId,
        targetRowId: target.rowId,
        position: source.unitId === target.unitId && sourceIndex < targetIndex ? 'after' : 'before',
      });
      return;
    }

    onReorder({
      kind: 'row',
      facilityId: facility.id,
      sourceUnitId: source.unitId,
      sourceRowId: source.rowId,
      targetUnitId: target.unitId,
      position: 'after',
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={facility.units.map((unit) => unitSortableId(facility.id, unit.id))}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

function OrderHandle({
  kind,
  label,
  testId,
  setActivatorNodeRef,
  attributes,
  listeners,
}: {
  kind: 'unit' | 'row';
  label: string;
  testId: string;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
}) {
  const { t } = useTranslation('schedule');
  const translationKey = kind === 'unit' ? 'matrix.order.dragUnit' : 'matrix.order.dragRow';
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      data-testid={testId}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-md border border-primary/30',
        'bg-surface text-primary shadow-sm hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30 active:cursor-grabbing',
      )}
      title={t(translationKey, {
        label,
        defaultValue: kind === 'unit' ? `Drag unit ${label}` : `Drag shift ${label}`,
      })}
      aria-label={t(translationKey, {
        label,
        defaultValue: kind === 'unit' ? `Drag unit ${label}` : `Drag shift ${label}`,
      })}
      {...attributes}
      {...listeners}
    >
      {kind === 'unit'
        ? <GripHorizontal className="h-4 w-4" aria-hidden="true" />
        : <GripVertical className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

export function SortableMatrixUnit({
  facilityId,
  unitId,
  unitLabel,
  rowIds,
  enabled,
  children,
}: {
  facilityId: string;
  unitId: string;
  unitLabel: string;
  rowIds: string[];
  enabled: boolean;
  children: (unitHandle: ReactNode) => ReactNode;
}) {
  const sortable = useSortable({
    id: unitSortableId(facilityId, unitId),
    disabled: !enabled,
    data: { kind: 'unit', facilityId, unitId } satisfies MatrixSortableData,
  });
  const unitHandle = enabled ? (
    <OrderHandle
      kind="unit"
      label={unitLabel}
      testId={`matrix-order-handle-unit-${unitId}`}
      setActivatorNodeRef={sortable.setActivatorNodeRef}
      attributes={sortable.attributes}
      listeners={sortable.listeners}
    />
  ) : null;

  return (
    <div
      ref={sortable.setNodeRef}
      className={cn(
        'flex flex-col rounded-md transition-shadow',
        sortable.isDragging && 'relative z-30 opacity-80 shadow-xl',
        sortable.isOver && !sortable.isDragging && 'ring-2 ring-primary/25',
      )}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      data-order-unit-id={unitId}
    >
      <SortableContext
        items={rowIds.map((rowId) => rowSortableId(facilityId, unitId, rowId))}
        strategy={verticalListSortingStrategy}
      >
        {children(unitHandle)}
      </SortableContext>
    </div>
  );
}

export function SortableMatrixRow({
  facilityId,
  unitId,
  rowId,
  rowLabel,
  enabled,
  children,
}: {
  facilityId: string;
  unitId: string;
  rowId: string;
  rowLabel: string;
  enabled: boolean;
  children: (rowHandle: ReactNode) => ReactNode;
}) {
  const sortable = useSortable({
    id: rowSortableId(facilityId, unitId, rowId),
    disabled: !enabled,
    data: { kind: 'row', facilityId, unitId, rowId } satisfies MatrixSortableData,
  });
  const rowHandle = enabled ? (
    <OrderHandle
      kind="row"
      label={rowLabel}
      testId={`matrix-order-handle-row-${rowId}`}
      setActivatorNodeRef={sortable.setActivatorNodeRef}
      attributes={sortable.attributes}
      listeners={sortable.listeners}
    />
  ) : null;

  return (
    <div
      ref={sortable.setNodeRef}
      className={cn(
        'flex rounded-sm transition-shadow',
        sortable.isDragging && 'relative z-40 opacity-80 shadow-xl',
        sortable.isOver && !sortable.isDragging && 'ring-2 ring-primary/25',
      )}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      data-order-row-id={rowId}
    >
      {children(rowHandle)}
    </div>
  );
}
