// ============================================================
// MatrixToolbar - Admin modes, filters, draft publishing
// ============================================================

import { memo } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Flame,
  Maximize2,
  ListOrdered,
  MoreHorizontal,
  Paintbrush,
  Pencil,
  Printer,
  Search,
  Settings2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { getShiftChipStyle } from '@/components/schedule/ScheduleMatrix/getShiftChipClasses';
import type { MatrixAdminMode, ShiftColorKey } from '@/types/scheduleMatrix';

interface MatrixToolbarProps {
  adminMode: MatrixAdminMode;
  onModeChange: (mode: MatrixAdminMode) => void;
  facilityFilter: string;
  onFacilityFilterChange: (id: string) => void;
  month: number;
  year: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isDirty: boolean;
  pendingDraftCount: number;
  onPublish: () => void;
  onDiscard: () => void;
  conflictCount: number;
  highlightedEmployeeId: string | null;
  onClearHighlight: () => void;
  selectedCellCount: number;
  onClearSelection: () => void;
  brushEmployeeCodes: string[];
  onClearBrush: () => void;
  isBulkSelecting?: boolean;
  onToggleBulkSelect?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  zoomLevel?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onBulkAssign?: () => void;
  onBulkClear?: () => void;
  onOpenFullscreen?: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchMatchCount: number;
  onJumpToSearchMatch: () => void;
  shiftFilter: ShiftColorKey | '';
  shiftStyles?: Partial<Record<ShiftColorKey, { backgroundColor?: string; textColor?: string }>>;
  onShiftFilterChange: (value: ShiftColorKey | '') => void;
  conflictsOnly: boolean;
  onToggleConflictsOnly: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onClearAllAssignments?: () => void;
}



function MatrixToolbar({
  adminMode,
  onModeChange,
  facilityFilter,
  onFacilityFilterChange,
  month,
  year,
  onPrevMonth,
  onNextMonth,
  isDirty,
  pendingDraftCount,
  onPublish,
  onDiscard,
  highlightedEmployeeId,
  onClearHighlight,
  selectedCellCount,
  onClearSelection,
  brushEmployeeCodes,
  onClearBrush,
  isBulkSelecting = false,
  onToggleBulkSelect,
  zoomLevel = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onBulkAssign,
  onBulkClear,
  onOpenFullscreen,
  searchQuery,
  onSearchQueryChange,
  searchMatchCount,
  onJumpToSearchMatch,
  shiftFilter,
  shiftStyles,
  onShiftFilterChange,
  onUndo,
  canUndo = false,
  onExportExcel,
  onExportPDF,
  onClearAllAssignments,
}: MatrixToolbarProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const isRtl = i18n.dir() === 'rtl';
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const months = (t('schedule:months', { returnObjects: true }) as string[]) || [];
  const modeConfig = [
    { mode: 'view' as const, label: t('schedule:toolbar.modes.view'), icon: <Eye className="h-3.5 w-3.5" /> },
    { mode: 'edit' as const, label: t('schedule:toolbar.modes.edit'), icon: <Pencil className="h-3.5 w-3.5" /> },
    { mode: 'order' as const, label: t('schedule:toolbar.modes.order', 'Arrange'), icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { mode: 'vacations' as const, label: t('schedule:toolbar.modes.vacations'), icon: <CalendarOff className="h-3.5 w-3.5" /> },
    { mode: 'brush' as const, label: t('schedule:toolbar.modes.brush'), icon: <Paintbrush className="h-3.5 w-3.5" /> },
    { mode: 'settings' as const, label: t('schedule:toolbar.modes.settings'), icon: <Settings2 className="h-3.5 w-3.5" /> },
  ];
  const facilityTabs = [
    { id: '', label: t('schedule:toolbar.allFacilities') },
    { id: 'kamc', label: 'KAMC' },
    { id: 'kasch', label: 'KASCH' },
    { id: 'whh', label: 'WHH' },
  ];
  const shiftFilters = [
    { value: '' as const, label: t('schedule:toolbar.allShifts') },
    { value: 'morning' as const, label: t('schedule:toolbar.morning'), colorKey: 'morning' as const },
    { value: 'evening' as const, label: t('schedule:toolbar.evening'), colorKey: 'evening' as const },
    { value: 'night' as const, label: t('schedule:toolbar.night'), colorKey: 'night' as const },
    { value: 'onCall' as const, label: t('schedule:toolbar.onCall'), colorKey: 'onCall' as const },
    { value: 'onCallNight' as const, label: t('schedule:toolbar.onCallNight'), colorKey: 'onCallNight' as const },
    { value: 'overtime' as const, label: t('schedule:toolbar.overtime'), colorKey: 'overtime' as const },
  ];

  return (
    <div className="min-w-0 space-y-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3 shadow-soft sm:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
          <div className="min-w-0 flex-1 sm:flex-none">
            <h1 className="text-lg font-bold text-ink">{t('schedule:toolbar.title')}</h1>
            <p className="text-[11px] text-text-secondary">{t('schedule:toolbar.subtitle')}</p>
          </div>

          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <button
              onClick={onPrevMonth}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-hover transition-colors"
              aria-label={t('schedule:matrix.prevMonth')}
            >
              <PrevIcon className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-center sm:min-w-[140px] sm:flex-none sm:px-4 sm:py-1.5">
              <span className="text-sm font-semibold text-ink">{months[month] || ''} {year}</span>
            </div>
            <button
              onClick={onNextMonth}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-hover transition-colors"
              aria-label={t('schedule:matrix.nextMonth')}
            >
              <NextIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="hidden items-center gap-2 flex-wrap md:flex">

          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                'flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all shadow-sm',
                canUndo
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500 hover:text-white'
                  : 'border-border bg-surface-muted text-text-muted cursor-not-allowed'
              )}
              title={t('schedule:toolbar.undoTitle')}
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>{t('schedule:toolbar.undo')}</span>
            </button>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1 shadow-inner">
            <button
              onClick={onZoomOut}
              disabled={zoomLevel <= 0.7}
              className="flex h-11 w-11 items-center justify-center rounded bg-surface text-text-primary shadow-sm hover:bg-hover disabled:opacity-40 transition-colors"
              title={t('schedule:toolbar.zoomOut')}
            >
              <ZoomOut className="h-3.5 w-3.5 text-primary-teal" />
            </button>
            <button
              onClick={onZoomReset}
              className="min-h-11 min-w-11 px-1 text-center text-xs font-bold text-ink transition-colors hover:text-primary-teal"
              title={t('schedule:toolbar.resetZoom')}
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              disabled={zoomLevel >= 2}
              className="flex h-11 w-11 items-center justify-center rounded bg-surface text-text-primary shadow-sm hover:bg-hover disabled:opacity-40 transition-colors"
              title={t('schedule:toolbar.zoomIn')}
            >
              <ZoomIn className="h-3.5 w-3.5 text-primary-teal" />
            </button>
          </div>

          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all shadow-sm dark:bg-emerald-950/60 dark:text-emerald-200"
              title={t('schedule:toolbar.exportExcel')}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden md:inline">{t('schedule:toolbar.exportExcel')}</span>
            </button>
          )}

          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-bold text-text-primary hover:border-primary hover:bg-primary hover:text-white transition-all shadow-sm"
              title={t('schedule:toolbar.exportPDF')}
            >
              <Printer className="h-4 w-4" />
              <span className="hidden md:inline">{t('schedule:toolbar.exportPDF')}</span>
            </button>
          )}

          {onClearAllAssignments && (
            <button
              onClick={onClearAllAssignments}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-danger/40 bg-danger-50 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all shadow-sm"
              title="Clear All Shift Assignments"
            >
              <Flame className="h-4 w-4" />
              <span className="hidden lg:inline">Clear Assignments</span>
            </button>
          )}

          {onOpenFullscreen && (
            <button
              onClick={onOpenFullscreen}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-primary-teal bg-primary-teal/10 px-3 py-1.5 text-xs font-bold text-primary-teal hover:bg-primary-teal hover:text-white transition-all shadow-sm"
              title={t('schedule:toolbar.fullscreen')}
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden md:inline">{t('schedule:toolbar.fullscreen')}</span>
            </button>
          )}
        </div>

        <details className="group relative w-full md:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-btn border border-border bg-surface-muted px-3 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30">
            <MoreHorizontal className="h-5 w-5" />
            {t('schedule:toolbar.moreActions')}
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-2 shadow-dropdown">
            <button type="button" onClick={() => onModeChange('brush')} className="min-h-11 rounded-btn border border-border px-3 text-xs font-semibold text-text-primary hover:bg-hover">
              {t('schedule:toolbar.modes.brush')}
            </button>
            <button type="button" onClick={() => onModeChange('settings')} className="min-h-11 rounded-btn border border-border px-3 text-xs font-semibold text-text-primary hover:bg-hover">
              {t('schedule:toolbar.modes.settings')}
            </button>
            {onUndo && (
              <button type="button" onClick={onUndo} disabled={!canUndo} className="min-h-11 rounded-btn border border-border px-3 text-xs font-semibold text-text-primary hover:bg-hover disabled:opacity-40">
                {t('schedule:toolbar.undo')}
              </button>
            )}
            {onExportExcel && (
              <button type="button" onClick={onExportExcel} className="min-h-11 rounded-btn border border-emerald-600 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {t('schedule:toolbar.exportExcel')}
              </button>
            )}
            {onExportPDF && (
              <button type="button" onClick={onExportPDF} className="min-h-11 rounded-btn border border-border px-3 text-xs font-semibold text-text-primary hover:bg-hover">
                {t('schedule:toolbar.exportPDF')}
              </button>
            )}
            {onClearAllAssignments && (
              <button type="button" onClick={onClearAllAssignments} className="col-span-2 min-h-11 rounded-btn border border-danger/40 px-3 text-xs font-semibold text-danger">
                Clear All Shift Assignments
              </button>
            )}
            {onOpenFullscreen && (
              <button type="button" onClick={onOpenFullscreen} className="col-span-2 min-h-11 rounded-btn border border-primary px-3 text-xs font-semibold text-primary">
                {t('schedule:toolbar.fullscreen')}
              </button>
            )}
          </div>
        </details>
      </div>

      {isDirty && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 shadow-soft">
          <Undo2 className="h-4 w-4 shrink-0" />
          <span className="font-bold">{t('schedule:toolbar.unpublishedDrafts')}</span>
          <span>{t('schedule:toolbar.draftChanges', { count: pendingDraftCount })}</span>
          <div className="ms-auto flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={onPublish} className="bg-primary-teal text-white border-0 hover:bg-primary-teal/90">
              <CheckCircle2 className="me-1 h-3.5 w-3.5" />
              {t('schedule:toolbar.publishUpdates')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDiscard} className="text-amber-800 hover:bg-hover">
              {t('schedule:toolbar.discardDraft')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-soft sm:px-4">
        <div className="min-w-0 max-w-full flex-1 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
          <div className="flex w-max items-center gap-1 rounded-lg bg-surface-muted p-0.5 border border-border">
            {modeConfig.map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  'flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                  (mode === 'brush' || mode === 'settings') && 'hidden md:flex',
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

          {adminMode === 'edit' && onToggleBulkSelect && (
            <button
              onClick={onToggleBulkSelect}
              className={cn(
                'min-h-11 rounded-md px-3 py-1.5 text-xs font-semibold border transition-all duration-150',
                isBulkSelecting
                  ? 'bg-primary-teal text-white border-primary-teal shadow-sm'
                  : 'bg-surface text-text-secondary border-border hover:border-primary-teal hover:bg-hover',
              )}
            >
              {isBulkSelecting ? t('schedule:toolbar.bulkSelectActiveLabel') : t('schedule:toolbar.selectRangeLabel')}
            </button>
          )}
        </div>

        <div className="flex w-full items-center gap-1 overflow-x-auto pb-1 lg:w-auto lg:overflow-visible lg:pb-0">
          {facilityTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onFacilityFilterChange(tab.id)}
              className={cn(
                'min-h-11 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
                facilityFilter === tab.id
                  ? 'bg-primary-teal text-white shadow-sm'
                  : 'text-text-secondary hover:bg-hover',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-soft sm:px-4">
        <div className="relative min-w-0 flex-1 basis-full sm:min-w-[240px] sm:basis-auto">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t('schedule:toolbar.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-border bg-surface ps-9 pe-24 text-xs text-ink shadow-inner focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
          />
          {searchQuery && (
            <button
              onClick={onJumpToSearchMatch}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md bg-surface-muted px-2 py-1 text-[10px] font-bold text-text-secondary hover:bg-hover"
            >
              {t('schedule:toolbar.resultsCount', { count: searchMatchCount })}
            </button>
          )}
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-1">
          {shiftFilters.map((filter) => (
            <button
              key={filter.value || 'all'}
              onClick={() => onShiftFilterChange(filter.value)}
              className={cn(
                'min-h-11 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                shiftFilter === filter.value
                  ? 'bg-primary-700 text-white shadow-sm dark:bg-primary-800 dark:text-white'
                  : 'bg-surface-muted text-text-secondary hover:bg-hover hover:text-text-primary dark:hover:bg-primary-950 dark:hover:text-text-primary',
              )}
            >
              {filter.colorKey && (
                <span
                  className="me-1 inline-block h-2.5 w-2.5 rounded-full border"
                  style={getShiftChipStyle(
                    filter.colorKey,
                    shiftStyles?.[filter.colorKey]?.backgroundColor,
                    shiftStyles?.[filter.colorKey]?.textColor,
                  )}
                  aria-hidden="true"
                />
              )}
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {highlightedEmployeeId && (
        <div className="flex items-center gap-2 rounded-lg bg-signal-cyan/10 border border-signal-cyan/20 px-3 py-2 text-xs font-medium text-primary-teal">
          <span>{t('schedule:matrix.highlightActive')}</span>
          <button onClick={onClearHighlight} className="ms-auto flex items-center gap-1 text-[11px] hover:text-ink">
            <X className="h-3 w-3" /> {t('schedule:matrix.cancelHighlight')}
          </button>
        </div>
      )}

      {adminMode === 'brush' && (
        <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-xs font-medium text-violet-700">
          <Paintbrush className="h-3.5 w-3.5" />
          <span>{t('schedule:matrix.brushSelectionCount', { count: brushEmployeeCodes.length })}</span>
          {brushEmployeeCodes.length > 0 && (
            <span dir="ltr" className="font-bold" style={{ unicodeBidi: 'isolate' }}>
              {brushEmployeeCodes.join(' + ')}
            </span>
          )}
          {brushEmployeeCodes.length > 0 && (
            <button onClick={onClearBrush} className="ms-auto flex items-center gap-1 text-[11px] hover:text-ink">
              <X className="h-3 w-3" /> {t('schedule:matrix.cancelBrush')}
            </button>
          )}
        </div>
      )}

      {selectedCellCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-primary-teal/10 border border-primary-teal/20 px-3 py-2 text-xs font-medium text-primary-teal">
          <span>{t('schedule:matrix.cellsSelected', { count: selectedCellCount })}</span>
          <Button size="sm" variant="primary" onClick={onBulkAssign} className="bg-primary-teal hover:bg-primary-teal/90 border-0 text-white text-[11px] px-2.5 py-1">
            {t('schedule:matrix.assignEmployee')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onBulkClear} className="text-[11px] px-2.5 py-1 text-text-secondary hover:text-ink hover:bg-hover">
            {t('schedule:matrix.clearCells')}
          </Button>
          <button onClick={onClearSelection} className="ms-auto flex items-center gap-1 text-[11px] hover:text-ink">
            <X className="h-3 w-3" /> {t('schedule:matrix.cancelSelection')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(MatrixToolbar);
