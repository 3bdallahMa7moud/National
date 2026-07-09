// ============================================================
// MatrixToolbar - Admin modes, filters, draft publishing
// ============================================================

import { memo, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Maximize2,
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
import { SHIFT_COLOR_KEYS } from '@/lib/shiftColorOptions';
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
  brushColorKey?: ShiftColorKey;
  onBrushColorKeyChange?: (key: ShiftColorKey) => void;
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
  onShiftFilterChange: (value: ShiftColorKey | '') => void;
  conflictsOnly: boolean;
  onToggleConflictsOnly: () => void;
  colorblindMode: boolean;
  onToggleColorblindMode: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
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
  conflictCount,
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
  onExportExcel,
  onExportPDF,
  searchQuery,
  onSearchQueryChange,
  searchMatchCount,
  onJumpToSearchMatch,
  shiftFilter,
  onShiftFilterChange,
  conflictsOnly,
  onToggleConflictsOnly,
  colorblindMode,
  onToggleColorblindMode,
  onUndo,
  canUndo = false,
  brushColorKey = 'morning',
  onBrushColorKeyChange,
}: MatrixToolbarProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const isRtl = i18n.dir() === 'rtl';
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const months = (t('schedule:months', { returnObjects: true }) as string[]) || [];
  const modeConfig = [
    { mode: 'view' as const, label: t('schedule:toolbar.modes.view'), icon: <Eye className="h-3.5 w-3.5" /> },
    { mode: 'edit' as const, label: t('schedule:toolbar.modes.edit'), icon: <Pencil className="h-3.5 w-3.5" /> },
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
    { value: 'morning' as const, label: t('schedule:toolbar.morning') },
    { value: 'evening' as const, label: 'Late' },
    { value: 'night' as const, label: 'Night' },
    { value: 'onCall' as const, label: 'On-call' },
    { value: 'overtime' as const, label: 'Weekend' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-ink">{t('schedule:toolbar.title')}</h1>
            <p className="text-[11px] text-slate-500">{t('schedule:toolbar.subtitle')}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onPrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              aria-label={t('schedule:matrix.prevMonth')}
            >
              <PrevIcon className="h-4 w-4" />
            </button>
            <div className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 min-w-[140px] text-center">
              <span className="text-sm font-semibold text-ink">{months[month] || ''} {year}</span>
            </div>
            <button
              onClick={onNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
              aria-label={t('schedule:matrix.nextMonth')}
            >
              <NextIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">

          <button
            onClick={onToggleColorblindMode}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors shadow-sm',
              colorblindMode
                ? 'border-primary-teal bg-primary-teal text-white'
                : 'border-gray-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {t('schedule:toolbar.legendAndColors')}
          </button>

          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all shadow-sm',
                canUndo
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 hover:bg-amber-500 hover:text-white'
                  : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
              title={t('schedule:toolbar.undoTitle')}
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>{t('schedule:toolbar.undo')}</span>
            </button>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-slate-50 p-1 shadow-inner">
            <button
              onClick={onZoomOut}
              disabled={zoomLevel <= 0.7}
              className="flex h-6 w-6 items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title={t('schedule:toolbar.zoomOut')}
            >
              <ZoomOut className="h-3.5 w-3.5 text-primary-teal" />
            </button>
            <button
              onClick={onZoomReset}
              className="min-w-[42px] text-center text-xs font-bold text-ink hover:text-primary-teal transition-colors px-1"
              title={t('schedule:toolbar.resetZoom')}
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={onZoomIn}
              disabled={zoomLevel >= 2}
              className="flex h-6 w-6 items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title={t('schedule:toolbar.zoomIn')}
            >
              <ZoomIn className="h-3.5 w-3.5 text-primary-teal" />
            </button>
          </div>

          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
              title={t('schedule:toolbar.exportExcel')}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden md:inline">{t('schedule:toolbar.exportExcel')}</span>
            </button>
          )}

          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 rounded-lg border border-slate-400 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
              title={t('schedule:toolbar.exportPDF')}
            >
              <Printer className="h-4 w-4" />
              <span className="hidden md:inline">{t('schedule:toolbar.exportPDF')}</span>
            </button>
          )}

          {onOpenFullscreen && (
            <button
              onClick={onOpenFullscreen}
              className="flex items-center gap-1.5 rounded-lg border border-primary-teal bg-primary-teal/10 px-3 py-1.5 text-xs font-bold text-primary-teal hover:bg-primary-teal hover:text-white transition-all shadow-sm"
              title={t('schedule:toolbar.fullscreen')}
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden md:inline">{t('schedule:toolbar.fullscreen')}</span>
            </button>
          )}
        </div>
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
            <Button size="sm" variant="ghost" onClick={onDiscard} className="text-amber-800 hover:bg-white/60">
              {t('schedule:toolbar.discardDraft')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 shadow-soft">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 border border-gray-200">
            {modeConfig.map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                  adminMode === mode
                    ? 'bg-white text-primary-teal shadow-sm border border-gray-200'
                    : 'text-slate-600 hover:text-ink hover:bg-slate-50',
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
                'rounded-md px-3 py-1.5 text-xs font-semibold border transition-all duration-150',
                isBulkSelecting
                  ? 'bg-primary-teal text-white border-primary-teal shadow-sm'
                  : 'bg-white text-slate-600 border-gray-300 hover:border-primary-teal hover:bg-slate-50',
              )}
            >
              {isBulkSelecting ? t('schedule:toolbar.bulkSelectActiveLabel') : t('schedule:toolbar.selectRangeLabel')}
            </button>
          )}

          {(adminMode === 'edit' || adminMode === 'brush') && onBrushColorKeyChange && (
            <div className="flex items-center gap-1.5 rounded-lg border border-primary-teal/30 bg-primary-teal/5 px-2.5 py-1">
              <span className="text-[11px] font-bold text-primary-teal">نوع الشفت عند التعيين:</span>
              <select
                value={brushColorKey}
                onChange={(e) => onBrushColorKeyChange(e.target.value as ShiftColorKey)}
                className="h-7 rounded border border-primary-teal/40 bg-white px-2 text-xs font-bold text-ink focus:border-primary-teal focus:outline-none"
              >
                {SHIFT_COLOR_KEYS.map((key) => (
                  <option key={key} value={key}>{t(`schedule:shiftColors.${key}`)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {facilityTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onFacilityFilterChange(tab.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
                facilityFilter === tab.id
                  ? 'bg-primary-teal text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 shadow-soft">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t('schedule:toolbar.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-24 text-xs text-ink shadow-inner focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
          />
          {searchQuery && (
            <button
              onClick={onJumpToSearchMatch}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200"
            >
              {t('schedule:toolbar.resultsCount', { count: searchMatchCount })}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {shiftFilters.map((filter) => (
            <button
              key={filter.value || 'all'}
              onClick={() => onShiftFilterChange(filter.value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                shiftFilter === filter.value
                  ? 'bg-ink text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
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

      {adminMode === 'brush' && brushEmployeeCodes.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-xs font-medium text-violet-700">
          <Paintbrush className="h-3.5 w-3.5" />
          <span>{t('schedule:matrix.brushActive')}:</span>
          <span dir="ltr" className="font-bold" style={{ unicodeBidi: 'isolate' }}>
            {brushEmployeeCodes.join(' + ')}
          </span>
          <button onClick={onClearBrush} className="ms-auto flex items-center gap-1 text-[11px] hover:text-ink">
            <X className="h-3 w-3" /> {t('schedule:matrix.cancelBrush')}
          </button>
        </div>
      )}

      {selectedCellCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-primary-teal/10 border border-primary-teal/20 px-3 py-2 text-xs font-medium text-primary-teal">
          <span>{t('schedule:matrix.cellsSelected', { count: selectedCellCount })}</span>
          <Button size="sm" variant="primary" onClick={onBulkAssign} className="bg-primary-teal hover:bg-primary-teal/90 border-0 text-white text-[11px] px-2.5 py-1">
            {t('schedule:matrix.assignEmployee')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onBulkClear} className="text-[11px] px-2.5 py-1 text-slate-600 hover:text-ink hover:bg-white/50">
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
