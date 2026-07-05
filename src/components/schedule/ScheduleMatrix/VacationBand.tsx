// ============================================================
// VacationBand — Vacation section below the schedule grid
// ============================================================

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { VacationRow, MatrixAdminMode } from '@/types/scheduleMatrix';

interface VacationBandProps {
  vacations: VacationRow[];
  daysInMonth: number;
  year: number;
  month: number;
  adminMode: MatrixAdminMode;
  onVacationToggle: (employeeId: string, day: number) => void;
}

function VacationBand({
  vacations,
  daysInMonth,
  year,
  month,
  adminMode,
  onVacationToggle,
}: VacationBandProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;
  const isVacationMode = adminMode === 'vacations';
  const vacationTypeLabel: Record<string, string> = {
    annual: t('schedule:vacationsPanel.types.annual'),
    sick: t('schedule:vacationsPanel.types.sick'),
    emergency: t('schedule:vacationsPanel.types.emergency'),
  };

  return (
    <div className="mt-1">
      {/* Grid: facility col (label) + label col (employee) + day cols */}
      <div className="flex">
        {/* Vacation vertical label — same width as facility band */}
        <div
          className={cn(
            'facility-vertical-label shrink-0 sticky z-10 flex items-center justify-center',
            'bg-slate-200 text-slate-800 border-e border-slate-300',
          )}
          style={{
            width: 'var(--matrix-facility-col)',
            minWidth: 'var(--matrix-facility-col)',
            height: `calc(var(--matrix-row-height) * ${vacations.length})`,
            insetInlineStart: 0,
          }}
        >
          {t('schedule:matrix.vacationsBand')}
        </div>

        {/* Rows container */}
        <div className="flex flex-col">
          {vacations.map((vac) => (
            <div key={vac.employeeId} className="flex">
              {/* Employee full-name label */}
              <div
                className={cn(
                  'flex flex-col justify-center px-2 shrink-0 sticky z-10',
                  'border-b border-e border-gray-300',
                  'bg-slate-50',
                )}
                style={{
                  width: 'var(--matrix-label-col)',
                  minWidth: 'var(--matrix-label-col)',
                  height: 'var(--matrix-row-height)',
                  insetInlineStart: 'var(--matrix-facility-col)',
                }}
              >
                <span className="text-[11px] font-bold text-ink truncate">
                  {vac.fullName}
                </span>
                <span dir="ltr" className="text-[10px] font-semibold text-slate-500 truncate" style={{ unicodeBidi: 'isolate' }}>
                  {vac.employeeCode}
                </span>
              </div>

              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const isOff = vac.daysOff.includes(day);
                const date = new Date(year, month, day);
                const dow = date.getDay();
                const isWeekend = dow === 5 || dow === 6;
                const isToday = day === todayDay;

                return (
                  <div
                    key={day}
                    className={cn(
                      'flex items-center justify-center',
                      'border-b border-e border-gray-300',
                      'transition-colors duration-100',
                      isWeekend && 'bg-[var(--weekend-tint)]',
                      isToday && 'bg-[var(--today-tint)]',
                      !isWeekend && !isToday && !isOff && 'bg-[var(--empty-cell-bg)]',
                      isVacationMode && 'cursor-pointer hover:bg-primary-teal/5',
                    )}
                    style={{
                      minWidth: 'var(--matrix-day-col)',
                      width: 'var(--matrix-day-col)',
                      height: 'var(--matrix-row-height)',
                    }}
                    onClick={() => {
                      if (isVacationMode) {
                        onVacationToggle(vac.employeeId, day);
                      }
                    }}
                    role="gridcell"
                    tabIndex={isVacationMode ? 0 : -1}
                    aria-label={`${vac.fullName} - ${t('schedule:matrix.vacationDay', { day })}`}
                    onKeyDown={(event) => {
                      if (isVacationMode && event.key === 'Enter') {
                        onVacationToggle(vac.employeeId, day);
                      }
                    }}
                  >
                    {isOff && (
                      <span
                        className={cn(
                          'text-[11px] font-bold',
                          'text-[var(--chip-vacation-text)]',
                          'bg-[var(--chip-vacation-bg)] border border-gray-200 rounded px-1.5 py-0.5',
                        )}
                        title={vac.type ? (vacationTypeLabel[vac.type] || t('schedule:matrix.vacation')) : t('schedule:matrix.vacation')}
                      >
                        X
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(VacationBand);
