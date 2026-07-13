// ============================================================
// VacationManagementPanel - Dedicated vacation range & dates flow
// Includes full Add / Remove / Edit support for vacations
// ============================================================

import { memo, useMemo, useState } from 'react';
import { Calendar, CalendarOff, Pencil, Save, Trash2, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { EmployeeIdentityUpdateResult } from '@/stores/scheduleMatrixStore';
import type { ScheduleMatrixData, VacationType } from '@/types/scheduleMatrix';

interface VacationManagementPanelProps {
  data: ScheduleMatrixData;
  onSaveRange: (employeeId: string, startDay: number, endDay: number, type: VacationType) => void;
  onSaveDates?: (employeeId: string, days: number[], type: VacationType) => void;
  onRemoveVacationDay?: (employeeId: string, day: number) => void;
  onRemoveVacationRange?: (employeeId: string, rangeId: string) => void;
  onClearEmployeeVacations?: (employeeId: string) => void;
  onUpdateEmployeeIdentity: (
    employeeId: string,
    fullName: string,
    code: string,
  ) => EmployeeIdentityUpdateResult;
}

function VacationManagementPanel({
  data,
  onSaveRange,
  onRemoveVacationDay,
  onRemoveVacationRange,
  onClearEmployeeVacations,
  onUpdateEmployeeIdentity,
}: VacationManagementPanelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const vacationTypes = [
    { value: 'annual' as const, label: t('schedule:vacationsPanel.types.annual') },
    { value: 'sick' as const, label: t('schedule:vacationsPanel.types.sick') },
    { value: 'emergency' as const, label: t('schedule:vacationsPanel.types.emergency') },
  ];
  const daysInMonth = new Date(data.year, data.month + 1, 0).getDate();
  const defaultYear = data.year;
  const defaultMonthStr = String(data.month + 1).padStart(2, '0');
  const [employeeId, setEmployeeId] = useState(data.legend[0]?.employeeId || '');
  const [fromDateStr, setFromDateStr] = useState(`${defaultYear}-${defaultMonthStr}-01`);
  const [toDateStr, setToDateStr] = useState(`${defaultYear}-${defaultMonthStr}-03`);
  const [type, setType] = useState<VacationType>('annual');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [identityName, setIdentityName] = useState('');
  const [identityCode, setIdentityCode] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);

  const parseDayFromDateStr = (dateStr: string, fallback: number) => {
    if (!dateStr) return fallback;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      if (year === data.year && month === data.month) {
        return Math.max(1, Math.min(daysInMonth, day));
      }
      if (new Date(year, month, day) < new Date(data.year, data.month, 1)) {
        return 1;
      }
      if (new Date(year, month, day) > new Date(data.year, data.month, daysInMonth)) {
        return daysInMonth;
      }
      return Math.max(1, Math.min(daysInMonth, day));
    }
    return fallback;
  };

  const startDay = parseDayFromDateStr(fromDateStr, 1);
  const endDay = parseDayFromDateStr(toDateStr, Math.min(3, daysInMonth));

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

  const handleSave = () => {
    const safeStartDay = Math.max(1, Math.min(daysInMonth, startDay));
    const safeEndDay = Math.max(1, Math.min(daysInMonth, endDay));
    onSaveRange(employeeId, Math.min(safeStartDay, safeEndDay), Math.max(safeStartDay, safeEndDay), type);
  };

  const openIdentityEditor = (targetEmployeeId: string) => {
    const employee = data.legend.find((entry) => entry.employeeId === targetEmployeeId);
    if (!employee) return;
    setEmployeeId(targetEmployeeId);
    setEditingEmployeeId(targetEmployeeId);
    setIdentityName(employee.fullName);
    setIdentityCode(employee.code);
    setIdentityError(null);
  };

  const closeIdentityEditor = () => {
    setEditingEmployeeId(null);
    setIdentityError(null);
  };

  const handleIdentitySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEmployeeId) return;
    const result = onUpdateEmployeeIdentity(editingEmployeeId, identityName, identityCode);
    if (result.ok) {
      closeIdentityEditor();
      return;
    }
    const errorKeys = {
      name_required: 'schedule:vacationsPanel.identity.errors.nameRequired',
      code_required: 'schedule:vacationsPanel.identity.errors.codeRequired',
      duplicate_code: 'schedule:vacationsPanel.identity.errors.duplicateCode',
      employee_not_found: 'schedule:vacationsPanel.identity.errors.employeeNotFound',
    } as const;
    setIdentityError(t(errorKeys[result.reason]));
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
  const editingEmployee = editingEmployeeId
    ? data.legend.find((employee) => employee.employeeId === editingEmployeeId)
    : null;
  const identityCanSave = Boolean(
    editingEmployee
    && identityName.trim()
    && identityCode.trim()
    && (
      identityName.trim() !== editingEmployee.fullName
      || identityCode.trim().toUpperCase() !== editingEmployee.code
    ),
  );

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
              {t('schedule:vacationsPanel.modeHintRange', {
                count: rangeLength,
                type: getVacationTypeLabel(type),
              })}
            </p>
          </div>
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

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                <span>{t('schedule:vacationsPanel.fromDay')}</span>
                <span className="font-mono text-primary-teal">(يوم {orderedStartDay})</span>
              </span>
              <input
                type="date"
                value={fromDateStr}
                onChange={(event) => setFromDateStr(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary outline-none transition-colors focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
              />
            </label>
            <label className="space-y-1.5">
              <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                <span>{t('schedule:vacationsPanel.toDay')}</span>
                <span className="font-mono text-primary-teal">(يوم {orderedEndDay})</span>
              </span>
              <input
                type="date"
                value={toDateStr}
                onChange={(event) => setToDateStr(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary outline-none transition-colors focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
              />
            </label>
          </div>

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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-teal px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-teal/90"
          >
            <Save className="h-4 w-4" />
            <span>{t('schedule:vacationsPanel.save')}</span>
          </button>
        </div>

        {editingEmployee && (
          <form
            aria-label={t('schedule:vacationsPanel.identity.title')}
            onSubmit={handleIdentitySubmit}
            className="rounded-xl border border-primary-teal/30 bg-primary-teal/5 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-text-primary">
                {t('schedule:vacationsPanel.identity.title')}
              </h3>
              <button
                type="button"
                onClick={closeIdentityEditor}
                aria-label={t('schedule:vacationsPanel.identity.cancel')}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-text-secondary">
                  {t('schedule:vacationsPanel.identity.name')}
                </span>
                <input
                  value={identityName}
                  onChange={(event) => {
                    setIdentityName(event.target.value);
                    setIdentityError(null);
                  }}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-primary outline-none focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-text-secondary">
                  {t('schedule:vacationsPanel.identity.code')}
                </span>
                <input
                  dir="ltr"
                  value={identityCode}
                  onChange={(event) => {
                    setIdentityCode(event.target.value);
                    setIdentityError(null);
                  }}
                  className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-bold uppercase text-text-primary outline-none focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20"
                />
              </label>
            </div>

            {identityError && (
              <p role="alert" className="mt-3 text-xs font-bold text-danger">
                {identityError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeIdentityEditor}
                className="min-h-11 rounded-lg border border-border bg-surface px-4 text-sm font-bold text-text-secondary hover:bg-hover"
              >
                {t('schedule:vacationsPanel.identity.cancel')}
              </button>
              <button
                type="submit"
                disabled={!identityCanSave}
                className="min-h-11 rounded-lg bg-primary-teal px-4 text-sm font-bold text-white hover:bg-primary-teal/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('schedule:vacationsPanel.identity.save')}
              </button>
            </div>
          </form>
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openIdentityEditor(employeeId)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-primary-teal/30 bg-surface px-3 text-xs font-bold text-primary-teal transition-colors hover:bg-primary-teal hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>{t('schedule:vacationsPanel.identity.edit')}</span>
                </button>
                {onClearEmployeeVacations && (
                  <button
                    type="button"
                    onClick={() => onClearEmployeeVacations(employeeId)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-danger px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-danger/90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('schedule:vacationsPanel.clearEmployeeVacations')}</span>
                  </button>
                )}
              </div>
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
                            className="min-h-11 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-primary-teal transition-colors hover:border-primary-teal hover:bg-primary-teal hover:text-white"
                          >
                            {t('schedule:vacationsPanel.manageEmployeeVacations')}
                          </button>
                          <button
                            type="button"
                            onClick={() => openIdentityEditor(vacation.employeeId)}
                            aria-label={t('schedule:vacationsPanel.identity.editFor', { name: vacation.fullName })}
                            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-text-secondary transition-colors hover:border-primary-teal hover:text-primary-teal"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t('schedule:vacationsPanel.identity.editShort')}
                          </button>
                          {onClearEmployeeVacations && (
                            <button
                              type="button"
                              onClick={() => onClearEmployeeVacations(vacation.employeeId)}
                              className="min-h-11 rounded-lg border border-danger/25 bg-danger-500/10 px-2.5 py-1 text-[11px] font-bold text-danger transition-colors hover:bg-danger hover:text-white"
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
