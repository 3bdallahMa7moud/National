import { useTranslation } from 'react-i18next';
import { occurrenceShiftStyle } from '@/lib/occurrenceShiftStyle';
import type { EmployeeScheduleDay } from '@/types/employeeScheduleView';

interface EmployeeWeekAgendaProps {
  days: EmployeeScheduleDay[];
  locale: string;
}

export default function EmployeeWeekAgenda({ days, locale }: EmployeeWeekAgendaProps) {
  const { t } = useTranslation('dashboard');

  return (
    <section aria-labelledby="week-agenda-title" className="space-y-3">
      <div>
        <h2 id="week-agenda-title" className="text-base font-semibold text-text-primary">
          {t('employee.week.title')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{t('employee.week.description')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((day) => (
          <article
            key={day.date}
            data-testid="employee-agenda-day"
            className="min-h-[126px] rounded-card border border-border bg-surface p-3 shadow-card"
          >
            <time dateTime={day.date} className="block border-b border-border pb-2">
              <span className="block text-xs font-semibold uppercase text-primary">
                {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-text-primary">
                {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
                  .format(new Date(`${day.date}T12:00:00`))}
              </span>
            </time>
            <div className="mt-2 space-y-2">
              {day.occurrences.length === 0 ? (
                <p className="text-xs text-text-secondary">{t('employee.week.off')}</p>
              ) : day.occurrences.map((occurrence) => (
                <div
                  key={occurrence.id}
                  className="rounded-btn border px-2 py-1.5"
                  style={occurrenceShiftStyle(occurrence)}
                  data-occurrence-color={occurrence.id}
                >
                  <p className="text-xs font-semibold text-inherit">
                    {t(`employee.categories.${occurrence.category}`)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-inherit opacity-80" dir="ltr">
                    {occurrence.timeRange}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
