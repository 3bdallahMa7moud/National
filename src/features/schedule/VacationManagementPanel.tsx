// ============================================================
// VacationManagementPanel - Dedicated vacation range & dates flow
// ============================================================

import { memo, useMemo, useState } from 'react';
import { CalendarOff, Save, CalendarRange, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { ScheduleMatrixData, VacationType } from '@/types/scheduleMatrix';

interface VacationManagementPanelProps {
  data: ScheduleMatrixData;
  onSaveRange: (employeeId: string, startDay: number, endDay: number, type: VacationType) => void;
  onSaveDates?: (employeeId: string, days: number[], type: VacationType) => void;
}

function VacationManagementPanel({ data, onSaveRange, onSaveDates }: VacationManagementPanelProps) {
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

  return (
    <section className="rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-soft space-y-3">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-primary-teal" />
          <h2 className="text-sm font-bold text-ink">{t('schedule:vacationsPanel.title')}</h2>
          {selectedVacation && (
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              {t('schedule:vacationsPanel.registeredDays', { count: selectedVacation.daysOff.length })}
            </span>
          )}
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setMode('range')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all',
              mode === 'range' ? 'bg-white text-primary-teal shadow-sm' : 'text-slate-600 hover:bg-white/50',
            )}
          >
            <CalendarRange className="h-3 w-3" />
            <span>{t('schedule:vacationsPanel.rangeMode')}</span>
          </button>
          <button
            onClick={() => setMode('dates')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all',
              mode === 'dates' ? 'bg-white text-primary-teal shadow-sm' : 'text-slate-600 hover:bg-white/50',
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
          <span className="text-[11px] font-bold text-slate-500">{t('schedule:vacationsPanel.employee')}</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
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
              <span className="text-[11px] font-bold text-slate-500">{t('schedule:vacationsPanel.fromDay')}</span>
              <input
                type="number"
                min={1}
                max={daysInMonth}
                value={startDay}
                onChange={(event) => setStartDay(Number(event.target.value))}
                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500">{t('schedule:vacationsPanel.toDay')}</span>
              <input
                type="number"
                min={1}
                max={daysInMonth}
                value={endDay}
                onChange={(event) => setEndDay(Number(event.target.value))}
                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-500">{t('schedule:vacationsPanel.selectedDays')}</span>
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
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-xs text-ink placeholder:text-slate-400 focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
            />
          </div>
        )}

        {/* Vacation Type */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500">{t('schedule:vacationsPanel.type')}</span>
          <div className="flex rounded-lg border border-gray-300 bg-slate-50 p-0.5">
            {vacationTypes.map((item) => (
              <button
                key={item.value}
                onClick={() => setType(item.value)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors',
                  type === item.value ? 'bg-white text-primary-teal shadow-sm' : 'text-slate-600 hover:bg-white/60',
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
                ? 'bg-gray-300 cursor-not-allowed'
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
        <div className="pt-2 border-t border-gray-100">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-bold text-slate-600">{t('schedule:vacationsPanel.quickCalendarTitle')}</span>
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
                  onClick={() => handleDayToggle(day)}
                  className={cn(
                    'h-7 w-7 rounded-md text-xs font-bold transition-all flex items-center justify-center border',
                    isSelected
                      ? 'bg-primary-teal text-white border-primary-teal shadow-sm scale-105'
                      : isAlreadyVacation
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        : 'bg-slate-50 text-slate-700 border-gray-200 hover:bg-slate-100 hover:border-gray-300',
                  )}
                  title={isAlreadyVacation ? t('schedule:vacationsPanel.alreadyVacation', { day }) : t('schedule:vacationsPanel.dayTooltip', { day })}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(VacationManagementPanel);
