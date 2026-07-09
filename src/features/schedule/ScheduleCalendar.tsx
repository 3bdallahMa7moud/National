import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import ShiftBadge from '@/components/common/ShiftBadge';
import { getDaysInMonth, getDayName } from '@/lib/utils';
import type { Shift, ShiftTypeKey, Employee } from '@/types';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ScheduleCalendarProps {
  shifts: Shift[];
  employees?: Employee[];
  mode: 'personal' | 'matrix';
  editable?: boolean;
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedCells?: string[];
  onCellClick?: (cellId: string) => void;
  onCellShiftClick?: (shift: Shift) => void;
  bulkSelectMode?: boolean;
  onCellManage?: (employee: Employee, dateStr: string) => void;
}

export default function ScheduleCalendar({
  shifts, employees, mode, editable = false,
  year, month, onPrevMonth, onNextMonth,
  selectedCells = [], onCellClick, onCellShiftClick,
  bulkSelectMode = false, onCellManage,
}: ScheduleCalendarProps) {
  const { t } = useTranslation(['common']);
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach((s) => {
      const key = `${s.employeeId}-${s.date}`;
      const existing = map.get(key) || [];
      existing.push(s);
      map.set(key, existing);
    });
    return map;
  }, [shifts]);

  const dateShiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    shifts.forEach((s) => {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    });
    return map;
  }, [shifts]);

  const header = (
    <div className="mb-4 flex items-center justify-between rounded-card border border-border bg-surface-muted px-2 py-2">
      <Button variant="ghost" size="sm" onClick={onPrevMonth} icon={<ChevronRight className="w-4 h-4 rtl:rotate-180" />}>
        {t('common:calendar.prev')}
      </Button>
      <h2 className="text-base font-semibold text-text-primary">
        {t(`common:calendar.months.${month}`)} {year}
      </h2>
      <Button variant="ghost" size="sm" onClick={onNextMonth} icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />}>
        {t('common:calendar.next')}
      </Button>
    </div>
  );

  if (mode === 'personal') {
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    return (
      <div>
        {header}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-border bg-border">
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
            <div key={dayIndex} className="bg-surface-muted py-2 text-center text-xs font-semibold text-text-secondary">
              {t(`common:calendar.weekdays.${dayIndex}`)}
            </div>
          ))}

          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-surface min-h-[70px] sm:min-h-[100px]" />
          ))}

          {days.map((date) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const dayShifts = dateShiftMap.get(dateStr) || [];
            const isToday = dateStr === todayStr;
            const isFriday = date.getDay() === 5;

            return (
              <div
                key={dateStr}
                className={cn(
                  'min-h-[70px] bg-surface p-1 transition-colors sm:min-h-[100px] sm:p-1.5',
                  isToday && 'bg-primary-50/30',
                  isFriday && 'bg-surface-muted/50'
                )}
              >
                <span className={cn(
                  'text-xs font-medium',
                  isToday ? 'text-primary font-bold' : 'text-text-secondary'
                )}>
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="cursor-pointer"
                      onClick={() => onCellShiftClick?.(shift)}
                    >
                      <ShiftBadge type={shift.shiftType as ShiftTypeKey} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[650px] border-collapse text-xs sm:min-w-[800px]">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 min-w-[110px] border-b border-e border-border bg-surface-muted px-2 py-2 text-start font-semibold text-text-secondary sm:min-w-[140px] sm:px-3">
                {t('common:calendar.employee')}
              </th>
              {days.map((date) => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isFriday = date.getDay() === 5;
                return (
                  <th
                    key={dateStr}
                    className={cn(
                      'px-1 py-2 text-center border-b border-border min-w-[60px]',
                      isToday ? 'bg-primary-50' : isFriday ? 'bg-surface-muted' : 'bg-surface-muted'
                    )}
                  >
                    <div className="text-[10px] text-text-secondary">{getDayName(date)}</div>
                    <div className={cn('font-bold', isToday ? 'text-primary' : 'text-text-primary')}>
                      {date.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(employees || []).map((emp) => (
              <tr key={emp.id} className="transition-colors hover:bg-hover/40">
                <td className="sticky start-0 z-10 border-b border-e border-border bg-surface px-3 py-2">
                  <div className="font-medium text-text-primary text-sm truncate">{emp.name}</div>
                  <div className="text-[10px] text-text-secondary">{emp.position}</div>
                </td>
                {days.map((date) => {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  const cellId = `${emp.id}-${dateStr}`;
                  const cellShifts = shiftMap.get(cellId) || [];
                  const isSelected = selectedCells.includes(cellId);
                  const isToday = dateStr === todayStr;
                  const hasConflict = false;

                  return (
                    <td
                      key={cellId}
                      className={cn(
                        'cursor-pointer border-b border-border px-0.5 py-1 text-center transition-colors',
                        isToday && 'bg-primary-50/20',
                        isSelected && 'bg-primary-100 ring-2 ring-primary ring-inset',
                        hasConflict && 'ring-2 ring-danger ring-inset',
                        editable && 'hover:bg-hover'
                      )}
                      onClick={() => {
                        if (!editable) return;
                        if (bulkSelectMode) {
                          onCellClick?.(cellId);
                        } else if (onCellManage) {
                          onCellManage(emp, dateStr);
                        } else {
                          onCellClick?.(cellId);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5 items-center">
                        {cellShifts.map((shift) => (
                          <ShiftBadge key={shift.id} type={shift.shiftType as ShiftTypeKey} size="sm" />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
