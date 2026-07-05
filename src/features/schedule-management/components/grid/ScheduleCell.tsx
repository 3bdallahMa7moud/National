// ============================================================
// ScheduleCell — Individual shift badge
// ============================================================
// Renders a single schedule cell as a modern rounded badge.
// Supports hover animation, tooltip, click, and right-click.

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SHIFT_THEMES } from '../../utils/constants';
import type { ScheduleEntry, ScheduleEmployee } from '../../types/schedule';

interface ScheduleCellProps {
  entry: ScheduleEntry | undefined;
  employee: ScheduleEmployee;
  date: string;
  isToday: boolean;
  isWeekend: boolean;
  isHighlighted: boolean;
  onCellClick: (entry: ScheduleEntry, employee: ScheduleEmployee) => void;
  onContextMenu: (
    e: React.MouseEvent,
    entry: ScheduleEntry | null,
    employee: ScheduleEmployee,
    date: string
  ) => void;
}

function ScheduleCell({
  entry,
  employee,
  date,
  isToday,
  isWeekend,
  isHighlighted,
  onCellClick,
  onContextMenu,
}: ScheduleCellProps) {
  const handleClick = useCallback(() => {
    if (entry) onCellClick(entry, employee);
  }, [entry, employee, onCellClick]);

  const handleContext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, entry ?? null, employee, date);
    },
    [entry, employee, date, onContextMenu]
  );

  if (!entry) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center',
          isWeekend && 'bg-slate-50/60 dark:bg-slate-800/30',
          isToday && 'bg-primary-50/30 dark:bg-primary-900/10'
        )}
        onContextMenu={handleContext}
        role="gridcell"
        aria-label={`No shift on ${date}`}
      />
    );
  }

  const theme = SHIFT_THEMES[entry.shiftCategory];

  return (
    <div
      className={cn(
        'flex h-full items-center justify-center px-0.5',
        isWeekend && 'bg-slate-50/60 dark:bg-slate-800/30',
        isToday && 'bg-primary-50/40 dark:bg-primary-900/15',
        isHighlighted && 'ring-2 ring-primary ring-inset'
      )}
      onContextMenu={handleContext}
      role="gridcell"
      aria-label={`${employee.name} - ${theme.fullLabel} on ${date}`}
    >
      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={cn(
          'inline-flex h-7 min-w-[32px] items-center justify-center rounded-md px-1',
          'text-[10px] font-bold border cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/30',
          'shadow-sm hover:shadow-md transition-shadow duration-200',
          theme.bg, theme.bgDark, theme.text, theme.textDark, theme.border
        )}
        title={`${theme.fullLabel} · ${entry.startTime}–${entry.endTime}${entry.notes ? ` · ${entry.notes}` : ''}`}
      >
        {theme.label}
      </motion.button>
    </div>
  );
}

export default memo(ScheduleCell);
