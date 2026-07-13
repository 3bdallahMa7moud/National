import { CalendarRange, Palmtree, TimerReset, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import type { OperationalSnapshot } from '@/types/operationalDashboard';

interface SecondaryOperationalMetricsProps { secondary: OperationalSnapshot['secondary']; availableMonths: number }

export default function SecondaryOperationalMetrics({ secondary, availableMonths }: SecondaryOperationalMetricsProps) {
  const { t } = useTranslation('dashboard');
  const metrics = [
    { label: t('secondary.scheduledEmployees'), value: `${secondary.scheduledEmployees} / ${secondary.activeEmployees}`, icon: UsersRound },
    { label: t('secondary.standardAssignments'), value: secondary.standardAssignments, icon: CalendarRange },
    { label: t('secondary.otHours'), value: t('coverage.hours', { count: secondary.otHours }), icon: TimerReset },
    { label: t('secondary.approvedVacations'), value: secondary.vacationEmployees, icon: Palmtree },
  ];
  return (
    <section aria-labelledby="secondary-metrics-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 id="secondary-metrics-title" className="text-base font-semibold text-text-primary">{t('secondary.title')}</h2><p className="mt-1 text-sm text-text-secondary">{t('secondary.description')}</p></div>
        <p className="text-xs font-medium text-text-secondary">{t('secondary.availableMonths', { count: availableMonths })}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="min-h-[108px] p-4 sm:p-4"><Icon className="h-4 w-4 text-primary" aria-hidden="true" /><p className="mt-3 text-xl font-semibold text-text-primary">{value}</p><p className="mt-1 text-xs text-text-secondary">{label}</p></Card>
        ))}
      </div>
    </section>
  );
}
