import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, LayoutList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PublishedScheduleSurface, { type PublishedScheduleTab } from './PublishedScheduleSurface';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PublishedScheduleExportActions from './PublishedScheduleExportActions';
import { ShiftRequestCreateModal } from '@/features/shift-requests/ShiftRequestsPage';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import EmployeeDetailedShiftsModal from './EmployeeDetailedShiftsModal';
import { DEFAULT_SCHEDULE_DEPARTMENT_ID, projectPublishedOTTable, projectPublishedScheduleMatrix } from '@/lib/employeePublishedTables';
import { createOTAssignmentRef, createScheduleAssignmentRef } from '@/lib/shiftAssignmentGateway';
import { useAuthStore } from '@/stores/authStore';
import { resolveCurrentEmployeeAccess, useEmployeeAccessStore } from '@/stores/employeeAccessStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { formatLateScheduleMonthKey, useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { Assignment, MatrixCellRef } from '@/types/scheduleMatrix';
import type { ShiftAssignmentRef, ShiftRequestMutationResult } from '@/types/shiftRequest';

export default function EmployeeSchedulePage() {
  const { t, i18n } = useTranslation(['schedule', 'shiftRequests']);
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: PublishedScheduleTab = searchParams.get('tab') === 'ot' ? 'ot' : 'schedule';
  const [tab, setTabState] = useState<PublishedScheduleTab>(initialTab);
  const [anchor, setAnchor] = useState(() => new Date());
  const [requestAssignment, setRequestAssignment] = useState<ShiftAssignmentRef | null>(null);
  const user = useAuthStore((state) => state.user);
  const accessProfile = useEmployeeAccessStore((state) => user ? state.profiles[user.id] : undefined);
  const [showDetailedShifts, setShowDetailedShifts] = useState(false);
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
  const employeeId = access?.scheduleEmployeeId;
  const allowedTabs: PublishedScheduleTab[] = [
    ...(access?.active && access.permissions['schedule.own.view'] ? ['schedule' as const] : []),
    ...(access?.active && access.permissions['schedule.ot.own.view'] ? ['ot' as const] : []),
  ];
  const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0] || 'schedule';
  const sourceMatrix = matrices[key];
  const matrix = employeeId ? projectPublishedScheduleMatrix(sourceMatrix, departmentId, employeeId) : null;
  const otTable = employeeId && otDepartments[key] === departmentId
    ? projectPublishedOTTable(publishedOTRows[key], publishedOTUnits[key], employeeId)
    : null;
  const canCreateRequest = Boolean(access?.active && access.linked && (
    access.permissions['schedule.exchange.create'] || access.permissions['schedule.replace.create']
  ));
  const canExport = Boolean(access?.active && access.permissions['schedule.own.export']);
  const ownRoster = useMemo(
    () => employeeId ? roster.filter((employee) => employee.employeeId === employeeId) : [],
    [employeeId, roster],
  );
  const setTab = (next: PublishedScheduleTab) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'ot') params.set('tab', 'ot');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  };
  const monthTitle = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(anchor);

  const openRequest = (assignment: ShiftAssignmentRef | null) => {
    if (!assignment || new Date(assignment.startsAt).getTime() <= Date.now()) return;
    setRequestAssignment(assignment);
  };

  const openScheduleRequest = (ref: MatrixCellRef, assignment: Assignment) => {
    if (!canCreateRequest || !sourceMatrix || !employeeId || assignment.employeeId !== employeeId) return;
    openRequest(createScheduleAssignmentRef(sourceMatrix, ref.rowId, ref.day, employeeId, departmentId));
  };

  const openOTRequest = (rowId: string, day: number, clickedEmployeeId: string) => {
    if (!canCreateRequest || !employeeId || clickedEmployeeId !== employeeId) return;
    openRequest(createOTAssignmentRef(
      publishedOTRows[key] ?? [],
      year,
      month,
      rowId,
      day,
      employeeId,
      departmentId,
      publishedOTUnits[key] ?? [],
    ));
  };

  const handleRequestResult = (result: ShiftRequestMutationResult) => {
    if (result.ok) {
      addToast({
        type: 'success',
        title: t('shiftRequests:messages.saved'),
        message: t('shiftRequests:messages.created'),
      });
      setRequestAssignment(null);
      return;
    }
    addToast({
      type: 'error',
      title: t('shiftRequests:messages.generic'),
      message: t('shiftRequests:messages.generic'),
    });
  };

  if (!employeeId) {
    return (
      <Card className="mx-auto max-w-2xl py-10 text-center">
        <h1 className="text-xl font-semibold text-text-primary">{t('employeeView.unlinked')}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t('employeeView.unlinkedHint')}</p>
      </Card>
    );
  }
  if (allowedTabs.length === 0) {
    return <Card className="mx-auto max-w-2xl py-10 text-center"><p className="font-medium text-text-primary">{t('publishedTables.noAccess')}</p></Card>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('employeeView.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('employeeView.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <PublishedScheduleExportActions
              tab={activeTab}
              year={year}
              month={month}
              matrix={matrix}
              otTable={otTable}
              roster={ownRoster}
            />
          )}
          <Button
            type="button"
            variant="secondary"
            icon={<LayoutList className="h-4 w-4" />}
            onClick={() => setShowDetailedShifts(true)}
          >
            {t('schedule:detailedShifts.myShiftsBtn', { defaultValue: 'My Detailed Shifts' })}
          </Button>
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
          roster={ownRoster}
          highlightedEmployeeId={employeeId}
          emptyScheduleText={t('publishedTables.noSchedule')}
          emptyOTText={t('publishedTables.noOT')}
          onScheduleAssignmentClick={canCreateRequest ? openScheduleRequest : undefined}
          onOTAssignmentClick={canCreateRequest ? openOTRequest : undefined}
        />
      </ErrorBoundary>
      <ShiftRequestCreateModal
        isOpen={Boolean(requestAssignment)}
        initialAssignment={requestAssignment || undefined}
        onClose={() => setRequestAssignment(null)}
        onResult={handleRequestResult}
      />
      <EmployeeDetailedShiftsModal
        isOpen={showDetailedShifts}
        onClose={() => setShowDetailedShifts(false)}
        employeeId={employeeId ?? null}
        employeeName={user?.name}
        data={sourceMatrix ?? null}
      />
    </div>
  );
}
