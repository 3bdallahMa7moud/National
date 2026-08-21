// ============================================================
// MatrixToolbar - Admin modes, filters, draft publishing
// ============================================================

import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Save,
  Search,
  Settings2,
  Sparkles,
  Tag,
  TimerReset,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { getShiftChipStyle } from '@/components/schedule/ScheduleMatrix/getShiftChipClasses';
import { SCHEDULE_CELL_MARKER_SWATCHES } from '@/lib/scheduleCellMarkers';
import type { CellMarkerTool, MatrixAdminMode, ShiftColorKey } from '@/types/scheduleMatrix';

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
  canPublish?: boolean;
  onPublish: () => void;
  onDiscard: () => void;
  conflictCount: number;
  highlightedEmployeeId: string | null;
  onClearHighlight: () => void;
  selectedCellCount: number;
  onClearSelection: () => void;
  brushEmployeeCodes: string[];
  brushEmployees?: Array<{ code: string; fullName: string }>;
  onToggleBrushEmployee?: (code: string) => void;
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
  activeCellMarkerTool?: CellMarkerTool | null;
  onCellMarkerToolChange?: (tool: CellMarkerTool) => void;
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
  colorblindMode: boolean;
  onToggleColorblindMode: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onGenerateSchedule?: () => void;
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
  canPublish = isDirty,
  onPublish,
  onDiscard,
  highlightedEmployeeId,
  onClearHighlight,
  selectedCellCount,
  onClearSelection,
  brushEmployeeCodes,
  brushEmployees = [],
  onToggleBrushEmployee,
  onClearBrush,
  isBulkSelecting = false,
  onToggleBulkSelect,
  zoomLevel = 1,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onBulkAssign,
  onBulkClear,
  activeCellMarkerTool = null,
  onCellMarkerToolChange,
  onOpenFullscreen,
  searchQuery,
  onSearchQueryChange,
  searchMatchCount,
  onJumpToSearchMatch,
  shiftFilter,
  shiftStyles,
  onShiftFilterChange,
  colorblindMode,
  onToggleColorblindMode,
  onUndo,
  canUndo = false,
  onExportExcel,
  onExportPDF,
  onGenerateSchedule,
  onClearAllAssignments,
}: MatrixToolbarProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const isRtl = i18n.dir() === 'rtl';
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const [brushSearchQuery, setBrushSearchQuery] = useState('');

  const filteredBrushEmployees = useMemo(() => {
    const query = brushSearchQuery.trim().toLowerCase();
    if (!query) return brushEmployees;
    return brushEmployees.filter((employee) =>
      employee.code.toLowerCase().includes(query)
      || employee.fullName.toLowerCase().includes(query),
    );
  }, [brushEmployees, brushSearchQuery]);

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
  ];

  return (
    <div className="w-full min-w-0 space-y-3 overflow-hidden">
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-3 shadow-soft sm:flex-row sm:items-center sm:px-4">
        <div className="flex min-w-0 w-full flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1 sm:flex-none">
            <h1 className="text-lg font-bold text-ink">{t('schedule:toolbar.title')}</h1>
            <p className="text-[11px] text-text-secondary">{t('schedule:toolbar.subtitle')}</p>
          </div>

          <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
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

        <Button
          size="sm"
          variant="primary"
          onClick={onPublish}
          disabled={!canPublish}
          className="min-h-11 w-full shrink-0 border-0 bg-primary-teal px-4 text-white shadow-sm hover:bg-primary-teal/90 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted sm:w-auto"
          aria-label={t('schedule:toolbar.publishToEmployees')}
          title={canPublish
            ? t('schedule:toolbar.publishToEmployees')
            : t('schedule:toolbar.noDraftToPublish')}
        >
          <CheckCircle2 className="me-1 h-4 w-4" />
          {t('schedule:toolbar.publishToEmployees')}
        </Button>

        <div className="hidden w-full flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-3 md:flex">

          <button
            onClick={onToggleColorblindMode}
            className={cn(
              'min-h-11 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors shadow-sm',
              colorblindMode
                ? 'border-primary-teal bg-primary-teal text-white'
                : 'border-border bg-surface text-text-primary hover:bg-hover',
            )}
            title={t('schedule:toolbar.legendAndColors')}
          >
            {t('schedule:toolbar.legendAndColors')}
          </button>

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

          {onGenerateSchedule && (
            <button
              onClick={onGenerateSchedule}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-primary-teal bg-primary-teal/10 px-3 py-1.5 text-xs font-bold text-primary-teal hover:bg-primary-teal hover:text-white transition-all shadow-sm"
              title={t('schedule:toolbar.generateSchedule')}
              aria-label={t('schedule:toolbar.generateSchedule')}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden lg:inline">{t('schedule:toolbar.generateSchedule')}</span>
            </button>
          )}

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
            <button type="button" onClick={() => onModeChange('brush')} className="min-w-0 min-h-11 rounded-btn border border-border px-2 text-xs font-semibold leading-tight text-text-primary hover:bg-hover">
              {t('schedule:toolbar.modes.brush')}
            </button>
            <button type="button" onClick={() => onModeChange('settings')} className="min-w-0 min-h-11 rounded-btn border border-border px-2 text-xs font-semibold leading-tight text-text-primary hover:bg-hover">
              {t('schedule:toolbar.modes.settings')}
            </button>
            <button type="button" onClick={onToggleColorblindMode} className="min-w-0 min-h-11 rounded-btn border border-border px-2 text-xs font-semibold leading-tight text-text-primary hover:bg-hover">
              {t('schedule:toolbar.legendAndColors')}
            </button>
            {onUndo && (
              <button type="button" onClick={onUndo} disabled={!canUndo} className="min-w-0 min-h-11 rounded-btn border border-border px-2 text-xs font-semibold leading-tight text-text-primary hover:bg-hover disabled:opacity-40">
                {t('schedule:toolbar.undo')}
              </button>
            )}
            {(onZoomIn || onZoomOut || onZoomReset) && (
              <div className="col-span-2 grid grid-cols-3 gap-2 rounded-btn border border-border bg-surface-muted p-1">
                <button
                  type="button"
                  onClick={onZoomOut}
                  disabled={!onZoomOut || zoomLevel <= 0.7}
                  className="min-h-11 rounded-md bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-hover disabled:opacity-40"
                  title={t('schedule:toolbar.zoomOut')}
                >
                  <ZoomOut className="mx-auto h-4 w-4 text-primary-teal" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onZoomReset}
                  disabled={!onZoomReset}
                  className="min-h-11 rounded-md bg-surface px-2 text-xs font-bold text-text-primary hover:bg-hover disabled:opacity-40"
                  title={t('schedule:toolbar.resetZoom')}
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={onZoomIn}
                  disabled={!onZoomIn || zoomLevel >= 2}
                  className="min-h-11 rounded-md bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-hover disabled:opacity-40"
                  title={t('schedule:toolbar.zoomIn')}
                >
                  <ZoomIn className="mx-auto h-4 w-4 text-primary-teal" aria-hidden="true" />
                </button>
              </div>
            )}
            {onExportExcel && (
              <button type="button" onClick={onExportExcel} className="min-w-0 min-h-11 rounded-btn border border-emerald-600 px-2 text-xs font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                {t('schedule:toolbar.exportExcel')}
              </button>
            )}
            {onExportPDF && (
              <button type="button" onClick={onExportPDF} className="min-w-0 min-h-11 rounded-btn border border-border px-2 text-xs font-semibold leading-tight text-text-primary hover:bg-hover">
                {t('schedule:toolbar.exportPDF')}
              </button>
            )}
            {onGenerateSchedule && (
              <button type="button" onClick={onGenerateSchedule} className="col-span-2 min-h-11 rounded-btn border border-primary-teal px-3 text-xs font-semibold text-primary-teal">
                {t('schedule:toolbar.generateSchedule')}
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

      {(isDirty || canPublish) && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 shadow-soft sm:flex-row sm:flex-wrap sm:items-center">
          <Save className="h-4 w-4 shrink-0" />
          <span className="font-bold">{t('schedule:toolbar.draftSaved')}</span>
          {pendingDraftCount > 0 && (
            <span>{t('schedule:toolbar.draftChanges', { count: pendingDraftCount })}</span>
          )}
          <span>{t('schedule:toolbar.draftPrivateNotice')}</span>
          {isDirty && (
            <Button size="sm" variant="ghost" onClick={onDiscard} className="text-amber-800 hover:bg-hover sm:ms-auto">
              {t('schedule:toolbar.discardDraft')}
            </Button>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-soft sm:flex-row sm:items-center sm:px-4">
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

          <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto pb-1">
          {shiftFilters.map((filter) => (
            <button
              key={filter.value || 'all'}
              onClick={() => onShiftFilterChange(filter.value)}
              className={cn(
                'min-h-11 shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors',
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
          <Link
            to={`/admin/late-schedule?year=${year}&month=${month + 1}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-500 hover:text-white dark:text-amber-300 dark:hover:bg-amber-600 transition-colors shadow-sm ms-1"
            title={t('schedule:publishedTables.otTab', 'OT Schedule')}
          >
            <TimerReset className="h-3.5 w-3.5" aria-hidden="true" />
            <span>OT</span>
          </Link>
        </div>
      </div>

      <fieldset
        className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-soft sm:px-4"
        disabled={adminMode !== 'edit' || !onCellMarkerToolChange}
      >
        <legend className="sr-only">{t('schedule:markers.controlLabel')}</legend>
        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
          <Tag className="h-4 w-4 text-primary-teal" aria-hidden="true" />
          <span>{t('schedule:markers.controlLabel')}</span>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1.5" role="group" aria-label={t('schedule:markers.paletteLabel')}>
          {SCHEDULE_CELL_MARKER_SWATCHES.map(({ color, hex }) => {
            const colorLabel = t(`schedule:markers.colors.${color}`);
            return (
              <button
                key={color}
                type="button"
                onClick={() => onCellMarkerToolChange?.(color)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  activeCellMarkerTool === color
                    ? 'border-primary-teal bg-primary-teal/15 text-primary-teal ring-2 ring-primary-teal/25'
                    : 'border-border bg-surface-muted text-text-secondary hover:bg-hover',
                )}
                aria-pressed={activeCellMarkerTool === color}
                aria-label={t('schedule:markers.colorAction', { color: colorLabel })}
                title={t('schedule:markers.colorAction', { color: colorLabel })}
              >
                <span
                  className="h-3.5 w-3.5 rounded-sm border border-black/10"
                  style={{ backgroundColor: hex }}
                  aria-hidden="true"
                />
                <span className="hidden xl:inline">{colorLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onCellMarkerToolChange?.('remove')}
            className={cn(
              'min-h-11 rounded-md border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              activeCellMarkerTool === 'remove'
                ? 'border-primary-teal bg-primary-teal/15 text-primary-teal ring-2 ring-primary-teal/25'
                : 'border-border bg-surface-muted text-text-secondary hover:bg-hover',
            )}
            aria-pressed={activeCellMarkerTool === 'remove'}
          >
            {t('schedule:markers.remove')}
          </button>
        </div>
        <span className="min-w-0 flex-1 text-[11px] text-text-muted">
          {adminMode !== 'edit'
            ? t('schedule:markers.editFirst')
            : activeCellMarkerTool
              ? t('schedule:markers.activeHint')
              : t('schedule:markers.chooseFirst')}
        </span>
      </fieldset>

      {highlightedEmployeeId && (
        <div className="flex flex-col gap-2 rounded-lg border border-signal-cyan/20 bg-signal-cyan/10 px-3 py-2 text-xs font-medium text-primary-teal sm:flex-row sm:items-center">
          <span>{t('schedule:matrix.highlightActive')}</span>
          <button onClick={onClearHighlight} className="flex min-h-11 items-center gap-1 text-[11px] hover:text-ink sm:ms-auto">
            <X className="h-3 w-3" /> {t('schedule:matrix.cancelHighlight')}
          </button>
        </div>
      )}

      {adminMode === 'brush' && (
        <div className="space-y-3 rounded-lg border border-violet-300 bg-violet-50 px-3 py-3 text-xs font-medium text-violet-800 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 font-bold">
              <Paintbrush className="h-4 w-4" />
              {t('schedule:matrix.brushSelectionCount', { count: brushEmployeeCodes.length })}
            </span>
            {brushEmployeeCodes.length > 0 && (
              <span dir="ltr" className="rounded-full bg-violet-100 px-2.5 py-1 font-bold text-violet-800 dark:bg-violet-900 dark:text-violet-100" style={{ unicodeBidi: 'isolate' }}>
                {brushEmployeeCodes.join(' + ')}
              </span>
            )}
            {brushEmployeeCodes.length > 0 && (
              <button onClick={onClearBrush} className="ms-auto flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-bold hover:bg-violet-100 dark:hover:bg-violet-900">
                <X className="h-3.5 w-3.5" /> {t('schedule:matrix.cancelBrush')}
              </button>
            )}
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(220px,0.35fr)_1fr]">
            <label className="relative block">
              <span className="sr-only">{t('schedule:assignment.searchPlaceholder')}</span>
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-violet-500" />
              <input
                value={brushSearchQuery}
                onChange={(event) => setBrushSearchQuery(event.target.value)}
                placeholder={t('schedule:assignment.searchPlaceholder')}
                className="h-11 w-full rounded-lg border border-violet-200 bg-white ps-9 pe-3 text-xs font-semibold text-ink outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-violet-800 dark:bg-surface"
              />
            </label>
            <div className="flex max-h-32 flex-wrap content-start gap-1.5 overflow-y-auto rounded-lg border border-violet-200 bg-white/70 p-2 dark:border-violet-800 dark:bg-surface/70">
              {filteredBrushEmployees.map((employee) => {
                const selected = brushEmployeeCodes.includes(employee.code);
                return (
                  <button
                    key={employee.code}
                    type="button"
                    onClick={() => onToggleBrushEmployee?.(employee.code)}
                    aria-pressed={selected}
                    aria-label={`${employee.code} ${employee.fullName}`}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start transition-colors',
                      selected
                        ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                        : 'border-border bg-surface text-text-primary hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/50',
                    )}
                  >
                    <span dir="ltr" className="font-black" style={{ unicodeBidi: 'isolate' }}>{employee.code}</span>
                    <span className="max-w-40 truncate font-semibold">{employee.fullName}</span>
                    {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
              {filteredBrushEmployees.length === 0 && (
                <span className="px-2 py-1.5 text-text-muted">{t('schedule:assignment.noResults')}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCellCount > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary-teal/20 bg-primary-teal/10 px-3 py-2 text-xs font-medium text-primary-teal sm:flex-row sm:items-center sm:gap-3">
          <span>{t('schedule:matrix.cellsSelected', { count: selectedCellCount })}</span>
          <Button size="sm" variant="primary" onClick={onBulkAssign} className="bg-primary-teal hover:bg-primary-teal/90 border-0 text-white text-[11px] px-2.5 py-1">
            {t('schedule:matrix.assignEmployee')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onBulkClear} className="text-[11px] px-2.5 py-1 text-text-secondary hover:text-ink hover:bg-hover">
            {t('schedule:matrix.clearCells')}
          </Button>
          <button onClick={onClearSelection} className="flex min-h-11 items-center gap-1 text-[11px] hover:text-ink sm:ms-auto">
            <X className="h-3 w-3" /> {t('schedule:matrix.cancelSelection')}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(MatrixToolbar);
