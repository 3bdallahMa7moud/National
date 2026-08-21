import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  LayoutGrid,
  LayoutList,
  ListOrdered,
  Plus,
  Printer,
  Save,
  Smartphone,
  Tag,
  Timer,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { SCHEDULE_CELL_MARKER_SWATCHES } from '@/lib/scheduleCellMarkers';
import type { CellMarkerTool } from '@/types/scheduleMatrix';

export type OTViewMode = 'auto' | 'grid' | 'week';

interface LateScheduleToolbarProps {
  monthLabel: string;
  canEdit: boolean;
  isEditMode: boolean;
  onToggleEdit(): void;
  activeCellMarkerTool: CellMarkerTool | null;
  onCellMarkerToolChange(tool: CellMarkerTool): void;
  canPublish: boolean;
  onPublish(): void;
  viewMode: OTViewMode;
  onViewModeChange(mode: OTViewMode): void;
  onPreviousMonth(): void;
  onNextMonth(): void;
  onExportExcel(): void;
  onExportPdf(): void;
  exporting?: 'excel' | 'pdf' | null;
  onAddShift(): void;
  adminTab?: 'schedule' | 'structure';
  onAdminTabChange?(tab: 'schedule' | 'structure'): void;
}

export default function LateScheduleToolbar(props: LateScheduleToolbarProps) {
  const { t, i18n } = useTranslation(['schedule']);
  const isRtl = i18n.language === 'ar';
  const adminTab = props.adminTab ?? 'schedule';

  return (
    <header className="w-full min-w-0 space-y-4 overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-soft sm:p-4">
      {/* Top row: Title + Navigation + Mode Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-700 dark:text-pink-300">
            <Timer className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary">{isRtl ? 'جدول OT' : 'OT Schedule'}</h1>
            <p className="truncate text-xs text-text-secondary">{isRtl ? 'العمل الإضافي والشفتات التخصصية' : 'Overtime & specialty coverage'}</p>
          </div>
        </div>

        {/* Admin Tabs (Schedule vs Structure) */}
        {props.canEdit && props.onAdminTabChange && (
          <div className="grid w-full min-w-0 grid-cols-2 items-center rounded-xl border border-border bg-surface-muted p-1 text-xs font-bold sm:flex sm:w-auto" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={adminTab === 'schedule'}
              onClick={() => props.onAdminTabChange?.('schedule')}
              className={cn(
                'flex min-w-0 items-center justify-center gap-2 rounded-lg px-2.5 py-2 transition-all sm:px-3.5',
                adminTab === 'schedule'
                  ? 'bg-surface text-primary shadow-sm font-extrabold'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{isRtl ? 'جدول المناوبات' : 'Schedule Grid'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={adminTab === 'structure'}
              onClick={() => props.onAdminTabChange?.('structure')}
              className={cn(
                'flex min-w-0 items-center justify-center gap-2 rounded-lg px-2.5 py-2 transition-all sm:px-3.5',
                adminTab === 'structure'
                  ? 'bg-surface text-primary shadow-sm font-extrabold'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <ListOrdered className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{isRtl ? 'هيكل وترتيب الجدول' : 'Structure & Order'}</span>
            </button>
          </div>
        )}

        <div className="grid w-full min-w-0 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-start">
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-surface-muted p-1">
            <button type="button" onClick={props.onPreviousMonth} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm" aria-label={isRtl ? 'الشهر السابق' : 'Previous month'}>
              {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <span className="min-w-0 flex-1 truncate px-2 text-center text-xs font-bold text-text-primary sm:min-w-32 sm:px-3 sm:text-sm">{props.monthLabel}</span>
            <button type="button" onClick={props.onNextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm" aria-label={isRtl ? 'الشهر التالي' : 'Next month'}>
              {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="grid min-w-0 grid-cols-3 items-center rounded-xl border border-border bg-surface-muted p-1 text-xs font-bold sm:flex" role="tablist" aria-label={isRtl ? 'طريقة عرض جدول OT' : 'OT schedule view mode'}>
            <button
              type="button"
              role="tab"
              aria-selected={props.viewMode === 'auto'}
              onClick={() => props.onViewModeChange('auto')}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors sm:px-2.5 ${props.viewMode === 'auto' ? 'bg-surface text-primary shadow-sm font-extrabold' : 'text-text-secondary hover:text-text-primary'}`}
              title={isRtl ? 'تلقائي حسب حجم الشاشة' : 'Auto based on screen size'}
            >
              <Smartphone className="h-3.5 w-3.5 shrink-0 sm:hidden" />
              <LayoutGrid className="hidden h-3.5 w-3.5 sm:inline" />
              <span className="min-w-0 truncate">{isRtl ? 'تلقائي' : 'Auto'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={props.viewMode === 'grid'}
              onClick={() => props.onViewModeChange('grid')}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors sm:px-2.5 ${props.viewMode === 'grid' ? 'bg-surface text-primary shadow-sm font-extrabold' : 'text-text-secondary hover:text-text-primary'}`}
              title={isRtl ? 'عرض الشبكة الشهرية الكاملة' : 'Full monthly table grid'}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{isRtl ? 'شبكة الشهر' : 'Grid'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={props.viewMode === 'week'}
              onClick={() => props.onViewModeChange('week')}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors sm:px-2.5 ${props.viewMode === 'week' ? 'bg-surface text-primary shadow-sm font-extrabold' : 'text-text-secondary hover:text-text-primary'}`}
              title={isRtl ? 'عرض الأسبوع بالبطاقات' : 'Weekly cards view'}
            >
              <LayoutList className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{isRtl ? 'الأسبوع' : 'Week'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Export and Add actions */}
      <div className="grid grid-cols-2 items-stretch gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        {props.canEdit && (
          <Button
            className="min-h-11 flex-1 sm:flex-initial"
            variant={props.isEditMode ? 'primary' : 'secondary'}
            icon={<Edit3 className="h-4 w-4" />}
            onClick={props.onToggleEdit}
            aria-pressed={props.isEditMode}
          >
            <span className="text-xs font-bold sm:text-sm">{isRtl ? 'تعديل' : 'Edit'}</span>
          </Button>
        )}
        {props.canEdit && (
          <Button
            className="min-h-11 flex-1 border-0 bg-primary-teal text-white sm:flex-initial"
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={props.onPublish}
            disabled={!props.canPublish}
            title={props.canPublish
              ? t('toolbar.publishToEmployees')
              : t('toolbar.noDraftToPublish')}
          >
            <span className="min-w-0 truncate text-xs font-bold sm:text-sm">{t('toolbar.publishToEmployees')}</span>
          </Button>
        )}
        <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} onClick={props.onExportExcel} loading={props.exporting === 'excel'} disabled={Boolean(props.exporting)}>
          <span className="text-xs sm:text-sm">{isRtl ? 'Excel' : 'Excel'}</span>
        </Button>
        <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<Printer className="h-4 w-4" />} onClick={props.onExportPdf} loading={props.exporting === 'pdf'} disabled={Boolean(props.exporting)}>
          <span className="text-xs sm:text-sm">PDF</span>
        </Button>
        {props.canEdit && props.isEditMode && (
          <Button className="col-span-2 min-h-11 w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={props.onAddShift}>
            <span className="text-xs sm:text-sm font-bold">{isRtl ? 'إضافة شفت OT' : 'Add OT shift'}</span>
          </Button>
        )}
      </div>

      {props.canEdit && (
        <fieldset
          className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2.5"
          disabled={!props.isEditMode}
        >
          <legend className="sr-only">{t('markers.controlLabel')}</legend>
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
            <Tag className="h-4 w-4 text-primary-teal" aria-hidden="true" />
            <span>{t('markers.controlLabel')}</span>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5" role="group" aria-label={t('markers.paletteLabel')}>
            {SCHEDULE_CELL_MARKER_SWATCHES.map(({ color, hex }) => {
              const colorLabel = t(`markers.colors.${color}`);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => props.onCellMarkerToolChange(color)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    props.activeCellMarkerTool === color
                      ? 'border-primary-teal bg-primary-teal/15 text-primary-teal ring-2 ring-primary-teal/25'
                      : 'border-border bg-surface text-text-secondary hover:bg-hover',
                  )}
                  aria-pressed={props.activeCellMarkerTool === color}
                  aria-label={t('markers.colorAction', { color: colorLabel })}
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
              onClick={() => props.onCellMarkerToolChange('remove')}
              className={cn(
                'min-h-11 rounded-md border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                props.activeCellMarkerTool === 'remove'
                  ? 'border-primary-teal bg-primary-teal/15 text-primary-teal ring-2 ring-primary-teal/25'
                  : 'border-border bg-surface text-text-secondary hover:bg-hover',
              )}
              aria-pressed={props.activeCellMarkerTool === 'remove'}
            >
              {t('markers.remove')}
            </button>
          </div>
          <span className="text-[11px] text-text-muted">
            {!props.isEditMode
              ? t('markers.editFirst')
              : props.activeCellMarkerTool
                ? t('markers.activeHint')
                : t('markers.chooseFirst')}
          </span>
        </fieldset>
      )}

      {props.canEdit && props.canPublish && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <Save className="h-4 w-4" aria-hidden="true" />
          <span className="font-bold">{t('toolbar.draftSaved')}</span>
          <span>{t('toolbar.draftPrivateNotice')}</span>
        </div>
      )}
    </header>
  );
}
