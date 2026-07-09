// ============================================================
// VacationManagementPanel - Dedicated vacation range & dates flow
// Includes full Add / Remove / Edit support for vacations
// ============================================================

import { memo, useMemo, useState } from 'react';
import { Calendar, CalendarDays, CalendarOff, CalendarRange, Save, Trash2, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { ScheduleMatrixData, VacationType } from '@/types/scheduleMatrix';

interface VacationManagementPanelProps {
  data: ScheduleMatrixData;
  onSaveRange: (employeeId: string, startDay: number, endDay: number, type: VacationType) => void;
  onSaveDates?: (employeeId: string, days: number[], type: VacationType) => void;
  onRemoveVacationDay?: (employeeId: string, day: number) => void;
  onRemoveVacationRange?: (employeeId: string, rangeId: string) => void;
  onClearEmployeeVacations?: (employeeId: string) => void;
}

function VacationManagementPanel({
  data,
  onSaveRange,
  onSaveDates,
  onRemoveVacationDay,
  onRemoveVacationRange,
  onClearEmployeeVacations,
}: VacationManagementPanelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const vacationTypes = [
    { value: 'annual' as const, label: t('schedule:vacationsPanel.types.annual') },
    { value: 'sick' as const, label: t('schedule:vacationsPanel.types.sick') },
    { value: 'emergency' as const, label: t('schedule:vacationsPanel.types.emergency') },
  ];
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const [mode, setMode] = useState<'range' | 'dates'>('range');
  const [employeeId, setEmployeeId] = useState(data.legend[0]?.employeeId || '');
  const [startDay, setStartDay] = useState(1);
  const [endDay, setEndDay] = useState(Math.min(3, daysInMonth));
  const [type, setType] = useState<VacationType>('annual');
  const [selectedDates, setSelectedDates] = useState<number[]>([]);
  const [datesInputText, setDatesInputText] = useState('');

  const selectedEmployee = useMemo(
    () => data.legend.find((employee) => employee.employeeId === employeeId),
    [data.legend, employeeId],
  );

  const selectedVacation = useMemo(
    () => data.vacations.find((vacation) => vacation.employeeId === employeeId),
    [data.vacations, employeeId],
  );

  const activeVacationsList = useMemo(
    () => data.vacations.filter((vacation) => vacation.daysOff && vacation.daysOff.length > 0),
    [data.vacations],
  );

  const handleDayToggle = (day: number) => {
    const exists = selectedDates.includes(day);
    const updated = exists
      ? selectedDates.filter((currentDay) => currentDay !== day)
      : [...selectedDates, day].sort((a, b) => a - b);
    setSelectedDates(updated);
    setDatesInputText(updated.join(', '));
  };

  const handleInputTextChange = (text: string) => {
    setDatesInputText(text);
    const parsed = text
      .split(/[,\u060C\s]+/)
      .map((item) => parseInt(item.trim(), 10))
      .filter((num) => !isNaN(num) && num >= 1 && num <= daysInMonth);
    const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
    setSelectedDates(uniqueSorted);
  };

  const handleSave = () => {
    if (mode === 'range') {
      const safeStartDay = Math.max(1, Math.min(daysInMonth, startDay));
      const safeEndDay = Math.max(1, Math.min(daysInMonth, endDay));
      onSaveRange(employeeId, Math.min(safeStartDay, safeEndDay), Math.max(safeStartDay, safeEndDay), type);
    } else if (onSaveDates) {
      if (selectedDates.length === 0) return;
      onSaveDates(employeeId, selectedDates, type);
      setSelectedDates([]);
      setDatesInputText('');
    }
  };

  const getVacationTypeLabel = (val?: VacationType) => {
    if (val === 'sick') return t('schedule:vacationsPanel.types.sick');
    if (val === 'emergency') return t('schedule:vacationsPanel.types.emergency');
    return t('schedule:vacationsPanel.types.annual');
  };

  const selectedVacationDays = selectedVacation?.daysOff ?? [];
  const selectedVacationRanges = selectedVacation?.ranges ?? [];
  const selectedEmployeeName = selectedVacation?.fullName ?? selectedEmployee?.fullName ?? '';
  const safeStartDay = Math.max(1, Math.min(daysInMonth, startDay));
  const safeEndDay = Math.max(1, Math.min(daysInMonth, endDay));
  const orderedStartDay = Math.min(safeStartDay, safeEndDay);
  const orderedEndDay = Math.max(safeStartDay, safeEndDay);
  const rangeLength = orderedEndDay - orderedStartDay + 1;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/45 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-teal/25 bg-primary-teal/10 text-primary-teal">
            <CalendarOff className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-text-primary">{t('schedule:vacationsPanel.title')}</h2>
              {selectedVacationDays.length > 0 && (
                <span className="rounded-full border border-amber-300/70 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100">
                  {t('schedule:vacationsPanel.registeredDays', { count: selectedVacationDays.length })}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-medium text-text-secondary">
              {mode === 'range'
                ? t('schedule:vacationsPanel.modeHintRange', {
                    count: rangeLength,
                    type: getVacationTypeLabel(type),
                  })
                : t('schedule:vacationsPanel.modeHintDates', { count: selectedDates.length })}
            </p>
          </div>
        </div>

        <div className="flex rounded-lg border border-border bg-surface p-1 shadow-soft">
          <button
            type="button"
            onClick={() => setMode('range')}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold transition-colors',
              mode === 'range'
                ? 'bg-primary-teal text-white shadow-sm'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            <span>{t('schedule:vacationsPanel.rangeMode')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('dates')}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold transition-colors',
              mode === 'dates'
                ? 'bg-primary-teal text-white shadow-sm'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{t('schedule:vacationsPanel.datesMode')}</span>
          </button>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="grid items-end gap-3 xl:grid-cols-[minmax(240px,1.25fr)_minmax(260px,1.4fr)_minmax(220px,1fr)_auto]">
          <label className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              {t('schedule:vacationsPanel.employee')}
            </span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-colors focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
            >
              {data.legend.map((employee) => (
                <option key={employee.employeeId} value={employee.employeeId}>
                  {employee.code} - {employee.fullName}
                </option>
              ))}
            </select>
          </label>

          {mode === 'range' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                  {t('schedule:vacationsPanel.fromDay')}
                </span>
                <input
                  type="number"
                  min={1}
                  max={daysInMonth}
                  value={startDay}
                  onChange={(event) => setStartDay(Number(event.target.value))}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-colors focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                  {t('schedule:vacationsPanel.toDay')}
                </span>
                <input
                  type="number"
                  min={1}
                  max={daysInMonth}
                  value={endDay}
                  onChange={(event) => setEndDay(Number(event.target.value))}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-colors focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
                />
              </label>
            </div>
          ) : (
            <label className="space-y-1.5">
              <span className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                <span>{t('schedule:vacationsPanel.selectedDays')}</span>
                {selectedDates.length > 0 && (
                  <span className="rounded-full bg-primary-teal/10 px-2 py-0.5 text-[10px] font-bold text-primary-teal">
                    {t('schedule:vacationsPanel.daysCount', { count: selectedDates.length })}
                  </span>
                )}
              </span>
              <input
                type="text"
                placeholder={t('schedule:vacationsPanel.datesPlaceholder')}
                value={datesInputText}
                onChange={(event) => handleInputTextChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
              />
            </label>
          )}

          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              {t('schedule:vacationsPanel.type')}
            </span>
            <div className="grid h-10 grid-cols-3 rounded-lg border border-border bg-surface p-1 shadow-soft">
              {vacationTypes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={cn(
                    'rounded-md px-2 text-[11px] font-bold transition-colors',
                    type === item.value
                      ? 'bg-primary-teal text-white shadow-sm'
                      : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={mode === 'dates' && selectedDates.length === 0}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors',
              mode === 'dates' && selectedDates.length === 0
                ? 'cursor-not-allowed bg-surface-muted text-text-muted'
                : 'bg-primary-teal text-white shadow-sm hover:bg-primary-teal/90',
            )}
          >
            <Save className="h-4 w-4" />
            <span>{t('schedule:vacationsPanel.save')}</span>
          </button>
        </div>

        {mode === 'dates' && (
          <div className="rounded-lg border border-border bg-surface-muted/35 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-text-primary">
                  {t('schedule:vacationsPanel.quickCalendarTitle')}
                </span>
                <span className="rounded-full border border-amber-300/60 bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100">
                  {t('schedule:vacationsPanel.quickCalendarHint')}
                </span>
              </div>
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDates([]);
                    setDatesInputText('');
                  }}
                  className="rounded-md px-2 py-1 text-[11px] font-bold text-danger hover:bg-danger-500/10"
                >
                  {t('schedule:vacationsPanel.clearSelection')}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isSelected = selectedDates.includes(day);
                const isAlreadyVacation = selectedVacationDays.includes(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isAlreadyVacation && onRemoveVacationDay) {
                        onRemoveVacationDay(employeeId, day);
                      } else {
                        handleDayToggle(day);
                      }
                    }}
                    className={cn(
                      'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold transition-colors',
                      isSelected
                        ? 'border-primary-teal bg-primary-teal text-white shadow-sm'
                        : isAlreadyVacation
                          ? 'border-amber-300 bg-amber-100 text-amber-900 hover:border-danger/50 hover:bg-danger-500/10 hover:text-danger dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100'
                          : 'border-border bg-surface text-text-primary hover:border-primary-teal/50 hover:bg-hover',
                    )}
                    title={
                      isAlreadyVacation
                        ? t('schedule:vacationsPanel.alreadyVacation', { day })
                        : t('schedule:vacationsPanel.dayTooltip', { day })
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedVacation && selectedVacationDays.length > 0 && (
          <div className="rounded-lg border border-primary-teal/25 bg-primary-teal/5 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-teal/15 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-teal/10 text-primary-teal">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-primary">
                    {t('schedule:vacationsPanel.selectedSummaryTitle', { name: selectedEmployeeName })}
                  </p>
                  <p className="text-xs font-semibold text-text-secondary">
                    {t('schedule:vacationsPanel.selectedSummarySubtitle', { count: selectedVacationDays.length })}
                  </p>
                </div>
              </div>

              {onClearEmployeeVacations && (
                <button
                  type="button"
                  onClick={() => onClearEmployeeVacations(employeeId)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-danger px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-danger/90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t('schedule:vacationsPanel.clearEmployeeVacations')}</span>
                </button>
              )}
            </div>

            <div className="grid gap-3 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              {selectedVacationRanges.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                    {t('schedule:vacationsPanel.registeredRanges')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedVacationRanges.map((range) => (
                      <span
                        key={range.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-text-primary shadow-soft"
                      >
                        <Calendar className="h-3.5 w-3.5 text-primary-teal" />
                        <span>
                          {t('schedule:vacationsPanel.rangeBadge', {
                            start: range.startDay,
                            end: range.endDay,
                            type: getVacationTypeLabel(range.type),
                          })}
                        </span>
                        {onRemoveVacationRange && (
                          <button
                            type="button"
                            onClick={() => onRemoveVacationRange(employeeId, range.id)}
                            className="rounded-md p-0.5 text-text-muted transition-colors hover:bg-danger-500/10 hover:text-danger"
                            title={t('schedule:vacationsPanel.removeRange')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                  {t('schedule:vacationsPanel.individualDays')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedVacationDays.map((day) => (
                    <span
                      key={day}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-bold text-text-primary shadow-soft"
                    >
                      <span>{t('schedule:vacationsPanel.dayLabel', { day })}</span>
                      {onRemoveVacationDay && (
                        <button
                          type="button"
                          onClick={() => onRemoveVacationDay(employeeId, day)}
                          className="rounded-full p-0.5 text-text-muted transition-colors hover:bg-danger-500/10 hover:text-danger"
                          title={t('schedule:vacationsPanel.removeDay', { day })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeVacationsList.length > 0 && (
          <details className="rounded-lg border border-border bg-surface-muted/25">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-bold text-text-primary">
              <span>{t('schedule:vacationsPanel.activeVacationsTitle', { count: activeVacationsList.length })}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                {activeVacationsList.length}
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="border-b border-border bg-surface text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 text-start font-bold">{t('schedule:vacationsPanel.employeeCode')}</th>
                    <th className="px-3 py-2 text-start font-bold">{t('schedule:vacationsPanel.employeeName')}</th>
                    <th className="px-3 py-2 text-start font-bold">{t('schedule:vacationsPanel.vacationDaysCount')}</th>
                    <th className="px-3 py-2 text-start font-bold">{t('schedule:vacationsPanel.vacationDays')}</th>
                    <th className="px-3 py-2 text-end font-bold">{t('schedule:vacationsPanel.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {activeVacationsList.map((vacation) => (
                    <tr
                      key={vacation.employeeId}
                      className={cn(
                        'transition-colors hover:bg-hover',
                        vacation.employeeId === employeeId && 'bg-primary-teal/5',
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-text-secondary">{vacation.employeeCode}</td>
                      <td className="px-3 py-2 font-bold text-text-primary">{vacation.fullName}</td>
                      <td className="px-3 py-2 font-bold text-primary-teal">
                        {t('schedule:vacationsPanel.daysUnit', { count: vacation.daysOff.length })}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{vacation.daysOff.join(', ')}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEmployeeId(vacation.employeeId)}
                            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-primary-teal transition-colors hover:border-primary-teal hover:bg-primary-teal hover:text-white"
                          >
                            {t('schedule:vacationsPanel.manageEmployeeVacations')}
                          </button>
                          {onClearEmployeeVacations && (
                            <button
                              type="button"
                              onClick={() => onClearEmployeeVacations(vacation.employeeId)}
                              className="rounded-lg border border-danger/25 bg-danger-500/10 px-2.5 py-1 text-[11px] font-bold text-danger transition-colors hover:bg-danger hover:text-white"
                              title={t('schedule:vacationsPanel.clearEmployeeVacations')}
                            >
                              {t('schedule:vacationsPanel.clearVacation')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

export default memo(VacationManagementPanel);
