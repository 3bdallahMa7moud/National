// ============================================================
// EmployeeDetailedShiftsModal
// Shows a chronological list of all shifts for a given employee
// in the current month, grouped by day.
// ============================================================

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { shiftChipStyle } from '@/lib/shiftColorPalette';
import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';

interface EmployeeDetailedShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  employeeName?: string;
  data: ScheduleMatrixData | null;
}

interface ShiftEntry {
  id: string;
  day: number;
  facilityName: string;
  unitName: string;
  shiftLabel: string;
  timeRange: string;
  colorKey: ShiftColorKey;
  backgroundColor?: string;
  textColor?: string;
}

function formatArabicDate(year: number, month: number, day: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(year, month, day));
  } catch {
    return `${year}-${month + 1}-${day}`;
  }
}

export default function EmployeeDetailedShiftsModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  data,
}: EmployeeDetailedShiftsModalProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);

  const shifts = useMemo<ShiftEntry[]>(() => {
    if (!data || !employeeId) return [];

    const items: ShiftEntry[] = [];

    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        if (unit.archived) continue;
        for (const row of unit.rows) {
          if (row.archived) continue;

          for (const [dayStr, assignments] of Object.entries(row.cellsByDay)) {
            const day = Number(dayStr);
            const isAssigned = (assignments ?? []).some((a) => a.employeeId === employeeId);

            if (isAssigned) {
              items.push({
                id: `${facility.id}-${unit.id}-${row.id}-${day}`,
                day,
                facilityName: facility.name,
                unitName: unit.name,
                shiftLabel: row.shiftLabel || row.rowLabel,
                timeRange: row.timeRange,
                colorKey: row.colorKey,
                backgroundColor: row.backgroundColor,
                textColor: row.textColor,
              });
            }
          }
        }
      }
    }

    return items.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.timeRange.localeCompare(b.timeRange);
    });
  }, [data, employeeId]);

  const title = employeeName
    ? t('schedule:detailedShifts.titleWithEmployee', { name: employeeName, defaultValue: `Shifts for {{name}}` })
    : t('schedule:detailedShifts.title', { defaultValue: 'Detailed Shifts' });

  const locale = i18n.language;
  const year = data?.year ?? new Date().getFullYear();
  const month = data?.month ?? new Date().getMonth();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="flex flex-col max-h-[70vh]">
        {/* Stats bar */}
        {shifts.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-muted shrink-0">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-text-primary">
              {t('schedule:detailedShifts.totalShifts', {
                count: shifts.length,
                defaultValue: `{{count}} shifts this month`,
              })}
            </span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          {shifts.length === 0 ? (
            <div className="text-center py-10 text-text-secondary">
              <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p>{t('schedule:detailedShifts.noShifts', { defaultValue: 'No shifts assigned for this month.' })}</p>
            </div>
          ) : (
            shifts.map((shift) => {
              const chipStyle = shiftChipStyle(shift.colorKey, shift.backgroundColor, shift.textColor);
              return (
                <div
                  key={shift.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Date & location */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-text-primary">
                      {formatArabicDate(year, month, shift.day, locale)}
                    </span>
                    <span className="text-xs text-text-secondary mt-0.5 truncate">
                      {shift.facilityName} • {shift.unitName}
                    </span>
                  </div>

                  {/* Shift chip */}
                  <div
                    className="rounded-lg px-3 py-2 shrink-0 min-w-[130px] text-center"
                    style={chipStyle}
                  >
                    <p className="text-sm font-bold text-inherit">{shift.shiftLabel}</p>
                    <p className="mt-0.5 text-[11px] text-inherit opacity-80" dir="ltr">
                      {shift.timeRange}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
