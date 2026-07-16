import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PublishedScheduleSurface, { type PublishedScheduleTab } from './PublishedScheduleSurface';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PublishedScheduleExportActions from './PublishedScheduleExportActions';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { DEFAULT_SCHEDULE_DEPARTMENT_ID, projectPublishedOTTable, projectPublishedScheduleMatrix } from '@/lib/employeePublishedTables';
import { useAuthStore } from '@/stores/authStore';
import { resolveCurrentEmployeeAccess, useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { formatLateScheduleMonthKey, useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';

export default function DepartmentSchedulePage() {
  const { t, i18n } = useTranslation('schedule');
  const [tab, setTab] = useState<PublishedScheduleTab>('schedule');
  const [anchor, setAnchor] = useState(() => new Date());
  const user = useAuthStore((state) => state.user);
  const accessProfile = useEmployeeAccessStore((state) => user ? state.profiles[user.id] : undefined);
  const access = useMemo(
    () => user ? resolveCurrentEmployeeAccess(accessProfile ? {
      ...user,
      departmentId: accessProfile.departmentId,
      scheduleEmployeeId: accessProfile.scheduleEmployeeId,
    } : user) : null,
    [accessProfile, user],
  );
  const roster = useEmployeeRosterStore((state) => state.employees);
  const matrices = useScheduleMatrixStore((state) => state.matricesByMonth);
  const publishedOTRows = useLateScheduleStore((state) => state.publishedRowsByMonth);
  const publishedOTUnits = useLateScheduleStore((state) => state.publishedUnitsByMonth);
  const otDepartments = useLateScheduleStore((state) => state.departmentIdsByMonth);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const key = formatLateScheduleMonthKey(year, month);
  const departmentId = access?.departmentId || user?.departmentId || DEFAULT_SCHEDULE_DEPARTMENT_ID;
  const allowedTabs: PublishedScheduleTab[] = [
    ...(access?.active && access.permissions['schedule.department.view'] ? ['schedule' as const] : []),
    ...(access?.active && access.permissions['schedule.ot.department.view'] ? ['ot' as const] : []),
  ];
  const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0] || 'schedule';
  const canExport = access?.active && access.permissions['schedule.department.export'];
  const matrix = useMemo(
    () => projectPublishedScheduleMatrix(matrices[key], departmentId),
    [departmentId, key, matrices],
  );
  const otTable = useMemo(
    () => otDepartments[key] === departmentId
      ? projectPublishedOTTable(publishedOTRows[key], publishedOTUnits[key])
      : null,
    [departmentId, key, otDepartments, publishedOTRows, publishedOTUnits],
  );
  const monthTitle = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(anchor);

  if (allowedTabs.length === 0) {
    return <Card className="mx-auto max-w-2xl py-10 text-center"><p className="font-medium text-text-primary">{t('publishedTables.noAccess')}</p></Card>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('department.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('departmentView.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <PublishedScheduleExportActions
              tab={activeTab}
              year={year}
              month={month}
              matrix={matrix}
              otTable={otTable}
              roster={roster}
            />
          )}
          <span className="w-fit rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
            {t('publishedTables.readOnly')}
          </span>
        </div>
      </header>

      <Card className="p-3 sm:p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2" role="tablist" aria-label={t('publishedTables.tabsLabel')}>
            {allowedTabs.includes('schedule') && <Button type="button" role="tab" aria-selected={activeTab === 'schedule'} variant={activeTab === 'schedule' ? 'primary' : 'secondary'} onClick={() => setTab('schedule')} icon={<CalendarDays className="h-4 w-4" />}>
              {t('publishedTables.scheduleTab')}
            </Button>}
            {allowedTabs.includes('ot') && <Button type="button" role="tab" aria-selected={activeTab === 'ot'} variant={activeTab === 'ot' ? 'primary' : 'secondary'} onClick={() => setTab('ot')} icon={<Clock3 className="h-4 w-4" />}>
              {t('publishedTables.otTab')}
            </Button>}
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button type="button" variant="ghost" aria-label={t('employeeView.previous')} onClick={() => setAnchor(new Date(year, month - 1, 1))} className="min-h-11 min-w-11 px-2"><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></Button>
            <h2 className="min-w-40 text-center font-semibold text-text-primary">{monthTitle}</h2>
            <Button type="button" variant="ghost" aria-label={t('employeeView.next')} onClick={() => setAnchor(new Date(year, month + 1, 1))} className="min-h-11 min-w-11 px-2"><ChevronRight className="h-5 w-5 rtl:rotate-180" /></Button>
          </div>
        </div>
      </Card>

      <ErrorBoundary level="section" invalidateQueries>
        <PublishedScheduleSurface
          tab={activeTab}
          year={year}
          month={month}
          matrix={matrix}
          otTable={otTable}
          roster={roster}
          highlightedEmployeeId={access?.scheduleEmployeeId}
          emptyScheduleText={t('publishedTables.noSchedule')}
          emptyOTText={t('publishedTables.noOT')}
        />
      </ErrorBoundary>
    </div>
  );
}
