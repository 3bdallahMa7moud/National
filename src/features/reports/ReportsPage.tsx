import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  Clock,
  Phone,
  Search,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import {
  exportEmployeeAnalysisExcel,
  exportEmployeeAnalysisPdf,
  type EmployeeWorkloadRow,
} from '@/lib/employeeAnalysisExport';
import { useToast } from '@/components/ui/Toast';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { aggregateEmployeeAnalysisForPeriod } from '@/lib/employeeAnalysis';
import {
  createAnalysisPeriod,
  getAnalysisCoverage,
  type AnalysisGranularity,
} from '@/lib/analysisPeriod';
import { buildEmployeeAnalysisView } from '@/lib/employeeAnalysisView';
import {
  operationalShiftBackgrounds,
  operationalShiftGradient,
  operationalShiftStyle,
} from '@/lib/occurrenceShiftStyle';
import {
  collectPublishedShiftVisualsForPeriod,
  defaultOperationalShiftVisual,
} from '@/lib/operationalShiftVisuals';
import type { CoverageCategory } from '@/types/operationalDashboard';

type TabKey = 'overview' | 'workloadMatrix';

function initialAnalysisAnchor(): string {
  const matrix = useScheduleMatrixStore.getState().data;
  if (matrix) {
    return `${matrix.year}-${String(matrix.month + 1).padStart(2, '0')}-01`;
  }
  const ot = useLateScheduleStore.getState();
  return `${ot.year}-${String(ot.month + 1).padStart(2, '0')}-01`;
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation(['reports', 'common']);
  const isRtl = i18n.language === 'ar';
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isRtl ? 'ar-SA' : 'en-US'),
    [isRtl],
  );
  const formatNumber = (value: number) => numberFormatter.format(value);
  const { addToast } = useToast();

  const [granularity, setGranularity] = useState<AnalysisGranularity>('month');
  const [anchorDate, setAnchorDate] = useState(initialAnalysisAnchor);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const matricesByMonth = useScheduleMatrixStore((state) => state.matricesByMonth);
  const otRowsByMonth = useLateScheduleStore((state) => state.publishedRowsByMonth);
  const roster = useEmployeeRosterStore((state) => state.employees);
  const period = useMemo(
    () => createAnalysisPeriod(granularity, anchorDate, isRtl ? 'ar-SA' : 'en-US'),
    [anchorDate, granularity, isRtl],
  );
  const coverage = useMemo(
    () => getAnalysisCoverage(period, matricesByMonth, otRowsByMonth),
    [matricesByMonth, otRowsByMonth, period],
  );
  const publishedShiftVisuals = useMemo(
    () => collectPublishedShiftVisualsForPeriod(matricesByMonth, otRowsByMonth, period),
    [matricesByMonth, otRowsByMonth, period],
  );
  const analysisRows = useMemo(
    () => aggregateEmployeeAnalysisForPeriod({ matricesByMonth, otRowsByMonth, period, roster }),
    [matricesByMonth, otRowsByMonth, period, roster],
  );
  const hasAssignments = analysisRows.some(
    (row) => row.totalScheduledAssignments > 0 || row.vacationDays > 0,
  );

  const workloadRows: EmployeeWorkloadRow[] = useMemo(() => {
    return analysisRows.map((row) => {
      const total = row.totalScheduledAssignments;
      return {
        ...row,
        id: row.employeeId,
        name: isRtl ? row.fullName : row.fullNameEn || row.fullName,
        department: isRtl ? 'إدارة الجدولة' : 'Schedule Management',
        morning: row.day,
        evening: row.late,
        weekend: row.onCallDay + row.onCallNight,
        oncall: row.onCallDay + row.onCallNight,
        overtimeHours: row.otScheduleHours,
        otShifts: row.matrixOTShifts + row.otScheduleShifts,
        totalShifts: total,
        workloadStatus: total > 26 ? 'high' : total < 8 ? 'under' : 'balanced',
      };
    });
  }, [analysisRows, isRtl]);

  const analysisView = useMemo(
    () => buildEmployeeAnalysisView(workloadRows, searchQuery),
    [workloadRows, searchQuery],
  );
  const filteredRows = analysisView.rows;

  // Chart data mirrors the same filtered official roster used by the table and exports.
  const chartData = useMemo(() => {
    return analysisView.chartRows.map((r) => {
      const row = r as EmployeeWorkloadRow & { otShifts?: number; vacationDays?: number };
      return {
        name: r.code,
        fullName: r.name,
        morning: r.morning,
        evening: r.evening,
        night: r.night,
        oncall: r.oncall,
        ot: row.otShifts ?? 0,
        vacation: row.vacationDays ?? 0,
      };
    });
  }, [analysisView.chartRows]);

  const totalShifts = analysisView.summary.totalAssignments;
  const totalNight = analysisView.summary.totalNight;
  const assignedEmployeeCount = filteredRows.filter((row) =>
    row.totalScheduledAssignments > 0 || row.vacationDays > 0,
  ).length;
  const averageNightPerAssignedEmployee = assignedEmployeeCount > 0
    ? Math.round((totalNight / assignedEmployeeCount) * 10) / 10
    : 0;
  const visualsForCategory = (category: CoverageCategory) => publishedShiftVisuals[category].length > 0
    ? publishedShiftVisuals[category]
    : [defaultOperationalShiftVisual(category)];
  const chartSeriesBackgrounds = {
    morning: operationalShiftBackgrounds(visualsForCategory('day')),
    evening: operationalShiftBackgrounds(visualsForCategory('late')),
    night: operationalShiftBackgrounds(visualsForCategory('night')),
    oncall: operationalShiftBackgrounds(visualsForCategory('onCall')),
    ot: operationalShiftBackgrounds(visualsForCategory('ot')),
    vacation: [operationalShiftStyle({ colorKey: 'vacation' }).backgroundColor],
  };
  const chartFill = (series: keyof typeof chartSeriesBackgrounds) => {
    const backgrounds = chartSeriesBackgrounds[series];
    return backgrounds.length > 1 ? `url(#reports-shift-${series})` : backgrounds[0];
  };
  const shiftDistribution = [
    { name: t('common:shifts.morning'), value: analysisView.summary.totalDay, color: operationalShiftGradient(visualsForCategory('day')) },
    { name: t('common:shifts.evening'), value: analysisView.summary.totalLate, color: operationalShiftGradient(visualsForCategory('late')) },
    { name: t('common:shifts.night'), value: totalNight, color: operationalShiftGradient(visualsForCategory('night')) },
    { name: t('common:shifts.oncall'), value: analysisView.summary.totalOnCall, color: operationalShiftGradient(visualsForCategory('onCall')) },
    { name: isRtl ? 'عمل إضافي' : 'Overtime', value: analysisView.summary.totalOTShifts, color: operationalShiftGradient(visualsForCategory('ot')) },
  ].filter((item) => item.value > 0);
  const totalShiftDistribution = shiftDistribution.reduce((sum, item) => sum + item.value, 0);
  const totalVacationDays = analysisView.summary.totalVacationDays;
  const leaveDistribution = totalVacationDays > 0
    ? [{
        name: isRtl ? 'إجازة' : 'Vacation',
        value: totalVacationDays,
        color: operationalShiftStyle({ colorKey: 'vacation' }).backgroundColor,
      }]
    : [];

  const handleExportExcel = async () => {
    try {
      await exportEmployeeAnalysisExcel(filteredRows, { period, coverage, isRtl });
      addToast({
        type: 'success',
        title: isRtl ? 'تم تصدير ملف Excel بنجاح' : 'Excel Exported',
      });
    } catch {
      addToast({
        type: 'error',
        title: isRtl ? 'فشل تصدير Excel' : 'Export Failed',
      });
    }
  };

  const handleExportPdf = () => {
    exportEmployeeAnalysisPdf(filteredRows, { period, coverage, isRtl });
    addToast({
      type: 'success',
      title: isRtl ? 'تم تجهيز تقرير الطباعة / PDF' : 'PDF Prepared',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── 1. Header & Actions Toolbar ─── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
            {t('reports:title')}
          </h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {t('reports:subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-muted p-2">
            <Calendar className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            <select
              data-testid="analysis-granularity"
              value={granularity}
              onChange={(event) => setGranularity(event.target.value as AnalysisGranularity)}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={isRtl ? 'نوع فترة التحليل' : 'Analysis period'}
            >
              <option value="day">{isRtl ? 'يوم' : 'Day'}</option>
              <option value="week">{isRtl ? 'أسبوع' : 'Week'}</option>
              <option value="month">{isRtl ? 'شهر' : 'Month'}</option>
              <option value="year">{isRtl ? 'سنة' : 'Year'}</option>
            </select>
            {(granularity === 'day' || granularity === 'week') && (
              <input
                data-testid="analysis-period-date"
                type="date"
                value={anchorDate}
                onChange={(event) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
                    setAnchorDate(event.target.value);
                  }
                }}
                className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={isRtl ? 'تاريخ التحليل' : 'Analysis date'}
              />
            )}
            {granularity === 'month' && (
              <input
                data-testid="analysis-period-month"
                type="month"
                value={anchorDate.slice(0, 7)}
                onChange={(event) => {
                  if (/^\d{4}-\d{2}$/.test(event.target.value)) {
                    setAnchorDate(`${event.target.value}-01`);
                  }
                }}
                className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={isRtl ? 'شهر التحليل' : 'Analysis month'}
              />
            )}
            {granularity === 'year' && (
              <input
                data-testid="analysis-period-year"
                type="number"
                min="2020"
                max="2100"
                value={anchorDate.slice(0, 4)}
                onChange={(event) => {
                  if (/^\d{4}$/.test(event.target.value)) {
                    setAnchorDate(`${event.target.value}-01-01`);
                  }
                }}
                className="min-h-11 w-24 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={isRtl ? 'سنة التحليل' : 'Analysis year'}
              />
            )}
          </div>

          {/* Export Excel */}
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            onClick={handleExportExcel}
          >
            {t('reports:analysis.actions.exportExcel')}
          </Button>

          {/* Export PDF */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer className="h-4 w-4 text-primary" />}
            onClick={handleExportPdf}
          >
            {t('reports:analysis.actions.exportPdf')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-text-secondary">
          <p>{t('reports:analysis.liveDataHint')}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span data-testid="analysis-period-range" className="font-semibold text-text-primary">
              {period.startDate} — {period.endDate}
            </span>
            <span data-testid="analysis-coverage">
              {isRtl
                ? `${formatNumber(coverage.availableMonths)}/${formatNumber(coverage.requiredMonths)} أشهر متاحة`
                : `${formatNumber(coverage.availableMonths)}/${formatNumber(coverage.requiredMonths)} available months`}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/schedule"
            className="inline-flex min-h-11 items-center justify-center rounded-btn border border-border bg-surface-muted px-4 text-sm font-semibold text-primary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {t('reports:analysis.actions.openSchedule')}
          </a>
          <a
            href="/admin/late-schedule"
            className="inline-flex min-h-11 items-center justify-center rounded-btn border border-border bg-surface-muted px-4 text-sm font-semibold text-primary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {t('reports:analysis.actions.openOTSchedule')}
          </a>
        </div>
      </div>

      {!hasAssignments && (
        <div
          role="status"
          className="rounded-2xl border border-dashed border-border bg-surface-muted px-5 py-8 text-center text-sm font-medium text-text-secondary"
        >
          {t('reports:analysis.emptyLiveData')}
        </div>
      )}

      {/* ─── 2. Executive KPI Cards Grid (3 Cards) ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Scheduled Shifts */}
        <Card className="flex items-center gap-4 border-s-4 border-primary">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-text-secondary">
              {t('reports:stats.totalScheduled')}
            </p>
            <p data-testid="analysis-total-assignments" className="mt-1 text-2xl font-bold leading-none text-text-primary">
              {t('reports:stats.totalScheduledValue', { count: formatNumber(totalShifts) })}
            </p>
            <p data-testid="analysis-assigned-employees" className="text-xs font-medium text-emerald-600 mt-1">
              {isRtl
                ? `${formatNumber(assignedEmployeeCount)} موظف لديهم تعيينات`
                : `${formatNumber(assignedEmployeeCount)} employees with assignments`}
            </p>
          </div>
        </Card>

        {/* Card 2: Night Shifts */}
        <Card className="flex items-center gap-4 border-s-4 border-purple-500">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-text-secondary">
              {isRtl ? 'نوبات الليل المجدولة' : 'Night Shift Load'}
            </p>
            <p className="mt-1 text-2xl font-bold leading-none text-text-primary">
              {formatNumber(totalNight)} {isRtl ? 'نوبة' : 'shifts'}
            </p>
            <p data-testid="analysis-average-night" className="text-xs font-medium text-text-secondary mt-1">
              {isRtl
                ? `متوسط ${formatNumber(averageNightPerAssignedEmployee)} شفت ليلي لكل موظف مُعيّن`
                : `${formatNumber(averageNightPerAssignedEmployee)} avg night shifts / assigned employee`}
            </p>
          </div>
        </Card>

        {/* Card 3: Overtime Shifts */}
        <Card className="flex items-center gap-4 border-s-4 border-amber-500">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-text-secondary">
              {isRtl ? 'شفتات العمل الإضافي (OT Shifts)' : 'Total OT Shifts'}
            </p>
            <p className="mt-1 text-2xl font-bold leading-none text-text-primary">
              {formatNumber(analysisView.summary.totalOTShifts)} {isRtl ? 'شفت' : 'shifts'}
            </p>
            <p data-testid="analysis-ot-hours" className="text-xs font-medium text-amber-600 mt-1">
              {isRtl
                ? `${formatNumber(analysisView.summary.totalOTHours)} ساعة OT`
                : `${formatNumber(analysisView.summary.totalOTHours)} OT hours`}
            </p>
          </div>
        </Card>
      </div>

      {/* ─── 3. Interactive Analytics Tabs Navigation ─── */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-3" role="tablist" aria-label={isRtl ? 'طرق عرض التحليل' : 'Analysis views'}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'overview'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          {t('reports:analysis.tabs.overview')}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'workloadMatrix'}
          onClick={() => setActiveTab('workloadMatrix')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'workloadMatrix'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          {t('reports:analysis.tabs.workloadMatrix')}
        </button>
      </div>

      {/* ─── 4. Tab Contents ─── */}
      <ErrorBoundary level="section" invalidateQueries>
      {/* TAB 1: Overview & Charts — all 29 employees */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Main bar chart: all employees */}
          <Card className="lg:col-span-2">
            <h3 className="mb-4 text-base font-semibold text-text-primary">
              {isRtl
                ? `توزيع النوبات — جميع الموظفين (${formatNumber(filteredRows.length)})`
                : `Shift Distribution — All Employees (${formatNumber(filteredRows.length)})`}
            </h3>
            <div className="space-y-2 sm:hidden">
              {chartData.slice(0, 6).map((employee) => {
                const total = employee.morning + employee.evening + employee.night + employee.oncall + employee.ot;
                return (
                  <div key={employee.name} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface-muted p-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white" dir="ltr">
                      {employee.name}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">{employee.fullName}</span>
                      <span className="mt-0.5 block text-xs text-text-secondary">
                        {isRtl ? `${formatNumber(total)} نوبة` : `${formatNumber(total)} shifts`} · {isRtl ? `${formatNumber(employee.night)} ليلية` : `${formatNumber(employee.night)} night`}
                      </span>
                    </span>
                  </div>
                );
              })}
              {chartData.length > 6 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('workloadMatrix')}
                  className="min-h-11 w-full rounded-btn border border-border bg-surface-muted px-4 text-sm font-semibold text-primary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {isRtl ? `عرض كل الموظفين (${formatNumber(chartData.length)})` : `View all employees (${formatNumber(chartData.length)})`}
                </button>
              )}
            </div>
            <div className="hidden h-96 w-full min-h-[280px] overflow-x-auto sm:block" dir="ltr">
              <ResponsiveContainer width={Math.max(chartData.length * 52, 600)} height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                >
                  <defs>
                    {Object.entries(chartSeriesBackgrounds).map(([series, backgrounds]) => backgrounds.length > 1 && (
                      <linearGradient key={series} id={`reports-shift-${series}`} x1="0" y1="0" x2="1" y2="0">
                        {backgrounds.map((background, index) => (
                          <stop
                            key={`${series}-${background}`}
                            offset={`${(index / Math.max(1, backgrounds.length - 1)) * 100}%`}
                            stopColor={background}
                          />
                        ))}
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    tick={{ fill: '#64748B' }}
                  />
                  <YAxis stroke="#64748B" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                    formatter={(value, name, props) => [
                      value,
                      props.payload?.fullName || name,
                    ]}
                    labelFormatter={(label) => {
                      const emp = chartData.find((d) => d.name === label);
                      return emp ? emp.fullName : label;
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '12px' }} />
                  <Bar dataKey="morning" name={t('common:shifts.morning')} stackId="a" fill={chartFill('morning')} />
                  <Bar dataKey="evening" name={t('common:shifts.evening')} stackId="a" fill={chartFill('evening')} />
                  <Bar
                    dataKey="night"
                    name={t('common:shifts.night')}
                    stackId="a"
                    fill={chartFill('night')}
                  />
                  <Bar
                    dataKey="oncall"
                    name={t('common:shifts.oncall')}
                    stackId="a"
                    fill={chartFill('oncall')}
                  />
                  <Bar
                    dataKey="ot"
                    name={isRtl ? 'عمل إضافي' : 'Overtime'}
                    stackId="a"
                    fill={chartFill('ot')}
                  />
                  <Bar
                    dataKey="vacation"
                    name={isRtl ? 'إجازة' : 'Vacation'}
                    stackId="a"
                    fill={chartFill('vacation')}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Distribution side panel — Shifts + Vacations separated */}
          <Card>
            {/* Shifts section */}
            <h3 className="mb-3 text-base font-semibold text-text-primary">
              {t('reports:charts.shiftTypeDistribution')}
            </h3>
            <div className="space-y-3">
              {shiftDistribution.map((item) => {
                const percentage = Math.round(
                  (item.value / totalShiftDistribution) * 100
                );
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: item.color }}
                        />
                        <span className="font-medium text-text-primary">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span>{t('reports:charts.shiftCount', { count: formatNumber(item.value) })}</span>
                        <span className="font-semibold text-text-primary">{formatNumber(percentage)}%</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-pill bg-surface-muted">
                      <div
                        className="h-full rounded-pill transition-all duration-300"
                        style={{ width: `${percentage}%`, background: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vacations / Leave section */}
            {leaveDistribution.length > 0 && (
              <>
                <div className="my-4 border-t border-border" />
                <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wide">
                  {isRtl ? 'الإجازات والغياب' : 'Leave & Vacations'}
                </h3>
                <div className="space-y-3">
                  {leaveDistribution.map((item) => {
                    const total = leaveDistribution.reduce((s, i) => s + i.value, 0);
                    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: item.color }}
                            />
                            <span className="font-medium text-text-primary">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span>{isRtl ? `${formatNumber(item.value)} يوم` : `${formatNumber(item.value)} days`}</span>
                            <span className="font-semibold text-text-primary">{formatNumber(percentage)}%</span>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-pill bg-surface-muted">
                          <div
                            className="h-full rounded-pill transition-all duration-300"
                            style={{ width: `${percentage}%`, background: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: Employee Workload Matrix Table */}
      {activeTab === 'workloadMatrix' && (
        <Card className="space-y-4">
          {/* Search bar only — no status filter buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder={t('reports:analysis.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface ps-9 pe-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary focus:outline-none"
              />
            </div>
            <span className="text-sm text-text-secondary">
              {isRtl
                ? `إجمالي الموظفين: ${formatNumber(filteredRows.length)}`
                : `Total employees: ${formatNumber(filteredRows.length)}`}
            </span>
          </div>

          {/* Workload Table — no Workload Status column */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-start text-sm">
              <thead className="bg-surface-muted text-xs font-semibold text-text-secondary uppercase">
                <tr>
                  <th className="px-4 py-3.5 text-start">{t('reports:analysis.table.employee')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.code')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.morning')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.evening')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.night')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.onCallDay')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.onCallNight')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.matrixOT')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.otScheduleShifts')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.otScheduleHours')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.vacationDays')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.source')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.totalShifts')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-sm text-text-secondary">
                      {t('reports:analysis.table.noResults')}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        data-testid={`analysis-row-${row.employeeId}`}
                        className="hover:bg-hover/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-text-primary">
                          {row.name}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded bg-teal-600 text-white font-mono text-xs font-bold">
                            {row.code}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-text-primary">{formatNumber(row.morning)}</td>
                        <td className="px-3 py-3 text-center text-text-primary">{formatNumber(row.evening)}</td>
                        <td className="px-3 py-3 text-center font-semibold text-purple-600 dark:text-purple-400">
                          {formatNumber(row.night)}
                        </td>
                        <td className="px-3 py-3 text-center text-blue-600 dark:text-blue-400">{formatNumber(row.onCallDay)}</td>
                        <td className="px-3 py-3 text-center text-sky-600 dark:text-sky-400">{formatNumber(row.onCallNight)}</td>
                        <td className="px-3 py-3 text-center text-orange-700 dark:text-orange-300">{formatNumber(row.matrixOTShifts)}</td>
                        <td className="px-3 py-3 text-center" data-testid="ot-schedule-shifts">{formatNumber(row.otScheduleShifts)}</td>
                        <td className="px-3 py-3 text-center" data-testid="ot-schedule-hours">{formatNumber(row.otScheduleHours)}</td>
                        <td className="px-3 py-3 text-center">{formatNumber(row.vacationDays)}</td>
                        <td className="px-3 py-3 text-center text-xs text-text-secondary" data-testid="analysis-source">
                          {t(`reports:analysis.table.sources.${row.source}`)}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-text-primary">
                          {formatNumber(row.totalShifts)}
                        </td>
                      </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </ErrorBoundary>
    </div>
  );
}
