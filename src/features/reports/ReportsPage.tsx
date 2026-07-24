import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useTheme } from '@/hooks/useTheme';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  Clock,
  Phone,
  Search,
  FileSpreadsheet,
  Printer,
  User,
  Filter,
  X,
  RotateCcw,
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [stackMode, setStackMode] = useState<'stacked' | 'grouped'>('stacked');

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
      const totalHours = (row.day * 8) + (row.late * 8) + (row.night * 12) + (row.onCallDay * 8) + (row.onCallNight * 12) + row.otScheduleHours;
      return {
        ...row,
        id: row.employeeId,
        name: isRtl ? row.fullName : row.fullNameEn || row.fullName,
        department: isRtl ? 'إدارة الجدولة' : 'Schedule Management',
        morning: row.day,
        evening: row.late,
        weekend: row.onCallDay + row.onCallNight,
        oncall: row.onCallDay + row.onCallNight,
        onCallDay: row.onCallDay,
        onCallNight: row.onCallNight,
        overtimeHours: row.otScheduleHours,
        otShifts: row.matrixOTShifts + row.otScheduleShifts,
        totalShifts: total,
        totalHours,
        workloadStatus: total > 26 ? 'high' : total < 8 ? 'under' : 'balanced',
      };
    });
  }, [analysisRows, isRtl]);

  const selectedEmployee = useMemo(
    () => workloadRows.find((emp) => emp.id === selectedEmployeeId),
    [workloadRows, selectedEmployeeId],
  );

  const { isDark } = useTheme();

  const shiftColors = useMemo(() => ({
    morning: isDark ? '#2DD4BF' : '#0D9488',
    evening: isDark ? '#FBBF24' : '#D97706',
    night: isDark ? '#38BDF8' : '#0284C7',
    onCallDay: isDark ? '#FACC15' : '#EAB308',
    onCallNight: isDark ? '#22D3D8' : '#06B6D4',
    ot: isDark ? '#FB7185' : '#E11D48',
    vacation: isDark ? '#94A3B8' : '#64748B',
  }), [isDark]);

  const employeePieData = useMemo(() => {
    if (!selectedEmployee) return [];
    return [
      { name: isRtl ? 'Day (نهاري)' : 'Day', value: selectedEmployee.morning, hours: selectedEmployee.morning * 8, isHoursBased: false, color: shiftColors.morning },
      { name: isRtl ? 'Night / Evening (ليلي / مسائي)' : 'Night / Evening', value: selectedEmployee.night, hours: selectedEmployee.night * 12, isHoursBased: false, color: shiftColors.night },
      { name: isRtl ? 'On-call Day' : 'On-call Day', value: selectedEmployee.onCallDay, hours: selectedEmployee.onCallDay * 8, isHoursBased: true, color: shiftColors.onCallDay },
      { name: isRtl ? 'On-call Night' : 'On-call Night', value: selectedEmployee.onCallNight, hours: selectedEmployee.onCallNight * 12, isHoursBased: true, color: shiftColors.onCallNight },
      { name: isRtl ? 'OT (عمل إضافي)' : 'OT', value: selectedEmployee.otShifts, hours: selectedEmployee.overtimeHours, isHoursBased: true, color: shiftColors.ot },
      { name: isRtl ? 'إجازة' : 'Vacation', value: selectedEmployee.vacationDays, hours: 0, isHoursBased: false, color: shiftColors.vacation },
    ];
  }, [selectedEmployee, shiftColors, isRtl]);

  const selectedEmployeeTotalShifts = useMemo(() => {
    if (!selectedEmployee) return 0;
    return selectedEmployee.morning + selectedEmployee.evening + selectedEmployee.night + selectedEmployee.onCallDay + selectedEmployee.onCallNight + selectedEmployee.otShifts;
  }, [selectedEmployee]);

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
        id: r.id,
        name: r.code,
        fullName: r.name,
        morning: r.morning,
        evening: r.evening,
        night: r.night,
        onCallDay: r.onCallDay,
        onCallNight: r.onCallNight,
        ot: row.otShifts ?? 0,
        vacation: row.vacationDays ?? 0,
      };
    });
  }, [analysisView.chartRows]);

  const displayedChartData = useMemo(() => {
    if (selectedEmployeeId === 'all' || !selectedEmployee) {
      return chartData;
    }
    const empBar = chartData.find((d) => d.id === selectedEmployeeId);
    return empBar ? [empBar] : chartData;
  }, [chartData, selectedEmployeeId, selectedEmployee]);

  const totalShifts = analysisView.summary.totalAssignments;
  const totalNight = analysisView.summary.totalNight;
  const assignedEmployeeCount = filteredRows.filter((row) =>
    row.totalScheduledAssignments > 0 || row.vacationDays > 0,
  ).length;
  const averageNightPerAssignedEmployee = assignedEmployeeCount > 0
    ? Math.round((totalNight / assignedEmployeeCount) * 10) / 10
    : 0;

  const targetSummary = useMemo(() => {
    if (selectedEmployeeId === 'all' || !selectedEmployee) {
      return {
        totalDay: analysisView.summary.totalDay,
        totalLate: analysisView.summary.totalLate,
        totalNight,
        totalOnCallDay: analysisView.summary.totalOnCallDay,
        totalOnCallNight: analysisView.summary.totalOnCallNight,
        totalOTShifts: analysisView.summary.totalOTShifts,
        totalVacationDays: analysisView.summary.totalVacationDays,
        totalHours: analysisView.summary.totalHours,
      };
    }
    return {
      totalDay: selectedEmployee.morning,
      totalLate: selectedEmployee.evening,
      totalNight: selectedEmployee.night,
      totalOnCallDay: selectedEmployee.onCallDay,
      totalOnCallNight: selectedEmployee.onCallNight,
      totalOTShifts: selectedEmployee.otShifts,
      totalVacationDays: selectedEmployee.vacationDays,
      totalHours: selectedEmployee.totalHours,
    };
  }, [selectedEmployeeId, selectedEmployee, analysisView.summary, totalNight]);

  const chartSeriesBackgrounds = {
    morning: [shiftColors.morning],
    evening: [shiftColors.evening],
    night: [shiftColors.night],
    onCallDay: [shiftColors.onCallDay],
    onCallNight: [shiftColors.onCallNight],
    ot: [shiftColors.ot],
    vacation: [shiftColors.vacation],
  };
  const chartFill = (series: keyof typeof chartSeriesBackgrounds) => {
    const backgrounds = chartSeriesBackgrounds[series];
    return backgrounds.length > 1 ? `url(#reports-shift-${series})` : backgrounds[0];
  };
  const otTotalHours = selectedEmployee ? selectedEmployee.overtimeHours : analysisView.summary.totalOTHours;
  const shiftDistribution = [
    { name: isRtl ? 'Day (نهاري)' : 'Day', value: targetSummary.totalDay, hours: targetSummary.totalDay * 8, isHoursBased: false, color: shiftColors.morning },
    { name: isRtl ? 'Night / Evening (ليلي / مسائي)' : 'Night / Evening', value: targetSummary.totalNight, hours: targetSummary.totalNight * 12, isHoursBased: false, color: shiftColors.night },
    { name: isRtl ? 'On-call Day' : 'On-call Day', value: targetSummary.totalOnCallDay, hours: targetSummary.totalOnCallDay * 8, isHoursBased: true, color: shiftColors.onCallDay },
    { name: isRtl ? 'On-call Night' : 'On-call Night', value: targetSummary.totalOnCallNight, hours: targetSummary.totalOnCallNight * 12, isHoursBased: true, color: shiftColors.onCallNight },
    { name: isRtl ? 'OT (عمل إضافي)' : 'OT', value: targetSummary.totalOTShifts, hours: otTotalHours, isHoursBased: true, color: shiftColors.ot },
  ];
  const totalShiftDistribution = shiftDistribution.reduce((sum, item) => sum + item.value, 0);
  const totalVacationDays = targetSummary.totalVacationDays;
  const leaveDistribution = totalVacationDays > 0
    ? [{
        name: isRtl ? 'إجازة' : 'Vacation',
        value: totalVacationDays,
        color: shiftColors.vacation,
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

      {/* ─── 2. Executive KPI Cards Grid (4 Cards) ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Card 2: Total Calculated Hours */}
        <Card className="flex items-center gap-4 border-s-4 border-teal-500">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-text-secondary">
              {isRtl ? 'إجمالي الساعات الكلية' : 'Total Calculated Hours'}
            </p>
            <p data-testid="analysis-total-hours" className="mt-1 text-2xl font-bold leading-none text-text-primary">
              {formatNumber(targetSummary.totalHours)} {isRtl ? 'ساعة' : 'hours'}
            </p>
            <p className="text-xs font-medium text-teal-600 mt-1">
              {isRtl
                ? 'شاملة الـ OT والأونكول نهاري وليلي'
                : 'Includes OT & On-call Day/Night'}
            </p>
          </div>
        </Card>

        {/* Card 3: Night Shifts */}
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

        {/* Card 4: Overtime Shifts */}
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
          {/* Main bar chart: all employees or single employee filter */}
          <Card className="lg:col-span-2">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  {selectedEmployee
                    ? (isRtl
                        ? `تحليل نوبات الموظف: ${selectedEmployee.name} (${selectedEmployee.code})`
                        : `Shift Analysis — ${selectedEmployee.name} (${selectedEmployee.code})`)
                    : (isRtl
                        ? `توزيع النوبات — جميع الموظفين (${formatNumber(filteredRows.length)})`
                        : `Shift Distribution — All Employees (${formatNumber(filteredRows.length)})`)}
                </h3>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {selectedEmployee
                    ? (isRtl ? 'تحليل تفصيلي دائر ي وقطاعي لنوبات الموظف المختار' : 'Detailed donut & workload breakdown for selected employee')
                    : (isRtl ? 'انقر على عمود أي موظف للتركيز عليه أو استخدم التصفية' : 'Click any employee bar to focus or filter')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Mode toggle (Stacked vs Grouped) — shown when viewing all employees */}
                {selectedEmployeeId === 'all' && (
                  <div className="flex items-center rounded-lg border border-border bg-surface-muted p-1" role="group" aria-label={isRtl ? 'نمط عرض الرسم البياني' : 'Chart stack mode'}>
                    <button
                      type="button"
                      onClick={() => setStackMode('stacked')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        stackMode === 'stacked'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {isRtl ? 'مكدّس' : 'Stacked'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStackMode('grouped')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        stackMode === 'grouped'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {isRtl ? 'مُقسّم' : 'Grouped'}
                    </button>
                  </div>
                )}

                {/* Dropdown Employee Selector */}
                <div className="relative min-w-[170px]">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full min-h-10 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-label={isRtl ? 'فلترة حسب الموظف' : 'Filter by employee'}
                  >
                    <option value="all">
                      {isRtl ? `جميع الموظفين (${formatNumber(workloadRows.length)})` : `All Employees (${formatNumber(workloadRows.length)})`}
                    </option>
                    {workloadRows.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEmployeeId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId('all')}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 text-xs font-semibold text-primary transition-colors hover:bg-hover hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{isRtl ? 'عرض الجميع' : 'Show All'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* SINGLE EMPLOYEE VIEW: Donut PieChart + Detailed Breakdown */}
            {selectedEmployee ? (
              <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2 items-center">
                {/* Donut Chart */}
                <div className="relative flex flex-col items-center justify-center min-h-[280px]" dir="ltr">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={employeePieData.filter((item) => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                      >
                        {employeePieData.filter((item) => item.value > 0).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                          borderRadius: '10px',
                          border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                          boxShadow: isDark ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          fontSize: '12px',
                          color: isDark ? '#F8FAFC' : '#0F172A',
                        }}
                        formatter={(value, name) => [
                          `${formatNumber(Number(value))} (${selectedEmployeeTotalShifts > 0 ? Math.round((Number(value) / selectedEmployeeTotalShifts) * 100) : 0}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central Donut Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl sm:text-2xl font-extrabold text-text-primary">
                      {formatNumber(selectedEmployee.totalHours)} <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">{isRtl ? 'ساعة' : 'hrs'}</span>
                    </span>
                    <span className="text-xs font-semibold text-text-secondary">
                      {isRtl ? `${formatNumber(selectedEmployeeTotalShifts)} شفت` : `${formatNumber(selectedEmployeeTotalShifts)} Shifts`}
                    </span>
                  </div>
                </div>

                {/* Individual Employee Metrics Breakdown Cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white" dir="ltr">
                        {selectedEmployee.code}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">{selectedEmployee.name}</h4>
                        <p className="text-xs text-text-secondary">{selectedEmployee.department}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selectedEmployee.workloadStatus === 'high'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        : selectedEmployee.workloadStatus === 'under'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      {selectedEmployee.workloadStatus === 'high'
                        ? (isRtl ? 'حمل مرتفع' : 'High Load')
                        : selectedEmployee.workloadStatus === 'under'
                        ? (isRtl ? 'حمل منخفض' : 'Under Loaded')
                        : (isRtl ? 'متوازن' : 'Balanced')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {employeePieData.map((item) => {
                      const pct = selectedEmployeeTotalShifts > 0 ? Math.round((item.value / selectedEmployeeTotalShifts) * 100) : 0;
                      const labelText = item.isHoursBased
                        ? (isRtl
                          ? `${formatNumber(item.hours)} ساعة (${formatNumber(item.value)} شفت)`
                          : `${formatNumber(item.hours)} hrs (${formatNumber(item.value)} shifts)`)
                        : item.name === (isRtl ? 'إجازة' : 'Vacation')
                        ? (isRtl ? `${formatNumber(item.value)} يوم` : `${formatNumber(item.value)} days`)
                        : (isRtl
                          ? `${formatNumber(item.value)} شفت (${formatNumber(item.hours)} س)`
                          : `${formatNumber(item.value)} shifts (${formatNumber(item.hours)}h)`);

                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-medium text-text-primary">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                              {item.name}
                            </span>
                            <span className="font-semibold text-text-secondary">
                              {labelText} <span className="text-text-primary font-bold">({formatNumber(pct)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%`, backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ALL EMPLOYEES BAR CHART VIEW */
              <>
                <div className="space-y-2 sm:hidden">
                  {workloadRows.slice(0, 6).map((employee) => {
                    const total = employee.morning + employee.evening + employee.night + employee.oncall + employee.otShifts;
                    return (
                      <button
                        type="button"
                        key={employee.id}
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-surface-muted p-3 text-start transition-all hover:bg-hover"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white" dir="ltr">
                          {employee.code}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text-primary">{employee.name}</span>
                          <span className="mt-0.5 block text-xs text-text-secondary">
                            {isRtl ? `${formatNumber(total)} نوبة` : `${formatNumber(total)} shifts`} · {isRtl ? `${formatNumber(employee.night)} ليلية` : `${formatNumber(employee.night)} night`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {workloadRows.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('workloadMatrix')}
                      className="min-h-11 w-full rounded-btn border border-border bg-surface-muted px-4 text-sm font-semibold text-primary transition-colors hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {isRtl ? `عرض كل الموظفين (${formatNumber(workloadRows.length)})` : `View all employees (${formatNumber(workloadRows.length)})`}
                    </button>
                  )}
                </div>

                <div className="hidden h-96 w-full min-h-[280px] overflow-x-auto sm:block" dir="ltr">
                  <ResponsiveContainer width={Math.max(displayedChartData.length * (stackMode === 'grouped' ? 110 : 52), 600)} height="100%">
                    <BarChart
                      data={displayedChartData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                      onClick={(state) => {
                        if (state && state.activePayload && state.activePayload.length > 0) {
                          const clickedId = state.activePayload[0]?.payload?.id;
                          if (clickedId) setSelectedEmployeeId(clickedId);
                        }
                      }}
                      className="cursor-pointer"
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
                        stroke={isDark ? '#94A3B8' : '#64748B'}
                        fontSize={11}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        tick={{ fill: isDark ? '#CBD5E1' : '#64748B' }}
                      />
                      <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={12} tick={{ fill: isDark ? '#CBD5E1' : '#64748B' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                          borderRadius: '10px',
                          border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
                          boxShadow: isDark ? '0 10px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          fontSize: '12px',
                          color: isDark ? '#F8FAFC' : '#0F172A',
                        }}
                        itemStyle={{
                          color: isDark ? '#E2E8F0' : '#1E293B',
                        }}
                        labelStyle={{
                          color: isDark ? '#F8FAFC' : '#0F172A',
                          fontWeight: 600,
                          marginBottom: '4px',
                        }}
                        formatter={(value, name) => [
                          formatNumber(Number(value)),
                          name,
                        ]}
                        labelFormatter={(label) => {
                          const emp = chartData.find((d) => d.name === label);
                          return emp ? `${emp.fullName} (${emp.name})` : label;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '12px' }}
                        formatter={(value) => (
                          <span className="text-xs font-semibold text-text-primary px-1">
                            {value}
                          </span>
                        )}
                      />
                      <Bar dataKey="morning" name={isRtl ? 'Day (نهاري)' : 'Day'} stackId={stackMode === 'stacked' ? 'a' : undefined} fill={chartFill('morning')} />
                      <Bar dataKey="evening" name={isRtl ? 'Late (متأخر)' : 'Late'} stackId={stackMode === 'stacked' ? 'a' : undefined} fill={chartFill('evening')} />
                      <Bar
                        dataKey="night"
                        name={isRtl ? 'Evening (ليلي)' : 'Evening'}
                        stackId={stackMode === 'stacked' ? 'a' : undefined}
                        fill={chartFill('night')}
                      />
                      <Bar
                        dataKey="onCallDay"
                        name={isRtl ? 'On-call Day' : 'On-call Day'}
                        stackId={stackMode === 'stacked' ? 'a' : undefined}
                        fill={chartFill('onCallDay')}
                      />
                      <Bar
                        dataKey="onCallNight"
                        name={isRtl ? 'On-call Night' : 'On-call Night'}
                        stackId={stackMode === 'stacked' ? 'a' : undefined}
                        fill={chartFill('onCallNight')}
                      />
                      <Bar
                        dataKey="ot"
                        name={isRtl ? 'OT (إضافي)' : 'OT'}
                        stackId={stackMode === 'stacked' ? 'a' : undefined}
                        fill={chartFill('ot')}
                      />
                      <Bar
                        dataKey="vacation"
                        name={isRtl ? 'إجازة' : 'Vacation'}
                        stackId={stackMode === 'stacked' ? 'a' : undefined}
                        fill={chartFill('vacation')}
                        radius={stackMode === 'stacked' ? [4, 4, 0, 0] : undefined}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
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
                        <span>
                          {item.isHoursBased
                            ? (isRtl
                              ? `${formatNumber(item.hours)} ساعة (${formatNumber(item.value)} شفت)`
                              : `${formatNumber(item.hours)} hrs (${formatNumber(item.value)} shifts)`)
                            : t('reports:charts.shiftCount', { count: formatNumber(item.value) })}
                        </span>
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
                  <th className="px-3 py-3.5 text-center text-teal-600 dark:text-teal-400 font-bold">{isRtl ? 'إجمالي الساعات' : 'Total Hours'}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.vacationDays')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.source')}</th>
                  <th className="px-3 py-3.5 text-center">{t('reports:analysis.table.totalShifts')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-sm text-text-secondary">
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
                        <td className="px-3 py-3 text-center font-bold text-teal-600 dark:text-teal-400">{formatNumber(row.totalHours)}</td>
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
