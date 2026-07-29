import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileSpreadsheet,
  LayoutGrid,
  LayoutList,
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
  onAddShift(): void;
}

export default function LateScheduleToolbar(props: LateScheduleToolbarProps) {
  const { t, i18n } = useTranslation(['schedule']);
  const isRtl = i18n.language === 'ar';

  return (
    <header className="rounded-2xl border border-border bg-surface p-4 shadow-soft space-y-4">
      {/* Top row: Title + Month Switcher + View Mode Toggle */}
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

        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted p-1">
            <button type="button" onClick={props.onPreviousMonth} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm" aria-label={isRtl ? 'الشهر السابق' : 'Previous month'}>
              {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <span className="min-w-32 px-3 text-center text-xs sm:text-sm font-bold text-text-primary">{props.monthLabel}</span>
            <button type="button" onClick={props.onNextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm" aria-label={isRtl ? 'الشهر التالي' : 'Next month'}>
              {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-border bg-surface-muted p-1 text-xs font-bold" role="tablist" aria-label={isRtl ? 'طريقة عرض جدول OT' : 'OT schedule view mode'}>
            <button
              type="button"
              role="tab"
              aria-selected={props.viewMode === 'auto'}
              onClick={() => props.onViewModeChange('auto')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${props.viewMode === 'auto' ? 'bg-surface text-primary shadow-sm font-extrabold' : 'text-text-secondary hover:text-text-primary'}`}
              title={isRtl ? 'تلقائي حسب حجم الشاشة' : 'Auto based on screen size'}
            >
              <Smartphone className="h-3.5 w-3.5 sm:hidden" />
              <LayoutGrid className="hidden h-3.5 w-3.5 sm:inline" />
              <span>{isRtl ? 'تلقائي' : 'Auto'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={props.viewMode === 'grid'}
              onClick={() => props.onViewModeChange('grid')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${props.viewMode === 'grid' ? 'bg-surface text-primary shadow-sm font-extrabold' : 'text-text-secondary hover:text-text-primary'}`}
              title={isRtl ? 'عرض الشبكة الشهرية الكاملة' : 'Full monthly table grid'}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{isRtl ? 'شبكة الشهر' : 'Grid'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={props.viewMode === 'week'}
              onClick={() => props.onViewModeChange('week')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${props.viewMode === 'week' ? 'bg-surface text-primary shadow-sm font-extrabold' : 'text-text-secondary hover:text-text-primary'}`}
              title={isRtl ? 'عرض الأسبوع بالبطاقات' : 'Weekly cards view'}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>{isRtl ? 'الأسبوع' : 'Week'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Export and Add actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
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
            <span className="text-xs font-bold sm:text-sm">{t('toolbar.publishToEmployees')}</span>
          </Button>
        )}
        <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} onClick={props.onExportExcel}>
          <span className="text-xs sm:text-sm">{isRtl ? 'Excel' : 'Excel'}</span>
        </Button>
        <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<Printer className="h-4 w-4" />} onClick={props.onExportPdf}>
          <span className="text-xs sm:text-sm">PDF</span>
        </Button>
        {props.canEdit && props.isEditMode && (
          <Button className="min-h-11 w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={props.onAddShift}>
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
