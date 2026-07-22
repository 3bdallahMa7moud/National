import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  FileCheck,
  FileText,
  GripVertical,
  Layers,
  PenTool,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Trash2,
  UserPlus,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { OfficialEmployee } from '@/data/officialEmployeeRoster';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { exportJustificationToDocx } from '@/lib/justificationDocxExport';
import {
  DEFAULT_JUSTIFICATION_STATE,
  type DataSourceKind,
  type JustificationEmployeeRow,
  type JustificationReportState,
} from '@/types/employeeJustification';

/** Parse "HH:MM - HH:MM" time ranges into hours (handles overnight). */
function hoursFromTimeRange(timeRange: string): number {
  const times = timeRange.match(/\b\d{1,2}:\d{2}\b/g);
  if (!times || times.length < 2) return 0;
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const start = toMin(times[0]);
  let end = toMin(times[1]);
  if (end <= start) end += 24 * 60; // overnight
  return Math.round((end - start) / 60 * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function generateId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const ENGLISH_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function getMonthOptions(isEng = false): { key: string; label: string }[] {
  const now = new Date();
  const opts: { key: string; label: string }[] = [];
  for (let offset = -6; offset <= 2; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${isEng ? ENGLISH_MONTHS[month] : ARABIC_MONTHS[month]} ${year}`;
    opts.push({ key, label });
  }
  return opts;
}

type TabKey = 'general' | 'employees' | 'signatures' | 'headers';

/* -------------------------------------------------------------------------- */
/*  Inline Click-to-Type Helper Component (Direct Table Editing)               */
/* -------------------------------------------------------------------------- */
function InlineEditSpan({
  value,
  onChange,
  className = '',
  placeholder = '',
  multiline = false,
  rows = 3,
  type = 'text',
}: {
  value: string | number;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'number';
}) {
  const contentLen = String(value || placeholder || '').length;
  
  return (
    <div className="relative group w-full flex items-center justify-center">
      {/* Print / Word Export pure display */}
      <span className="hidden print:inline">{value === '' || value === undefined ? placeholder : value}</span>
      {/* Screen inline editable input */}
      {multiline ? (
        <textarea
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`print:hidden bg-transparent border border-transparent hover:border-primary/40 focus:border-primary focus:bg-primary/5 rounded px-1.5 py-0.5 outline-none resize-none w-full transition-all cursor-text text-inherit font-inherit ${className}`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          size={Math.max(contentLen, 1)}
          className={`print:hidden bg-transparent border border-transparent hover:border-primary/40 focus:border-primary focus:bg-primary/5 rounded px-1 py-0.5 outline-none w-full transition-all cursor-text text-inherit font-inherit ${className}`}
          style={{ minWidth: 'min-content' }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Page                                                                  */
/* -------------------------------------------------------------------------- */
export default function EmployeeJustificationPage() {
  const officialEmployeeRoster = useEmployeeRosterStore((state) => state.employees);
  const { t, i18n } = useTranslation(['employeeJustification']);
  const { addToast } = useToast();
  const user = useAuthStore((state) => state.user);

  // ── OT Schedule (Late Schedule) data ──────────────────────────────────────
  const publishedRowsByMonth = useLateScheduleStore(
    (state) => state.publishedRowsByMonth,
  );
  const rowsByMonth = useLateScheduleStore((state) => state.rowsByMonth);

  // ── Schedule Management matrix data (for overtime rows) ───────────────────
  const matricesByMonth = useScheduleMatrixStore((state) => state.matricesByMonth);
  const currentMatrixData = useScheduleMatrixStore((state) => state.data);

  const nowInit = new Date();
  const initialMonthKey = `${nowInit.getFullYear()}-${String(nowInit.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState(initialMonthKey);
  const [report, setReport] = useState<JustificationReportState>({
    ...DEFAULT_JUSTIFICATION_STATE,
  });
  const [dataSource, setDataSource] = useState<DataSourceKind>('none');
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [isExporting, setIsExporting] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');

  const isEngLocale = i18n.language.startsWith('en') || !i18n.language.startsWith('ar');
  const monthOptions = useMemo(() => getMonthOptions(isEngLocale), [isEngLocale]);

  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return officialEmployeeRoster.slice(0, 15);
    const q = rosterSearch.toLowerCase();
    return officialEmployeeRoster.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.fullNameEn && e.fullNameEn.toLowerCase().includes(q)),
    ).slice(0, 20);
  }, [officialEmployeeRoster, rosterSearch]);

  /* ---- Guard: Admin only ---- */
  if (!user || user.role !== 'admin') return null;

  /* ---- Generate/Sync report from OT data ---- */
  function executeGenerateReport(targetMonthKey?: string) {
    const monthKey = typeof targetMonthKey === 'string' && targetMonthKey ? targetMonthKey : selectedMonthKey;
    if (!monthKey) return;

    // ── Source 1: OT Schedule (lateScheduleStore) ──────────────────────────
    const publishedRows = publishedRowsByMonth[monthKey] ?? [];
    const draftRows = rowsByMonth[monthKey] ?? [];
    const activeOTRows = publishedRows.length > 0 ? publishedRows : draftRows;
    const kind: DataSourceKind =
      publishedRows.length > 0 ? 'published' : draftRows.length > 0 ? 'draft' : 'none';

    const [yearStr, monthStr] = monthKey.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    const yearNum = parseInt(yearStr, 10);
    const isEngReport = isEngLocale || report.kingdomLabel.toLowerCase().includes('kingdom') || !report.kingdomLabel.includes('المملكة');
    const monthLabel = isEngReport
      ? `${ENGLISH_MONTHS[monthIdx]} ${yearNum}`
      : `${ARABIC_MONTHS[monthIdx]} ${yearNum}`;

    // employeeId -> { shifts, hours }
    const summaryMap: Record<string, { shifts: number; hours: number }> = {};

    // ── Merge from OT Schedule ─────────────────────────────────────────────
    // Use row.hours (the actual shift duration defined in the OT schedule row)
    for (const row of activeOTRows) {
      if (row.archived) continue;
      const shiftHours = typeof row.hours === 'number' && row.hours > 0
        ? row.hours
        : hoursFromTimeRange(row.timeRange);
      for (const dayStr of Object.keys(row.assignments)) {
        const assignments = row.assignments[parseInt(dayStr, 10)];
        if (!assignments) continue;
        for (const assignment of assignments) {
          if (assignment.kind !== 'employee') continue;
          const { employeeId } = assignment;
          if (!summaryMap[employeeId]) summaryMap[employeeId] = { shifts: 0, hours: 0 };
          summaryMap[employeeId].shifts += 1;
          summaryMap[employeeId].hours += shiftHours;
        }
      }
    }

    // ── Merge from Schedule Management (overtime color rows only) ──────────
    // Prefer the published snapshot for the selected month; fall back to the
    // live draft when no published snapshot exists yet.
    const matrixData = matricesByMonth[monthKey] ?? (
      currentMatrixData && currentMatrixData.year === yearNum && currentMatrixData.month === monthIdx
        ? currentMatrixData
        : null
    );
    if (matrixData) {
      for (const facility of matrixData.facilities) {
        for (const unit of facility.units) {
          for (const row of unit.rows) {
            if (row.archived) continue;
            // Only pick up overtime-coloured rows from schedule management
            if (row.colorKey !== 'overtime') continue;
            const shiftHours = hoursFromTimeRange(row.timeRange);
            for (const dayStr of Object.keys(row.cellsByDay)) {
              const assignments = row.cellsByDay[Number(dayStr)];
              if (!assignments?.length) continue;
              for (const assignment of assignments) {
                const empId = assignment.employeeId;
                if (!empId) continue;
                if (!summaryMap[empId]) summaryMap[empId] = { shifts: 0, hours: 0 };
                summaryMap[empId].shifts += 1;
                summaryMap[empId].hours += shiftHours > 0 ? shiftHours : 8;
              }
            }
          }
        }
      }
    }

    // ── Build final rows ───────────────────────────────────────────────────
    const newRows: JustificationEmployeeRow[] = [];
    for (const [empId, summary] of Object.entries(summaryMap)) {
      const rosterEmp = officialEmployeeRoster.find((r) => r.employeeId === empId);
      newRows.push({
        id: generateId(),
        bn: rosterEmp ? rosterEmp.code : empId.slice(0, 5),
        name: rosterEmp
          ? (isEngReport ? rosterEmp.fullNameEn || rosterEmp.fullName : rosterEmp.fullName)
          : empId,
        branch: (rosterEmp as any)?.branch || 'General',
        totalShifts: summary.shifts,
        claimedHours: Math.round(summary.hours),
      });
    }

    newRows.sort((a, b) => b.claimedHours - a.claimedHours);

    setReport((prev) => ({
      ...prev,
      month: monthLabel,
      year: '',
      numberOfStaff: String(newRows.length),
      rows: newRows,
    }));
    setDataSource(newRows.length > 0 ? (kind !== 'none' ? kind : 'published') : kind);
  }

  /* ---- Auto-init on load ---- */
  useEffect(() => {
    executeGenerateReport(selectedMonthKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Actions ---- */
  const updateField = useCallback(
    <K extends keyof JustificationReportState>(key: K, value: JustificationReportState[K]) => {
      setReport((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateHeader = useCallback(
    (key: keyof JustificationReportState['headers'], value: string) => {
      setReport((prev) => ({
        ...prev,
        headers: { ...prev.headers, [key]: value },
      }));
    },
    [],
  );

  const addRow = useCallback(() => {
    const newRow: JustificationEmployeeRow = {
      id: generateId(),
      bn: 'NEW',
      name: isEngLocale ? 'New Employee' : 'موظف جديد',
      branch: 'General',
      totalShifts: 1,
      claimedHours: 8,
    };
    setReport((prev) => ({
      ...prev,
      rows: [...prev.rows, newRow],
      numberOfStaff: String(prev.rows.length + 1),
    }));
    setEditingRowId(newRow.id);
  }, [isEngLocale]);

  const deleteRow = useCallback((id: string) => {
    setReport((prev) => {
      const nextRows = prev.rows.filter((r) => r.id !== id);
      return {
        ...prev,
        rows: nextRows,
        numberOfStaff: String(nextRows.length),
      };
    });
  }, []);

  const updateRow = useCallback((id: string, updates: Partial<JustificationEmployeeRow>) => {
    setReport((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  const moveRow = useCallback((id: string, direction: 'up' | 'down') => {
    setReport((prev) => {
      const idx = prev.rows.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.rows.length) return prev;

      const newRows = [...prev.rows];
      const temp = newRows[idx];
      newRows[idx] = newRows[targetIdx];
      newRows[targetIdx] = temp;
      return { ...prev, rows: newRows };
    });
  }, []);

  const handleSelectRosterEmployee = useCallback(
    (employee: OfficialEmployee) => {
      const exists = report.rows.some((r) => r.bn === employee.code);
      if (exists) {
        addToast({ type: 'warning', title: `${employee.fullName} is already in the table.` });
        return;
      }
      const isEngReport =
        isEngLocale ||
        report.kingdomLabel.toLowerCase().includes('kingdom') ||
        !report.kingdomLabel.includes('المملكة');

      const newRow: JustificationEmployeeRow = {
        id: generateId(),
        bn: employee.code,
        name: isEngReport ? employee.fullNameEn || employee.fullName : employee.fullName,
        branch: (employee as any).branch || 'General',
        totalShifts: 1,
        claimedHours: 8,
      };

      setReport((prev) => ({
        ...prev,
        rows: [...prev.rows, newRow],
        numberOfStaff: String(prev.rows.length + 1),
      }));
      addToast({ type: 'success', title: `${employee.fullName} added.` });
    },
    [report.rows, report.kingdomLabel, isEngLocale, addToast],
  );

  async function handleExport() {
    try {
      setIsExporting(true);
      await exportJustificationToDocx(report);
      addToast({
        type: 'success',
        title: t('employeeJustification:exportSuccess', 'Document generated successfully!'),
      });
    } catch (err) {
      console.error('Failed to export docx:', err);
      addToast({
        type: 'error',
        title: t('employeeJustification:exportError', 'Failed to generate Word document.'),
      });
    } finally {
      setIsExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const isEng =
    report.kingdomLabel.toLowerCase().includes('kingdom') || !report.kingdomLabel.includes('المملكة');
  const monthDisplay =
    report.month.trim() +
    (report.year && !report.month.includes(report.year) ? ' ' + report.year : '');
  const totalHours = report.rows.reduce((sum, r) => sum + Number(r.claimedHours || 0), 0);

  return (
    <div className="min-h-screen bg-surface-muted p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface-card p-4 sm:p-6 shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary sm:text-xl">
                {t('employeeJustification:pageTitle', 'OT Justification Report')}
              </h1>
              <p className="text-xs text-text-secondary">
                {t(
                  'employeeJustification:pageSubtitle',
                  'Generate official overtime confirmation documents for administrative review',
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<Download className="h-4 w-4" />}
              variant="outline"
              loading={isExporting}
              onClick={handleExport}
            >
              {t('employeeJustification:exportDocx')}
            </Button>
            <Button
              icon={<Printer className="h-4 w-4" />}
              variant="primary"
              onClick={handlePrint}
            >
              {t('employeeJustification:printPdf')}
            </Button>
          </div>
        </header>

        {/* Action Bar (Month Selector & Direct Editing Banner) */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface-card p-4 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-text-secondary">
                {t('employeeJustification:selectMonth')}:
              </label>
              <select
                className="input-field py-1.5 text-xs font-medium min-w-[160px]"
                value={selectedMonthKey}
                onChange={(e) => {
                  setSelectedMonthKey(e.target.value);
                  executeGenerateReport(e.target.value);
                }}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {isEngLocale
                ? 'Live table editing enabled — click any cell or text in the table below to edit directly'
                : 'تعديل الجدول مباشر مفعل — انقر فوق أي خلية أو نص في الجدول أدناه للتعديل فوراً'}
            </span>
          </div>

          <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={addRow}>
            {t('employeeJustification:editor.addEmployee')}
          </Button>
        </div>

        {/* Studio Workspace: Tabbed Editor (Left) & Unified Simple Preview (Right) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 print:!block print:!gap-0 print:!m-0 print:!p-0">
          {/* ===== LEFT: Tabbed Studio Editor (5 Cols) ===== */}
          <div className="xl:col-span-5 space-y-4 print:hidden">
            {/* Tab Bar */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface-muted p-1">
              <button
                onClick={() => setActiveTab('general')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${activeTab === 'general'
                  ? 'bg-surface-card text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{t('employeeJustification:tabs.general')}</span>
              </button>
              <button
                onClick={() => setActiveTab('employees')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${activeTab === 'employees'
                  ? 'bg-surface-card text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t('employeeJustification:tabs.employees')}</span>
                <span className="ms-1 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] text-primary">
                  {report.rows.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('signatures')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${activeTab === 'signatures'
                  ? 'bg-surface-card text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>{t('employeeJustification:tabs.signatures')}</span>
              </button>
              <button
                onClick={() => setActiveTab('headers')}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${activeTab === 'headers'
                  ? 'bg-surface-card text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* TAB 1: General & Letterhead (4 Lines only - Hospital Name removed) */}
            {activeTab === 'general' && (
              <div className="space-y-4 rounded-card border border-border bg-surface-card p-4 shadow-sm">
                <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2 border-b border-border pb-2.5">
                  <Layers className="h-4 w-4 text-primary" />
                  {t('employeeJustification:editor.hospitalHeader')} {isEngLocale ? '(4 lines max)' : '(4 أسطر فقط)'}
                </h3>

                <div className="space-y-3">
                  <EditorField label={t('employeeJustification:editor.kingdomLabel')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.kingdomLabel}
                      onChange={(e) => updateField('kingdomLabel', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.ministryName')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.ministryName}
                      onChange={(e) => updateField('ministryName', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.departmentName')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.departmentName}
                      onChange={(e) => updateField('departmentName', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.reportTitle')}>
                    <input
                      className="input-field w-full text-xs font-semibold underline"
                      value={report.reportTitle}
                      onChange={(e) => updateField('reportTitle', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.section')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.section}
                      onChange={(e) => updateField('section', e.target.value)}
                    />
                  </EditorField>
                </div>
              </div>
            )}

            {/* TAB 2: Employees List & Roster Picker */}
            {activeTab === 'employees' && (
              <div className="space-y-4 rounded-card border border-border bg-surface-card p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" />
                    {t('employeeJustification:editor.employeesList')} ({report.rows.length})
                  </h3>
                  <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={addRow}>
                    {t('employeeJustification:editor.addEmployee')}
                  </Button>
                </div>

                {/* Quick Add from Official Roster */}
                <div className="space-y-2 bg-surface-muted p-3 rounded-lg border border-border">
                  <label className="block text-xs font-semibold text-text-secondary">
                    {t('employeeJustification:editor.quickAddFromRoster', 'Quick Add from Official Roster')}
                  </label>
                  <div className="relative">
                    <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                    <input
                      type="text"
                      className="input-field w-full ps-8 text-xs"
                      placeholder={t('employeeJustification:editor.searchRoster', 'Search by name or code...')}
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-border rounded border border-border bg-surface-card">
                    {filteredRoster.map((emp) => (
                      <div
                        key={emp.employeeId}
                        className="flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-surface-muted transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-text-primary truncate">{emp.fullName}</div>
                          <div className="text-[10px] text-text-secondary font-mono">
                            {emp.code} · {(emp as any).branch || 'General'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSelectRosterEmployee(emp)}
                          className="ms-2 rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          {isEngLocale ? '+ Add' : '+ إضافة'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows List */}
                <div className="space-y-2 max-h-[460px] overflow-y-auto pe-1">
                  {report.rows.length === 0 ? (
                    <div className="text-center py-6 text-xs text-text-muted bg-surface-muted rounded-lg border border-dashed border-border">
                      {t('employeeJustification:editor.noEmployees', 'No employees added to the report yet.')}
                    </div>
                  ) : (
                    report.rows.map((row, idx) => (
                      <EmployeeRowEditor
                        key={row.id}
                        row={row}
                        index={idx}
                        isEditing={editingRowId === row.id}
                        onEdit={() => setEditingRowId(editingRowId === row.id ? null : row.id)}
                        onSave={() => setEditingRowId(null)}
                        onDelete={() => deleteRow(row.id)}
                        onUpdate={(updates) => updateRow(row.id, updates)}
                        onMoveUp={() => moveRow(row.id, 'up')}
                        onMoveDown={() => moveRow(row.id, 'down')}
                        isFirst={idx === 0}
                        isLast={idx === report.rows.length - 1}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Signatures & Notes */}
            {activeTab === 'signatures' && (
              <div className="space-y-4 rounded-card border border-border bg-surface-card p-4 shadow-sm">
                <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2 border-b border-border pb-2.5">
                  <PenTool className="h-4 w-4 text-primary" />
                  {t('employeeJustification:editor.signaturesAndNotes')}
                </h3>

                <div className="space-y-3">
                  <EditorField label={t('employeeJustification:editor.confirmationParagraph')}>
                    <textarea
                      rows={4}
                      className="input-field w-full text-xs leading-relaxed"
                      value={report.confirmationParagraph}
                      onChange={(e) => updateField('confirmationParagraph', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.supervisorLabel')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.supervisorLabel}
                      onChange={(e) => updateField('supervisorLabel', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.notes')}>
                    <textarea
                      rows={3}
                      className="input-field w-full text-xs"
                      placeholder={t('employeeJustification:editor.notesPlaceholder', 'Optional notes to appear below the table...')}
                      value={report.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                    />
                  </EditorField>

                  <EditorField label={t('employeeJustification:editor.footerText')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.footerText}
                      onChange={(e) => updateField('footerText', e.target.value)}
                    />
                  </EditorField>
                </div>
              </div>
            )}

            {/* TAB 4: Table Headers Customization */}
            {activeTab === 'headers' && (
              <div className="space-y-4 rounded-card border border-border bg-surface-card p-4 shadow-sm">
                <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2 border-b border-border pb-2.5">
                  <Settings className="h-4 w-4 text-primary" />
                  {t('employeeJustification:editor.tableHeaders')}
                </h3>

                <div className="space-y-3">
                  <EditorField label={t('employeeJustification:headers.no')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.headers.no}
                      onChange={(e) => updateHeader('no', e.target.value)}
                    />
                  </EditorField>
                  <EditorField label={t('employeeJustification:headers.bn')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.headers.bn}
                      onChange={(e) => updateHeader('bn', e.target.value)}
                    />
                  </EditorField>
                  <EditorField label={t('employeeJustification:headers.name')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.headers.name}
                      onChange={(e) => updateHeader('name', e.target.value)}
                    />
                  </EditorField>
                  <EditorField label={t('employeeJustification:headers.totalShifts')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.headers.totalShifts}
                      onChange={(e) => updateHeader('totalShifts', e.target.value)}
                    />
                  </EditorField>
                  <EditorField label={t('employeeJustification:headers.claimedHours')}>
                    <input
                      className="input-field w-full text-xs"
                      value={report.headers.claimedHours}
                      onChange={(e) => updateHeader('claimedHours', e.target.value)}
                    />
                  </EditorField>
                </div>
              </div>
            )}
          </div>

          {/* ===== RIGHT: Live Printable Preview — Two A4 Pages ===== */}
          <div className="xl:col-span-7 space-y-3 print:!col-span-12 print:!space-y-0 print:!m-0 print:!p-0">
            <div className="flex items-center justify-between rounded-card border border-border bg-surface-card p-3 shadow-sm print:hidden">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                {t('employeeJustification:livePreview')} — {isEngLocale ? 'Exact A4 pages as in exported document' : 'صفحتا A4 بالضبط كما في الملف'}
              </span>
            </div>

            <div className="space-y-6 print:!space-y-0">
              {/* ══════════════ PAGE 1 — Letterhead + Tables ══════════════ */}
              <div
                className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 border-2 border-black dark:border-slate-700 print:!bg-white print:!text-black print:!border-black shadow-xl print:shadow-none mx-auto print:mx-0 print:!max-w-none print:!w-full transition-colors"
                style={{
                  fontFamily: 'Arial, sans-serif',
                  padding: '28px 32px',
                  minHeight: 1056,
                  maxWidth: 794,
                  pageBreakAfter: 'always',
                  breakAfter: 'page',
                  direction: isEng ? 'ltr' : 'rtl',
                }}
              >
                {/* Letterhead */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <img
                    src={(isEng ? report.leftLogo : report.rightLogo) || '/mngha-logo.png'}
                    alt="logo-l"
                    style={{ height: 68, objectFit: 'contain' }}
                  />
                  <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      <InlineEditSpan value={report.kingdomLabel} onChange={(v) => updateField('kingdomLabel', v)} className="text-center font-bold text-inherit" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 11, marginTop: 3, textTransform: 'uppercase' }}>
                      <InlineEditSpan value={report.ministryName} onChange={(v) => updateField('ministryName', v)} className="text-center font-bold text-inherit" />
                    </div>
                    <div className="inline-block border border-neutral-600 dark:border-neutral-400 print:!border-neutral-600 px-5 py-0.5 mt-1.5 mb-1">
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        <InlineEditSpan value={report.departmentName} onChange={(v) => updateField('departmentName', v)} className="text-center font-bold text-inherit" />
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 10, textDecoration: 'underline', marginTop: 2, textTransform: 'uppercase' }}>
                      <InlineEditSpan value={report.reportTitle} onChange={(v) => updateField('reportTitle', v)} className="text-center font-bold underline text-inherit" />
                    </div>
                  </div>
                  <img
                    src={(isEng ? report.rightLogo : report.leftLogo) || '/ct-logo.png'}
                    alt="logo-r"
                    style={{ height: 68, objectFit: 'contain' }}
                  />
                </div>

                {/* Meta table */}
                {isEng ? (
                  <table className="w-full border-collapse mb-8 text-[11px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] dark:bg-slate-800 text-black dark:text-slate-100 print:!bg-[#D9D9D9] print:!text-black">
                        <th className="border border-black dark:border-slate-700 print:!border-black p-2 text-center w-1/4 font-bold">SECTION</th>
                        <th className="border border-black dark:border-slate-700 print:!border-black p-2 text-center w-[45%] font-bold">MONTH</th>
                        <th className="border border-black dark:border-slate-700 print:!border-black p-2 text-center w-[30%] font-bold"># OF STAFF WHO WORKED<br />AFTERHOURS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black">
                        <td className="border border-black dark:border-slate-700 print:!border-black p-2 text-center">
                          <InlineEditSpan value={report.section} onChange={(v) => updateField('section', v)} className="text-center text-inherit font-inherit" placeholder="CT Scan" />
                        </td>
                        <td className="border border-black dark:border-slate-700 print:!border-black p-2 text-center uppercase">
                          <InlineEditSpan value={monthDisplay} onChange={(v) => updateField('month', v)} className="text-center uppercase text-inherit font-inherit" placeholder="JUL 2026" />
                        </td>
                        <td className="border border-black dark:border-slate-700 print:!border-black p-2 text-center font-bold text-[14px]">
                          <InlineEditSpan value={report.numberOfStaff || report.rows.length} onChange={(v) => updateField('numberOfStaff', v)} className="text-center font-bold text-inherit" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full border-collapse mb-8 text-[11px]">
                    <thead>
                      <tr className="bg-[#2B3A55] dark:bg-slate-800 text-white dark:text-slate-100 print:!bg-[#2B3A55] print:!text-white">
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-2 text-center w-[16%] font-bold bg-[#2B3A55] dark:bg-slate-800 text-white dark:text-slate-100 print:!bg-[#2B3A55] print:!text-white">القسم</th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-2 text-center w-[28%] font-bold bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black">
                          <InlineEditSpan value={report.section} onChange={(v) => updateField('section', v)} className="text-center text-inherit font-inherit" placeholder="الأشعة" />
                        </th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-2 text-center w-[16%] font-bold bg-[#2B3A55] dark:bg-slate-800 text-white dark:text-slate-100 print:!bg-[#2B3A55] print:!text-white">الشهر / السنة</th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-2 text-center w-[22%] font-bold bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black">
                          <InlineEditSpan value={monthDisplay} onChange={(v) => updateField('month', v)} className="text-center text-inherit font-inherit" placeholder="يوليو 2026" />
                        </th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-2 text-center w-[10%] font-bold bg-[#2B3A55] dark:bg-slate-800 text-white dark:text-slate-100 print:!bg-[#2B3A55] print:!text-white">الموظفين</th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-2 text-center w-[8%] font-bold bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black">
                          <InlineEditSpan value={report.numberOfStaff || report.rows.length} onChange={(v) => updateField('numberOfStaff', v)} className="text-center font-bold text-inherit" />
                        </th>
                      </tr>
                    </thead>
                  </table>
                )}

                {/* Employee table */}
                {isEng ? (
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] dark:bg-slate-800 text-black dark:text-slate-100 print:!bg-[#D9D9D9] print:!text-black">
                        <th className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-center w-9 font-bold">
                          <InlineEditSpan value={report.headers.no || '#'} onChange={(v) => updateHeader('no', v)} className="text-center font-bold text-inherit" />
                        </th>
                        <th className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-center w-[90px] font-bold">
                          <InlineEditSpan value={report.headers.bn || 'BN'} onChange={(v) => updateHeader('bn', v)} className="text-center font-bold text-inherit" />
                        </th>
                        <th className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-left font-bold">
                          <InlineEditSpan value={report.headers.name || 'NAME'} onChange={(v) => updateHeader('name', v)} className="font-bold text-inherit" />
                        </th>
                        <th className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-center w-[130px] font-bold">
                          <InlineEditSpan value={report.headers.claimedHours || '# OF CLAIMED HOURS'} onChange={(v) => updateHeader('claimedHours', v)} className="text-center font-bold text-inherit" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row, idx) => (
                        <tr key={row.id} className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black">
                          <td className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-center font-bold">{idx + 1}</td>
                          <td className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-center font-mono font-bold">
                            <InlineEditSpan value={row.bn} onChange={(v) => updateRow(row.id, { bn: v })} className="text-center font-mono font-bold text-inherit" />
                          </td>
                          <td className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-left font-semibold">
                            <InlineEditSpan value={row.name} onChange={(v) => updateRow(row.id, { name: v })} className="font-semibold text-inherit" />
                          </td>
                          <td className="border border-black dark:border-slate-700 print:!border-black p-1.5 text-center font-bold">
                            <InlineEditSpan value={row.claimedHours} onChange={(v) => updateRow(row.id, { claimedHours: Number(v) || 0 })} type="number" className="text-center font-bold text-inherit" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#2B3A55] dark:bg-slate-800 text-white dark:text-slate-100 print:!bg-[#2B3A55] print:!text-white">
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center w-9 font-bold">
                          <InlineEditSpan value={report.headers.no || 'م'} onChange={(v) => updateHeader('no', v)} className="text-center font-bold text-inherit" />
                        </th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center w-[90px] font-bold">
                          <InlineEditSpan value={report.headers.bn || 'الرقم الوظيفي'} onChange={(v) => updateHeader('bn', v)} className="text-center font-bold text-inherit" />
                        </th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-right font-bold">
                          <InlineEditSpan value={report.headers.name || 'اسم الموظف'} onChange={(v) => updateHeader('name', v)} className="font-bold text-inherit" />
                        </th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center w-[95px] font-bold">
                          <InlineEditSpan value={report.headers.totalShifts || 'عدد المناوبات'} onChange={(v) => updateHeader('totalShifts', v)} className="text-center font-bold text-inherit" />
                        </th>
                        <th className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center w-[95px] font-bold">
                          <InlineEditSpan value={report.headers.claimedHours || 'عدد الساعات'} onChange={(v) => updateHeader('claimedHours', v)} className="text-center font-bold text-inherit" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 !== 0 ? 'bg-[#F9FAFB] dark:bg-slate-800/50 text-black dark:text-slate-100 print:!bg-[#F9FAFB] print:!text-black' : 'bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black'}>
                          <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center font-bold">{idx + 1}</td>
                          <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center font-mono font-bold">
                            <InlineEditSpan value={row.bn} onChange={(v) => updateRow(row.id, { bn: v })} className="text-center font-mono font-bold text-inherit" />
                          </td>
                          <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-right font-semibold">
                            <InlineEditSpan value={row.name} onChange={(v) => updateRow(row.id, { name: v })} className="font-semibold text-right text-inherit" />
                          </td>
                          <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center font-bold">
                            <InlineEditSpan value={row.totalShifts} onChange={(v) => updateRow(row.id, { totalShifts: Number(v) || 0 })} type="number" className="text-center font-bold text-inherit" />
                          </td>
                          <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-1.5 text-center font-bold">
                            <InlineEditSpan value={row.claimedHours} onChange={(v) => updateRow(row.id, { claimedHours: Number(v) || 0 })} type="number" className="text-center font-bold text-inherit" />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#EEF1F6] dark:bg-slate-800 text-[#2B3A55] dark:text-slate-100 print:!bg-[#EEF1F6] print:!text-[#2B3A55] font-bold">
                        <td colSpan={3} className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] py-1.5 px-3 text-center text-inherit">الإجمالي العام / Total</td>
                        <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] py-1.5 px-2.5 text-center text-inherit">{report.rows.length}</td>
                        <td className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] py-1.5 px-2.5 text-center text-inherit">{totalHours}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {report.notes && (
                  <div className="mt-3 text-[11px] text-neutral-700 dark:text-neutral-300 print:!text-[#444] bg-[#f8f8f8] dark:bg-slate-800/60 print:!bg-[#f8f8f8] p-2 px-3 border border-neutral-300 dark:border-slate-700 print:!border-[#ddd]">
                    <strong>{isEng ? 'Notes:' : 'ملاحظات:'}</strong> {report.notes}
                  </div>
                )}
              </div>

              {/* ══════════════ PAGE 2 — Letterhead + Confirmation + Signature ══════════════ */}
              <div
                className="bg-white dark:bg-slate-900 text-black dark:text-slate-100 border-2 border-black dark:border-slate-700 print:!bg-white print:!text-black print:!border-black shadow-xl print:shadow-none mx-auto print:mx-0 print:!max-w-none print:!w-full flex flex-col justify-between transition-colors"
                style={{
                  fontFamily: 'Arial, sans-serif',
                  padding: '28px 32px',
                  minHeight: 1056,
                  maxWidth: 794,
                  pageBreakBefore: 'always',
                  breakBefore: 'page',
                  direction: isEng ? 'ltr' : 'rtl',
                }}
              >
                <div>
                  {/* Letterhead (repeated) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                    <img
                      src={(isEng ? report.leftLogo : report.rightLogo) || '/mngha-logo.png'}
                      alt="logo-l"
                      style={{ height: 68, objectFit: 'contain' }}
                    />
                    <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textTransform: 'uppercase' }}>{report.kingdomLabel}</div>
                      <div style={{ fontWeight: 700, fontSize: 11, marginTop: 3, textTransform: 'uppercase' }}>{report.ministryName}</div>
                      <div className="inline-block border border-neutral-600 dark:border-neutral-400 print:!border-neutral-600 px-5 py-0.5 mt-1.5">
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{report.departmentName}</span>
                      </div>
                    </div>
                    <img
                      src={(isEng ? report.rightLogo : report.leftLogo) || '/ct-logo.png'}
                      alt="logo-r"
                      style={{ height: 68, objectFit: 'contain' }}
                    />
                  </div>

                  {/* Confirmation paragraph */}
                  {isEng ? (
                    <div className="text-[12px] leading-[1.9] text-center px-10 text-black dark:text-slate-100 print:!text-black mt-7.5">
                      <InlineEditSpan
                        value={report.confirmationParagraph}
                        onChange={(v) => updateField('confirmationParagraph', v)}
                        multiline
                        rows={4}
                        className="text-center leading-relaxed text-inherit font-inherit"
                      />
                    </div>
                  ) : (
                    <div className="border border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] bg-[#F9FAFB] dark:bg-slate-800/50 text-black dark:text-slate-100 print:!bg-[#F9FAFB] print:!text-black p-4 mt-7.5">
                      <InlineEditSpan
                        value={report.confirmationParagraph}
                        onChange={(v) => updateField('confirmationParagraph', v)}
                        multiline
                        rows={4}
                        className="text-right leading-relaxed text-sm text-inherit font-inherit"
                      />
                    </div>
                  )}

                  {/* Supervisor signature section */}
                  {isEng ? (
                    <div className="mt-25 flex flex-col items-center gap-2">
                      <div className="w-[360px] border-b-2 border-black dark:border-slate-300 print:!border-black" />
                      <div className="font-bold text-[11px] uppercase tracking-wider text-inherit">
                        <InlineEditSpan
                          value={report.supervisorLabel || "SUPERVISOR'S SIGNATURE/ DATE"}
                          onChange={(v) => updateField('supervisorLabel', v)}
                          className="text-center font-bold uppercase tracking-wide text-inherit"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-15 flex justify-start">
                      <div className="border-2 border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] p-3.5 px-4.5 w-[280px] bg-white dark:bg-slate-900 text-black dark:text-slate-100 print:!bg-white print:!text-black text-[11px] space-y-2">
                        <div className="font-bold text-[#2B3A55] dark:text-slate-100 print:!text-[#2B3A55] border-b border-[#2B3A55] dark:border-slate-700 print:!border-[#2B3A55] pb-1.5 mb-2.5">
                          <InlineEditSpan
                            value={report.supervisorLabel || 'مشرف القسم'}
                            onChange={(v) => updateField('supervisorLabel', v)}
                            className="font-bold text-inherit"
                          />
                        </div>
                        <div className="my-2">التوقيع / Signature : .........................</div>
                        <div className="my-2">التاريخ / Date : ...............................</div>
                        <div className="my-2">الختم الرسمي / Stamp</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer text */}
                {report.footerText && (
                  <div className="mt-10 border-t border-neutral-200 dark:border-slate-700 print:!border-[#eee] pt-2 text-[10px] text-neutral-500 dark:text-neutral-400 print:!text-[#666]">
                    <InlineEditSpan
                      value={report.footerText}
                      onChange={(v) => updateField('footerText', v)}
                      className={isEng ? 'text-left text-xs text-inherit' : 'text-right text-xs text-inherit'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editor Section & Field Wrappers                                            */
/* -------------------------------------------------------------------------- */
function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Employee Row Editor                                                        */
/* -------------------------------------------------------------------------- */
function EmployeeRowEditor({
  row,
  index,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onUpdate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  row: JustificationEmployeeRow;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<JustificationEmployeeRow>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { t, i18n } = useTranslation(['employeeJustification']);
  const isEngLocale = i18n.language.startsWith('en') || !i18n.language.startsWith('ar');

  return (
    <div className="rounded-lg border border-border bg-surface-muted transition-colors">
      {/* Row header */}
      <div className="flex items-center gap-2 p-2">
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-20"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <GripVertical className="h-3 w-3 text-text-muted" />
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-20"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface-card px-1.5 py-0.5 text-[10px] font-mono text-text-secondary border border-border">
              {index + 1}
            </span>
            <span className="text-xs font-semibold text-text-primary truncate">{row.name || '—'}</span>
            <span className="text-[11px] text-text-secondary font-mono">{row.bn}</span>
            <span className="ms-auto text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              {row.totalShifts} {isEngLocale ? 'shifts' : 'مناوبة'} · {row.claimedHours}{isEngLocale ? 'h' : 'س'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 text-text-muted hover:text-primary">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 text-text-muted hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded edit form */}
      {isEditing && (
        <div className="border-t border-border p-3 space-y-2 bg-surface-card rounded-b-lg">
          <div className="grid grid-cols-2 gap-2">
            <EditorField label={t('employeeJustification:row.bn', 'BN')}>
              <input
                className="input-field w-full text-xs font-mono"
                value={row.bn}
                onChange={(e) => onUpdate({ bn: e.target.value })}
              />
            </EditorField>
            <EditorField label={t('employeeJustification:row.name')}>
              <input
                className="input-field w-full text-xs font-medium"
                value={row.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
              />
            </EditorField>
            <EditorField label={t('employeeJustification:row.shifts')}>
              <input
                type="number"
                className="input-field w-full text-xs"
                value={row.totalShifts}
                onChange={(e) => onUpdate({ totalShifts: Number(e.target.value) })}
              />
            </EditorField>
            <EditorField label={t('employeeJustification:row.hours')}>
              <input
                type="number"
                className="input-field w-full text-xs font-semibold"
                value={row.claimedHours}
                onChange={(e) => onUpdate({ claimedHours: Number(e.target.value) })}
              />
            </EditorField>
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={onSave}>
              {t('employeeJustification:row.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
