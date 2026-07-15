import { useTranslation } from 'react-i18next';
import { occurrenceShiftStyle } from '@/lib/occurrenceShiftStyle';
import type { EmployeeScheduleDay } from '@/types/employeeScheduleView';
import type { OperationalOccurrence } from '@/types/operationalSchedule';

interface Props {
  days: EmployeeScheduleDay[];
  locale: string;
  onSelect: (occurrence: OperationalOccurrence) => void;
}

export default function EmployeeScheduleWeek({ days, locale, onSelect }: Props) {
  const { t } = useTranslation('schedule');

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <section key={day.date} className="rounded-card border border-border bg-surface shadow-card">
          <div className="border-b border-border px-4 py-3">
            <time dateTime={day.date} className="font-semibold text-text-primary">
              {new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
                .format(new Date(`${day.date}T12:00:00`))}
            </time>
          </div>
          <div className="p-3">
            {day.occurrences.length === 0 ? (
              <p className="px-2 py-4 text-sm text-text-secondary">{t('employeeView.noAssignment')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {day.occurrences.map((occurrence) => (
                  <button
                    key={occurrence.id}
                    type="button"
                    onClick={() => onSelect(occurrence)}
                    aria-label={t('employeeView.openDetails', {
                      shift: t(`employeeView.categories.${occurrence.category}`),
                    })}
                    data-occurrence-color={occurrence.id}
                    className="min-h-[84px] rounded-btn border p-3 text-start transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={occurrenceShiftStyle(occurrence)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-inherit">
                          {t(`employeeView.categories.${occurrence.category}`)}
                        </p>
                        <p className="mt-1 text-sm text-inherit opacity-80">
                          {occurrence.facility} · {occurrence.unit}
                        </p>
                      </div>
                      <span className="rounded-full border border-current/20 bg-surface/70 px-2 py-1 text-[11px] font-semibold text-inherit">
                        {occurrence.source === 'ot' ? 'OT' : t('employeeView.scheduleSource')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-inherit opacity-80">
                      <span dir="ltr">{occurrence.timeRange}</span>
                      {occurrence.category === 'ot' && (
                        <span>{t('employeeView.hours', { count: occurrence.hours })}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
