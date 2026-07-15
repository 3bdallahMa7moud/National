// ============================================================
// AdminSchedulePage — Schedule Matrix Admin View
// ============================================================
// State-of-the-art enterprise healthcare scheduling interface.
// Integrates full spreadsheet matrix, draft/publish flow, vacation
// management, shift definition settings, bulk actions, undo/redo,
// search, and cross-facility conflict verification.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useScheduleMatrix } from '@/hooks/useScheduleMatrix';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import AdminMonthControl from '@/components/common/AdminMonthControl';
import Button from '@/components/ui/Button';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import ScheduleMatrix from '@/components/schedule/ScheduleMatrix/ScheduleMatrix';
import MatrixToolbar from './MatrixToolbar';
import MatrixStatsCards from './MatrixStatsCards';
import ScheduleViewControls from './ScheduleViewControls';
import AssignmentDrawer from './AssignmentDrawer';
import FullscreenMatrixModal from './FullscreenMatrixModal';
import VacationManagementPanel from './VacationManagementPanel';
import ScheduleSettingsPanel from './ScheduleSettingsPanel';
import ScheduleOrderPanel from './ScheduleOrderPanel';
import ScheduleSettingsWorkspace from './ScheduleSettingsWorkspace';
import CellContextMenu from './CellContextMenu';
import { mergeBrushAssignments } from '@/lib/scheduleAssignments';
import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import { useRole } from '@/hooks/useRole';
import { useAuthStore } from '@/stores/authStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { MatrixCellRef, Assignment, ShiftColorKey, MatrixReorderCommand, MatrixReorderResult } from '@/types/scheduleMatrix';

export default function AdminSchedulePage() {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const months = useMemo(() => (t('schedule:months', { returnObjects: true }) as string[]) || [], [t]);
  const store = useScheduleMatrix();
  const { isAdmin } = useRole();
  const user = useAuthStore((state) => state.user);
  const {
    data,
    month,
    year,
    adminMode,
    setAdminMode,
    facilityFilter,
    setFacilityFilter,
    highlightedEmployeeId,
    setHighlightedEmployeeId,
    selectedCells,
    selectCellRange,
    clearSelection,
    brushEmployeeCodes,
    toggleBrushEmployeeCode,
    clearBrushEmployees,
    drawerCell,
    openDrawer,
    closeDrawer,
    isDirty,
    pendingDraftCount,
    conflictCount,
    goToPrevMonth,
    goToNextMonth,
    assignCell,
    clearCell,
    duplicateToNextDay,
    fillAssignmentRange,
    toggleVacation,
    addVacationRange,
    updateEmployeeIdentity,
    markCellVacation,
    publishDrafts,
    discardDraft,
    undoLastEdit,
    undoStack,
    addShiftDefinition,
    updateShiftDefinition,
    deleteShiftDefinition,
    archiveShiftDefinition,
    restoreShiftDefinition,
    addUnit,
    renameUnit,
    archiveUnit,
    restoreUnit,
    deleteUnit,
    expandedCellsView,
    setExpandedCellsView,
    updateMatrixRow,
    addMatrixRow,
    archiveMatrixRow,
    restoreMatrixRow,
    deleteMatrixRow,
    reorderMatrixItem,
    clearAllAssignments,
    tableClipboard,
    copyCurrentTable,
    pasteCopiedTable,
    resetCurrentMonth,
    deleteCurrentMonth,
    currentMonthStatus,
    storageError,
  } = store;

  const { addToast } = useToast();
  const searchParams = useMemo(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search), []);
  const deepLinkHandled = useRef(false);

  // Local state for toolbar filtering & search
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [shiftFilter, setShiftFilter] = useState<ShiftColorKey | ''>('');
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [deleteRowTarget, setDeleteRowTarget] = useState<{
    rowId: string;
    rowLabel: string;
    assignments: number;
  } | null>(null);
  const [deleteUnitTarget, setDeleteUnitTarget] = useState<{
    facilityId: string;
    unitId: string;
    unitLabel: string;
    assignments: number;
  } | null>(null);

  useEffect(() => {
    if (deepLinkHandled.current) return;
    const dateValue = searchParams.get('date');
    const rowId = searchParams.get('rowId');
    const day = Number(searchParams.get('day'));
    if (!dateValue || !rowId || !Number.isInteger(day)) return;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
    if (!match) { deepLinkHandled.current = true; return; }
    const targetYear = Number(match[1]);
    const targetMonth = Number(match[2]) - 1;
    if (year !== targetYear || month !== targetMonth) {
      store.loadMonth(targetMonth, targetYear);
      return;
    }
    if (!data) return;
    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        if (unit.archived) continue;
        const row = filterActiveScheduleRows(data, facility.id, unit.rows).find((entry) => entry.id === rowId);
        if (!row || day < 1 || day > new Date(targetYear, targetMonth + 1, 0).getDate()) continue;
        setFacilityFilter(facility.id);
        const category = searchParams.get('category');
        const categoryColor: Record<string, ShiftColorKey> = { day: 'morning', late: 'evening', night: 'night', onCall: 'onCall', ot: 'overtime' };
        if (category && categoryColor[category]) setShiftFilter(categoryColor[category]);
        openDrawer({
          facilityId: facility.id,
          unitId: unit.id,
          rowId: row.id,
          day,
          facilityName: facility.name,
          unitName: unit.name,
          shiftLabel: row.shiftLabel || row.rowLabel,
          timeRange: row.timeRange,
          defaultColorKey: row.colorKey,
        });
        deepLinkHandled.current = true;
        return;
      }
    }
    deepLinkHandled.current = true;
    addToast({ type: 'warning', title: t('schedule:matrix.noResults'), message: t('schedule:matrix.noResults') });
  }, [addToast, data, month, openDrawer, searchParams, setFacilityFilter, store, t, year]);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    ref: MatrixCellRef;
    position: { x: number; y: number };
  } | null>(null);

  // Keyboard shortcut: Ctrl+Z / Cmd+Z for Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (undoStack && undoStack.length > 0) {
          e.preventDefault();
          const success = undoLastEdit();
          if (success) {
            addToast({
              type: 'info',
              title: t('schedule:toast.undoTitle'),
              message: t('schedule:toast.undoMsg'),
            });
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, undoLastEdit, addToast, t]);

  // Handle zoom steps
  const handleZoomIn = useCallback(() => setZoomLevel((z) => Math.min(z + 0.15, 2.0)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((z) => Math.max(z - 0.15, 0.7)), []);
  const handleZoomReset = useCallback(() => setZoomLevel(1), []);

  const handleToggleExpand = useCallback(() => {
    if (!isExpanded) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
      setIsExpanded(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
      setIsExpanded(false);
    }
  }, [isExpanded]);

  // Cell click -> open assignment drawer
  const getCellAssignments = useCallback(
    (cellRef: MatrixCellRef): Assignment[] => {
      if (!data) return [];
      for (const f of data.facilities) {
        if (f.id !== cellRef.facilityId) continue;
        for (const u of f.units) {
          if (u.id !== cellRef.unitId) continue;
          for (const r of u.rows) {
            if (r.id === cellRef.rowId) return r.cellsByDay[cellRef.day] || [];
          }
        }
      }
      return [];
    },
    [data],
  );

  const handleCellClick = useCallback(
    (cellRef: MatrixCellRef) => {
      if (!data) return;

      if (isBulkSelecting) {
        store.toggleCellSelection(cellRef);
        return;
      }

      if (adminMode === 'brush' && brushEmployeeCodes.length > 0) {
        const current = getCellAssignments(cellRef);
        const selectedEmployees = brushEmployeeCodes.flatMap((code) => {
          const employee = data.legend.find((entry) => entry.code === code);
          return employee ? [employee] : [];
        });
        const mergeResult = mergeBrushAssignments(current, selectedEmployees);

        if (!mergeResult.ok) {
          addToast({
            type: 'warning',
            title: t('schedule:toast.brushMaxCellTitle'),
            message: t('schedule:toast.brushMaxCellMsg'),
          });
          return;
        }

        if (!mergeResult.changed) {
          return;
        }

        const res = assignCell(cellRef.rowId, cellRef.day, mergeResult.assignments);
        if (!res.ok) {
          addToast({
            type: 'warning',
            title: t('schedule:toast.conflictWarningTitle'),
            message: res.conflict.reason,
          });
        } else {
          addToast({
            type: 'success',
            title: t('schedule:toast.brushAssignTitle'),
            message: t('schedule:toast.brushAssignMsg', {
              codes: mergeResult.assignments.map((assignment) => assignment.employeeCode).join(', '),
              day: cellRef.day,
            }),
          });
        }
        return;
      }

      // Find facility, unit, and row names for drawer title
      let facilityName = '';
      let unitName = '';
      let shiftLabel = '';
      let timeRange = '';
      let defaultColorKey: ShiftColorKey = 'morning';

      for (const f of data.facilities) {
        if (f.id === cellRef.facilityId) {
          facilityName = f.name;
          for (const u of f.units) {
            if (u.id === cellRef.unitId) {
              unitName = u.name;
              for (const r of u.rows) {
                if (r.id === cellRef.rowId) {
                  shiftLabel = r.shiftLabel || r.rowLabel;
                  timeRange = r.timeRange;
                  defaultColorKey = r.colorKey;
                  break;
                }
              }
              break;
            }
          }
          break;
        }
      }

      openDrawer({
        ...cellRef,
        facilityName,
        unitName,
        shiftLabel,
        timeRange,
        defaultColorKey,
      });
    },
    [data, isBulkSelecting, adminMode, brushEmployeeCodes, store, assignCell, openDrawer, addToast, t, getCellAssignments],
  );

  const handleChipClick = useCallback(
    (cellRef: MatrixCellRef, assignment?: Assignment) => {
      if (adminMode === 'brush' && assignment?.employeeCode) {
        const wasSelected = brushEmployeeCodes.includes(assignment.employeeCode);
        toggleBrushEmployeeCode(assignment.employeeCode);

        const emp = data?.legend.find((e) => e.code === assignment.employeeCode);
        if (wasSelected) {
          const remaining = brushEmployeeCodes.filter((code) => code !== assignment.employeeCode);
          const nextCode = remaining[remaining.length - 1];
          const nextEmp = nextCode ? data?.legend.find((entry) => entry.code === nextCode) : null;
          setHighlightedEmployeeId(nextEmp?.employeeId ?? null);
        } else if (emp) {
          setHighlightedEmployeeId(emp.employeeId);
        }
        return;
      }
      handleCellClick(cellRef);
    },
    [
      handleCellClick,
      adminMode,
      brushEmployeeCodes,
      toggleBrushEmployeeCode,
      data?.legend,
      setHighlightedEmployeeId,
    ],
  );

  const handleSaveAssignment = useCallback(
    (rowId: string, day: number, assignments: Assignment[]) => {
      if (selectedCells.length > 1 && selectedCells.some((c) => c.rowId === rowId && c.day === day)) {
        let hasConflict = false;
        let conflictMsg = '';
        selectedCells.forEach((c) => {
          const res = assignCell(c.rowId, c.day, assignments);
          if (!res.ok) {
            hasConflict = true;
            conflictMsg = res.conflict.reason;
          }
        });
        clearSelection();
        if (hasConflict) {
          addToast({
            type: 'warning',
            title: t('schedule:toast.conflictWarningTitle'),
            message: conflictMsg || 'Some cells had conflicts during bulk assignment.',
          });
        } else {
          addToast({
            type: 'success',
            title: 'Bulk Assignment Applied',
            message: `Successfully applied assignments to ${selectedCells.length} selected cells.`,
          });
        }
        return;
      }

      const res = assignCell(rowId, day, assignments);
      if (!res.ok) {
        addToast({
          type: 'warning',
          title: t('schedule:toast.conflictWarningTitle'),
          message: res.conflict.reason,
        });
      } else {
        addToast({
          type: 'success',
          title: t('schedule:toast.shiftSavedTitle'),
          message: t('schedule:toast.shiftSavedMsg'),
        });
      }
    },
    [assignCell, addToast, selectedCells, clearSelection, t],
  );

  // Bulk actions
  const handleBulkAssign = useCallback(() => {
    if (selectedCells.length === 0) return;
    const firstCell = selectedCells[0];
    handleCellClick(firstCell);
  }, [selectedCells, handleCellClick]);

  const handleBulkClear = useCallback(() => {
    selectedCells.forEach((c) => {
      clearCell(c.rowId, c.day);
    });
    clearSelection();
    setIsBulkSelecting(false);
    addToast({
      type: 'info',
      title: t('schedule:toast.bulkClearTitle'),
      message: t('schedule:toast.bulkClearMsg'),
    });
  }, [selectedCells, clearCell, clearSelection, addToast, t]);

  // Publish flow
  const handlePublish = useCallback(() => {
    const res = publishDrafts();
    if (res.ok) {
      addToast({
        type: 'success',
        title: t('schedule:toast.publishSuccessTitle'),
        message: t('schedule:toast.publishSuccessMsg'),
      });
    } else {
      addToast({
        type: 'error',
        title: t('schedule:toast.publishFailTitle'),
        message: res.message,
      });
    }
  }, [publishDrafts, addToast, t]);

  const handleLegendEmployeeClick = useCallback(
    (empId: string) => {
      if (adminMode === 'brush') {
        const emp = data?.legend.find((e) => e.employeeId === empId || e.code === empId);
        if (!emp) return;

        const wasSelected = brushEmployeeCodes.includes(emp.code);
        toggleBrushEmployeeCode(emp.code);

        if (wasSelected) {
          const remaining = brushEmployeeCodes.filter((code) => code !== emp.code);
          const nextCode = remaining[remaining.length - 1];
          const nextEmp = nextCode ? data?.legend.find((e) => e.code === nextCode) : null;
          setHighlightedEmployeeId(nextEmp?.employeeId ?? null);
        } else {
          setHighlightedEmployeeId(emp.employeeId);
        }
        return;
      }

      setHighlightedEmployeeId(empId === highlightedEmployeeId ? null : empId);
    },
    [
      adminMode,
      data?.legend,
      brushEmployeeCodes,
      toggleBrushEmployeeCode,
      highlightedEmployeeId,
      setHighlightedEmployeeId,
    ],
  );

  const searchMatches = useMemo(() => {
    if (!data || !deferredSearchQuery.trim()) return [];
    const query = deferredSearchQuery.trim().toLowerCase();
    const matchedEmps = data.legend.filter(
      (e) => e.code.toLowerCase().includes(query) || e.fullName.toLowerCase().includes(query),
    );
    return matchedEmps;
  }, [data, deferredSearchQuery]);

  const totalAssignmentCount = useMemo(() => {
    if (!data) return 0;
    let total = 0;
    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          total += Object.values(row.cellsByDay).reduce((sum, assignments) => sum + assignments.length, 0);
        }
      }
    }
    return total;
  }, [data]);

  const shiftStyles = useMemo(() => {
    if (!data) return {};
    const styles: Partial<Record<ShiftColorKey, { backgroundColor?: string; textColor?: string }>> = {};
    const orderedSettings = facilityFilter
      ? [...data.settings].sort((left, right) =>
        Number(right.facilityId.includes(facilityFilter)) - Number(left.facilityId.includes(facilityFilter)))
      : data.settings;
    for (const facilitySettings of orderedSettings) {
      for (const definition of facilitySettings.shiftDefinitions) {
        if (!styles[definition.colorKey]) {
          styles[definition.colorKey] = {
            backgroundColor: definition.backgroundColor,
            textColor: definition.textColor,
          };
        }
      }
    }
    return styles;
  }, [data, facilityFilter]);

  const getRowDeleteContext = useCallback((rowId: string) => {
    if (!data) return null;
    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          if (row.id !== rowId) continue;
          return {
            rowId,
            rowLabel: `${facility.name} / ${unit.name} / ${row.rowLabel}`,
            assignments: Object.values(row.cellsByDay).reduce((sum, assignments) => sum + assignments.length, 0),
          };
        }
      }
    }
    return null;
  }, [data]);

  const handleRequestDeleteRow = useCallback((rowId: string) => {
    const context = getRowDeleteContext(rowId);
    if (!context) return;
    if (context.assignments > 0) {
      setDeleteRowTarget(context);
      return;
    }
    deleteMatrixRow(rowId, true);
    addToast({ type: 'success', title: 'Row deleted', message: 'The empty row was deleted.' });
  }, [addToast, deleteMatrixRow, getRowDeleteContext]);

  const handleRequestDeleteUnit = useCallback((facilityId: string, unitId: string) => {
    const facility = data?.facilities.find((candidate) => candidate.id === facilityId);
    const unit = facility?.units.find((candidate) => candidate.id === unitId);
    if (!facility || !unit) return;
    const assignments = unit.rows.reduce((unitTotal, row) => unitTotal
      + Object.values(row.cellsByDay).reduce((rowTotal, values) => rowTotal + values.length, 0), 0);
    setDeleteUnitTarget({
      facilityId,
      unitId,
      unitLabel: `${facility.name} / ${unit.name}`,
      assignments,
    });
  }, [data]);

  const handleReorder = useCallback((command: MatrixReorderCommand): MatrixReorderResult => {
    const result = reorderMatrixItem(command, user?.name);
    if (result.ok) {
      addToast({
        type: 'success',
        title: t('schedule:matrix.order.successTitle'),
        message: t('schedule:matrix.order.successMessage', {
          item: t(`schedule:matrix.order.${result.kind}Kind`),
          count: result.affectedAssignments,
        }),
      });
      return result;
    }
    addToast({
      type: 'error',
      title: t('schedule:matrix.order.failureTitle'),
      message: result.message || t(`schedule:matrix.order.errors.${result.reason}`),
    });
    return result;
  }, [addToast, reorderMatrixItem, t, user?.name]);

  const handleJumpToSearchMatch = useCallback(() => {
    if (searchMatches.length > 0) {
      setHighlightedEmployeeId(searchMatches[0].employeeId);
      addToast({
        type: 'info',
        title: t('schedule:toast.searchResultTitle'),
        message: t('schedule:toast.searchResultMsg', { name: searchMatches[0].fullName, code: searchMatches[0].code }),
      });
    }
  }, [searchMatches, setHighlightedEmployeeId, addToast, t]);

  // Filtered display data (search & shift filter & conflict filter applied)
  const displayData = useMemo(() => {
    if (!data) return null;

    const facilities = data.facilities
      .filter((facility) => !facilityFilter || facility.id === facilityFilter)
      .map((facility) => {
        const units = facility.units
          .filter((unit) => !unit.archived)
          .map((unit) => {
            let rows = filterActiveScheduleRows(data, facility.id, unit.rows);

            if (shiftFilter) {
              rows = rows.filter((row) => row.colorKey === shiftFilter);
            }

            if (conflictsOnly) {
              rows = rows.filter((row) =>
                Object.values(row.cellsByDay).some((assignments) =>
                  assignments.some((assignment) => assignment.hasConflict),
                ),
              );
            }

            return rows === unit.rows ? unit : { ...unit, rows };
          })
          .filter((unit) => unit.rows.length > 0);

        return units === facility.units ? facility : { ...facility, units };
      });

    return facilities === data.facilities ? data : { ...data, facilities };
  }, [data, facilityFilter, shiftFilter, conflictsOnly]);

  const handleExportMatrix = useCallback(async () => {
    if (!displayData) return;
    const exportModule = await import('@/lib/scheduleMatrixExport');
    const matrixMonth = data?.month ?? month;
    const matrixYear = data?.year ?? year;
    const exportLabels = exportModule.buildScheduleMatrixExportLabels(t, months[matrixMonth] || '', matrixYear);
    const exportOptions = {
      facilityFilter: facilityFilter || undefined,
      dir: 'ltr' as const,
      monthName: exportModule.getEnglishMonthName(matrixMonth),
      year: matrixYear,
    };
    exportModule.exportScheduleMatrixToExcel(displayData, exportLabels, exportOptions);
  }, [displayData, data?.month, data?.year, month, year, t, months, facilityFilter]);

  const handleExportMatrixPdf = useCallback(async () => {
    if (!displayData) return;
    const exportModule = await import('@/lib/scheduleMatrixExport');
    const matrixMonth = data?.month ?? month;
    const matrixYear = data?.year ?? year;
    const exportLabels = exportModule.buildScheduleMatrixExportLabels(t, months[matrixMonth] || '', matrixYear);
    const exportOptions = {
      facilityFilter: facilityFilter || undefined,
      dir: 'ltr' as const,
      monthName: exportModule.getEnglishMonthName(matrixMonth),
      year: matrixYear,
    };
    exportModule.printScheduleMatrixPdf(displayData, exportLabels, exportOptions);
    addToast({
      type: 'info',
      title: t('schedule:toast.exportPdfTitle'),
      message: t('schedule:toast.exportPdfMsg'),
    });
  }, [displayData, data?.month, data?.year, month, year, t, months, facilityFilter, addToast]);

  // Current assignments for active drawer cell
  const drawerCurrentAssignments = useMemo(() => {
    if (!drawerCell || !data) return [];
    for (const f of data.facilities) {
      for (const u of f.units) {
        for (const r of u.rows) {
          if (r.id === drawerCell.rowId) {
            return r.cellsByDay[drawerCell.day] || [];
          }
        }
      }
    }
    return [];
  }, [drawerCell, data]);

  if (!displayData || !data) {
    return (
      <div dir={i18n.dir()} className="flex items-center justify-center h-64 text-slate-brand font-bold">
        {t('schedule:matrix.loading')}
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-4 pb-8 transition-all duration-200",
      isExpanded && "fixed inset-0 z-[100] bg-surface-muted p-4 sm:p-6 overflow-auto w-screen h-screen"
    )}>
      {/* ── Toolbar ── */}
      <div className="print:hidden">
        <MatrixToolbar
          adminMode={adminMode}
        onModeChange={setAdminMode}
        facilityFilter={facilityFilter}
        onFacilityFilterChange={setFacilityFilter}
        month={month}
        year={year}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        isDirty={isDirty}
        pendingDraftCount={pendingDraftCount}
        onPublish={handlePublish}
        onDiscard={discardDraft}
        conflictCount={conflictCount}
        highlightedEmployeeId={highlightedEmployeeId}
        onClearHighlight={() => setHighlightedEmployeeId(null)}
        selectedCellCount={selectedCells.length}
        onClearSelection={clearSelection}
        brushEmployeeCodes={brushEmployeeCodes}
        onClearBrush={clearBrushEmployees}
        isBulkSelecting={isBulkSelecting || selectedCells.length > 0}
        onToggleBulkSelect={() => {
          if (selectedCells.length > 0) {
            clearSelection();
          } else {
            setIsBulkSelecting(!isBulkSelecting);
          }
        }}
        isExpanded={isExpanded}
        onToggleExpand={handleToggleExpand}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onBulkAssign={handleBulkAssign}
        onBulkClear={handleBulkClear}
        onOpenFullscreen={() => setIsFullscreenModalOpen(true)}
        onExportExcel={handleExportMatrix}
        onExportPDF={handleExportMatrixPdf}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchMatchCount={searchMatches.length}
        onJumpToSearchMatch={handleJumpToSearchMatch}
        shiftFilter={shiftFilter}
        shiftStyles={shiftStyles}
        onShiftFilterChange={setShiftFilter}
        conflictsOnly={conflictsOnly}
        onToggleConflictsOnly={() => setConflictsOnly(!conflictsOnly)}
        onUndo={() => {
          if (undoLastEdit()) {
            addToast({ type: 'info', title: t('schedule:toast.undoTitle'), message: t('schedule:toast.undoStepMsg') });
          }
        }}
        canUndo={undoStack.length > 0}
        />
      </div>

      {/* ── KPI Statistics Cards ── */}
      {isAdmin && (
        <div className="print:hidden">
          <AdminMonthControl
            status={currentMonthStatus()}
            monthLabel={`${months[month] || month + 1} ${year}`}
            assignmentCount={totalAssignmentCount}
            tableClipboard={tableClipboard ? {
              sourceMonthLabel: `${months[tableClipboard.sourceMonth] || tableClipboard.sourceMonth + 1} ${tableClipboard.sourceYear}`,
              assignmentCount: tableClipboard.assignmentCount,
            } : null}
            storageError={storageError}
            onCopy={() => copyCurrentTable(user?.name)}
            onPaste={() => pasteCopiedTable(user?.name)}
            onClear={() => {
              clearAllAssignments(user?.name || 'Administrator');
              const error = useScheduleMatrixStore.getState().storageError;
              return { ok: !error, message: error || undefined };
            }}
            onReset={() => resetCurrentMonth(user?.name)}
            onDelete={() => deleteCurrentMonth(user?.name)}
          />
        </div>
      )}

      <ScheduleViewControls
        statsExpanded={statsExpanded}
        onToggleStats={() => setStatsExpanded((expanded) => !expanded)}
      />

      <div className={cn('hidden md:block', !statsExpanded && 'md:hidden')}>
        <MatrixStatsCards
          data={data}
          activeShiftFilter={shiftFilter}
          onSelectFilter={(filterKey) => setShiftFilter(filterKey)}
        />
      </div>

      {/* ── Conditional Mode Views (Vacations / Settings / Matrix) ── */}
      {adminMode === 'vacations' ? (
        <div className="space-y-4">
          <VacationManagementPanel
            data={data}
            onSaveRange={(empId, sDay, eDay, vType) => {
              addVacationRange(empId, sDay, eDay, vType);
              addToast({
                type: 'success',
                title: t('schedule:vacationPanel.toastSuccessTitle'),
                message: t('schedule:vacationPanel.toastRangeMessage', { start: sDay, end: eDay }),
              });
            }}
            onSaveDates={(empId, days, vType) => {
              store.addVacationDays(empId, days, vType);
              addToast({
                type: 'success',
                title: t('schedule:vacationPanel.toastSuccessTitle'),
                message: t('schedule:vacationPanel.toastDatesMessage', { days: days.join(', ') }),
              });
            }}
            onRemoveVacationDay={(empId, day) => {
              store.removeVacationDay(empId, day);
              addToast({
                type: 'info',
                title: 'تم إزالة الإجازة',
                message: `تم إزالة يوم الإجازة (${day}) بنجاح`,
              });
            }}
            onRemoveVacationRange={(empId, rangeId) => {
              store.removeVacationRange(empId, rangeId);
              addToast({
                type: 'info',
                title: 'تم إزالة الإجازة',
                message: 'تم إزالة فترة الإجازة بنجاح',
              });
            }}
            onClearEmployeeVacations={(empId) => {
              store.clearEmployeeVacations(empId);
              addToast({
                type: 'info',
                title: 'تم مسح الإجازات',
                message: 'تم مسح جميع إجازات الموظف بنجاح',
              });
            }}
            onUpdateEmployeeIdentity={(empId, fullName, code) => {
              const result = updateEmployeeIdentity(empId, fullName, code);
              if (result.ok) {
                addToast({
                  type: 'success',
                  title: t('schedule:vacationsPanel.identity.successTitle'),
                  message: t('schedule:vacationsPanel.identity.successMessage', {
                    name: result.fullName,
                    code: result.code,
                  }),
                });
              }
              return result;
            }}
          />
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-bold text-ink mb-2">{t('schedule:vacationPanel.bandTitle')}</h3>
            <ScheduleMatrix
              data={displayData}
              editable={false}
              adminMode="view"
              highlightedEmployeeId={highlightedEmployeeId}
              selectedCells={[]}
              brushEmployeeCodes={[]}
              isExpanded={isExpanded}
              zoomLevel={zoomLevel}
            />
          </div>
        </div>
      ) : adminMode === 'settings' ? (
        <ScheduleSettingsWorkspace
          shiftTypesPanel={(
            <ScheduleSettingsPanel
              data={data}
              onAddShift={addShiftDefinition}
              onUpdateShift={updateShiftDefinition}
              onDeleteShift={deleteShiftDefinition}
              onArchiveShift={archiveShiftDefinition}
              onRestoreShift={restoreShiftDefinition}
              onAddUnit={addUnit}
              onRenameUnit={renameUnit}
              onArchiveUnit={archiveUnit}
              onRestoreUnit={restoreUnit}
              onAddRow={addMatrixRow}
              onUpdateRow={(rowId, updates) => {
                updateMatrixRow(rowId, updates);
                addToast({
                  type: 'success',
                  title: t('schedule:toast.rowUpdatedTitle'),
                  message: t('schedule:toast.rowUpdatedMsg'),
                });
              }}
              onArchiveRow={(rowId) => {
                archiveMatrixRow(rowId);
                addToast({ type: 'info', title: 'Row archived', message: 'The row was archived successfully.' });
              }}
              onRestoreRow={(rowId) => {
                restoreMatrixRow(rowId);
                addToast({ type: 'success', title: 'Row restored', message: 'The row was restored successfully.' });
              }}
              onDeleteRow={handleRequestDeleteRow}
            />
          )}
          tableOrderPanel={(
            <ScheduleOrderPanel
              data={data}
              onReorder={handleReorder}
            />
          )}
        />
      ) : (
        /* ── Main Schedule Matrix Grid ── */
        <ScheduleMatrix
          data={displayData}
          editable={adminMode === 'edit'}
          adminMode={adminMode}
          highlightedEmployeeId={highlightedEmployeeId}
          selectedCells={selectedCells}
          brushEmployeeCodes={brushEmployeeCodes}
          isExpanded={isExpanded}
          expandedCellsView={expandedCellsView}
          onToggleExpandedCellsView={() => setExpandedCellsView(!expandedCellsView)}
          zoomLevel={zoomLevel}
          onCellClick={handleCellClick}
          onChipClick={handleChipClick}
          onCellContextMenu={(ref, position) => {
            if (adminMode === 'edit') {
              setContextMenu({ ref, position });
            }
          }}
          onRangeSelect={(start, end) => selectCellRange(start, end)}
          onDragFill={(source, target) => {
            fillAssignmentRange(source, target);
            addToast({
              type: 'info',
              title: t('schedule:toast.dragFillTitle'),
              message: t('schedule:toast.dragFillMsg'),
            });
          }}
          onVacationToggle={(empId, day) => {
            toggleVacation(empId, day);
            addToast({ type: 'info', title: t('schedule:toast.vacationUpdateTitle'), message: t('schedule:toast.vacationUpdateMsg', { day }) });
          }}
          onLegendEmployeeClick={handleLegendEmployeeClick}
          onUpdateRow={(rowId, updates) => {
            updateMatrixRow(rowId, updates);
            addToast({
              type: 'success',
              title: t('schedule:toast.rowUpdatedTitle'),
              message: t('schedule:toast.rowUpdatedMsg'),
            });
          }}
          onAddRow={addMatrixRow}
          onArchiveRow={(rowId) => {
            archiveMatrixRow(rowId);
            addToast({ type: 'info', title: 'Row archived', message: 'The row was archived successfully.' });
          }}
          onDeleteRow={handleRequestDeleteRow}
          onAddUnit={addUnit}
          onRenameUnit={renameUnit}
          onArchiveUnit={archiveUnit}
          onDeleteUnit={handleRequestDeleteUnit}
          onReorder={handleReorder}
        />
      )}

      {/* ── Right-Click Cell Context Menu ── */}
      {contextMenu && (
        <CellContextMenu
          position={contextMenu.position}
          hasAssignments={
            (data.facilities
              .find((f) => f.id === contextMenu.ref.facilityId)
              ?.units.find((u) => u.id === contextMenu.ref.unitId)
              ?.rows.find((r) => r.id === contextMenu.ref.rowId)
              ?.cellsByDay[contextMenu.ref.day]?.length || 0) > 0
          }
          onClose={() => setContextMenu(null)}
          onAssign={() => {
            handleCellClick(contextMenu.ref);
            setContextMenu(null);
          }}
          onRemove={() => {
            clearCell(contextMenu.ref.rowId, contextMenu.ref.day);
            setContextMenu(null);
            addToast({ type: 'info', title: t('schedule:toast.clearSuccessTitle'), message: t('schedule:toast.clearSuccessMsg') });
          }}
          onMarkVacation={() => {
            markCellVacation(contextMenu.ref.rowId, contextMenu.ref.day);
            setContextMenu(null);
            addToast({ type: 'success', title: t('schedule:toast.convertToVacationTitle'), message: t('schedule:toast.convertToVacationMsg') });
          }}
          onHistory={() => {
            setContextMenu(null);
            addToast({
              type: 'info',
              title: t('schedule:toast.auditLogTitle'),
              message: `${t('schedule:toast.auditLogMsg')} ${new Date().toLocaleTimeString()}`,
            });
          }}
          onDuplicateNextDay={() => {
            duplicateToNextDay(contextMenu.ref.rowId, contextMenu.ref.day);
            setContextMenu(null);
            addToast({ type: 'success', title: t('schedule:toast.copyNextDayTitle'), message: t('schedule:toast.copyNextDayMsg') });
          }}
        />
      )}

      {/* ── Assignment Drawer ── */}
      <AssignmentDrawer
        isOpen={!!drawerCell && !isFullscreenModalOpen}
        onClose={closeDrawer}
        data={data}
        cell={drawerCell}
        currentAssignments={drawerCurrentAssignments}
        legend={data.legend}
        onSave={handleSaveAssignment}
        onClear={clearCell}
      />

      {/* ── Fullscreen Overlay Modal ── */}
      <FullscreenMatrixModal
        isOpen={isFullscreenModalOpen}
        onClose={() => setIsFullscreenModalOpen(false)}
        data={data}
        displayData={displayData}
        month={month}
        year={year}
        adminMode={adminMode}
        onModeChange={setAdminMode}
        facilityFilter={facilityFilter}
        onFacilityFilterChange={setFacilityFilter}
        isDirty={isDirty}
        conflictCount={conflictCount}
        onDiscard={discardDraft}
        highlightedEmployeeId={highlightedEmployeeId}
        selectedCells={selectedCells}
        brushEmployeeCodes={brushEmployeeCodes}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onExportExcel={handleExportMatrix}
        onExportPDF={handleExportMatrixPdf}
        onCellClick={handleCellClick}
        onChipClick={handleChipClick}
        onVacationToggle={toggleVacation}
        onLegendEmployeeClick={handleLegendEmployeeClick}
        onUpdateRow={(rowId, updates) => {
          updateMatrixRow(rowId, updates);
          addToast({
            type: 'success',
            title: t('schedule:toast.rowUpdatedTitle'),
            message: t('schedule:toast.rowUpdatedMsg'),
          });
        }}
        onAddRow={addMatrixRow}
        onArchiveRow={(rowId) => {
          archiveMatrixRow(rowId);
          addToast({ type: 'info', title: 'Row archived', message: 'The row was archived successfully.' });
        }}
        onDeleteRow={handleRequestDeleteRow}
        onAddUnit={addUnit}
        onRenameUnit={renameUnit}
        onArchiveUnit={archiveUnit}
        onDeleteUnit={handleRequestDeleteUnit}
        onReorder={handleReorder}
        drawerCell={drawerCell}
        drawerCurrentAssignments={drawerCurrentAssignments}
        onDrawerClose={closeDrawer}
        onDrawerSave={handleSaveAssignment}
        onDrawerClear={clearCell}
      />

      {/* ── Safe Delete Confirmation Dialog (Policy 5) ── */}
      <Modal
        isOpen={!!deleteRowTarget}
        onClose={() => setDeleteRowTarget(null)}
        title="Delete Row With Assignments"
        size="md"
      >
        {deleteRowTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="text-xs">
                <p className="font-bold">Accidental Data Loss Warning</p>
                <p className="mt-1">
                  This row (<span className="font-semibold">{deleteRowTarget.rowLabel}</span>) currently contains{' '}
                  <span className="font-bold">{deleteRowTarget.assignments}</span> employee assignments during {months[month] || `Month ${month + 1}`} {year}.
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              If you delete this row immediately, all associated employee shift assignments in this row will be permanently removed from the schedule. Alternatively, you can archive the row to hide it while preserving historical assignment records.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteRowTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  archiveMatrixRow(deleteRowTarget.rowId);
                  setDeleteRowTarget(null);
                  addToast({
                    type: 'info',
                    title: 'Row Archived',
                    message: 'The row has been archived successfully while preserving assignment history.',
                  });
                }}
              >
                Archive Row
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteMatrixRow(deleteRowTarget.rowId, true);
                  setDeleteRowTarget(null);
                  addToast({
                    type: 'success',
                    title: 'Row Deleted',
                    message: `The row and its ${deleteRowTarget.assignments} assignments have been removed permanently.`,
                  });
                }}
              >
                Delete Row and Remove Assignments
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteUnitTarget}
        onClose={() => setDeleteUnitTarget(null)}
        title={t('schedule:matrix.unitDelete.title', { defaultValue: 'Delete unit' })}
        size="md"
      >
        {deleteUnitTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-text-primary">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" aria-hidden="true" />
              <div className="text-xs">
                <p className="font-bold">{t('schedule:matrix.unitDelete.warningTitle', { defaultValue: 'Assignments will be affected' })}</p>
                <p className="mt-1">
                  {t('schedule:matrix.unitDelete.warningMessage', {
                    unit: deleteUnitTarget.unitLabel,
                    count: deleteUnitTarget.assignments,
                    month: months[month] || `Month ${month + 1}`,
                    year,
                    defaultValue: '{{unit}} contains {{count}} employee assignments in {{month}} {{year}}.',
                  })}
                </p>
              </div>
            </div>
            <p className="text-xs leading-5 text-text-secondary">
              {t('schedule:matrix.unitDelete.description', {
                defaultValue: 'Archive preserves the unit and all assignments. Permanent deletion removes the entire unit, every row, and all assignments.',
              })}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-3">
              <Button variant="secondary" size="sm" onClick={() => setDeleteUnitTarget(null)}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  archiveUnit(deleteUnitTarget.facilityId, deleteUnitTarget.unitId);
                  setDeleteUnitTarget(null);
                  addToast({
                    type: 'info',
                    title: t('schedule:matrix.unitDelete.archivedTitle', { defaultValue: 'Unit archived' }),
                    message: t('schedule:matrix.unitDelete.archivedMessage', { defaultValue: 'The unit and its assignments were preserved.' }),
                  });
                }}
              >
                {t('schedule:matrix.unitDelete.archiveAction', { defaultValue: 'Archive unit' })}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const result = deleteUnit(
                    deleteUnitTarget.facilityId,
                    deleteUnitTarget.unitId,
                    true,
                    user?.name,
                  );
                  if (!result.ok) {
                    addToast({
                      type: 'error',
                      title: t('common:toast.error', { defaultValue: 'Unable to delete unit' }),
                      message: result.message || result.reason,
                    });
                    return;
                  }
                  setDeleteUnitTarget(null);
                  addToast({
                    type: 'success',
                    title: t('schedule:matrix.unitDelete.deletedTitle', { defaultValue: 'Unit deleted' }),
                    message: t('schedule:matrix.unitDelete.deletedMessage', {
                      count: result.affectedAssignments,
                      defaultValue: 'The unit and {{count}} assignments were permanently removed.',
                    }),
                  });
                }}
              >
                {t('schedule:matrix.unitDelete.deleteAction', { defaultValue: 'Delete unit permanently' })}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
