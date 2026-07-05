// ============================================================
// ShiftRowCells - One schedule sub-row x day cells
// ============================================================

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import EmployeeChip from './EmployeeChip';
import type { AuditEntry, ShiftRow, Assignment, MatrixCellRef } from '@/types/scheduleMatrix';

export interface CellInteractionMeta {
  anchorRect?: DOMRect;
  shiftKey?: boolean;
  hasAssignments?: boolean;
}

interface ShiftRowCellsProps {
  row: ShiftRow;
  rowIndex: number;
  facilityId: string;
  facilityName: string;
  unitId: string;
  unitName: string;
  daysInMonth: number;
  year: number;
  month: number;
  legend: { code: string; fullName: string; employeeId?: string }[];
  auditLog?: AuditEntry[];
  highlightedEmployeeId: string | null;
  selectedCells: MatrixCellRef[];
  isEditable: boolean;
  isVacationMode: boolean;
  isBrushMode: boolean;
  brushEmployeeCodes: string[];
  colorblindMode?: boolean;
  onCellClick: (ref: MatrixCellRef, meta?: CellInteractionMeta) => void;
  onChipClick: (ref: MatrixCellRef, assignment: Assignment, meta?: CellInteractionMeta) => void;
  onCellContextMenu?: (ref: MatrixCellRef, position: { x: number; y: number }) => void;
  onRangeSelect?: (start: MatrixCellRef, end: MatrixCellRef) => void;
  onDragFill?: (source: MatrixCellRef, target: MatrixCellRef) => void;
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function focusCell(rowIndex: number, day: number) {
  const next = document.querySelector<HTMLElement>(
    `[data-matrix-row-index="${rowIndex}"][data-matrix-day="${day}"]`,
  );
  next?.focus();
}

function ShiftRowCells({
  row,
  rowIndex,
  facilityId,
  facilityName,
  unitId,
  unitName,
  daysInMonth,
  year,
  month,
  legend,
  auditLog = [],
  highlightedEmployeeId,
  selectedCells,
  isEditable,
  isBrushMode,
  brushEmployeeCodes,
  colorblindMode = false,
  onCellClick,
  onChipClick,
  onCellContextMenu,
  onRangeSelect,
  onDragFill,
}: ShiftRowCellsProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;
  const monthLabel = MONTH_LABELS[month];
  const rangeStartRef = useRef<MatrixCellRef | null>(null);
  const dragMovedRef = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const fillSourceRef = useRef<MatrixCellRef | null>(null);
  const [fillTargetDay, setFillTargetDay] = useState<number | null>(null);

  const legendMap = useMemo(() => new Map(legend.map((item) => [item.code, item.fullName])), [legend]);

  const isCellSelected = useCallback(
    (day: number) =>
      selectedCells.some(
        (cell) => cell.facilityId === facilityId && cell.unitId === unitId && cell.rowId === row.id && cell.day === day,
      ),
    [selectedCells, facilityId, unitId, row.id],
  );

  const historyForCell = useCallback(
    (day: number) => auditLog.filter((entry) => entry.rowId === row.id && entry.day === day).slice(0, 3),
    [auditLog, row.id],
  );

  const makeAriaLabel = (day: number, assignments: Assignment[]) => {
    const names = assignments.length
      ? assignments.map((assignment) => legendMap.get(assignment.employeeCode) || assignment.employeeCode).join(', ')
      : t('schedule:matrix.emptyCell');
    return `${names} - ${row.shiftLabel} - ${t('schedule:matrix.day', { day })} - ${facilityName} ${unitName}`;
  };

  return (
    <>
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(year, month, day);
        const dow = date.getDay();
        const isWeekend = dow === 5 || dow === 6;
        const isToday = day === todayDay;
        const assignments = row.cellsByDay[day] || [];
        const selected = isCellSelected(day);
        const cellRef: MatrixCellRef = { facilityId, unitId, rowId: row.id, day };
        const isFillTarget = fillTargetDay === day;
        const canEditCell = isEditable || isBrushMode;

        return (
          <div
            key={day}
            data-matrix-row-index={rowIndex}
            data-matrix-day={day}
            data-row-id={row.id}
            className={cn(
              'group relative flex flex-col items-center justify-center gap-1 px-[2px]',
              'border-b border-e border-gray-300 outline-none',
              'transition-colors duration-100',
              isWeekend && 'bg-[var(--weekend-tint)]',
              isToday && 'bg-[var(--today-tint)]',
              !isWeekend && !isToday && assignments.length === 0 && 'bg-[var(--empty-cell-bg)]',
              !isWeekend && !isToday && assignments.length > 0 && 'bg-white',
              selected && 'ring-2 ring-inset ring-signal-cyan bg-signal-cyan/10',
              isFillTarget && 'ring-2 ring-inset ring-primary-teal bg-primary-teal/10',
              canEditCell && 'cursor-pointer hover:bg-primary-teal/10',
              brushEmployeeCodes.length > 0 && isBrushMode && 'hover:outline hover:outline-2 hover:outline-violet-400',
            )}
            style={{
              minWidth: 'var(--matrix-day-col)',
              width: 'var(--matrix-day-col)',
              height: 'var(--matrix-row-height)',
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onCellContextMenu?.(cellRef, { x: event.clientX, y: event.clientY });
            }}
            onPointerDown={(event) => {
              if (event.pointerType === 'touch' && onCellContextMenu) {
                longPressTimer.current = window.setTimeout(() => {
                  onCellContextMenu(cellRef, { x: event.clientX, y: event.clientY });
                }, 520);
              }
            }}
            onPointerUp={() => {
              if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }}
            onMouseDown={(event) => {
              if (!canEditCell || event.button !== 0) return;
              rangeStartRef.current = cellRef;
              dragMovedRef.current = false;
            }}
            onMouseEnter={(event) => {
              if (fillSourceRef.current) {
                setFillTargetDay(day);
                return;
              }
              if (!canEditCell || event.buttons !== 1 || !rangeStartRef.current) return;
              if (rangeStartRef.current.day !== day) {
                dragMovedRef.current = true;
                onRangeSelect?.(rangeStartRef.current, cellRef);
              }
            }}
            onMouseUp={() => {
              if (fillSourceRef.current) {
                onDragFill?.(fillSourceRef.current, cellRef);
                fillSourceRef.current = null;
                setFillTargetDay(null);
                return;
              }
              rangeStartRef.current = null;
            }}
            onClick={(event) => {
              if (!canEditCell) return;
              if (dragMovedRef.current) {
                dragMovedRef.current = false;
                return;
              }
              if (event.shiftKey) {
                onCellClick(cellRef, {
                  anchorRect: event.currentTarget.getBoundingClientRect(),
                  shiftKey: true,
                  hasAssignments: assignments.length > 0,
                });
                return;
              }
              onCellClick(cellRef, {
                anchorRect: event.currentTarget.getBoundingClientRect(),
                shiftKey: event.shiftKey,
                hasAssignments: assignments.length > 0,
              });
            }}
            role="gridcell"
            tabIndex={canEditCell ? 0 : -1}
            aria-label={makeAriaLabel(day, assignments)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canEditCell) {
                onCellClick(cellRef, {
                  anchorRect: event.currentTarget.getBoundingClientRect(),
                  hasAssignments: assignments.length > 0,
                });
              }
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                focusCell(rowIndex, Math.min(daysInMonth, day + 1));
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                focusCell(rowIndex, Math.max(1, day - 1));
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusCell(rowIndex + 1, day);
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusCell(Math.max(0, rowIndex - 1), day);
              }
            }}
          >
            {assignments.length === 0 && canEditCell && (
              <span
                className={cn(
                  'pointer-events-none flex h-5 w-5 items-center justify-center rounded-full',
                  'border border-primary-teal/30 bg-primary-teal/5 text-primary-teal',
                  'opacity-0 transition-opacity duration-150 group-hover:opacity-70 group-focus:opacity-100',
                )}
                aria-hidden="true"
              >
                <Plus className="h-3 w-3" />
              </span>
            )}

            {assignments.map((assignment, assignmentIndex) => (
              <EmployeeChip
                key={`${assignment.employeeCode}-${assignmentIndex}`}
                assignment={assignment}
                rowColorKey={row.colorKey}
                fullName={legendMap.get(assignment.employeeCode)}
                shiftLabel={row.shiftLabel}
                timeRange={row.timeRange}
                facilityName={facilityName}
                unitName={unitName}
                day={day}
                monthLabel={monthLabel}
                isHighlighted={highlightedEmployeeId === assignment.employeeId}
                colorblindMode={colorblindMode}
                historyEntries={historyForCell(day)}
                onClick={() => onChipClick(cellRef, assignment, { hasAssignments: true })}
              />
            ))}

            {assignments.length > 0 && canEditCell && (
              <button
                type="button"
                className={cn(
                  'absolute bottom-0.5 end-0.5 h-2.5 w-2.5 rounded-[2px]',
                  'border border-white bg-primary-teal shadow-sm opacity-0 transition-opacity',
                  'group-hover:opacity-100 focus:opacity-100',
                )}
                aria-label={t('schedule:matrix.dragHandle')}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  fillSourceRef.current = cellRef;
                  setFillTargetDay(day);
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default memo(ShiftRowCells);
