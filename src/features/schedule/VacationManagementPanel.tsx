// ============================================================
// VacationManagementPanel - Dedicated vacation range & dates flow
// Includes full Add / Remove / Edit support for vacations
// ============================================================

import { memo, useMemo, useState } from 'react';
import { CalendarOff, Save, CalendarRange, CalendarDays, Trash2, X, User, Calendar } from 'lucide-react';
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

  // For specific dates mode
  const [selectedDates, setSelectedDates] = useState<number[]>([]);
  const [datesInputText, setDatesInputText] = useState('');

  const selectedVacation = useMemo(
    () => data.vacations.find((vacation) => vacation.employeeId === employeeId),
    [data.vacations, employeeId],
  );

  const activeVacationsList = useMemo(
    () => data.vacations.filter((v) => v.daysOff && v.daysOff.length > 0),
    [data.vacations],
  );

  const handleDayToggle = (day: number) => {
    const exists = selectedDates.includes(day);
    const updated = exists
      ? selectedDates.filter((d) => d !== day)
      : [...selectedDates, day].sort((a, b) => a - b);
    setSelectedDates(updated);
    setDatesInputText(updated.join(', '));
  };

  const handleInputTextChange = (text: string) => {
    setDatesInputText(text);
    const parsed = text
      .split(/[,،\s]+/)
      .map((item) => parseInt(item.trim(), 10))
      .filter((num) => !isNaN(num) && num >= 1 && num <= daysInMonth);
    const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
    setSelectedDates(uniqueSorted);
  };

  const handleSave = () => {
    if (mode === 'range') {
      onSaveRange(employeeId, startDay, endDay, type);
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

  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-4 shadow-soft space-y-4">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-5 w-5 text-primary-teal" />
          <h2 className="text-base font-bold text-ink">{t('schedule:vacationsPanel.title')}</h2>
          {selectedVacation && selectedVacation.daysOff.length > 0 && (
            <span className="text-xs text-text-primary bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
              {t('schedule:vacationsPanel.registeredDays', { count: selectedVacation.daysOff.length })}
            </span>
          )}
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-lg border border-border bg-surface-muted p-0.5">
          <button
            onClick={() => setMode('range')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all',
              mode === 'range' ? 'bg-surface text-primary-teal shadow-sm' : 'text-text-secondary hover:bg-hover',
            )}
          >
            <CalendarRange className="h-3 w-3" />
            <span>{t('schedule:vacationsPanel.rangeMode')}</span>
          </button>
          <button
            onClick={() => setMode('dates')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all',
              mode === 'dates' ? 'bg-surface text-primary-teal shadow-sm' : 'text-text-secondary hover:bg-hover',
            )}
          >
            <CalendarDays className="h-3 w-3" />
            <span>{t('schedule:vacationsPanel.datesMode')}</span>
          </button>
        </div>
      </div>

      {/* Form Controls */}
      <div className="grid gap-3 md:grid-cols-[1.4fr_1.6fr_1fr_auto] items-start">
        {/* Employee selector */}
        <label className="space-y-1">
          <span className="text-[11px] font-bold text-text-secondary">{t('schedule:vacationsPanel.employee')}</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-ink font-semibold focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
          >
            {data.legend.map((employee) => (
              <option key={employee.employeeId} value={employee.employeeId}>
                {employee.code} - {employee.fullName}
              </option>
            ))}
          </select>
        </label>

        {/* Date Inputs based on Mode */}
        {mode === 'range' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-text-secondary">{t('schedule:vacationsPanel.fromDay')}</span>
              <input
                type="number"
                min={1}
                max={daysInMonth}
                value={startDay}
                onChange={(event) => setStartDay(Number(event.target.value))}
                className="h-9 w-full rounded-lg border border-border px-3 text-xs text-ink font-semibold focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-text-secondary">{t('schedule:vacationsPanel.toDay')}</span>
              <input
                type="number"
                min={1}
                max={daysInMonth}
                value={endDay}
                onChange={(event) => setEndDay(Number(event.target.value))}
                className="h-9 w-full rounded-lg border border-border px-3 text-xs text-ink font-semibold focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-text-secondary">{t('schedule:vacationsPanel.selectedDays')}</span>
              {selectedDates.length > 0 && (
                <span className="text-[10px] text-primary-teal font-bold">
                  {t('schedule:vacationsPanel.daysCount', { count: selectedDates.length })}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={t('schedule:vacationsPanel.datesPlaceholder')}
              value={datesInputText}
              onChange={(e) => handleInputTextChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-border px-3 text-xs text-ink font-semibold placeholder:text-text-muted focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
            />
          </div>
        )}

        {/* Vacation Type */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-text-secondary">{t('schedule:vacationsPanel.type')}</span>
          <div className="flex rounded-lg border border-border bg-surface-muted p-0.5">
            {vacationTypes.map((item) => (
              <button
                key={item.value}
                onClick={() => setType(item.value)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors',
                  type === item.value ? 'bg-surface text-primary-teal shadow-sm' : 'text-text-secondary hover:bg-hover',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-end pt-5">
          <button
            onClick={handleSave}
            disabled={mode === 'dates' && selectedDates.length === 0}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-bold text-white transition-all',
              mode === 'dates' && selectedDates.length === 0
                ? 'bg-surface-muted text-text-muted cursor-not-allowed'
                : 'bg-primary-teal hover:bg-primary-teal/90 shadow-sm',
            )}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{t('schedule:vacationsPanel.save')}</span>
          </button>
        </div>
      </div>

      {/* Clickable Days Pills for Specific Dates Mode */}
      {mode === 'dates' && (
        <div className="pt-3 border-t border-border/50">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-text-secondary">{t('schedule:vacationsPanel.quickCalendarTitle')}</span>
              <span className="text-[10px] text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                💡 الأيام باللون الأصفر إجازة مسجلة (اضغط على اليوم الأصفر لحذفه فوراً)
              </span>
            </div>
            {selectedDates.length > 0 && (
              <button
                onClick={() => {
                  setSelectedDates([]);
                  setDatesInputText('');
                }}
                className="text-[10px] text-red-600 hover:underline font-semibold"
              >
                {t('schedule:vacationsPanel.clearSelection')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const isSelected = selectedDates.includes(day);
              const isAlreadyVacation = selectedVacation?.daysOff.includes(day);

              return (
                <button
                  key={day}
                  onClick={() => {
                    if (isAlreadyVacation && onRemoveVacationDay) {
                      onRemoveVacationDay(employeeId, day);
                    } else {
                      handleDayToggle(day);
                    }
                  }}
                  className={cn(
                    'h-7 w-7 rounded-md text-xs font-bold transition-all flex items-center justify-center border',
                    isSelected
                      ? 'bg-primary-teal text-white border-primary-teal shadow-sm scale-105'
                      : isAlreadyVacation
                        ? 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-red-100 hover:text-red-700 hover:border-red-400'
                        : 'bg-surface-muted text-text-primary border-border hover:bg-hover hover:border-border',
                  )}
                  title={
                    isAlreadyVacation
                      ? `يوم إجازة مسجل للموظف - اضغط لإزالته`
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

      {/* Selected Employee Vacations Management Section */}
      {selectedVacation && selectedVacation.daysOff.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-amber-800" />
              <span className="text-xs font-bold text-amber-950">
                إجازات الموظف المختار: {selectedVacation.fullName} ({selectedVacation.daysOff.length} يوم)
              </span>
            </div>
            {onClearEmployeeVacations && (
              <button
                onClick={() => onClearEmployeeVacations(employeeId)}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="h-3 w-3" />
                <span>حذف جميع إجازات الموظف</span>
              </button>
            )}
          </div>

          {/* Registered Ranges */}
          {selectedVacation.ranges && selectedVacation.ranges.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-amber-900 block">فترات الإجازة المسجلة:</span>
              <div className="flex flex-wrap gap-2">
                {selectedVacation.ranges.map((range) => (
                  <div
                    key={range.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-surface px-3 py-1 text-xs font-bold text-amber-950 shadow-2xs"
                  >
                    <Calendar className="h-3.5 w-3.5 text-amber-700" />
                    <span>
                      من يوم {range.startDay} إلى {range.endDay} ({getVacationTypeLabel(range.type)})
                    </span>
                    {onRemoveVacationRange && (
                      <button
                        onClick={() => onRemoveVacationRange(employeeId, range.id)}
                        className="ml-1 rounded p-0.5 text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="إزالة هذه الفترة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual Days Badges */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-amber-900 block">الأيام الفردية المجازة (اضغط على ✕ لحذف يوم محدد):</span>
            <div className="flex flex-wrap gap-1.5">
              {selectedVacation.daysOff.map((day) => (
                <span
                  key={day}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-surface px-2.5 py-1 text-xs font-bold text-amber-950 shadow-2xs"
                >
                  <span>يوم {day}</span>
                  {onRemoveVacationDay && (
                    <button
                      onClick={() => onRemoveVacationDay(employeeId, day)}
                      className="rounded-full hover:bg-red-100 hover:text-red-700 text-text-secondary transition-colors p-0.5"
                      title={`حذف إجازة يوم ${day}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All Active Vacations Table across Employees */}
      {activeVacationsList.length > 0 && (
        <div className="pt-3 border-t border-border">
          <h3 className="text-xs font-bold text-text-primary mb-2">
            جميع الموظفين الحاصلين على إجازات في هذا الشهر ({activeVacationsList.length} موظف):
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary font-bold border-b border-border">
                <tr>
                  <th className="py-2 px-3">كود الموظف</th>
                  <th className="py-2 px-3">اسم الموظف</th>
                  <th className="py-2 px-3">عدد أيام الإجازة</th>
                  <th className="py-2 px-3">أيام الإجازة</th>
                  <th className="py-2 px-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-surface">
                {activeVacationsList.map((vac) => (
                  <tr
                    key={vac.employeeId}
                    className={cn('hover:bg-hover transition-colors', vac.employeeId === employeeId && 'bg-primary-teal/5 font-semibold')}
                  >
                    <td className="py-2 px-3 font-mono text-text-secondary">{vac.employeeCode}</td>
                    <td className="py-2 px-3 font-bold text-ink">{vac.fullName}</td>
                    <td className="py-2 px-3 font-semibold text-amber-800">{vac.daysOff.length} يوم</td>
                    <td className="py-2 px-3 text-text-secondary">
                      <span className="line-clamp-1">{vac.daysOff.join(', ')}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEmployeeId(vac.employeeId)}
                          className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-bold text-primary-teal hover:bg-primary-teal hover:text-white transition-colors"
                        >
                          إدارة إجازاته
                        </button>
                        {onClearEmployeeVacations && (
                          <button
                            onClick={() => onClearEmployeeVacations(vac.employeeId)}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                            title="حذف كل إجازات هذا الموظف"
                          >
                            حذف الإجازة
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(VacationManagementPanel);
