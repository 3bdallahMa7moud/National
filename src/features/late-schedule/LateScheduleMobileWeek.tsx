import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import { cn } from '@/lib/utils';
import { getLateScheduleIntlLocale } from './lateScheduleLocale';

interface LateScheduleMobileWeekProps {
  year: number;
  month: number;
  rows: OTShiftRow[];
  units?: OTUnit[];
  roster: UnifiedEmployee[];
  canEdit?: boolean;
  onAssign?(rowId: string, day: number): void;
  onAssignmentClick?(rowId: string, day: number, employeeId: string): void;
}

function buildWeekStarts(daysInMonth: number): number[] {
  const starts: number[] = [];
  for (let day = 1; day <= daysInMonth; day += 7) starts.push(day);
  return starts;
}

export default function LateScheduleMobileWeek({
  year,
  month,
  rows,
  units = [],
  roster,
  canEdit = false,
  onAssign,
  onAssignmentClick,
}: LateScheduleMobileWeekProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const locale = getLateScheduleIntlLocale(isRtl);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekStarts = useMemo(() => buildWeekStarts(daysInMonth), [daysInMonth]);
  const [weekIndex, setWeekIndex] = useState(0);
  const safeWeekIndex = Math.min(weekIndex, weekStarts.length - 1);
  const weekStart = weekStarts[safeWeekIndex];
  const [selectedDay, setSelectedDay] = useState(1);
  const employeeById = useMemo(
    () => new Map(roster.map((employee) => [employee.employeeId, employee])),
    [roster],
  );
  const days = Array.from(
    { length: Math.min(7, daysInMonth - weekStart + 1) },
    (_, index) => weekStart + index,
  );
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month, 1));
  const activeUnits = units.filter((unit) => !unit.archived);
  const activeRows = activeUnits.length > 0
    ? activeUnits.flatMap((unit) => rows.filter((row) => !row.archived && row.unitId === unit.id))
    : rows.filter((row) => !row.archived);

  useEffect(() => {
    setWeekIndex(0);
    setSelectedDay(1);
  }, [month, year]);

  const moveWeek = (direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(weekStarts.length - 1, safeWeekIndex + direction));
    setWeekIndex(nextIndex);
    setSelectedDay(weekStarts[nextIndex]);
  };

  return (
    <section
      data-testid="ot-mobile-week"
      className="min-w-0 max-w-full space-y-4 overflow-x-hidden md:hidden"
      aria-label={isRtl ? 'عرض المناوبات الإضافية الأسبوعي' : 'Weekly OT schedule'}
    >
      <div className="rounded-2xl border border-border bg-surface p-2 shadow-card">
        <div className="flex min-w-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveWeek(-1)}
          disabled={safeWeekIndex === 0}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-text-primary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={isRtl ? 'الأسبوع السابق' : 'Previous week'}
        >
          {isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-extrabold text-text-primary">{monthName} {year}</p>
          <p className="mt-0.5 text-[11px] font-medium text-text-secondary">
            {isRtl ? `الأسبوع ${safeWeekIndex + 1} من ${weekStarts.length}` : `Week ${safeWeekIndex + 1} of ${weekStarts.length}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => moveWeek(1)}
          disabled={safeWeekIndex === weekStarts.length - 1}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-text-primary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={isRtl ? 'الأسبوع التالي' : 'Next week'}
        >
          {isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full grid-cols-7 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-card">
        {days.map((day) => {
          const date = new Date(year, month, day);
          const weekend = date.getDay() === 5 || date.getDay() === 6;
          const highlighted = activeRows.some((row) => row.highlightedDays?.includes(day));
          const selected = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              data-testid={`ot-mobile-day-${day}`}
              aria-pressed={selectedDay === day}
              onClick={() => setSelectedDay(day)}
              aria-label={`${isRtl ? 'اختر' : 'Select'} ${monthName} ${day}`}
              className={cn(
                'flex min-h-16 min-w-0 max-w-full flex-col items-center justify-center overflow-hidden rounded-xl border px-0.5 text-xs outline-none transition-colors focus:ring-2 focus:ring-primary/40',
                selected
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : highlighted
                    ? 'border-warning/50 bg-warning-50 text-text-primary'
                    : weekend
                      ? 'border-border bg-surface-muted text-text-primary'
                      : 'border-border bg-surface text-text-primary hover:bg-hover',
              )}
            >
              <span data-testid="ot-mobile-day" className={cn('block max-w-full truncate text-[9px] font-semibold', selected ? 'text-white/80' : 'text-text-secondary')}>
                {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
              </span>
              <span className="mt-1 block text-sm font-extrabold">{day}</span>
            </button>
          );
        })}
      </div>

      <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
        {activeRows.map((row) => {
          const assignments = row.assignments[selectedDay] ?? [];
          const highlighted = row.highlightedDays?.includes(selectedDay) ?? false;
          return (
            <article
              key={row.id}
              className={cn(
                'relative min-w-0 max-w-full overflow-hidden rounded-2xl border bg-surface p-4 shadow-card',
                highlighted ? 'border-warning/50' : 'border-border',
              )}
            >
              <span
                className="absolute inset-y-0 start-0 w-1.5 bg-primary"
                style={{ backgroundColor: row.backgroundColor }}
                aria-hidden="true"
              />
              <div className="min-w-0 ps-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-sm font-extrabold leading-6 text-text-primary">{row.title}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                    {assignments.length} {isRtl ? 'موظف' : assignments.length === 1 ? 'employee' : 'employees'}
                  </span>
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap gap-2 text-[11px] font-medium text-text-secondary">
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-surface-muted px-2 py-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="break-words">{row.location}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2 py-1" dir="ltr">
                    <Clock3 className="h-3.5 w-3.5 text-primary" />
                    {row.timeRange}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2 py-1" dir="ltr">
                    <CalendarDays className="h-3.5 w-3.5 text-primary" />
                    {row.hours}h
                  </span>
                </div>
              </div>

              <div
                data-testid={`ot-mobile-codes-${row.id}`}
                className="mt-4 flex min-w-0 flex-wrap gap-2 ps-1"
              >
                {assignments.length === 0 && (
                  <span className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-3 text-xs font-medium text-text-secondary">
                    <UsersRound className="h-4 w-4" />
                    {isRtl ? 'لا يوجد تعيين في هذا اليوم' : 'No employees assigned for this day'}
                  </span>
                )}
                {assignments.map((assignment, index) => {
                  if (assignment.kind === 'unresolved') {
                    return <span key={`${assignment.legacyCode}-${index}`} className="max-w-full break-all rounded-xl border border-danger/30 bg-danger-50 px-2.5 py-2 font-mono text-xs font-bold text-danger">{assignment.legacyCode} ?</span>;
                  }
                  const employee = employeeById.get(assignment.employeeId);
                  const name = isRtl ? employee?.fullName : employee?.fullNameEn || employee?.fullName;
                  return (
                    <button
                      type="button"
                      key={`${assignment.employeeId}-${index}`}
                      disabled={!onAssignmentClick}
                      onClick={() => onAssignmentClick?.(row.id, selectedDay, assignment.employeeId)}
                      className="min-w-0 max-w-full rounded-xl border border-primary/20 bg-primary-50 px-2.5 py-2 text-start text-xs text-primary disabled:cursor-default"
                      style={{ backgroundColor: row.backgroundColor, color: row.textColor, borderColor: row.backgroundColor }}
                    >
                      <strong className="font-mono">{employee?.code ?? assignment.employeeId}</strong>
                      {name ? <span className="ms-1 break-words">{name}</span> : null}
                    </button>
                  );
                })}
              </div>

              {canEdit && (
                <button
                  type="button"
                  className="mt-4 min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onClick={() => onAssign?.(row.id, selectedDay)}
                  aria-label={`${isRtl ? 'تعيين موظفين إلى' : 'Assign employees to'} ${row.title}`}
                >
                  {isRtl ? 'تعيين الموظفين' : 'Assign employees'}
                </button>
              )}
            </article>
          );
        })}
        {activeRows.length === 0 && (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 text-center text-sm text-text-secondary">
            <UsersRound className="mb-2 h-6 w-6 text-text-muted" />
            {isRtl ? 'لا توجد شفتات OT نشطة لهذا الشهر.' : 'No active OT shifts for this month.'}
          </div>
        )}
      </div>
    </section>
  );
}
