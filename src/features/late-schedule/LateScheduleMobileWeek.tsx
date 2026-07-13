import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import { getLateScheduleIntlLocale } from './lateScheduleLocale';

interface LateScheduleMobileWeekProps {
  year: number;
  month: number;
  rows: OTShiftRow[];
  roster: UnifiedEmployee[];
  canEdit: boolean;
  onAssign(rowId: string, day: number): void;
}

const PALETTE = {
  white: '#FFFFFF',
  black: '#000000',
  title: '#BFBFBF',
  weekend: '#737373',
  highlight: '#FFFF00',
  legend: '#009999',
} as const;

function buildWeekStarts(daysInMonth: number): number[] {
  const starts: number[] = [];
  for (let day = 1; day <= daysInMonth; day += 7) starts.push(day);
  return starts;
}

export default function LateScheduleMobileWeek({
  year,
  month,
  rows,
  roster,
  canEdit,
  onAssign,
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
  const activeRows = rows.filter((row) => !row.archived);

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
      className="min-w-0 max-w-full space-y-3 overflow-x-hidden bg-white text-black md:hidden"
      style={{ backgroundColor: PALETTE.white, color: PALETTE.black, fontFamily: 'Calibri, Arial, sans-serif' }}
      aria-label={isRtl ? 'عرض المناوبات الإضافية الأسبوعي' : 'Weekly OT schedule'}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 border border-black px-2 py-1" style={{ backgroundColor: PALETTE.title }}>
        <button
          type="button"
          onClick={() => moveWeek(-1)}
          disabled={safeWeekIndex === 0}
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-black bg-white text-black disabled:opacity-40"
          aria-label={isRtl ? 'الأسبوع السابق' : 'Previous week'}
        >
          {isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <span className="min-w-0 truncate text-sm font-bold text-black">{monthName} {year}</span>
        <button
          type="button"
          onClick={() => moveWeek(1)}
          disabled={safeWeekIndex === weekStarts.length - 1}
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-black bg-white text-black disabled:opacity-40"
          aria-label={isRtl ? 'الأسبوع التالي' : 'Next week'}
        >
          {isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>

      <div className="grid min-w-0 max-w-full grid-cols-7 gap-px overflow-hidden border border-black bg-black">
        {days.map((day) => {
          const date = new Date(year, month, day);
          const weekend = date.getDay() === 5 || date.getDay() === 6;
          const highlighted = activeRows.some((row) => row.highlightedDays?.includes(day));
          const backgroundColor = highlighted
            ? PALETTE.highlight
            : weekend ? PALETTE.weekend : PALETTE.white;
          const foregroundColor = weekend && !highlighted ? PALETTE.white : PALETTE.black;
          return (
            <button
              key={day}
              type="button"
              data-testid={`ot-mobile-day-${day}`}
              aria-pressed={selectedDay === day}
              onClick={() => setSelectedDay(day)}
              aria-label={`${isRtl ? 'اختر' : 'Select'} ${monthName} ${day}`}
              className="flex min-h-14 min-w-0 max-w-full flex-col items-center justify-center overflow-hidden px-0.5 text-xs outline-none ring-inset focus:ring-2 focus:ring-black"
              style={{ backgroundColor, color: foregroundColor }}
            >
              <span data-testid="ot-mobile-day" className="block max-w-full truncate text-[9px]">
                {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
              </span>
              <span className="block text-sm font-bold">{day}</span>
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
              className="min-w-0 max-w-full overflow-hidden border border-black p-3 text-black"
              style={{ backgroundColor: highlighted ? PALETTE.highlight : PALETTE.white }}
            >
              <div className="min-w-0">
                <h3 className="break-words text-base font-bold text-black">{row.title}</h3>
                <p className="mt-1 break-words text-xs text-black">
                  {row.location} | <span dir="ltr">{row.timeRange}</span> | {row.hours}h
                </p>
              </div>

              <div
                data-testid={`ot-mobile-codes-${row.id}`}
                className="mt-3 flex min-w-0 flex-wrap gap-2"
              >
                {assignments.length === 0 && <span className="text-xs text-black">{isRtl ? 'لا يوجد تعيين' : 'No assignment'}</span>}
                {assignments.map((assignment, index) => {
                  if (assignment.kind === 'unresolved') {
                    return <span key={`${assignment.legacyCode}-${index}`} className="border border-black bg-white px-2 py-1 font-mono text-xs font-bold text-black">{assignment.legacyCode} ?</span>;
                  }
                  const employee = employeeById.get(assignment.employeeId);
                  const name = isRtl ? employee?.fullName : employee?.fullNameEn || employee?.fullName;
                  return (
                    <span key={`${assignment.employeeId}-${index}`} className="min-w-0 border border-black bg-white px-2 py-1 text-xs text-black">
                      <strong className="font-mono text-black">{employee?.code ?? assignment.employeeId}</strong>
                      {name ? <span className="ms-1 break-words text-black">{name}</span> : null}
                    </span>
                  );
                })}
              </div>

              {canEdit && (
                <button
                  type="button"
                  className="mt-3 min-h-11 w-full border border-black px-3 py-2 font-bold text-white focus:outline-none focus:ring-2 focus:ring-black/50"
                  style={{ backgroundColor: PALETTE.legend }}
                  onClick={() => onAssign(row.id, selectedDay)}
                  aria-label={`${isRtl ? 'تعيين موظفين إلى' : 'Assign employees to'} ${row.title}`}
                >
                  {isRtl ? 'تعيين الموظفين' : 'Assign employees'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
