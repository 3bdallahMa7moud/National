import { AlertTriangle, ArrowUpRight, CalendarDays, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmployeeNextShiftCard from './EmployeeNextShiftCard';
import EmployeeWeekAgenda from './EmployeeWeekAgenda';
import Card from '@/components/ui/Card';
import { buildEmployeeScheduleView } from '@/lib/employeeScheduleView';
import { useAuthStore } from '@/stores/authStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';

function formatDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function addDays(date: Date, days: number): Date { const result = new Date(date); result.setDate(result.getDate() + days); return result; }

export default function EmployeeDashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const user = useAuthStore((state) => state.user);
  const roster = useEmployeeRosterStore((state) => state.employees);
  const matrices = useScheduleMatrixStore((state) => state.matricesByMonth);
  const otMonths = useLateScheduleStore((state) => state.rowsByMonth);
  const otNotice = useLateScheduleStore((state) => state.notice);
  const now = new Date();
  const today = formatDate(now);

  if (!user?.scheduleEmployeeId) {
    return <Card className="mx-auto max-w-2xl py-10 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-warning" aria-hidden="true" /><h1 className="mt-3 text-xl font-semibold text-text-primary">{t('employee.unlinked.title')}</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">{t('employee.unlinked.description')}</p></Card>;
  }

  const sunday = addDays(now, -now.getDay());
  const week = buildEmployeeScheduleView(user.scheduleEmployeeId, { startDate: formatDate(sunday), endDate: formatDate(addDays(sunday, 6)) }, matrices, otMonths, roster, today);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const month = buildEmployeeScheduleView(user.scheduleEmployeeId, { startDate: formatDate(monthStart), endDate: formatDate(monthEnd) }, matrices, otMonths, roster, today);
  const horizon = buildEmployeeScheduleView(user.scheduleEmployeeId, { startDate: today, endDate: formatDate(addDays(now, 90)) }, matrices, otMonths, roster, today);

  if (month.availability === 'missing' && week.availability === 'missing') {
    return <Card className="mx-auto max-w-2xl py-10 text-center"><CalendarDays className="mx-auto h-8 w-8 text-text-secondary" aria-hidden="true" /><h1 className="mt-3 text-xl font-semibold text-text-primary">{t('employee.missing.title')}</h1><p className="mt-2 text-sm text-text-secondary">{t('employee.missing.description')}</p></Card>;
  }

  const totals = [
    ['day', month.totals.day], ['late', month.totals.late], ['night', month.totals.night],
    ['onCallDay', month.totals.onCallDay], ['onCallNight', month.totals.onCallNight], ['ot', month.totals.ot],
  ] as const;

  return (
    <div className="space-y-6">
      <header><p className="text-sm font-medium text-primary">{new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}</p><h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">{t('employee.title')}</h1><p className="mt-1 text-sm text-text-secondary">{t('employee.greeting', { name: user.name })}</p></header>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
        <EmployeeNextShiftCard occurrence={horizon.nextShift} locale={i18n.language} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Link to="/schedule/me" className="group flex min-h-[92px] items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"><span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span><span className="flex-1 font-semibold text-text-primary">{t('employee.links.mySchedule')}</span><ArrowUpRight className="h-4 w-4 text-primary rtl:-scale-x-100" aria-hidden="true" /></Link>
          <Link to="/schedule/department" className="group flex min-h-[92px] items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"><span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary-50 text-primary"><UsersRound className="h-5 w-5" aria-hidden="true" /></span><span className="flex-1 font-semibold text-text-primary">{t('employee.links.departmentSchedule')}</span><ArrowUpRight className="h-4 w-4 text-primary rtl:-scale-x-100" aria-hidden="true" /></Link>
        </div>
      </div>
      <EmployeeWeekAgenda days={week.days} locale={i18n.language} />
      {(month.notices.length > 0 || otNotice) && <Card><h2 className="font-semibold text-text-primary">{t('employee.notices.title')}</h2><div className="mt-3 space-y-2">{month.notices.map((notice) => <p key={notice.id} className="rounded-btn bg-warning/10 px-3 py-2 text-sm text-text-primary">{notice.date} · {notice.label}</p>)}{otNotice && <p className="rounded-btn bg-info/10 px-3 py-2 text-sm text-text-primary">{otNotice}</p>}</div></Card>}
      <section aria-labelledby="month-summary-title" className="space-y-3"><div><h2 id="month-summary-title" className="font-semibold text-text-primary">{t('employee.summary.title')}</h2><p className="mt-1 text-sm text-text-secondary">{t('employee.summary.description')}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">{totals.map(([category, count]) => <Card key={category} className="p-4 text-center sm:p-4"><p className="text-xl font-semibold text-text-primary">{count}</p><p className="mt-1 text-xs text-text-secondary">{t(`employee.categories.${category}`)}</p></Card>)}<Card className="p-4 text-center sm:p-4"><p className="text-xl font-semibold text-text-primary">{t('employee.summary.otHours', { count: month.totals.otHours })}</p><p className="mt-1 text-xs text-text-secondary">{t('employee.summary.hoursLabel')}</p></Card></div></section>
    </div>
  );
}
