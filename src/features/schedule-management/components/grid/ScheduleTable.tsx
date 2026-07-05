// ============================================================
// ScheduleTable — Virtualized Schedule Grid
// ============================================================
// The main grid component using @tanstack/react-virtual for
// smooth scrolling with 1000+ employees × 31 days.
// Features: sticky header, sticky first column, collapsible
// department groups, and weekend/today highlighting.

import { memo, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday as isDateToday, getDay } from 'date-fns';
import { GRID_CONFIG } from '../../utils/constants';
import ScheduleCell from './ScheduleCell';
import type { ScheduleGridRow, ScheduleEntry, ScheduleEmployee } from '../../types/schedule';

interface ScheduleTableProps {
  rows: ScheduleGridRow[];
  monthDays: Date[];
  highlightedEmployeeId: string | null;
  onToggleDepartment: (deptId: string) => void;
  collapsedDepartments: Set<string>;
  onCellClick: (entry: ScheduleEntry, employee: ScheduleEmployee) => void;
  onContextMenu: (
    e: React.MouseEvent,
    entry: ScheduleEntry | null,
    employee: ScheduleEmployee,
    date: string
  ) => void;
}

function ScheduleTable({
  rows,
  monthDays,
  highlightedEmployeeId,
  onToggleDepartment,
  collapsedDepartments,
  onCellClick,
  onContextMenu,
}: ScheduleTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      rows[index].type === 'department-header'
        ? GRID_CONFIG.DEPT_HEADER_HEIGHT
        : GRID_CONFIG.ROW_HEIGHT,
    overscan: GRID_CONFIG.OVERSCAN,
  });

  // Column virtualizer (for days)
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: monthDays.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => GRID_CONFIG.DAY_COL_WIDTH,
    overscan: 5,
  });

  // Pre-compute date strings and metadata
  const dayMeta = useMemo(
    () =>
      monthDays.map((d) => ({
        date: format(d, 'yyyy-MM-dd'),
        dayNum: format(d, 'd'),
        dayName: format(d, 'EEE'),
        isToday: isDateToday(d),
        isWeekend: getDay(d) === 5 || getDay(d) === 6, // Fri/Sat for Saudi
      })),
    [monthDays]
  );

  const totalWidth =
    GRID_CONFIG.EMPLOYEE_COL_WIDTH + monthDays.length * GRID_CONFIG.DAY_COL_WIDTH;

  const renderDeptHeader = useCallback(
    (row: ScheduleGridRow, virtualRow: { index: number; start: number; size: number }) => {
      const isCollapsed = collapsedDepartments.has(row.departmentId);
      return (
        <div
          key={`dept-${row.departmentId}`}
          className={cn(
            'absolute left-0 flex items-center gap-2 px-4',
            'bg-slate-50 dark:bg-slate-800/80 border-b border-border dark:border-slate-700',
            'cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800',
            'transition-colors duration-150'
          )}
          style={{
            top: 0,
            transform: `translateY(${virtualRow.start}px)`,
            height: `${virtualRow.size}px`,
            width: totalWidth,
          }}
          onClick={() => onToggleDepartment(row.departmentId)}
          role="row"
          aria-expanded={!isCollapsed}
        >
          {/* Department color indicator */}
          <div
            className="h-5 w-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: row.departmentColor }}
          />

          <motion.div
            animate={{ rotate: isCollapsed ? -90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-text-secondary dark:text-slate-400" />
          </motion.div>

          <span className="text-sm font-semibold text-text-primary dark:text-white">
            {row.departmentName}
          </span>

          <div className="flex items-center gap-1 ml-2 rounded-full bg-white dark:bg-slate-700 border border-border dark:border-slate-600 px-2 py-0.5">
            <Users className="h-3 w-3 text-text-secondary dark:text-slate-400" />
            <span className="text-[10px] font-medium text-text-secondary dark:text-slate-400">
              {rows.filter(
                (r) => r.type === 'employee' && r.departmentId === row.departmentId
              ).length}
            </span>
          </div>
        </div>
      );
    },
    [collapsedDepartments, onToggleDepartment, rows, totalWidth]
  );

  const renderEmployeeRow = useCallback(
    (row: ScheduleGridRow, virtualRow: { index: number; start: number; size: number }) => {
      if (!row.employee) return null;
      const emp = row.employee;
      const isHighlighted = highlightedEmployeeId === emp.id;

      return (
        <div
          key={`emp-${emp.id}`}
          className={cn(
            'absolute left-0 flex border-b border-border/50 dark:border-slate-800',
            isHighlighted && 'bg-primary-50/50 dark:bg-primary-900/20',
            !isHighlighted && 'bg-white dark:bg-slate-900'
          )}
          style={{
            top: 0,
            transform: `translateY(${virtualRow.start}px)`,
            height: `${virtualRow.size}px`,
            width: totalWidth,
          }}
          role="row"
          data-employee-id={emp.id}
        >
          {/* Sticky employee name column */}
          <div
            className={cn(
              'sticky left-0 z-20 flex items-center gap-2.5 px-3 border-r border-border/50',
              'bg-white dark:bg-slate-900',
              isHighlighted && 'bg-primary-50/50 dark:bg-primary-900/20'
            )}
            style={{ width: GRID_CONFIG.EMPLOYEE_COL_WIDTH, minWidth: GRID_CONFIG.EMPLOYEE_COL_WIDTH }}
          >
            {/* Department color bar */}
            <div
              className="h-6 w-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: row.departmentColor }}
            />

            {/* Avatar */}
            <div
              className={cn(
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                'text-[10px] font-bold text-white'
              )}
              style={{ backgroundColor: row.departmentColor + '99' }}
            >
              {emp.initials}
            </div>

            {/* Name & Room */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text-primary dark:text-white truncate leading-tight">
                {emp.name}
              </p>
              <p className="text-[10px] text-text-secondary dark:text-slate-500 truncate leading-tight">
                {emp.roomName}
              </p>
            </div>
          </div>

          {/* Schedule cells — only render visible columns */}
          {columnVirtualizer.getVirtualItems().map((virtualCol) => {
            const meta = dayMeta[virtualCol.index];
            const entry = row.entries?.[meta.date];
            return (
              <div
                key={meta.date}
                className="flex-shrink-0 border-r border-border/30 dark:border-slate-800/50"
                style={{
                  position: 'absolute',
                  left: GRID_CONFIG.EMPLOYEE_COL_WIDTH + virtualCol.start,
                  width: virtualCol.size,
                  height: '100%',
                }}
              >
                <ScheduleCell
                  entry={entry}
                  employee={emp}
                  date={meta.date}
                  isToday={meta.isToday}
                  isWeekend={meta.isWeekend}
                  isHighlighted={isHighlighted}
                  onCellClick={onCellClick}
                  onContextMenu={onContextMenu}
                />
              </div>
            );
          })}
        </div>
      );
    },
    [columnVirtualizer, dayMeta, highlightedEmployeeId, onCellClick, onContextMenu, totalWidth]
  );

  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-surface overflow-hidden shadow-soft',
        'dark:bg-slate-900 dark:border-slate-800'
      )}
    >
      {/* Scrollable container */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: 'calc(100vh - 420px)', minHeight: 400 }}
        role="grid"
        aria-label="Employee schedule grid"
        tabIndex={0}
      >
        {/* Inner sizer */}
        <div
          style={{
            height: rowVirtualizer.getTotalSize() + GRID_CONFIG.HEADER_HEIGHT,
            width: totalWidth,
            position: 'relative',
          }}
        >
          {/* ── Sticky Header ── */}
          <div
            className={cn(
              'sticky top-0 z-30 flex border-b border-border',
              'bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm'
            )}
            style={{ height: GRID_CONFIG.HEADER_HEIGHT, width: totalWidth }}
            role="row"
          >
            {/* Corner cell */}
            <div
              className={cn(
                'sticky left-0 z-40 flex items-center justify-center border-r border-border',
                'bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm',
                'text-xs font-semibold text-text-secondary dark:text-slate-400'
              )}
              style={{ width: GRID_CONFIG.EMPLOYEE_COL_WIDTH, minWidth: GRID_CONFIG.EMPLOYEE_COL_WIDTH }}
              role="columnheader"
            >
              Employee
            </div>

            {/* Day headers — only render visible */}
            {columnVirtualizer.getVirtualItems().map((virtualCol) => {
              const meta = dayMeta[virtualCol.index];
              return (
                <div
                  key={meta.date}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-border/50',
                    'dark:border-slate-700/50',
                    meta.isToday && 'bg-primary-50 dark:bg-primary-900/20',
                    meta.isWeekend && !meta.isToday && 'bg-amber-50/40 dark:bg-amber-900/10'
                  )}
                  style={{
                    position: 'absolute',
                    left: GRID_CONFIG.EMPLOYEE_COL_WIDTH + virtualCol.start,
                    width: virtualCol.size,
                    height: '100%',
                  }}
                  role="columnheader"
                >
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      meta.isToday
                        ? 'text-primary dark:text-primary-400'
                        : meta.isWeekend
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-text-secondary dark:text-slate-400'
                    )}
                  >
                    {meta.dayName}
                  </span>
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      meta.isToday
                        ? 'bg-primary text-white'
                        : 'text-text-primary dark:text-slate-200'
                    )}
                  >
                    {meta.dayNum}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Virtualized Rows ── */}
          <div
            style={{
              position: 'absolute',
              top: GRID_CONFIG.HEADER_HEIGHT,
              left: 0,
              width: '100%',
              height: rowVirtualizer.getTotalSize(),
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (row.type === 'department-header') {
                return renderDeptHeader(row, virtualRow);
              }
              return renderEmployeeRow(row, virtualRow);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ScheduleTable);
