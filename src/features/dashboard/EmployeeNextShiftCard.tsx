import { CalendarClock, MapPin, TimerReset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import type { OperationalOccurrence } from '@/types/operationalSchedule';

interface EmployeeNextShiftCardProps { occurrence?: OperationalOccurrence; locale: string }

export default function EmployeeNextShiftCard({ occurrence, locale }: EmployeeNextShiftCardProps) {
  const { t } = useTranslation('dashboard');
  return (
    <Card className="h-full">
      <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-base font-semibold text-text-primary">{t('employee.nextShift.title')}</h2></div>
      {!occurrence ? <p className="mt-6 text-sm text-text-secondary">{t('employee.nextShift.empty')}</p> : (
        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-lg font-semibold text-text-primary">{t(`employee.categories.${occurrence.category}`)}</p><p className="mt-1 text-sm text-text-secondary">{new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${occurrence.date}T12:00:00`))}</p></div>
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary">{occurrence.source === 'ot' ? t('employee.source.ot') : t('employee.source.schedule')}</span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-btn bg-surface-muted p-3 text-sm text-text-primary"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" /><span>{occurrence.facility} · {occurrence.unit}</span></div>
            <div className="flex items-center gap-2 rounded-btn bg-surface-muted p-3 text-sm font-medium text-text-primary" dir="ltr"><TimerReset className="h-4 w-4 text-primary" aria-hidden="true" />{occurrence.timeRange}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
