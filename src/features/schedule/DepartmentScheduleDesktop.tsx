import { useTranslation } from 'react-i18next';
import { occurrenceShiftStyle } from '@/lib/occurrenceShiftStyle';
import type { DepartmentScheduleView } from '@/types/employeeScheduleView';
import type { OperationalShiftCategory } from '@/types/operationalSchedule';

interface Props {
  view: DepartmentScheduleView;
  locale: string;
  selfEmployeeId?: string;
}

const CATEGORIES: OperationalShiftCategory[] = ['day', 'late', 'night', 'onCallDay', 'onCallNight', 'ot'];

export default function DepartmentScheduleDesktop({ view, locale, selfEmployeeId }: Props) {
  const { t } = useTranslation('schedule');

  return (
    <div className="hidden overflow-x-auto rounded-card border border-border bg-surface shadow-card md:block">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-muted">
          <tr>
            <th className="w-44 border-b border-border px-4 py-3 text-start text-xs font-semibold text-text-secondary">
              {t('departmentView.date')}
            </th>
            {CATEGORIES.map((category) => (
              <th key={category} className="border-b border-border px-3 py-3 text-start text-xs font-semibold text-text-secondary">
                {t(`departmentView.categories.${category}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {view.days.map((day) => (
            <tr key={day.date} className="align-top">
              <th className="sticky start-0 bg-surface px-4 py-4 text-start font-medium text-text-primary">
                <time dateTime={day.date}>
                  {new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' })
                    .format(new Date(`${day.date}T12:00:00`))}
                </time>
              </th>
              {CATEGORIES.map((category) => {
                const group = day.groups.find((entry) => entry.category === category);
                return (
                  <td key={category} className="px-3 py-3">
                    {group?.occurrences.map((occurrence) => {
                      const self = occurrence.employeeId === selfEmployeeId;
                      return (
                        <div
                          key={occurrence.id}
                          data-occurrence-color={occurrence.id}
                          className={`mb-2 rounded-btn border p-2 ${self ? 'ring-2 ring-primary/30' : ''}`}
                          style={occurrenceShiftStyle(occurrence)}
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-inherit">
                              {occurrence.employeeName || occurrence.employeeCode}
                            </span>
                            {self && (
                              <span className="rounded-full border border-current/20 bg-surface/70 px-1.5 py-0.5 text-[10px] font-semibold text-inherit">
                                {t('departmentView.you')}
                              </span>
                            )}
                            {occurrence.source === 'ot' && (
                              <span className="rounded-full border border-current/20 bg-surface/70 px-1.5 py-0.5 text-[10px] font-semibold text-inherit">
                                OT
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-inherit opacity-80">
                            {occurrence.facility} · {occurrence.unit}
                          </p>
                          <p className="mt-0.5 text-[11px] text-inherit opacity-80" dir="ltr">
                            {occurrence.timeRange}
                          </p>
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
