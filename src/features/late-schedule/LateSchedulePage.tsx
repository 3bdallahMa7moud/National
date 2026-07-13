import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArchiveRestore, BellRing, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useLateScheduleStore } from '@/stores/lateScheduleStore';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useEmployeeRosterStore } from '@/stores/employeeRosterStore';
import { exportLateScheduleExcel, exportLateSchedulePdf } from '@/lib/lateScheduleExport';
import type { OTShiftInput } from '@/types/lateSchedule';
import LateScheduleToolbar from './LateScheduleToolbar';
import LateScheduleStats from './LateScheduleStats';
import LateScheduleDesktopGrid from './LateScheduleDesktopGrid';
import LateScheduleMobileWeek from './LateScheduleMobileWeek';
import OTAssignmentPanel from './OTAssignmentPanel';
import OTShiftFormModal from './OTShiftFormModal';

interface ActiveCell {
  rowId: string;
  day: number;
}

export default function LateSchedulePage() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const locale = isRtl ? 'ar-SA-u-ca-gregory' : 'en-US';
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const { addToast } = useToast();
  const year = useLateScheduleStore((state) => state.year);
  const month = useLateScheduleStore((state) => state.month);
  const rows = useLateScheduleStore((state) => state.rows);
  const notice = useLateScheduleStore((state) => state.notice);
  const warnings = useLateScheduleStore((state) => state.warnings);
  const goToPreviousMonth = useLateScheduleStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useLateScheduleStore((state) => state.goToNextMonth);
  const setMonth = useLateScheduleStore((state) => state.setMonth);
  const setCellAssignments = useLateScheduleStore((state) => state.setCellAssignments);
  const clearCell = useLateScheduleStore((state) => state.clearCell);
  const addRow = useLateScheduleStore((state) => state.addRow);
  const updateRow = useLateScheduleStore((state) => state.updateRow);
  const archiveRow = useLateScheduleStore((state) => state.archiveRow);
  const restoreLateShiftRow = useLateScheduleStore((state) => state.restoreLateShiftRow);
  const setNotice = useLateScheduleStore((state) => state.setNotice);
  const [search, setSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState(notice);
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  const searchParams = useMemo(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search), []);
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    if (deepLinkHandled.current) return;
    const rowId = searchParams.get('rowId');
    const day = Number(searchParams.get('day'));
    const targetYear = Number(searchParams.get('year'));
    const targetMonth = Number(searchParams.get('month')) - 1;
    if (!rowId || !Number.isInteger(day) || !Number.isInteger(targetYear) || !Number.isInteger(targetMonth)) return;
    if (year !== targetYear || month !== targetMonth) {
      setMonth(targetYear, targetMonth);
      return;
    }
    const row = rows.find((entry) => entry.id === rowId && !entry.archived);
    if (row && day >= 1 && day <= new Date(year, month + 1, 0).getDate() && isAdmin) {
      setActiveCell({ rowId, day });
    } else if (!row) {
      addToast({ type: 'warning', title: isRtl ? 'العنصر غير متاح' : 'Schedule item unavailable', message: isRtl ? 'قد يكون الصف مؤرشفًا أو غير موجود.' : 'The row may be archived or no longer exist.' });
    }
    deepLinkHandled.current = true;
  }, [addToast, isAdmin, isRtl, month, rows, searchParams, setMonth, year]);

  const roster = useEmployeeRosterStore((state) => state.employees);
  const employeeById = useMemo(() => new Map(roster.map((employee) => [employee.employeeId, employee])), [roster]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const identityText = Object.values(row.assignments).flat().map((assignment) => {
        if (assignment.kind === 'unresolved') return assignment.legacyCode;
        const employee = employeeById.get(assignment.employeeId);
        return `${employee?.code ?? ''} ${employee?.fullName ?? ''} ${employee?.fullNameEn ?? ''}`;
      }).join(' ');
      return `${row.title} ${row.location} ${row.timeRange} ${identityText}`.toLowerCase().includes(query);
    });
  }, [rows, search, employeeById]);
  const activeFilteredRows = filteredRows.filter((row) => !row.archived);
  const archivedFilteredRows = filteredRows.filter((row) => row.archived);

  const activeRow = activeCell ? rows.find((row) => row.id === activeCell.rowId) : undefined;
  const editingRow = editingRowId ? rows.find((row) => row.id === editingRowId) : undefined;
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const activeRows = rows.filter((row) => !row.archived);
  const assignmentCount = activeRows.reduce((total, row) => total + Object.values(row.assignments).reduce((sum, assignments) => sum + assignments.length, 0), 0);
  const totalHours = activeRows.reduce((total, row) => total + Object.values(row.assignments).reduce((sum, assignments) => sum + assignments.filter((assignment) => assignment.kind === 'employee').length * row.hours, 0), 0);

  const handleSaveAssignment = (employeeIds: string[], unresolvedLegacyCodes: string[]) => {
    if (!activeCell) return;
    const result = setCellAssignments(activeCell.rowId, activeCell.day, employeeIds, unresolvedLegacyCodes, user?.name);
    if (!result.ok) {
      addToast({ type: 'warning', title: isRtl ? 'تعذر حفظ التعيين' : 'Assignment not saved', message: result.reason });
      return;
    }
    setActiveCell(null);
    addToast({ type: 'success', title: isRtl ? 'تم حفظ التعيين' : 'Assignment saved' });
  };

  const handleSaveRow = (input: OTShiftInput) => {
    const result = editingRow ? updateRow(editingRow.id, input, user?.name) : addRow(input, user?.name);
    if (!result.ok) {
      addToast({ type: 'warning', title: isRtl ? 'تعذر حفظ الشفت' : 'Shift not saved', message: result.reason });
      return;
    }
    setEditingRowId(null);
    setIsAddingRow(false);
    addToast({ type: 'success', title: isRtl ? 'تم حفظ شفت OT' : 'OT shift saved' });
  };

  const exportContext = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNum = index + 1;
      const date = new Date(year, month, dayNum);
      return {
        dayNum,
        weekdayName: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
        isWeekend: date.getDay() === 5 || date.getDay() === 6,
      };
    });
    const officialMonth = new Intl.DateTimeFormat('en-US', { month: 'long' })
      .format(new Date(year, month, 1))
      .toUpperCase();
    return { title: `${officialMonth}  LATE SHIFT`, days };
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-clip pb-10">
      <LateScheduleToolbar
        monthLabel={monthLabel}
        search={search}
        canEdit={isAdmin}
        showStats={showStats}
        onSearch={setSearch}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onToggleStats={() => setShowStats((value) => !value)}
        onExportExcel={async () => {
          const context = exportContext();
          await exportLateScheduleExcel(rows, roster, context.title, year, month, context.days, notice);
        }}
        onExportPdf={() => {
          const context = exportContext();
          exportLateSchedulePdf(rows, roster, context.title, year, context.days, isRtl, notice);
        }}
        onAddShift={() => setIsAddingRow(true)}
      />

      {showStats && <LateScheduleStats isRtl={isRtl} shiftRows={activeRows.length} assignments={assignmentCount} hours={totalHours} employees={roster.length} />}

      {(notice || isAdmin || warnings.length > 0) && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            {warnings.length > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" /> : <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{notice || (isRtl ? 'لا يوجد تنبيه حالي' : 'No active notice')}</p>
              {warnings.map((warning, index) => (
                <p key={`${warning.kind}-${index}`} className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  {warning.kind === 'unresolved_employee' ? `${isRtl ? 'كود غير مرتبط' : 'Unresolved code'}: ${warning.code}` : (isRtl ? 'تم استرجاع بيانات OT الافتراضية بعد خطأ تخزين' : 'OT data recovered after a storage error')}
                </p>
              ))}
            </div>
          </div>
          {isAdmin && <Button variant="ghost" className="min-h-11" icon={<Edit3 className="h-4 w-4" />} onClick={() => { setNoticeDraft(notice); setIsNoticeOpen(true); }}>{isRtl ? 'تعديل التنبيه' : 'Edit notice'}</Button>}
        </section>
      )}

      {isAdmin && (
        <div
          className="flex w-fit items-center gap-1 rounded-xl border border-border bg-surface-muted p-1"
          role="tablist"
          aria-label={isRtl ? 'حالة صفوف OT' : 'OT row status'}
        >
          <button
            type="button"
            role="tab"
            aria-selected={archiveView === 'active'}
            onClick={() => setArchiveView('active')}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${archiveView === 'active' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {isRtl ? 'النشطة' : 'Active'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={archiveView === 'archived'}
            onClick={() => setArchiveView('archived')}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${archiveView === 'archived' ? 'bg-surface text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {isRtl ? 'المؤرشفة' : 'Archived'}
            {archivedFilteredRows.length > 0 && <span aria-hidden="true"> ({archivedFilteredRows.length})</span>}
          </button>
        </div>
      )}

      {archiveView === 'active' || !isAdmin ? (
        <>
          <LateScheduleDesktopGrid year={year} month={month} rows={activeFilteredRows} roster={roster} notice={notice} canEdit={isAdmin} onAssign={(rowId, day) => setActiveCell({ rowId, day })} onEditRow={setEditingRowId} />
          <LateScheduleMobileWeek year={year} month={month} rows={activeFilteredRows} roster={roster} canEdit={isAdmin} onAssign={(rowId, day) => setActiveCell({ rowId, day })} />
        </>
      ) : (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4" aria-label={isRtl ? 'صفوف OT المؤرشفة' : 'Archived OT rows'}>
          {archivedFilteredRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              {isRtl ? 'لا توجد صفوف OT مؤرشفة في هذا الشهر.' : 'No archived OT rows in this month.'}
            </p>
          ) : archivedFilteredRows.map((row) => (
            <article key={row.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-text-primary">{row.title}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {row.location} · <span dir="ltr">{row.timeRange}</span> · {row.hours}h
                </p>
              </div>
              <Button
                variant="secondary"
                className="min-h-11 shrink-0"
                icon={<ArchiveRestore className="h-4 w-4" />}
                aria-label={`${isRtl ? 'استعادة' : 'Restore'} ${row.title}`}
                onClick={() => {
                  const result = restoreLateShiftRow(row.id, user?.name);
                  if (result.ok) {
                    setArchiveView('active');
                    addToast({ type: 'success', title: isRtl ? 'تمت استعادة صف OT' : 'OT row restored' });
                  }
                }}
              >
                {isRtl ? 'استعادة' : 'Restore'}
              </Button>
            </article>
          ))}
        </section>
      )}

      <Modal isOpen={!!activeCell} onClose={() => setActiveCell(null)} title={activeCell ? `${isRtl ? 'تعيين OT — اليوم' : 'OT assignment — Day'} ${activeCell.day}` : ''} size="md">
        {activeCell && activeRow && (
          <OTAssignmentPanel
            key={`${activeCell.rowId}-${activeCell.day}`}
            roster={roster}
            initialAssignments={activeRow.assignments[activeCell.day] ?? []}
            onSave={handleSaveAssignment}
            onClear={() => {
              const result = clearCell(activeCell.rowId, activeCell.day, user?.name);
              if (result.ok) setActiveCell(null);
            }}
            onCancel={() => setActiveCell(null)}
          />
        )}
      </Modal>

      <OTShiftFormModal isOpen={isAddingRow || !!editingRow} row={editingRow} onClose={() => { setIsAddingRow(false); setEditingRowId(null); }} onSave={handleSaveRow} onArchive={editingRow ? () => { archiveRow(editingRow.id, user?.name); setEditingRowId(null); } : undefined} />

      <Modal isOpen={isNoticeOpen} onClose={() => setIsNoticeOpen(false)} title={isRtl ? 'تعديل تنبيه OT' : 'Edit OT notice'} size="sm">
        <div className="space-y-4">
          <Input label={isRtl ? 'نص التنبيه' : 'Notice text'} value={noticeDraft} onChange={(event) => setNoticeDraft(event.target.value)} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setIsNoticeOpen(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button><Button onClick={() => { setNotice(noticeDraft, user?.name); setIsNoticeOpen(false); }}>{isRtl ? 'حفظ' : 'Save notice'}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
