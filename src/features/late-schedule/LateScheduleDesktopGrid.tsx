import { useMemo } from 'react';
import { Edit3, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import { cn } from '@/lib/utils';

interface LateScheduleDesktopGridProps {
  year: number;
  month: number;
  rows: OTShiftRow[];
  units?: OTUnit[];
  roster: UnifiedEmployee[];
  notice?: string;
  canEdit?: boolean;
  onAssign?(rowId: string, day: number): void;
  onAssignmentClick?(rowId: string, day: number, employeeId: string): void;
  onEditRow?(rowId: string): void;
}

export default function LateScheduleDesktopGrid({
  year,
  month,
  rows,
  units = [],
  roster,
  canEdit = false,
  onAssign,
  onAssignmentClick,
  onEditRow,
}: LateScheduleDesktopGridProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const locale = isRtl ? 'ar-SA-u-ca-gregory' : 'en-US';
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const activeUnits = units.filter((unit) => !unit.archived);
  const activeRows = activeUnits.length > 0
    ? activeUnits.flatMap((unit) => rows.filter((row) => !row.archived && row.unitId === unit.id))
    : rows.filter((row) => !row.archived);
  const employeeById = useMemo(
    () => new Map(roster.map((employee) => [employee.employeeId, employee])),
    [roster],
  );

  return (
    <section
      data-testid="ot-schedule-surface"
      className="relative hidden min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:block"
      aria-label={isRtl ? 'جدول OT الشهري' : 'Monthly OT schedule'}
    >
      <div
        data-testid="ot-schedule-scroll"
        className="relative max-h-[68vh] max-w-full overflow-auto overscroll-contain"
        tabIndex={0}
        aria-label={isRtl ? 'مرر داخل الجدول لعرض بقية الأيام' : 'Monthly OT schedule, scroll to view more days'}
      >
        <table className="min-w-max border-separate border-spacing-0 text-xs text-text-primary">
          <thead data-testid="ot-day-header" className="sticky top-0 z-30">
            <tr>
              <th className="sticky start-0 z-40 min-w-72 border-b border-e border-border bg-surface px-4 py-3 text-start shadow-[4px_0_8px_-8px_rgb(var(--color-shadow))] rtl:shadow-[-4px_0_8px_-8px_rgb(var(--color-shadow))]">
                <span className="block text-sm font-bold">{isRtl ? 'تفاصيل الشفت' : 'Shift details'}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-text-secondary">
                  {isRtl ? 'الموقع · الوقت' : 'Location · time'}
                </span>
              </th>
              {days.map((day) => {
                const date = new Date(year, month, day);
                const weekend = date.getDay() === 5 || date.getDay() === 6;
                const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
                return (
                  <th
                    key={day}
                    data-testid={`ot-day-${day}`}
                    className={cn(
                      'min-w-[3.25rem] border-b border-e border-border px-1 py-2 text-center',
                      weekend ? 'bg-surface-muted' : 'bg-surface',
                    )}
                  >
                    <span className="block text-[10px] font-semibold uppercase text-text-secondary">{weekday}</span>
                    <span className="mt-0.5 block text-sm font-bold text-text-primary">{day}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row.id} className="group">
                <th
                  data-testid={`ot-shift-column-${row.id}`}
                  className="sticky start-0 z-20 min-w-72 border-b border-e border-border bg-surface px-4 py-3 text-start align-top shadow-[4px_0_8px_-8px_rgb(var(--color-shadow))] rtl:shadow-[-4px_0_8px_-8px_rgb(var(--color-shadow))]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-bold text-text-primary" title={row.title}>{row.title}</span>
                      <span className="mt-1 block truncate text-[11px] font-medium text-text-secondary">{row.location}</span>
                      <span className="mt-1 block text-[11px] text-text-secondary" dir="ltr">
                        {row.timeRange}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEditRow?.(row.id)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-hover hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-label={`${isRtl ? 'تعديل' : 'Edit'} ${row.title}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </th>
                {days.map((day) => {
                  const assignments = row.assignments[day] ?? [];
                  const highlighted = row.highlightedDays?.includes(day) ?? false;
                  const clickableAssignment = assignments.find((assignment) => assignment.kind === 'employee');
                  const date = new Date(year, month, day);
                  const weekend = date.getDay() === 5 || date.getDay() === 6;
                  return (
                    <td
                      key={day}
                      data-testid={`ot-cell-${row.id}-${day}`}
                      className={cn(
                        'min-w-[3.25rem] border-b border-e border-border p-1 align-top',
                        highlighted ? 'bg-warning-50' : weekend ? 'bg-surface-muted' : 'bg-surface',
                      )}
                    >
                      <button
                        type="button"
                        disabled={!canEdit && !(onAssignmentClick && clickableAssignment)}
                        onClick={() => {
                          if (canEdit) onAssign?.(row.id, day);
                          else if (clickableAssignment?.kind === 'employee') {
                            onAssignmentClick?.(row.id, day, clickableAssignment.employeeId);
                          }
                        }}
                        className="flex min-h-11 w-full min-w-[3.25rem] flex-col items-stretch justify-center gap-1 rounded-lg bg-transparent px-1 py-1 text-start transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40 disabled:cursor-default disabled:hover:bg-transparent"
                        aria-label={`${isRtl ? 'تعيين موظفين إلى' : 'Assign employees to'} ${row.title}, ${day}`}
                      >
                        {assignments.length === 0 ? (
                          <span className="block text-center text-base font-medium text-text-muted" aria-hidden="true">·</span>
                        ) : assignments.slice(0, 2).map((assignment, index) => {
                          if (assignment.kind === 'unresolved') {
                            return (
                              <span key={`${assignment.legacyCode}-${index}`} className="block rounded-md border border-danger/30 bg-danger-50 px-1.5 py-1 text-center font-mono text-[10px] font-bold text-danger" dir="ltr">
                                {assignment.legacyCode}?
                              </span>
                            );
                          }
                          const employee = employeeById.get(assignment.employeeId);
                          const code = employee?.code ?? assignment.employeeId;
                          const name = isRtl ? employee?.fullName : employee?.fullNameEn || employee?.fullName;
                          return (
                            <span
                              key={`${assignment.employeeId}-${index}`}
                              className="block min-w-0 rounded-md border border-primary/20 bg-primary-50 px-1.5 py-1 text-primary"
                              style={{ backgroundColor: row.backgroundColor, color: row.textColor }}
                            >
                              <span className="block text-center font-mono text-[10px] font-bold" dir="ltr">{code}</span>
                              {name && <span className="mt-0.5 block max-w-20 truncate text-center text-[9px] font-medium" title={name}>{name}</span>}
                            </span>
                          );
                        })}
                        {assignments.length > 2 && (
                          <span className="block rounded-md border border-primary/20 bg-primary/10 px-1 py-0.5 text-center text-[9px] font-extrabold text-primary">
                            +{assignments.length - 2}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {activeRows.length === 0 && (
          <div className="flex min-h-40 items-center justify-center gap-2 px-6 text-sm text-text-secondary">
            <Users className="h-5 w-5" />
            {isRtl ? 'لا توجد صفوف OT نشطة لهذا الشهر.' : 'No active OT rows for this month.'}
          </div>
        )}
      </div>
      <div className="border-t border-border bg-surface-muted px-4 py-2 text-center text-xs font-medium text-text-secondary">
        {isRtl ? 'مرر داخل الجدول لعرض بقية الأيام' : 'Scroll to view more days'}
      </div>
    </section>
  );
}
