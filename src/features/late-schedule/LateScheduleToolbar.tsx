import { BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet, LayoutGrid, LayoutList, Plus, Printer, Search, Smartphone, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

export type OTViewMode = 'auto' | 'grid' | 'week';

interface LateScheduleToolbarProps {
  monthLabel: string;
  search: string;
  canEdit: boolean;
  showStats: boolean;
  viewMode: OTViewMode;
  onViewModeChange(mode: OTViewMode): void;
  onSearch(value: string): void;
  onPreviousMonth(): void;
  onNextMonth(): void;
  onToggleStats(): void;
  onExportExcel(): void;
  onExportPdf(): void;
  onAddShift(): void;
}

export default function LateScheduleToolbar(props: LateScheduleToolbarProps) {
  const { i18n } = useTranslation();
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

      {/* Bottom row: Search + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder={isRtl ? 'بحث في شفتات أو موظفين...' : 'Search shifts or employees...'}
            aria-label={isRtl ? 'بحث في شفتات أو موظفين' : 'Search shifts or employees'}
            className="input-field min-h-11 ps-10 w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<BarChart3 className="h-4 w-4" />} onClick={props.onToggleStats}>
            <span className="text-xs sm:text-sm">{props.showStats ? (isRtl ? 'إخفاء الإحصائيات' : 'Hide stats') : (isRtl ? 'عرض الإحصائيات' : 'Show stats')}</span>
          </Button>
          <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} onClick={props.onExportExcel}>
            <span className="text-xs sm:text-sm">{isRtl ? 'Excel' : 'Excel'}</span>
          </Button>
          <Button variant="secondary" className="min-h-11 flex-1 sm:flex-initial" icon={<Printer className="h-4 w-4" />} onClick={props.onExportPdf}>
            <span className="text-xs sm:text-sm">PDF</span>
          </Button>
          {props.canEdit && (
            <Button className="min-h-11 w-full sm:w-auto" icon={<Plus className="h-4 w-4" />} onClick={props.onAddShift}>
              <span className="text-xs sm:text-sm font-bold">{isRtl ? 'إضافة شفت OT' : 'Add OT shift'}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
