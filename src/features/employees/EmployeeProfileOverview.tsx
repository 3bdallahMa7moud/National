import { ArrowUpRight, CalendarDays, Clock3, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import { occurrenceShiftStyle } from '@/lib/occurrenceShiftStyle';
import type { EmployeeScheduleView } from '@/types/employeeScheduleView';

interface Props {
  month: EmployeeScheduleView;
  week: EmployeeScheduleView;
}

export default function EmployeeProfileOverview({ month, week }: Props) {
  const { t } = useTranslation('employees');
  const totals = [
    ['day', month.totals.day],
    ['late', month.totals.late],
    ['night', month.totals.night],
    ['onCallDay', month.totals.onCallDay],
    ['onCallNight', month.totals.onCallNight],
    ['ot', month.totals.ot],
  ] as const;

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
        <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
        {t('profileView.scheduleOverview')}
      </h2>
      {month.nextShift && (
        <div
          className="mt-4 rounded-card border p-4"
          style={occurrenceShiftStyle(month.nextShift)}
          data-occurrence-color={month.nextShift.id}
        >
          <p className="text-xs font-semibold uppercase text-inherit opacity-80">{t('profileView.nextShift')}</p>
          <p className="mt-1 font-semibold text-inherit">
            {t(`profileView.categories.${month.nextShift.category}`)}
          </p>
          <p className="mt-1 text-sm text-inherit opacity-80">
            {month.nextShift.date} · {month.nextShift.facility} · {month.nextShift.unit}
          </p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-btn bg-background p-3">
          <p className="text-lg font-semibold text-text-primary">{week.occurrences.length}</p>
          <p className="text-xs text-text-secondary">{t('profileView.thisWeek')}</p>
        </div>
        {totals.map(([category, value]) => (
          <div key={category} className="rounded-btn bg-background p-3">
            <p className="text-lg font-semibold text-text-primary">{value}</p>
            <p className="text-xs text-text-secondary">{t(`profileView.categories.${category}`)}</p>
          </div>
        ))}
        <div className="rounded-btn bg-background p-3">
          <p className="text-lg font-semibold text-text-primary">{month.totals.otHours}</p>
          <p className="text-xs text-text-secondary">{t('profileView.otHours')}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/schedule/me"
          className="flex min-h-11 items-center gap-2 rounded-btn border border-border px-3 font-medium text-primary hover:bg-primary-50"
        >
          <Clock3 className="h-4 w-4" />
          {t('profileView.mySchedule')}
          <ArrowUpRight className="ms-auto h-4 w-4 rtl:-scale-x-100" />
        </Link>
        <Link
          to="/schedule/department"
          className="flex min-h-11 items-center gap-2 rounded-btn border border-border px-3 font-medium text-primary hover:bg-primary-50"
        >
          <UsersRound className="h-4 w-4" />
          {t('profileView.departmentSchedule')}
          <ArrowUpRight className="ms-auto h-4 w-4 rtl:-scale-x-100" />
        </Link>
      </div>
    </Card>
  );
}
