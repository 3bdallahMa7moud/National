import { memo, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getShiftChipStyle } from './getShiftChipClasses';
import type { MatrixCellRef, ScheduleMatrixData } from '@/types/scheduleMatrix';

interface MobileWeeklyScheduleProps {
  data: ScheduleMatrixData;
  onCellClick?: (ref: MatrixCellRef) => void;
}

function MobileWeeklySchedule({ data, onCellClick }: MobileWeeklyScheduleProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const isRtl = i18n.dir() === 'rtl';
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const today = new Date();
  const initialDay = today.getFullYear() === data.year && today.getMonth() === data.month
    ? today.getDate()
    : 1;
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setSelectedDay(initialDay);
  }, [data.month, data.year, initialDay]);

  useEffect(() => {
    setShowAll(false);
  }, [selectedDay]);

  const weekStart = Math.floor((selectedDay - 1) / 7) * 7 + 1;
  const weekDays = Array.from(
    { length: Math.min(7, daysInMonth - weekStart + 1) },
    (_, index) => weekStart + index,
  );
  const weekNumber = Math.floor((weekStart - 1) / 7) + 1;
  const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US';
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const assignments = useMemo(() => {
    const legendByCode = new Map(data.legend.map((employee) => [employee.code, employee]));
    return data.facilities.flatMap((facility) =>
      facility.units.flatMap((unit) =>
        unit.rows.flatMap((row) =>
          (row.cellsByDay[selectedDay] || []).map((assignment) => ({
            ref: { facilityId: facility.id, unitId: unit.id, rowId: row.id, day: selectedDay },
            facility: facility.name,
            unit: unit.name,
            shift: row.shiftLabel,
            time: row.timeRange,
            colorKey: row.colorKey,
            code: assignment.employeeCode,
            employee: legendByCode.get(assignment.employeeCode)?.fullName || assignment.employeeCode,
          })),
        ),
      ),
    );
  }, [data, selectedDay]);

  const selectedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(data.year, data.month, selectedDay));
  const visibleAssignments = showAll ? assignments : assignments.slice(0, 12);

  return (
    <section
      data-testid="mobile-weekly-schedule"
      className="min-w-0 space-y-3 overflow-hidden rounded-card border border-border bg-surface p-3 shadow-card"
      aria-label={t('schedule:matrix.mobileTitle')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary">
            <CalendarDays className="h-4 w-4 text-primary" />
            {t('schedule:matrix.mobileTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {t('schedule:matrix.weekLabel', { week: weekNumber })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedDay(Math.max(1, selectedDay - 7))}
            disabled={weekStart === 1}
            className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-border text-text-secondary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-40"
            aria-label={t('schedule:matrix.previousWeek')}
          >
            <PrevIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedDay(Math.min(daysInMonth, selectedDay + 7))}
            disabled={weekStart + 7 > daysInMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-border text-text-secondary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-40"
            aria-label={t('schedule:matrix.nextWeek')}
          >
            <NextIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[350px] grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const date = new Date(data.year, data.month, day);
            const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
            const active = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-lg border px-1 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface-muted text-text-secondary hover:bg-hover hover:text-text-primary',
                )}
                aria-pressed={active}
              >
                <span className="text-[10px] font-semibold">{weekday}</span>
                <span className="mt-0.5 text-sm font-bold">{new Intl.NumberFormat(locale).format(day)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-[11px] font-medium text-text-secondary">
        {t('schedule:matrix.swipeHint')}
      </p>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-text-primary">
            {t('schedule:matrix.assignmentsFor', { date: selectedDate })}
          </h3>
          <span className="rounded-pill bg-surface-muted px-2 py-1 text-[11px] font-semibold text-text-secondary">
            {t('schedule:matrix.assignmentCount', { count: assignments.length })}
          </span>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-text-secondary">
            {t('schedule:matrix.noAssignments')}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAssignments.map((entry, index) => (
              <button
                key={`${entry.ref.rowId}-${entry.code}-${index}`}
                type="button"
                onClick={() => onCellClick?.(entry.ref)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-start transition-transform active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={getShiftChipStyle(entry.colorKey)}
                aria-label={`${entry.employee}, ${entry.shift}, ${entry.facility}, ${entry.unit}, ${entry.time}`}
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-surface/70 font-mono text-xs font-bold">
                  {entry.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-bold">
                    <UserRound className="h-3.5 w-3.5 shrink-0" />
                    {entry.employee}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold">{entry.shift} · {entry.unit}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
                    <Clock3 className="h-3 w-3" />
                    <span dir="ltr">{entry.time}</span>
                    <span>·</span>
                    <span dir="ltr">{entry.facility}</span>
                  </span>
                </span>
              </button>
            ))}
            {assignments.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="min-h-11 w-full rounded-btn border border-border bg-surface-muted px-4 text-sm font-semibold text-primary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {showAll
                  ? t('schedule:matrix.showFewerAssignments')
                  : t('schedule:matrix.showAllAssignments', { count: assignments.length })}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(MobileWeeklySchedule);
