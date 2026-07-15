// ============================================================
// ShiftRowCells - One schedule sub-row x day cells
// ============================================================

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import EmployeeChip from './EmployeeChip';
import type { AuditEntry, ShiftRow, Assignment, MatrixCellRef, HolidayRange } from '@/types/scheduleMatrix';

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
  readOnly?: boolean;
  isEditable: boolean;
  isVacationMode: boolean;
  isBrushMode: boolean;
  brushEmployeeCodes: string[];
  holidays?: HolidayRange[];
  onCellClick: (ref: MatrixCellRef, meta?: CellInteractionMeta) => void;
  onChipClick?: (ref: MatrixCellRef, assignment: Assignment, meta?: CellInteractionMeta) => void;
  onCellContextMenu?: (ref: MatrixCellRef, position: { x: number; y: number }) => void;
  onRangeSelect?: (start: MatrixCellRef, end: MatrixCellRef) => void;
  onDragFill?: (source: MatrixCellRef, target: MatrixCellRef) => void;
  expandedCellsView?: boolean;
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
  readOnly = false,
  isEditable,
  isBrushMode,
  brushEmployeeCodes,
  holidays = [],
  onCellClick,
  onChipClick,
  onCellContextMenu,
  onRangeSelect,
  onDragFill,
  expandedCellsView = false,
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
  const [previewCell, setPreviewCell] = useState<{ day: number; assignments: Assignment[]; cellRef: MatrixCellRef } | null>(null);

  const legendMap = useMemo(() => new Map(legend.map((item) => [item.code, item.fullName])), [legend]);

  const isCellSelected = useCallback(
    (day: number) =>
      selectedCells.some(
        (cell) => cell.facilityId === facilityId && cell.unitId === unitId && cell.rowId === row.id && cell.day === day,
      ),
    [selectedCells, facilityId, unitId, row.id],
  );

  const historyForCell = useCallback(
    (day: number) => readOnly ? [] : auditLog.filter((entry) => entry.rowId === row.id && entry.day === day).slice(0, 3),
    [auditLog, readOnly, row.id],
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
        const isHoliday = holidays.some((holiday) => day >= holiday.startDay && day <= holiday.endDay);

        return (
          <div
            key={day}
            data-matrix-row-index={rowIndex}
            data-matrix-day={day}
            data-row-id={row.id}
            data-holiday-day={isHoliday ? day : undefined}
            className={cn(
              'group relative flex flex-col items-center justify-center gap-1 px-[2px] overflow-hidden',
              'border-b border-e border-border outline-none',
              'transition-colors duration-100',
              isWeekend && 'bg-[var(--weekend-tint)]',
              isHoliday && 'bg-amber-100/60 dark:bg-amber-950/25',
              isToday && 'bg-[var(--today-tint)]',
              !isWeekend && !isToday && !isHoliday && assignments.length === 0 && 'bg-[var(--empty-cell-bg)]',
              !isWeekend && !isToday && !isHoliday && assignments.length > 0 && 'bg-surface',
              selected && 'ring-2 ring-inset ring-signal-cyan bg-signal-cyan/10',
              isFillTarget && 'ring-2 ring-inset ring-primary-teal bg-primary-teal/10',
              canEditCell && 'cursor-pointer hover:bg-primary-teal/10',
              brushEmployeeCodes.length > 0 && isBrushMode && 'hover:outline hover:outline-2 hover:outline-violet-400',
            )}
            style={{
              minWidth: 'var(--matrix-day-col)',
              width: 'var(--matrix-day-col)',
              minHeight: 'var(--matrix-row-height)',
              height: expandedCellsView ? 'auto' : 'var(--matrix-row-height)',
            }}
            onContextMenu={(event) => {
              if (readOnly || !onCellContextMenu) return;
              event.preventDefault();
              onCellContextMenu(cellRef, { x: event.clientX, y: event.clientY });
            }}
            onPointerDown={(event) => {
              if (!readOnly && event.pointerType === 'touch' && onCellContextMenu) {
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

            {assignments.length > 2 && !expandedCellsView && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewCell({ day, assignments, cellRef });
                }}
                className="absolute top-0.5 end-0.5 z-10 flex h-4 w-4 items-center justify-center rounded bg-surface/90 text-text-secondary opacity-0 shadow hover:bg-primary-teal hover:text-white group-hover:opacity-100 transition-opacity"
                title="Expand cell"
              >
                <Maximize2 className="h-2.5 w-2.5" />
              </button>
            )}

            {expandedCellsView && assignments.length > 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 w-full py-1 px-1">
                {assignments.map((assignment, assignmentIndex) => (
                  <EmployeeChip
                    key={`${assignment.employeeCode}-${assignmentIndex}`}
                    assignment={assignment}
                    rowColorKey={row.colorKey}
                    rowBackgroundColor={row.backgroundColor}
                    rowTextColor={row.textColor}
                    fullName={legendMap.get(assignment.employeeCode)}
                    shiftLabel={row.shiftLabel}
                    timeRange={row.timeRange}
                    facilityName={facilityName}
                    unitName={unitName}
                    day={day}
                    monthLabel={monthLabel}
                    isHighlighted={highlightedEmployeeId === assignment.employeeId}
                    historyEntries={historyForCell(day)}
                    readOnly={readOnly}
                    suppressPopover={isBrushMode}
                    compact={false}
                    onClick={onChipClick ? () => onChipClick(cellRef, assignment, { hasAssignments: true }) : undefined}
                  />
                ))}
              </div>
            ) : assignments.length > 2 ? (
              <div className="flex h-full w-full flex-col items-stretch justify-center gap-[2px] overflow-hidden px-[2px] py-[2px]">
                {assignments.slice(0, 2).map((assignment, assignmentIndex) => (
                  <EmployeeChip
                    key={`${assignment.employeeCode}-${assignmentIndex}`}
                    assignment={assignment}
                    rowColorKey={row.colorKey}
                    rowBackgroundColor={row.backgroundColor}
                    rowTextColor={row.textColor}
                    fullName={legendMap.get(assignment.employeeCode)}
                    shiftLabel={row.shiftLabel}
                    timeRange={row.timeRange}
                    facilityName={facilityName}
                    unitName={unitName}
                    day={day}
                    monthLabel={monthLabel}
                    isHighlighted={highlightedEmployeeId === assignment.employeeId}
                    historyEntries={historyForCell(day)}
                    readOnly={readOnly}
                    suppressPopover={isBrushMode}
                    compact={true}
                    onClick={onChipClick ? () => onChipClick(cellRef, assignment, { hasAssignments: true }) : undefined}
                  />
                ))}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewCell({ day, assignments, cellRef });
                  }}
                  className="w-full truncate rounded-[3px] border border-primary-teal/25 bg-primary-teal/10 px-1 py-[1px] text-center text-[9px] font-extrabold leading-none text-primary-teal hover:bg-primary-teal hover:text-white"
                  aria-label={`Show ${assignments.length - 2} more employees`}
                >
                  +{assignments.length - 2}
                </button>
              </div>
            ) : (
              assignments.map((assignment, assignmentIndex) => (
                <EmployeeChip
                  key={`${assignment.employeeCode}-${assignmentIndex}`}
                  assignment={assignment}
                  rowColorKey={row.colorKey}
                  rowBackgroundColor={row.backgroundColor}
                  rowTextColor={row.textColor}
                  fullName={legendMap.get(assignment.employeeCode)}
                  shiftLabel={row.shiftLabel}
                  timeRange={row.timeRange}
                  facilityName={facilityName}
                  unitName={unitName}
                  day={day}
                  monthLabel={monthLabel}
                  isHighlighted={highlightedEmployeeId === assignment.employeeId}
                  historyEntries={historyForCell(day)}
                  readOnly={readOnly}
                  suppressPopover={isBrushMode}
                  compact={false}
                  onClick={onChipClick ? () => onChipClick(cellRef, assignment, { hasAssignments: true }) : undefined}
                />
              ))
            )}

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

      {previewCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-150" onClick={() => setPreviewCell(null)}>
          <div className="w-80 rounded-2xl border border-border bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <div>
                <h4 className="text-sm font-bold text-text-primary">{facilityName} — {unitName}</h4>
                <p className="text-xs font-semibold text-primary-teal">{row.shiftLabel} ({row.timeRange}) • Day {previewCell.day}</p>
              </div>
              <button type="button" onClick={() => setPreviewCell(null)} className="rounded-lg p-1 text-text-muted hover:bg-hover hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {previewCell.assignments.map((assignment, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/50 p-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-primary-teal text-xs font-black text-white">
                      {assignment.employeeCode}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{legendMap.get(assignment.employeeCode) || assignment.employeeCode}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(ShiftRowCells);
