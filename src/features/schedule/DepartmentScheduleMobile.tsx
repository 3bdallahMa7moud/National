import { useTranslation } from 'react-i18next';
import { occurrenceShiftStyle } from '@/lib/occurrenceShiftStyle';
import type { DepartmentScheduleView } from '@/types/employeeScheduleView';

interface Props {
  view: DepartmentScheduleView;
  locale: string;
  selfEmployeeId?: string;
}

export default function DepartmentScheduleMobile({ view, locale, selfEmployeeId }: Props) {
  const { t } = useTranslation('schedule');

  return (
    <div className="space-y-3 md:hidden">
      {view.days.filter((day) => day.groups.length > 0).map((day) => (
        <article key={day.date} className="rounded-card border border-border bg-surface shadow-card">
          <header className="border-b border-border px-4 py-3">
            <time dateTime={day.date} className="font-semibold text-text-primary">
              {new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
                .format(new Date(`${day.date}T12:00:00`))}
            </time>
          </header>
          <div className="space-y-4 p-4">
            {day.groups.map((group) => (
              <section key={group.category}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t(`departmentView.categories.${group.category}`)}
                </h3>
                <div className="mt-2 space-y-2">
                  {group.occurrences.map((occurrence) => {
                    const self = occurrence.employeeId === selfEmployeeId;
                    return (
                      <div
                        key={occurrence.id}
                        data-occurrence-color={occurrence.id}
                        className={`rounded-btn border p-3 ${self ? 'ring-2 ring-primary/30' : ''}`}
                        style={occurrenceShiftStyle(occurrence)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-inherit">
                            {occurrence.employeeName || occurrence.employeeCode}
                          </span>
                          {self && (
                            <span className="rounded-full border border-current/20 bg-surface/70 px-2 py-0.5 text-[10px] font-semibold text-inherit">
                              {t('departmentView.you')}
                            </span>
                          )}
                          {occurrence.source === 'ot' && (
                            <span className="rounded-full border border-current/20 bg-surface/70 px-2 py-0.5 text-[10px] font-semibold text-inherit">
                              OT
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-inherit opacity-80">
                          {occurrence.facility} · {occurrence.unit}
                        </p>
                        <p className="mt-1 text-xs text-inherit opacity-80" dir="ltr">
                          {occurrence.timeRange}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
