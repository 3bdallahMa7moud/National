// ============================================================
// ScheduleMatrix — Root grid component
// ============================================================
// Presentation-only. No fetch, no socket. Props + callbacks.
// dir="rtl" shell with CSS Grid, frozen columns, scroll container.

import { memo, useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { ListOrdered, Maximize2, Minimize2, Plus, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import DayHeaderRow from './DayHeaderRow';
import FacilityBand from './FacilityBand';
import UnitShiftLabel from './UnitShiftLabel';
import ShiftRowCells from './ShiftRowCells';
import LegendPanel from './LegendPanel';
import VacationBand from './VacationBand';
import RowEditPopover, { type RowEditTarget } from './RowEditPopover';
import UnitManagementPopover, { type UnitManagementTarget } from './UnitManagementPopover';
import MobileWeeklySchedule from './MobileWeeklySchedule';
import ManualTableOrder from '@/components/common/ManualTableOrder';
import { getShiftChipStyle } from './getShiftChipClasses';
import {
  MatrixFacilityOrderContext,
  SortableMatrixRow,
  SortableMatrixUnit,
} from './MatrixOrderDnd';
import type { CellInteractionMeta } from './ShiftRowCells';
import type {
  ScheduleMatrixData,
  MatrixCellRef,
  Assignment,
  MatrixAdminMode,
  MatrixReorderCommand,
  MatrixReorderResult,
  ShiftRow,
  ShiftDefinition,
} from '@/types/scheduleMatrix';

export interface ScheduleMatrixProps {
  data: ScheduleMatrixData;
  /** Hard employee-facing mode that suppresses every admin/edit/audit interaction. */
  readOnly?: boolean;
  editable?: boolean;
  adminMode?: MatrixAdminMode;
  highlightedEmployeeId?: string | null;
  selectedCells?: MatrixCellRef[];
  brushEmployeeCodes?: string[];
  isExpanded?: boolean;
  zoomLevel?: number;
  onCellClick?: (ref: MatrixCellRef, meta?: CellInteractionMeta) => void;
  onChipClick?: (ref: MatrixCellRef, assignment: Assignment, meta?: CellInteractionMeta) => void;
  onCellContextMenu?: (ref: MatrixCellRef, position: { x: number; y: number }) => void;
  onRangeSelect?: (start: MatrixCellRef, end: MatrixCellRef) => void;
  onDragFill?: (source: MatrixCellRef, target: MatrixCellRef) => void;
  onVacationToggle?: (employeeId: string, day: number) => void;
  onLegendEmployeeClick?: (employeeId: string) => void;
  onLegendEmployeeDetailsClick?: (employeeId: string, employeeName: string) => void;
  onUpdateRow?: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly' | 'shiftDefinitionId'>>,
  ) => void;
  onAddRow?: (facilityId: string, unitId: string, shiftDefinitionId: string, rowLabel: string) => void;
  onArchiveRow?: (rowId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  onAddUnit?: (facilityId: string, name: string) => void;
  onRenameUnit?: (facilityId: string, unitId: string, name: string) => void;
  onArchiveUnit?: (facilityId: string, unitId: string) => void;
  onDeleteUnit?: (facilityId: string, unitId: string) => void;
  onReorder?: (command: MatrixReorderCommand) => MatrixReorderResult;
  expandedCellsView?: boolean;
  onToggleExpandedCellsView?: () => void;
  colorblindMode?: boolean;
}

function MobileMatrixOrder({
  data,
  onReorder,
  onAddRow,
  onManageUnit,
}: {
  data: ScheduleMatrixData;
  onReorder: (command: MatrixReorderCommand) => MatrixReorderResult;
  onAddRow?: (facilityId: string, unitId: string, anchorRect: DOMRect) => void;
  onManageUnit?: (facilityId: string, unitId: string | undefined, anchorRect: DOMRect) => void;
}) {
  const { t } = useTranslation('schedule');
  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-3 shadow-card" data-testid="mobile-matrix-order">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-text-primary">
          <ListOrdered className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('matrix.order.title', { defaultValue: 'Arrange table' })}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {t('matrix.order.touchHint', { defaultValue: 'Press and hold a handle, then move the unit or shift.' })}
        </p>
      </div>
      {data.facilities.map((facility) => {
        const units = facility.units
          .filter((unit) => !unit.archived)
          .map((unit) => ({
            id: unit.id,
            label: unit.name,
            rows: unit.rows.filter((row) => !row.archived).map((row) => ({
              id: row.id,
              label: row.rowLabel || row.shiftLabel,
              meta: `${row.shiftLabel} · ${row.timeRange}`,
              color: getShiftChipStyle(row.colorKey, row.backgroundColor, row.textColor).backgroundColor,
            })),
          }));
        if (units.length === 0) {
          return (
            <div key={facility.id} className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-text-secondary">{facility.name}</h3>
              {onManageUnit ? (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 text-xs font-bold text-primary hover:bg-primary/5"
                  onClick={(event) => onManageUnit(facility.id, undefined, event.currentTarget.getBoundingClientRect())}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('matrix.addFirstUnit', { defaultValue: 'Add first unit/room' })}
                </button>
              ) : (
                <p className="text-xs text-text-secondary">
                  {t('matrix.order.noUnits', { defaultValue: 'There are no units to order.' })}
                </p>
              )}
            </div>
          );
        }
        return (
          <div key={facility.id} className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-text-secondary">{facility.name}</h3>
            <ManualTableOrder
              units={units}
              onReorderUnit={(sourceUnitId, targetUnitId, position) => {
                onReorder({ kind: 'unit', facilityId: facility.id, sourceUnitId, targetUnitId, position });
              }}
              onReorderRow={(sourceRowId, sourceUnitId, targetUnitId, targetRowId, position = 'after') => {
                onReorder({
                  kind: 'row',
                  facilityId: facility.id,
                  sourceUnitId,
                  sourceRowId,
                  targetUnitId,
                  targetRowId,
                  position,
                });
              }}
              onAddRow={onAddRow ? (unitId, anchorRect) => onAddRow(facility.id, unitId, anchorRect) : undefined}
              onManageUnit={onManageUnit ? (unitId, anchorRect) => onManageUnit(facility.id, unitId, anchorRect) : undefined}
            />
          </div>
        );
      })}
    </section>
  );
}

function ScheduleMatrix({
  data,
  readOnly = false,
  editable = false,
  adminMode = 'view',
  highlightedEmployeeId = null,
  selectedCells = [],
  brushEmployeeCodes = [],
  isExpanded = false,
  zoomLevel = 1,
  onCellClick,
  onChipClick,
  onCellContextMenu,
  onRangeSelect,
  onDragFill,
  onVacationToggle,
  onLegendEmployeeClick,
  onLegendEmployeeDetailsClick,
  onUpdateRow,
  onAddRow,
  onArchiveRow,
  onDeleteRow,
  onAddUnit,
  onRenameUnit,
  onArchiveUnit,
  onDeleteUnit,
  onReorder,
  expandedCellsView = false,
  onToggleExpandedCellsView,
  colorblindMode = false,
}: ScheduleMatrixProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [rowEditTarget, setRowEditTarget] = useState<RowEditTarget | null>(null);
  const [unitManagementTarget, setUnitManagementTarget] = useState<UnitManagementTarget | null>(null);
  const [rowAddTarget, setRowAddTarget] = useState<{
    facilityId: string;
    unitId: string;
    unitName: string;
    anchorRect: DOMRect;
    definitions: ShiftDefinition[];
  } | null>(null);
  const [newRowLabel, setNewRowLabel] = useState('');
  const [newRowShiftDefinitionId, setNewRowShiftDefinitionId] = useState('');
  const [dayColWidth, setDayColWidth] = useState(56);
  const [labelColWidth, setLabelColWidth] = useState(190);
  const [facilityColWidth, setFacilityColWidth] = useState(40);
  const [baseRowHeight, setBaseRowHeight] = useState(54);
  
  const currentRowHeight = expandedCellsView ? Math.max(baseRowHeight, 84) : baseRowHeight;

  const daysInMonth = useMemo(() => {
    return new Date(data.year, data.month + 1, 0).getDate();
  }, [data.year, data.month]);

  const createHorizontalResizer = useCallback((
    startWidth: number,
    cssVar: string,
    min: number,
    max: number,
    onComplete: (w: number) => void
  ) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const isRTL = document.documentElement.dir === 'rtl';

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const deltaX = currentX - startX;
      const newWidth = Math.max(min, Math.min(max, startWidth + (isRTL ? -deltaX : deltaX)));
      if (scrollRef.current) scrollRef.current.style.setProperty(cssVar, `${newWidth}px`);
    };

    const handleMouseUp = (upEvent: MouseEvent | TouchEvent) => {
      cleanup();
      const currentX = 'changedTouches' in upEvent ? upEvent.changedTouches[0].clientX : (upEvent as MouseEvent).clientX;
      const deltaX = currentX - startX;
      const finalWidth = Math.max(min, Math.min(max, startWidth + (isRTL ? -deltaX : deltaX)));
      onComplete(finalWidth);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);
  }, []);

  const handleColumnResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    createHorizontalResizer(dayColWidth, '--matrix-day-col', 40, 300, setDayColWidth)(e);
  }, [dayColWidth, createHorizontalResizer]);

  const handleLabelColResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    createHorizontalResizer(labelColWidth, '--matrix-label-col', 100, 400, setLabelColWidth)(e);
  }, [labelColWidth, createHorizontalResizer]);

  const handleFacilityColResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    createHorizontalResizer(facilityColWidth, '--matrix-facility-col', 30, 150, setFacilityColWidth)(e);
  }, [facilityColWidth, createHorizontalResizer]);

  const handleRowResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const startHeight = baseRowHeight;
    let animationFrameId: number;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
      const deltaY = currentY - startY;
      const newHeight = Math.max(40, Math.min(200, startHeight + deltaY));
      
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setBaseRowHeight(newHeight);
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);
  }, [baseRowHeight]);


  // Track scroll state for edge-fade
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      // In RTL, scrollLeft is negative in some browsers
      const scrollPos = Math.abs(el.scrollLeft);
      setIsScrolled(scrollPos > 10);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // Build code → id map for legend
  const codeToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of data.legend) {
      map.set(employee.code, employee.employeeId);
    }
    for (const f of data.facilities) {
      for (const u of f.units) {
        for (const r of u.rows) {
          for (const day of Object.keys(r.cellsByDay)) {
            for (const a of r.cellsByDay[Number(day)]) {
              map.set(a.employeeCode, a.employeeId);
            }
          }
        }
      }
    }
    return map;
  }, [data]);

  // Count total rows per facility (for FacilityBand rowspan)
  const facilityRowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const facility of data.facilities) {
      const totalRows = facility.units.filter((unit) => !unit.archived).reduce(
        (sum, unit) => sum + Math.max(1, unit.rows.filter((row) => !row.archived).length),
        0,
      );
      counts.set(facility.id, Math.max(1, totalRows));
    }
    return counts;
  }, [data.facilities]);

  const isEditable = !readOnly && (editable || adminMode === 'edit');
  const isOrderMode = !readOnly && adminMode === 'order';
  const canEditRows = (isEditable || isOrderMode) && !!onUpdateRow;
  const canManageUnits = (isEditable || isOrderMode) && !!onAddUnit;
  const isBrushMode = !readOnly && adminMode === 'brush';
  const isVacationMode = !readOnly && adminMode === 'vacations';

  // Flatten facilities/units/rows into a 1D item array for virtualizer
  const flatRows = useMemo(() => {
    if (isOrderMode && !!onReorder) return [];
    const items: Array<{
      kind: 'row' | 'empty-unit' | 'empty-facility';
      facility: ScheduleMatrixData['facilities'][number];
      unit?: ScheduleMatrixData['facilities'][number]['units'][number];
      row?: ShiftRow;
      rowPosition?: number;
      globalRowIndex?: number;
      isFirstUnitRow?: boolean;
      isFirstFacilityRow?: boolean;
      totalFacilityRows?: number;
    }> = [];

    let globalIdx = 0;
    for (const facility of data.facilities) {
      const visibleUnits = facility.units.filter((u) => !u.archived);
      const totalFacilityRows = facilityRowCounts.get(facility.id) || 1;
      let isFirstInFacility = true;

      if (visibleUnits.length === 0) {
        items.push({
          kind: 'empty-facility',
          facility,
          isFirstFacilityRow: true,
          totalFacilityRows: 1,
        });
        continue;
      }

      for (const unit of visibleUnits) {
        const activeRows = unit.rows.filter((r) => !r.archived);
        if (activeRows.length === 0) {
          items.push({
            kind: 'empty-unit',
            facility,
            unit,
            isFirstFacilityRow: isFirstInFacility,
            isFirstUnitRow: true,
            totalFacilityRows,
          });
          isFirstInFacility = false;
          continue;
        }

        for (let pos = 0; pos < activeRows.length; pos++) {
          const row = activeRows[pos];
          items.push({
            kind: 'row',
            facility,
            unit,
            row,
            rowPosition: pos,
            globalRowIndex: globalIdx++,
            isFirstFacilityRow: isFirstInFacility,
            isFirstUnitRow: pos === 0,
            totalFacilityRows,
          });
          isFirstInFacility = false;
        }
      }
    }
    return items;
  }, [data.facilities, facilityRowCounts, isOrderMode, onReorder]);

  const isTestEnv = Boolean(import.meta.env && (import.meta.env.TEST || import.meta.env.MODE === 'test'));
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => currentRowHeight,
    overscan: isTestEnv ? Math.max(8, flatRows.length) : 8,
    initialRect: { width: 1200, height: 2400 },
  });

  const virtualItems = isTestEnv
    ? flatRows.map((_, index) => ({ index, start: 0, size: currentRowHeight, end: currentRowHeight, key: index }))
    : rowVirtualizer.getVirtualItems();
  const totalSize = isTestEnv ? flatRows.length * currentRowHeight : rowVirtualizer.getTotalSize();

  const handleCellClick = useCallback(
    (ref: MatrixCellRef, meta?: CellInteractionMeta) => onCellClick?.(ref, meta),
    [onCellClick],
  );

  const handleChipClick = useCallback(
    (ref: MatrixCellRef, assignment: Assignment, meta?: CellInteractionMeta) => onChipClick?.(ref, assignment, meta),
    [onChipClick],
  );

  const handleVacationToggle = useCallback(
    (employeeId: string, day: number) => onVacationToggle?.(employeeId, day),
    [onVacationToggle],
  );

  const handleLegendClick = useCallback(
    (employeeId: string) => onLegendEmployeeClick?.(employeeId),
    [onLegendEmployeeClick],
  );

  const openAddRow = useCallback((
    facilityId: string,
    unitId: string,
    unitName: string,
    anchorRect: DOMRect,
  ) => {
    const definitions = data.settings
      .find((entry) => entry.facilityId === facilityId)
      ?.shiftDefinitions.filter((definition) => !definition.archived) ?? [];
    setRowAddTarget({ facilityId, unitId, unitName, anchorRect, definitions });
    setNewRowLabel('');
    setNewRowShiftDefinitionId(definitions[0]?.id || '');
  }, [data.settings]);

  const openManageUnit = useCallback((
    facilityId: string,
    unitId: string | undefined,
    anchorRect: DOMRect,
  ) => {
    const facility = data.facilities.find((candidate) => candidate.id === facilityId);
    if (!facility) return;
    const unit = unitId ? facility.units.find((candidate) => candidate.id === unitId) : undefined;
    const assignmentCount = unit?.rows.reduce((unitTotal, row) => unitTotal
      + Object.values(row.cellsByDay).reduce((rowTotal, assignments) => rowTotal + assignments.length, 0), 0) ?? 0;
    setUnitManagementTarget({
      facilityId,
      facilityName: facility.name,
      unitId: unit?.id,
      unitName: unit?.name,
      assignmentCount,
      anchorRect,
    });
  }, [data.facilities]);

  let rowIndex = 0;

  return (
    <>
      <div className="md:hidden">
        {isOrderMode && onReorder ? (
          <MobileMatrixOrder
            data={data}
            onReorder={onReorder}
            onAddRow={onAddRow ? (facilityId, unitId, anchorRect) => {
              const unit = data.facilities
                .find((facility) => facility.id === facilityId)
                ?.units.find((candidate) => candidate.id === unitId);
              if (unit) openAddRow(facilityId, unitId, unit.name, anchorRect);
            } : undefined}
            onManageUnit={canManageUnits ? (facilityId, unitId, anchorRect) => openManageUnit(facilityId, unitId, anchorRect) : undefined}
          />
        ) : (
          <MobileWeeklySchedule
            data={data}
            onCellClick={readOnly ? undefined : handleCellClick}
            onAssignmentClick={readOnly && onChipClick
              ? (ref, assignment) => handleChipClick(ref, assignment, { hasAssignments: true })
              : undefined}
          />
        )}
      </div>
      <div
        className="hidden gap-3 items-start md:flex"
        data-testid="desktop-schedule-matrix"
      >
      {/* ── Main Grid ── */}
      <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
        {isOrderMode && !!onReorder && (
          <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary">
            <ListOrdered className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('schedule:matrix.order.mouseHint', { defaultValue: 'Drag the right-side handle for any unit or shift with the mouse. The new order is saved automatically.' })}</span>
          </div>
        )}
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className={cn(
            'matrix-scroll-container overflow-auto',
            isScrolled && 'is-scrolled',
          )}
          style={{ 
            maxHeight: isExpanded ? 'calc(100vh - 160px)' : 'calc(100vh - 260px)',
            '--matrix-day-col': `${dayColWidth}px`,
            '--matrix-label-col': `${labelColWidth}px`,
            '--matrix-facility-col': `${facilityColWidth}px`,
            '--matrix-row-height': `${currentRowHeight}px`
          } as React.CSSProperties}
          role="grid"
          aria-label={t('schedule:matrix.gridAriaLabel')}
        >
          {/* Inner sizing wrapper */}
          <div style={{ minWidth: `calc(var(--matrix-facility-col) + var(--matrix-label-col) + var(--matrix-day-col) * ${daysInMonth})`, zoom: zoomLevel }}>
            {/* ── Sticky Header Row ── */}
            <div
              className="flex sticky top-0 z-20"
              role="row"
            >
              {/* Corner: facility col placeholder */}
              <div
                className="shrink-0 sticky z-30 bg-surface-muted border-b border-e border-border group"
                style={{
                  width: 'var(--matrix-facility-col)',
                  minWidth: 'var(--matrix-facility-col)',
                  height: 'var(--matrix-header-height)',
                  insetInlineStart: 0,
                }}
              >
                {/* Horizontal Resizer for Facility Col */}
                <div 
                   className="absolute top-0 bottom-0 end-[-3px] w-[6px] z-20 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 hover:bg-primary-teal/50 transition-opacity"
                   onMouseDown={handleFacilityColResizeStart}
                   onTouchStart={handleFacilityColResizeStart}
                />
              </div>
              {/* Corner: label col placeholder */}
              <div
                className="shrink-0 sticky z-30 bg-surface-muted border-b border-e border-border flex items-center justify-between px-2 gap-1.5 group relative"
                style={{
                  width: 'var(--matrix-label-col)',
                  minWidth: 'var(--matrix-label-col)',
                  height: 'var(--matrix-header-height)',
                  insetInlineStart: 'var(--matrix-facility-col)',
                }}
              >
                <span className="text-[10px] font-bold text-text-secondary truncate">
                  {t('schedule:matrix.unitShiftLabel')}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {!readOnly && onToggleExpandedCellsView && (
                    <button
                      type="button"
                      onClick={onToggleExpandedCellsView}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded border transition-colors',
                        expandedCellsView
                          ? 'border-primary-teal bg-primary-teal/15 text-primary-teal'
                          : 'border-border bg-surface text-text-secondary hover:bg-hover'
                      )}
                      title={expandedCellsView ? 'Collapse Cells' : 'Expand Cells Mode'}
                    >
                      {expandedCellsView ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
              {/* Day numbers */}
              <DayHeaderRow
                daysInMonth={daysInMonth}
                year={data.year}
                month={data.month}
                holidays={data.holidays}
                onResizeStart={handleColumnResizeStart}
              />
            </div>

            {/* ── Facility Rows ── */}
            {isOrderMode && !!onReorder ? (
              /* Reorder Mode: Full hierarchical rendering for precise @dnd-kit drag and drop */
              data.facilities.map((facility) => {
              const rowCount = facilityRowCounts.get(facility.id) || 1;
              const visibleUnits = facility.units.filter((unit) => !unit.archived);
              return (
                <div key={facility.id} className="flex">
                  {/* Frozen col 1: facility band */}
                  <div
                    className="shrink-0 sticky z-10"
                    style={{ insetInlineStart: 0 }}
                  >
                    <FacilityBand
                      name={facility.name}
                      accentColorToken={facility.accentColorToken}
                      rowCount={rowCount}
                    />
                  </div>

                  {/* Rows within facility */}
                  <MatrixFacilityOrderContext
                    facility={facility}
                    enabled={isOrderMode && !!onReorder}
                    onReorder={onReorder}
                  >
                  <div className="flex flex-col">
                    {visibleUnits.length === 0 && (
                      <div className="flex">
                        <div
                          className="shrink-0 sticky z-10"
                          style={{ insetInlineStart: 'var(--matrix-facility-col)' }}
                        >
                          <div
                            className="flex items-center justify-between gap-2 px-3 text-xs font-bold text-primary-teal bg-surface-muted border-b border-e border-border"
                            style={{
                              width: 'var(--matrix-label-col)',
                              minWidth: 'var(--matrix-label-col)',
                              height: 'var(--matrix-row-height)',
                            }}
                          >
                            <span>{t('schedule:matrix.addFirstUnit')}</span>
                            {canManageUnits && (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-surface text-primary hover:bg-primary/10"
                                aria-label={t('schedule:matrix.addUnit', { defaultValue: 'Add unit' })}
                                onClick={(event) => openManageUnit(facility.id, undefined, event.currentTarget.getBoundingClientRect())}
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex items-center px-4 text-xs text-text-secondary bg-surface border-b border-e border-border"
                          style={{
                            width: `calc(var(--matrix-day-col) * ${daysInMonth})`,
                            height: 'var(--matrix-row-height)',
                          }}
                        >
                          {t('schedule:matrix.noUnits')}
                        </div>
                      </div>
                    )}
                    {visibleUnits.map((unit) => {
                      const activeRows = unit.rows.filter((row) => !row.archived);
                      return (
                        <SortableMatrixUnit
                          key={unit.id}
                          facilityId={facility.id}
                          unitId={unit.id}
                          unitLabel={unit.name}
                          rowIds={activeRows.map((row) => row.id)}
                          enabled={isOrderMode && !!onReorder}
                        >
                        {(unitHandle) => (
                        <div data-testid={`unit-group-${unit.id}`} className="flex flex-col">
                        {activeRows.length === 0 && (
                          <div className="flex">
                            <div
                              className="sticky z-10 flex shrink-0 items-center gap-2 border-b border-e border-border bg-surface-muted px-2"
                              style={{
                                insetInlineStart: 'var(--matrix-facility-col)',
                                width: 'var(--matrix-label-col)',
                                minWidth: 'var(--matrix-label-col)',
                                height: 'var(--matrix-row-height)',
                              }}
                            >
                              {unitHandle}
                              <span className="min-w-0 flex-1 truncate text-xs font-bold text-text-primary">{unit.name}</span>
                              {(isEditable || isOrderMode) && onAddRow && (
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-surface text-primary hover:bg-primary/10"
                                  aria-label={t('schedule:matrix.addRow', 'Add row')}
                                  onClick={(event) => openAddRow(facility.id, unit.id, unit.name, event.currentTarget.getBoundingClientRect())}
                                >
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {canManageUnits && (
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:border-primary hover:text-primary"
                                  aria-label={t('schedule:matrix.unitActions', { defaultValue: 'Unit actions' })}
                                  onClick={(event) => openManageUnit(facility.id, unit.id, event.currentTarget.getBoundingClientRect())}
                                >
                                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                            <div
                              className="flex items-center border-b border-e border-border bg-surface px-4 text-xs text-text-secondary"
                              style={{
                                width: `calc(var(--matrix-day-col) * ${daysInMonth})`,
                                height: 'var(--matrix-row-height)',
                              }}
                            >
                                {t('schedule:matrix.order.emptyUnit', { defaultValue: 'This unit has no active rows.' })}
                              </div>
                            </div>
                          )}
                          {activeRows.map((row, rowPosition) => {
                            const currentRowIndex = rowIndex;
                            rowIndex += 1;
                            return (
                          <SortableMatrixRow
                          key={row.id}
                          facilityId={facility.id}
                          unitId={unit.id}
                          rowId={row.id}
                          rowLabel={row.rowLabel || row.shiftLabel}
                          enabled={isOrderMode && !!onReorder}
                        >
                        {(dragProps) => (
                        <>
                          {/* Frozen col 2: unit/shift label */}
                          <div
                            className="shrink-0 sticky z-10"
                            style={{ insetInlineStart: 'var(--matrix-facility-col)' }}
                          >
                            <UnitShiftLabel
                              unitName={unit.name}
                              rowLabel={row.rowLabel}
                              rowId={row.id}
                              shiftLabel={row.shiftLabel}
                              timeRange={row.timeRange}
                              isOverflowRow={row.isOverflowRow}
                              weekendOnly={row.weekendOnly}
                              isEditable={canEditRows && !isOrderMode}
                              showUnitName={rowPosition === 0}
                              orderControls={isOrderMode && rowPosition === 0 ? <>{unitHandle}</> : undefined}
                              dragProps={dragProps}
                              onEditRow={
                                canEditRows
                                  ? (anchorRect) =>
                                      setRowEditTarget({ row, unitName: unit.name, anchorRect })
                                  : undefined
                              }
                              onAddRow={
                                (isEditable || isOrderMode) && onAddRow && rowPosition === 0
                                  ? (anchorRect) => openAddRow(facility.id, unit.id, unit.name, anchorRect)
                                  : undefined
                              }
                              onArchiveRow={canEditRows && onArchiveRow ? () => onArchiveRow(row.id) : undefined}
                              onDeleteRow={canEditRows && onDeleteRow ? () => onDeleteRow(row.id) : undefined}
                              onManageUnit={canManageUnits && rowPosition === 0
                                ? (anchorRect) => openManageUnit(facility.id, unit.id, anchorRect)
                                : undefined}
                              expandedCellsView={expandedCellsView}
                              onRowResizeStart={handleRowResizeStart}
                            />
                          </div>

                          {/* Day cells */}
                          <ShiftRowCells
                            row={row}
                            rowIndex={currentRowIndex}
                            facilityId={facility.id}
                            facilityName={facility.name}
                            unitId={unit.id}
                            unitName={unit.name}
                            daysInMonth={daysInMonth}
                            year={data.year}
                            month={data.month}
                            legend={data.legend}
                            auditLog={readOnly ? [] : data.auditLog}
                            highlightedEmployeeId={highlightedEmployeeId}
                            selectedCells={readOnly ? [] : selectedCells}
                            readOnly={readOnly}
                            isEditable={isEditable}
                            isVacationMode={isVacationMode}
                            isBrushMode={isBrushMode}
                            brushEmployeeCodes={readOnly ? [] : brushEmployeeCodes}
                            holidays={data.holidays}
                            onCellClick={handleCellClick}
                            onChipClick={onChipClick ? handleChipClick : undefined}
                            onCellContextMenu={readOnly ? undefined : onCellContextMenu}
                            onRangeSelect={readOnly ? undefined : onRangeSelect}
                            onDragFill={readOnly ? undefined : onDragFill}
                            expandedCellsView={expandedCellsView}
                          />
                        </>
                        )}
                        </SortableMatrixRow>
                        );
                      })}
                      </div>
                      )}
                      </SortableMatrixUnit>
                    );
                  })}
                  </div>
                  </MatrixFacilityOrderContext>
                </div>
              );
            })
            ) : (
              /* Standard High-Performance Mode: Virtualized Flat Row Model (60 FPS) */
              <div
                style={{
                  height: `${totalSize}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {/* Pre-computed Facility Bands across full vertical span */}
                {data.facilities.map((facility) => {
                  const startIndex = flatRows.findIndex((item) => item.facility.id === facility.id);
                  if (startIndex === -1) return null;
                  const rowCount = facilityRowCounts.get(facility.id) || 1;
                  return (
                    <div
                      key={`fb-${facility.id}`}
                      className="absolute sticky z-20 shrink-0 flex justify-center text-white border-e border-border pointer-events-none"
                      style={{
                        insetInlineStart: 0,
                        top: `${startIndex * currentRowHeight}px`,
                        height: `${rowCount * currentRowHeight}px`,
                        width: 'var(--matrix-facility-col)',
                        minWidth: 'var(--matrix-facility-col)',
                        backgroundColor: `var(--${facility.accentColorToken})`,
                      }}
                    >
                      <span
                        data-testid={`facility-label-${facility.name.toLowerCase()}`}
                        className="facility-vertical-text sticky top-[calc(var(--matrix-header-height)+8px)] flex h-24 items-center justify-center font-bold text-[11px]"
                        title={facility.name}
                      >
                        {facility.name}
                      </span>
                    </div>
                  );
                })}

                {virtualItems.map((virtualRow) => {
                  const item = flatRows[virtualRow.index];
                  if (!item) return null;

                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="flex absolute top-0 start-0 w-full border-b border-border"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {/* Frozen col 1: facility band background placeholder */}
                      <div
                        className="shrink-0 sticky z-10 border-e border-border"
                        style={{
                          insetInlineStart: 0,
                          width: 'var(--matrix-facility-col)',
                          minWidth: 'var(--matrix-facility-col)',
                          height: '100%',
                          minHeight: 'var(--matrix-row-height)',
                          backgroundColor: `var(--${item.facility.accentColorToken})`,
                        }}
                      />

                      {/* Frozen col 2 + cells */}
                      {item.kind === 'empty-facility' && (
                        <div className="flex flex-1">
                          <div
                            className="shrink-0 sticky z-10"
                            style={{ insetInlineStart: 'var(--matrix-facility-col)' }}
                          >
                            <div
                              className="flex items-center justify-between gap-2 px-3 text-xs font-bold text-primary-teal bg-surface-muted border-e border-border"
                              style={{
                                width: 'var(--matrix-label-col)',
                                minWidth: 'var(--matrix-label-col)',
                                minHeight: 'var(--matrix-row-height)',
                                height: '100%',
                              }}
                            >
                              <span>{t('schedule:matrix.addFirstUnit')}</span>
                              {canManageUnits && (
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-surface text-primary hover:bg-primary/10"
                                  aria-label={t('schedule:matrix.addUnit', { defaultValue: 'Add unit' })}
                                  onClick={(event) => openManageUnit(item.facility.id, undefined, event.currentTarget.getBoundingClientRect())}
                                >
                                  <Plus className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div
                            className="flex items-center px-4 text-xs text-text-secondary bg-surface border-e border-border"
                            style={{
                              width: `calc(var(--matrix-day-col) * ${daysInMonth})`,
                              minHeight: 'var(--matrix-row-height)',
                              height: '100%',
                            }}
                          >
                            {t('schedule:matrix.noUnits')}
                          </div>
                        </div>
                      )}

                      {item.kind === 'empty-unit' && item.unit && (
                        <div className="flex flex-1">
                          <div
                            className="shrink-0 sticky z-10 flex items-center gap-2 border-e border-border bg-surface-muted px-2"
                            style={{
                              insetInlineStart: 'var(--matrix-facility-col)',
                              width: 'var(--matrix-label-col)',
                              minWidth: 'var(--matrix-label-col)',
                              minHeight: 'var(--matrix-row-height)',
                              height: '100%',
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate text-xs font-bold text-text-primary">{item.unit.name}</span>
                            {(isEditable || isOrderMode) && onAddRow && (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-surface text-primary hover:bg-primary/10"
                                aria-label={t('schedule:matrix.addRow', 'Add row')}
                                onClick={(event) => openAddRow(item.facility.id, item.unit!.id, item.unit!.name, event.currentTarget.getBoundingClientRect())}
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            {canManageUnits && (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-secondary hover:border-primary hover:text-primary"
                                aria-label={t('schedule:matrix.unitActions', { defaultValue: 'Unit actions' })}
                                onClick={(event) => openManageUnit(item.facility.id, item.unit!.id, event.currentTarget.getBoundingClientRect())}
                              >
                                <Settings2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <div
                            className="flex items-center border-e border-border bg-surface px-4 text-xs text-text-secondary"
                            style={{
                              width: `calc(var(--matrix-day-col) * ${daysInMonth})`,
                              minHeight: 'var(--matrix-row-height)',
                              height: '100%',
                            }}
                          >
                            {t('schedule:matrix.order.emptyUnit', { defaultValue: 'This unit has no active rows.' })}
                          </div>
                        </div>
                      )}

                      {item.kind === 'row' && item.unit && item.row && (
                        <div className="flex flex-1">
                          {/* Frozen col 2: unit/shift label */}
                          <div
                            className="shrink-0 sticky z-10"
                            style={{ insetInlineStart: 'var(--matrix-facility-col)' }}
                          >
                            <UnitShiftLabel
                              unitName={item.unit.name}
                              rowLabel={item.row.rowLabel}
                              shiftLabel={item.row.shiftLabel}
                              timeRange={item.row.timeRange}
                              isOverflowRow={item.row.isOverflowRow}
                              weekendOnly={item.row.weekendOnly}
                              isEditable={canEditRows}
                              showUnitName={item.isFirstUnitRow}
                              onEditRow={
                                canEditRows
                                  ? (anchorRect) =>
                                      setRowEditTarget({ row: item.row!, unitName: item.unit!.name, anchorRect })
                                  : undefined
                              }
                              onAddRow={
                                (isEditable || isOrderMode) && onAddRow && item.isFirstUnitRow
                                  ? (anchorRect) => openAddRow(item.facility.id, item.unit!.id, item.unit!.name, anchorRect)
                                  : undefined
                              }
                              onArchiveRow={canEditRows && onArchiveRow ? () => onArchiveRow(item.row!.id) : undefined}
                              onDeleteRow={canEditRows && onDeleteRow ? () => onDeleteRow(item.row!.id) : undefined}
                              onManageUnit={
                                canManageUnits && item.isFirstUnitRow
                                  ? (anchorRect) => openManageUnit(item.facility.id, item.unit!.id, anchorRect)
                                  : undefined
                              }
                              expandedCellsView={expandedCellsView}
                              onRowResizeStart={handleRowResizeStart}
                            />
                          </div>

                          {/* Day cells */}
                          <ShiftRowCells
                            row={item.row}
                            rowIndex={item.globalRowIndex ?? 0}
                            facilityId={item.facility.id}
                            facilityName={item.facility.name}
                            unitId={item.unit.id}
                            unitName={item.unit.name}
                            daysInMonth={daysInMonth}
                            year={data.year}
                            month={data.month}
                            legend={data.legend}
                            auditLog={readOnly ? [] : data.auditLog}
                            highlightedEmployeeId={highlightedEmployeeId}
                            selectedCells={readOnly ? [] : selectedCells}
                            readOnly={readOnly}
                            isEditable={isEditable}
                            isVacationMode={isVacationMode}
                            isBrushMode={isBrushMode}
                            brushEmployeeCodes={readOnly ? [] : brushEmployeeCodes}
                            holidays={data.holidays}
                            onCellClick={handleCellClick}
                            onChipClick={onChipClick ? handleChipClick : undefined}
                            onCellContextMenu={readOnly ? undefined : onCellContextMenu}
                            onRangeSelect={readOnly ? undefined : onRangeSelect}
                            onDragFill={readOnly ? undefined : onDragFill}
                            expandedCellsView={expandedCellsView}
                            colorblindMode={colorblindMode}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Vacation Band ── */}
            {data.vacations.length > 0 && (
              <VacationBand
                vacations={data.vacations}
                daysInMonth={daysInMonth}
                year={data.year}
                month={data.month}
                adminMode={readOnly ? 'view' : adminMode}
                onVacationToggle={readOnly ? undefined : handleVacationToggle}
                holidays={data.holidays}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Legend Panel (trailing side = left in RTL) ── */}
      <LegendPanel
        legend={data.legend}
        month={data.month}
        year={data.year}
        highlightedEmployeeId={highlightedEmployeeId}
        brushEmployeeCodes={brushEmployeeCodes}
        onEmployeeClick={readOnly ? undefined : handleLegendClick}
        onEmployeeDetailsClick={onLegendEmployeeDetailsClick}
        codeToId={codeToId}
      />

      <RowEditPopover
        target={rowEditTarget}
        onClose={() => setRowEditTarget(null)}
        onSave={(rowId, updates) => onUpdateRow?.(rowId, updates)}
        shiftDefinitions={
          rowEditTarget
            ? data.settings
                .flatMap((entry) => entry.shiftDefinitions)
                .filter((definition) => !definition.archived)
            : []
        }
        onArchive={onArchiveRow}
        onDelete={onDeleteRow}
      />
      {onAddUnit && (
        <UnitManagementPopover
          target={unitManagementTarget}
          onClose={() => setUnitManagementTarget(null)}
          onAddUnit={onAddUnit}
          onRenameUnit={onRenameUnit}
          onAddRow={onAddRow ? (facilityId, unitId, anchorRect) => {
            const unit = data.facilities
              .find((facility) => facility.id === facilityId)
              ?.units.find((candidate) => candidate.id === unitId);
            if (unit) openAddRow(facilityId, unitId, unit.name, anchorRect);
          } : undefined}
          onArchiveUnit={onArchiveUnit}
          onDeleteUnit={onDeleteUnit}
        />
      )}
      {rowAddTarget && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[240] cursor-default bg-transparent"
            aria-label={t('schedule:rowEdit.cancel')}
            onClick={() => setRowAddTarget(null)}
          />
          <div
            className="fixed z-[250] w-[300px] rounded-lg border border-border bg-surface p-3 shadow-2xl"
            style={{
              top: Math.min(rowAddTarget.anchorRect.bottom + 8, window.innerHeight - 300),
              left: Math.max(16, Math.min(rowAddTarget.anchorRect.left, window.innerWidth - 320)),
            }}
            role="dialog"
            aria-label={t('schedule:matrix.addRow', 'Add row')}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink">{t('schedule:matrix.addRow', 'Add row')}</h2>
                <p className="text-[11px] text-text-secondary">{rowAddTarget.unitName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRowAddTarget(null)}
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
                  value={newRowLabel}
                  onChange={(event) => setNewRowLabel(event.target.value)}
                  className="h-8 w-full rounded-md border border-border px-2 text-xs font-semibold text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
                  placeholder="Bed 1 - Morning"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                  {t('schedule:rowEdit.shiftType')}
                </span>
                <select
                  value={newRowShiftDefinitionId}
                  onChange={(event) => setNewRowShiftDefinitionId(event.target.value)}
                  className="h-8 w-full rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
                >
                  {rowAddTarget.definitions.map((definition) => (
                    <option key={definition.id} value={definition.id}>
                      {definition.englishName || definition.label} · {definition.timeRange}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <button
                type="button"
                disabled={!newRowLabel.trim() || !newRowShiftDefinitionId}
                onClick={() => {
                  onAddRow?.(rowAddTarget.facilityId, rowAddTarget.unitId, newRowShiftDefinitionId, newRowLabel.trim());
                  setRowAddTarget(null);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-teal px-3 py-2 text-xs font-bold text-white hover:bg-primary-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('schedule:matrix.addRow', 'Add row')}
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </>
  );
}

export default memo(ScheduleMatrix);
