// ============================================================
// FullscreenMatrixModal — Fullscreen overlay for schedule matrix
// ============================================================
// Renders the full ScheduleMatrix in a fixed overlay that covers
// the entire viewport. Includes a slim toolbar for mode switching,
// facility filtering, zoom, and an exit button.
// The user can still edit shifts, use the brush mode and see conflicts.

import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil, Eye, CalendarOff, Paintbrush, FileSpreadsheet, Printer,
  ZoomIn, ZoomOut, Minimize2, Undo2, ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import ScheduleMatrix from '@/components/schedule/ScheduleMatrix/ScheduleMatrix';
import AssignmentDrawer from './AssignmentDrawer';
import type {
  ScheduleMatrixData,
  MatrixCellRef,
  Assignment,
  MatrixAdminMode,
  MatrixReorderCommand,
  MatrixReorderResult,
  ShiftColorKey,
  ShiftRow,
} from '@/types/scheduleMatrix';



interface FullscreenMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Data
  data: ScheduleMatrixData;
  displayData: ScheduleMatrixData;
  month: number;
  year: number;

  // Admin controls
  adminMode: MatrixAdminMode;
  onModeChange: (m: MatrixAdminMode) => void;
  facilityFilter: string;
  onFacilityFilterChange: (id: string) => void;

  // Dirty / conflicts
  isDirty: boolean;
  conflictCount: number;
  onDiscard: () => void;

  // Cell state
  highlightedEmployeeId: string | null;
  selectedCells: MatrixCellRef[];
  brushEmployeeCodes: string[];

  // Zoom
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;

  // Cell interactions
  onCellClick: (ref: MatrixCellRef) => void;
  onChipClick: (ref: MatrixCellRef, a: Assignment) => void;
  onVacationToggle: (empId: string, day: number) => void;
  onLegendEmployeeClick: (empId: string) => void;
  onLegendEmployeeDetailsClick?: (empId: string, employeeName: string) => void;
  onUpdateRow?: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftLabel' | 'timeRange' | 'colorKey' | 'weekendOnly'>>,
  ) => void;
  onAddRow?: (facilityId: string, unitId: string, shiftDefinitionId: string, rowLabel: string) => void;
  onArchiveRow?: (rowId: string) => void;
  onDeleteRow?: (rowId: string) => void;
  onAddUnit?: (facilityId: string, name: string) => void;
  onRenameUnit?: (facilityId: string, unitId: string, name: string) => void;
  onArchiveUnit?: (facilityId: string, unitId: string) => void;
  onDeleteUnit?: (facilityId: string, unitId: string) => void;
  onReorder?: (command: MatrixReorderCommand) => MatrixReorderResult;

  // Drawer
  drawerCell: (MatrixCellRef & {
    facilityName: string;
    unitName: string;
    shiftLabel: string;
    timeRange: string;
    defaultColorKey: ShiftColorKey;
  }) | null;
  drawerCurrentAssignments: Assignment[];
  onDrawerClose: () => void;
  onDrawerSave: (rowId: string, day: number, assignments: Assignment[]) => void;
  onDrawerClear: (rowId: string, day: number) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}

function FullscreenMatrixModal({
  isOpen,
  onClose,
  data,
  displayData,
  month,
  year,
  adminMode,
  onModeChange,
  facilityFilter,
  onFacilityFilterChange,
  isDirty,
  onDiscard,
  highlightedEmployeeId,
  selectedCells,
  brushEmployeeCodes,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onCellClick,
  onChipClick,
  onVacationToggle,
  onLegendEmployeeClick,
  onLegendEmployeeDetailsClick,
  onUpdateRow,
  onAddRow,
  onArchiveRow,
  onDeleteRow,
  onAddUnit,
  onRenameUnit,
  onArchiveUnit,
  onDeleteUnit,
  onReorder,
  drawerCell,
  drawerCurrentAssignments,
  onDrawerClose,
  onDrawerSave,
  onDrawerClear,
  onExportExcel,
  onExportPDF,
}: FullscreenMatrixModalProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const containerRef = useRef<HTMLDivElement>(null);
  const months = (t('schedule:months', { returnObjects: true }) as string[]) || [];
  const modeConfig: { mode: MatrixAdminMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'view', label: t('schedule:toolbar.viewMode'), icon: <Eye className="h-3.5 w-3.5" /> },
    { mode: 'edit', label: t('schedule:toolbar.editMode'), icon: <Pencil className="h-3.5 w-3.5" /> },
    { mode: 'order', label: t('schedule:toolbar.orderMode', 'Arrange'), icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { mode: 'vacations', label: t('schedule:toolbar.vacationMode'), icon: <CalendarOff className="h-3.5 w-3.5" /> },
    { mode: 'brush', label: t('schedule:toolbar.brushMode'), icon: <Paintbrush className="h-3.5 w-3.5" /> },
  ];
  const facilityTabs = [
    { id: '', label: t('schedule:toolbar.all') },
    { id: 'kamc', label: 'KAMC' },
    { id: 'kasch', label: 'KASCH' },
    { id: 'whh', label: 'WHH' },
  ];

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !drawerCell) onClose();
    };
    document.addEventListener('keydown', handleKey);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, drawerCell]);

  const handleZoomStep = useCallback((dir: 'in' | 'out') => {
    if (dir === 'in') onZoomIn();
    else onZoomOut();
  }, [onZoomIn, onZoomOut]);

  if (!isOpen) return null;

  const toolbar = (
    <div
      className="flex items-center gap-2 flex-wrap bg-surface border-b border-border px-4 py-2 shadow-sm shrink-0"
    >
      {/* Title + month */}
      <span className="text-sm font-bold text-ink">
        {t('schedule:toolbar.title')} - {months[month] || ''} {year}
      </span>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Mode tabs */}
      <div className="flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5 border border-border">
        {modeConfig.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-150',
              adminMode === mode
                ? 'bg-surface text-primary-teal shadow-sm border border-border'
                : 'text-text-secondary hover:text-ink hover:bg-hover',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Facility filter */}
      <div className="flex items-center gap-1">
        {facilityTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onFacilityFilterChange(tab.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150',
              facilityFilter === tab.id
                ? 'bg-primary-teal text-white shadow-sm'
                : 'text-text-secondary hover:bg-hover',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dirty indicator */}
      {isDirty && (
        <button
          onClick={onDiscard}
          className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <Undo2 className="h-3.5 w-3.5" />
          {t('schedule:toolbar.discardChanges')}
        </button>
      )}

      {onExportExcel && (
        <button
          onClick={onExportExcel}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all shadow-sm mx-1"
          title={t('schedule:toolbar.exportExcel')}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('schedule:toolbar.exportExcel')}</span>
        </button>
      )}

      {onExportPDF && (
        <button
          onClick={onExportPDF}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-text-primary hover:border-primary hover:bg-primary hover:text-white transition-all shadow-sm mx-1"
          title={t('schedule:toolbar.exportPDF')}
        >
          <Printer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('schedule:toolbar.exportPDF')}</span>
        </button>
      )}

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5">
        <button
          onClick={() => handleZoomStep('out')}
          disabled={zoomLevel <= 0.7}
          className="flex h-6 w-6 items-center justify-center rounded bg-surface text-text-primary hover:bg-hover disabled:opacity-40 transition-colors"
          title={t('schedule:toolbar.zoomOut')}
        >
          <ZoomOut className="h-3.5 w-3.5 text-primary-teal" />
        </button>
        <button
          onClick={onZoomReset}
          className="min-w-[38px] text-center text-[11px] font-bold text-ink hover:text-primary-teal transition-colors px-1"
          title={t('schedule:toolbar.zoomReset')}
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          onClick={() => handleZoomStep('in')}
          disabled={zoomLevel >= 2.0}
          className="flex h-6 w-6 items-center justify-center rounded bg-surface text-text-primary hover:bg-hover disabled:opacity-40 transition-colors"
          title={t('schedule:toolbar.zoomIn')}
        >
          <ZoomIn className="h-3.5 w-3.5 text-primary-teal" />
        </button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Close fullscreen */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-primary hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all shadow-sm"
        title={t('schedule:toolbar.exitFullscreen')}
      >
        <Minimize2 className="h-4 w-4" />
        {t('schedule:toolbar.exitFullscreen')}
      </button>
    </div>
  );

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex flex-col bg-surface-muted"
      role="dialog"
      aria-modal="true"
      aria-label={t('schedule:toolbar.fullscreenAria')}
    >
      {/* ── Slim top toolbar ── */}
      {toolbar}

      {/* ── Full-height scrollable matrix ── */}
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-2">
        <div className="h-full rounded-lg border border-border bg-surface shadow-soft overflow-hidden">
          <ScheduleMatrix
            data={displayData}
            editable={adminMode === 'edit'}
            adminMode={adminMode}
            highlightedEmployeeId={highlightedEmployeeId}
            selectedCells={selectedCells}
            brushEmployeeCodes={brushEmployeeCodes}
            isExpanded
            zoomLevel={zoomLevel}
            onCellClick={onCellClick}
            onChipClick={onChipClick}
            onVacationToggle={onVacationToggle}
            onLegendEmployeeClick={onLegendEmployeeClick}
            onLegendEmployeeDetailsClick={onLegendEmployeeDetailsClick}
            onUpdateRow={onUpdateRow}
            onAddRow={onAddRow}
            onArchiveRow={onArchiveRow}
            onDeleteRow={onDeleteRow}
            onAddUnit={onAddUnit}
            onRenameUnit={onRenameUnit}
            onArchiveUnit={onArchiveUnit}
            onDeleteUnit={onDeleteUnit}
            onReorder={onReorder}
          />
        </div>
      </div>

      {/* ── Assignment Drawer (stacks on top inside portal) ── */}
      <AssignmentDrawer
        isOpen={!!drawerCell}
        onClose={onDrawerClose}
        data={data}
        cell={drawerCell}
        currentAssignments={drawerCurrentAssignments}
        legend={data.legend}
        onSave={onDrawerSave}
        onClear={onDrawerClear}
      />
    </div>,
    document.body,
  );
}

export default memo(FullscreenMatrixModal);
