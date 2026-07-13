import { BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Printer, Search, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

interface LateScheduleToolbarProps {
  monthLabel: string;
  search: string;
  canEdit: boolean;
  showStats: boolean;
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
    <header className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-700 dark:text-pink-300">
            <Timer className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary">{isRtl ? 'جدول OT' : 'OT Schedule'}</h1>
            <p className="truncate text-xs text-text-secondary">{isRtl ? 'العمل الإضافي والشفتات التخصصية' : 'Overtime & specialty coverage'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <button type="button" onClick={props.onPreviousMonth} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label={isRtl ? 'الشهر السابق' : 'Previous month'}>
            {isRtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <span className="min-w-36 rounded-xl border border-border bg-surface-muted px-4 py-3 text-center text-sm font-bold text-text-primary">{props.monthLabel}</span>
          <button type="button" onClick={props.onNextMonth} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface hover:bg-hover focus:outline-none focus:ring-2 focus:ring-primary/40" aria-label={isRtl ? 'الشهر التالي' : 'Next month'}>
            {isRtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        <div className="relative min-w-0 flex-1 xl:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder={isRtl ? 'بحث في شفتات أو موظفين...' : 'Search shifts or employees...'}
            aria-label={isRtl ? 'بحث في شفتات أو موظفين' : 'Search shifts or employees'}
            className="input-field min-h-11 ps-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-11" icon={<BarChart3 className="h-4 w-4" />} onClick={props.onToggleStats}>
            {props.showStats ? (isRtl ? 'إخفاء الإحصائيات' : 'Hide stats') : (isRtl ? 'عرض الإحصائيات' : 'Show stats')}
          </Button>
          <Button variant="secondary" className="min-h-11" icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />} onClick={props.onExportExcel}>{isRtl ? 'Excel' : 'Excel'}</Button>
          <Button variant="secondary" className="min-h-11" icon={<Printer className="h-4 w-4" />} onClick={props.onExportPdf}>PDF</Button>
          {props.canEdit && <Button className="min-h-11" icon={<Plus className="h-4 w-4" />} onClick={props.onAddShift}>{isRtl ? 'إضافة شفت OT' : 'Add OT shift'}</Button>}
        </div>
      </div>
    </header>
  );
}
