import { memo, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getShiftChipStyle } from './getShiftChipClasses';
import { scheduleCellMarkerBackground, scheduleCellMarkerKey } from '@/lib/scheduleCellMarkers';
import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import { buildEmployeeDisplayLookup } from '@/lib/employeeDisplay';
import { useEmployeeDirectoryStore } from '@/stores/employeeDirectoryStore';
import type { Assignment, MatrixCellRef, ScheduleMatrixData } from '@/types/scheduleMatrix';

interface MobileWeeklyScheduleProps {
  data: ScheduleMatrixData;
  onCellClick?: (ref: MatrixCellRef) => void;
  onAssignmentClick?: (ref: MatrixCellRef, assignment: Assignment) => void;
  showEmptySlots?: boolean;
  markerToolActive?: boolean;
}

function MobileWeeklySchedule({
  data,
  onCellClick,
  onAssignmentClick,
  showEmptySlots = false,
  markerToolActive = false,
}: MobileWeeklyScheduleProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const isRtl = i18n.dir() === 'rtl';
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const today = new Date();
  const initialDay = today.getFullYear() === data.year && today.getMonth() === data.month
    ? today.getDate()
    : 1;
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [showAll, setShowAll] = useState(false);
  const directoryRecords = useEmployeeDirectoryStore((state) => state.records);

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
    const employeeLookup = buildEmployeeDisplayLookup(data.legend, directoryRecords, isRtl);
    return data.facilities.flatMap((facility) =>
      facility.units.flatMap((unit) =>
        unit.rows.flatMap((row) =>
          (row.cellsByDay[selectedDay] || []).map((assignment) => {
            const employee = employeeLookup.resolve(assignment);
            return {
              ref: { facilityId: facility.id, unitId: unit.id, rowId: row.id, day: selectedDay },
              facility: facility.name,
              unit: unit.name,
              shift: row.shiftLabel,
              time: row.timeRange,
              colorKey: row.colorKey,
              backgroundColor: row.backgroundColor,
              textColor: row.textColor,
              assignment,
              markerColor: data.cellMarkers[scheduleCellMarkerKey(row.id, selectedDay)],
              employee: employee.name,
              employeeNumber: employee.employeeNumber,
              tooltip: employee.tooltip,
            };
          }),
        ),
      ),
    );
  }, [data, directoryRecords, isRtl, selectedDay]);

  const slots = useMemo(() => {
    const employeeLookup = buildEmployeeDisplayLookup(data.legend, directoryRecords, isRtl);
    return data.facilities.flatMap((facility) =>
      facility.units
        .filter((unit) => !unit.archived)
        .flatMap((unit) =>
          filterActiveScheduleRows(data, facility.id, unit.rows).map((row) => {
            const cellAssignments = row.cellsByDay[selectedDay] || [];
            const markerColor = data.cellMarkers[scheduleCellMarkerKey(row.id, selectedDay)];
            return {
              ref: { facilityId: facility.id, unitId: unit.id, rowId: row.id, day: selectedDay },
              facility: facility.name,
              unit: unit.name,
              shift: row.shiftLabel,
              rowLabel: row.rowLabel,
              time: row.timeRange,
              colorKey: row.colorKey,
              backgroundColor: row.backgroundColor,
              textColor: row.textColor,
              markerColor,
              assignments: cellAssignments.map((assignment, index) => ({
                assignment,
                index,
                employee: employeeLookup.resolve(assignment),
              })),
            };
          }),
        ),
    ).filter((entry) => showEmptySlots || entry.assignments.length > 0);
  }, [data, directoryRecords, isRtl, selectedDay, showEmptySlots]);

  const selectedDate = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(data.year, data.month, selectedDay));
  const visibleAssignments = showAll ? assignments : assignments.slice(0, 12);
  const visibleSlots = showAll ? slots : slots.slice(0, 12);
  const visibleCount = showEmptySlots ? slots.length : assignments.length;

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

      <div className="min-w-0 pb-1">
        <div className="grid min-w-0 grid-cols-7 gap-1">
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
                  'flex min-h-14 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border px-0.5 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface-muted text-text-secondary hover:bg-hover hover:text-text-primary',
                )}
                aria-pressed={active}
              >
                <span className="block max-w-full truncate text-[9px] font-semibold sm:text-[10px]">{weekday}</span>
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

        {visibleCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-text-secondary">
            {t('schedule:matrix.noAssignments')}
          </div>
        ) : showEmptySlots ? (
          <div className="space-y-2">
            {visibleSlots.map((entry) => {
              const chipStyle = getShiftChipStyle(entry.colorKey, entry.backgroundColor, entry.textColor);
              return (
                <article
                  key={`${entry.ref.facilityId}-${entry.ref.unitId}-${entry.ref.rowId}`}
                  data-cell-marker-color={entry.markerColor}
                  className="relative overflow-hidden rounded-xl border border-border bg-surface p-3 shadow-soft"
                  style={{
                    backgroundColor: entry.markerColor
                      ? scheduleCellMarkerBackground(entry.markerColor)
                      : undefined,
                  }}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                      style={chipStyle}
                      aria-hidden="true"
                    >
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-extrabold text-text-primary">
                        {entry.rowLabel || entry.shift}
                      </h4>
                      <p className="mt-1 truncate text-xs font-semibold text-primary-teal">
                        {entry.shift} · {entry.unit}
                      </p>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-text-secondary">
                        <span dir="ltr">{entry.time}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{entry.facility}</span>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-pill bg-surface-muted px-2 py-1 text-[11px] font-bold text-text-secondary">
                      {t('schedule:matrix.assignmentCount', { count: entry.assignments.length })}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.assignments.length === 0 ? (
                      <span className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted px-3 text-xs font-semibold text-text-secondary">
                        {t('schedule:matrix.emptyCell')}
                      </span>
                    ) : entry.assignments.map(({ assignment, employee, index }) => (
                      <button
                        key={`${assignment.employeeId}-${index}`}
                        type="button"
                        disabled={!onAssignmentClick}
                        onClick={() => onAssignmentClick?.(entry.ref, assignment)}
                        className="min-h-10 min-w-0 max-w-full rounded-lg border border-current/20 px-2.5 py-1.5 text-start text-xs font-bold disabled:cursor-default"
                        style={chipStyle}
                        title={employee.tooltip}
                      >
                        <span className="block max-w-full truncate">
                          {employee.code || assignment.employeeCode}
                        </span>
                        <span className="mt-0.5 block max-w-full truncate text-[10px] font-semibold opacity-80">
                          {employee.name}
                        </span>
                      </button>
                    ))}
                  </div>

                  {onCellClick && (
                    <button
                      type="button"
                      onClick={() => onCellClick(entry.ref)}
                      className={cn(
                        'mt-3 min-h-11 w-full rounded-btn border px-3 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                        markerToolActive
                          ? 'border-primary-teal bg-primary-teal/10 text-primary-teal'
                          : 'border-primary bg-primary text-white hover:bg-primary-700',
                      )}
                    >
                      {markerToolActive
                        ? t('schedule:markers.activeHint')
                        : t('schedule:matrix.assignEmployee')}
                    </button>
                  )}
                </article>
              );
            })}
            {slots.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="min-h-11 w-full rounded-btn border border-border bg-surface-muted px-4 text-sm font-semibold text-primary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {showAll
                  ? t('schedule:matrix.showFewerAssignments')
                  : t('schedule:matrix.showAllAssignments', { count: slots.length })}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAssignments.map((entry, index) => (
              <button
                key={`${entry.ref.rowId}-${entry.assignment.employeeId}-${index}`}
                type="button"
                onClick={() => {
                  if (onAssignmentClick) onAssignmentClick(entry.ref, entry.assignment);
                  else onCellClick?.(entry.ref);
                }}
                className="relative flex min-h-14 w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-start transition-transform active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={getShiftChipStyle(entry.colorKey, entry.backgroundColor, entry.textColor)}
                aria-label={`${entry.employee}, ${entry.shift}, ${entry.facility}, ${entry.unit}, ${entry.time}${entry.markerColor ? `, ${t('schedule:markers.modifiedShiftMarker')}` : ''}`}
                title={entry.tooltip}
              >
                {entry.markerColor && (
                  <span
                    className="pointer-events-none absolute inset-0 z-0"
                    style={{
                      backgroundColor: scheduleCellMarkerBackground(entry.markerColor),
                    }}
                    aria-label={t('schedule:markers.modifiedShiftMarker')}
                    title={t('schedule:markers.modifiedShiftMarker')}
                  />
                )}
                <span className="relative z-[1] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-surface/70">
                  <UserRound className="h-4 w-4" />
                </span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-bold">
                    <UserRound className="h-3.5 w-3.5 shrink-0" />
                    {entry.employee}
                  </span>
                  {entry.employeeNumber && (
                    <span className="mt-1 block truncate text-[11px] opacity-80" dir="ltr">
                      {entry.employeeNumber}
                    </span>
                  )}
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
