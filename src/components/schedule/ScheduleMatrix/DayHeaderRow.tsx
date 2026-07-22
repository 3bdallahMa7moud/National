// ============================================================
// DayHeaderRow — Sticky day numbers 1–31
// ============================================================

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { HolidayRange } from '@/types/scheduleMatrix';

interface DayHeaderRowProps {
  daysInMonth: number;
  year: number;
  month: number; // 0-indexed
  holidays?: HolidayRange[];
  onResizeStart?: (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => void;
}

function DayHeaderRow({ daysInMonth, year, month, holidays = [], onResizeStart }: DayHeaderRowProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US';
  const numberFormatter = new Intl.NumberFormat(locale, { useGrouping: false });
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
        const holiday = holidays.find((item) => day >= item.startDay && day <= item.endDay);
        const isHolidayStart = holiday?.startDay === day;
        const holidayLabel = holiday && i18n.language === 'ar' ? (holiday.labelAr || holiday.label) : holiday?.label;

        return (
          <div
            key={day}
            data-testid={`day-header-${day}`}
            data-holiday-day={holiday ? day : undefined}
            className={cn(
              'relative flex flex-col items-center justify-center text-center select-none group',
              'border-b border-e border-border',
              isWeekend && 'bg-[var(--weekend-tint)]',
              holiday && 'bg-amber-100/80 dark:bg-amber-950/35',
              isToday && 'bg-[var(--today-tint)]',
              !isWeekend && !isToday && !holiday && 'bg-surface',
              holidays.length > 0 && 'pt-4',
            )}
            style={{
              minWidth: 'var(--matrix-day-col)',
              width: 'var(--matrix-day-col)',
              height: 'var(--matrix-header-height)',
            }}
          >
            {isHolidayStart && holiday && (
              <span
                className="absolute inset-inline-start-0 top-0 z-10 flex h-4 items-center justify-center overflow-hidden border-b border-amber-300 bg-amber-300 px-1 text-[8px] font-extrabold uppercase tracking-wide text-amber-950 dark:border-amber-700 dark:bg-amber-800 dark:text-amber-50"
                style={{ width: `calc(var(--matrix-day-col) * ${holiday.endDay - holiday.startDay + 1})` }}
                title={holidayLabel}
              >
                {holidayLabel}
              </span>
            )}
            <span className={cn(
              'text-[10px] font-medium',
              isToday ? 'text-primary-teal' : isWeekend ? 'text-alert-coral font-semibold' : 'text-text-secondary',
            )}>
              {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
            </span>
            <span className={cn(
              'text-xs font-bold mt-0.5',
              isToday && 'bg-primary-teal text-white w-5 h-5 rounded-full flex items-center justify-center',
              !isToday && 'text-ink',
            )}>
              {numberFormatter.format(day)}
            </span>

            {/* Column Resizer */}
            {onResizeStart && (
              <div
                className="absolute top-0 bottom-0 end-[-3px] w-[6px] z-20 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 hover:bg-primary-teal/50 transition-opacity"
                onMouseDown={onResizeStart}
                onTouchStart={onResizeStart}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default memo(DayHeaderRow);
