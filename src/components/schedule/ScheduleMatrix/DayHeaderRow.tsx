// ============================================================
// DayHeaderRow — Sticky day numbers 1–31
// ============================================================

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface DayHeaderRowProps {
  daysInMonth: number;
  year: number;
  month: number; // 0-indexed
}

function DayHeaderRow({ daysInMonth, year, month }: DayHeaderRowProps) {
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  return (
    <>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const date = new Date(year, month, day);
        const dow = date.getDay();
        const isWeekend = dow === 5 || dow === 6; // Fri, Sat
        const isToday = day === todayDay;

        return (
          <div
            key={day}
            className={cn(
              'flex flex-col items-center justify-center text-center select-none',
              'border-b border-e border-border',
              isWeekend && 'bg-[var(--weekend-tint)]',
              isToday && 'bg-[var(--today-tint)]',
              !isWeekend && !isToday && 'bg-surface',
            )}
            style={{
              minWidth: 'var(--matrix-day-col)',
              width: 'var(--matrix-day-col)',
              height: 'var(--matrix-header-height)',
            }}
          >
            <span className={cn(
              'text-[10px] font-medium',
              isToday ? 'text-primary-teal' : isWeekend ? 'text-alert-coral font-semibold' : 'text-text-secondary',
            )}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]}
            </span>
            <span className={cn(
              'text-xs font-bold mt-0.5',
              isToday && 'bg-primary-teal text-white w-5 h-5 rounded-full flex items-center justify-center',
              !isToday && 'text-ink',
            )}>
              {day}
            </span>
          </div>
        );
      })}
    </>
  );
}

export default memo(DayHeaderRow);
