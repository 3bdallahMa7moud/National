import { useMemo, useState } from 'react';
import { CalendarClock, ExternalLink, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RecentOperationalActivity from './RecentOperationalActivity';
import SecondaryOperationalMetrics from './SecondaryOperationalMetrics';
import TodayCoverageCards from './TodayCoverageCards';
import TodayShiftGroups from './TodayShiftGroups';
import { buildUnifiedOperationalAudit } from '@/lib/operationalAudit';
import { buildOperationalSnapshot } from '@/lib/operationalSnapshot';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useOperationalAuditStore } from '@/stores/operationalAuditStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { CoverageCategory } from '@/types/operationalDashboard';

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const [selectedDate, setSelectedDate] = useState(() => localDateValue(new Date()));
  const [selectedCategory, setSelectedCategory] = useState<CoverageCategory | null>(null);
  const matricesByMonth = useScheduleMatrixStore((state) => state.matricesByMonth);
  const rowsByMonth = useLateScheduleStore((state) => state.rowsByMonth);
  const employees = useEmployeeRosterStore((state) => state.employees);
  const persistedAuditEntries = useOperationalAuditStore((state) => state.entries);
  const monthKey = selectedDate.slice(0, 7);
  const matrix = matricesByMonth[monthKey];
  const snapshot = useMemo(
    () => buildOperationalSnapshot(selectedDate, matrix, rowsByMonth[monthKey], employees),
    [employees, matrix, monthKey, rowsByMonth, selectedDate],
  );
  const auditEntries = useMemo(() => {
    const scheduleEntries = Object.values(matricesByMonth).flatMap((entry) => entry.auditLog);
    return buildUnifiedOperationalAudit(scheduleEntries, persistedAuditEntries);
  }, [matricesByMonth, persistedAuditEntries]);
  const latestPublish = auditEntries.find((entry) => entry.action === 'publish');

  return (
    <div className="space-y-6">
      <header className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-text-secondary">
              <span className="inline-flex h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              <span>{t('department')}</span><span aria-hidden="true">·</span>
              <span>{latestPublish ? t('lastPublished', { value: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(latestPublish.timestamp)) }) : t('notPublished')}</span>
            </div>
            <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('commandCenter.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{t('commandCenter.description')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-xs font-medium text-text-secondary">
              <span className="mb-1.5 block">{t('operationalDate')}</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => { setSelectedDate(event.target.value); setSelectedCategory(null); }}
                className="min-h-11 w-full rounded-btn border border-border bg-background px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto"
              />
            </label>
            <div className="flex gap-2">
              <Link to={`/admin/schedule?date=${selectedDate}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn bg-primary px-4 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary/30">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />{t('actions.openSchedule')}
              </Link>
              <Link to={`/admin/late-schedule?year=${selectedDate.slice(0, 4)}&month=${Number(selectedDate.slice(5, 7))}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30">
                <TimerReset className="h-4 w-4" aria-hidden="true" />{t('actions.reviewOt')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {snapshot.availability === 'missing' && (
        <div role="status" className="flex flex-col gap-3 rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-primary sm:flex-row sm:items-center sm:justify-between">
          <span>{t('missingSchedule')}</span>
          <Link to={`/admin/schedule?date=${selectedDate}`} className="inline-flex min-h-11 items-center gap-1 self-start rounded-btn px-2 font-medium text-primary hover:bg-primary-50 sm:self-auto">{t('actions.openSchedule')}<ExternalLink className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      )}

      <TodayCoverageCards
        metrics={snapshot.coverage}
        hasPublishedSchedule={snapshot.availability === 'available'}
        selectedCategory={selectedCategory}
        onSelect={(category) => setSelectedCategory((current) => current === category ? null : category)}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <TodayShiftGroups groups={snapshot.shiftGroups} selectedCategory={selectedCategory} />
        <RecentOperationalActivity entries={auditEntries.slice(0, 5)} locale={i18n.language} />
      </div>

      <SecondaryOperationalMetrics secondary={snapshot.secondary} availableMonths={Object.keys(matricesByMonth).length} />
    </div>
  );
}
