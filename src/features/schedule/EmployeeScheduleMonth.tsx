import { useTranslation } from 'react-i18next';
import type { EmployeeScheduleDay } from '@/types/employeeScheduleView';
import type { OperationalOccurrence } from '@/types/operationalSchedule';

interface Props { days: EmployeeScheduleDay[]; locale: string; onSelect: (occurrence: OperationalOccurrence) => void }

export default function EmployeeScheduleMonth({ days, locale, onSelect }: Props) {
  const { t } = useTranslation('schedule');
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-7">{days.map((day) => <article key={day.date} data-testid="personal-month-day" className="min-h-[132px] rounded-card border border-border bg-surface p-3 shadow-card"><time dateTime={day.date} className="block border-b border-border pb-2 text-sm font-semibold text-text-primary"><span className="me-1 text-primary">{new Date(`${day.date}T12:00:00`).getDate()}</span><span className="text-xs font-normal text-text-secondary">{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</span></time><div className="mt-2 space-y-1.5">{day.occurrences.map((occurrence) => <button key={occurrence.id} type="button" onClick={() => onSelect(occurrence)} aria-label={t('employeeView.openDetails', { shift: t(`employeeView.categories.${occurrence.category}`) })} className="block min-h-11 w-full rounded-btn bg-primary-50 px-2 py-1 text-start text-xs font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">{t(`employeeView.categories.${occurrence.category}`)}<span className="mt-0.5 block truncate text-[10px] font-normal text-text-secondary" dir="ltr">{occurrence.timeRange}</span></button>)}</div></article>)}</div>;
}
