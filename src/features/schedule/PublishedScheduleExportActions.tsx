import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { orderLateScheduleRows } from '@/lib/lateScheduleOrder';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';
import type { PublishedScheduleTab } from './PublishedScheduleSurface';

interface PublishedScheduleExportActionsProps {
  tab: PublishedScheduleTab;
  year: number;
  month: number;
  matrix: ScheduleMatrixData | null;
  otTable: { rows: OTShiftRow[]; units: OTUnit[] } | null;
  roster: UnifiedEmployee[];
}

function exportDays(year: number, month: number, locale: string) {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const dayNum = index + 1;
    const date = new Date(year, month, dayNum);
    return {
      dayNum,
      weekdayName: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
      isWeekend: date.getDay() === 5 || date.getDay() === 6,
    };
  });
}

export default function PublishedScheduleExportActions({
  tab,
  year,
  month,
  matrix,
  otTable,
  roster,
}: PublishedScheduleExportActionsProps) {
  const { t, i18n } = useTranslation(['schedule', 'common']);
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);
  const unavailable = tab === 'schedule' ? !matrix : !otTable;
  const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month, 1));

  const exportSchedule = async (format: 'excel' | 'pdf') => {
    if (!matrix) return;
    const exportModule = await import('@/lib/scheduleMatrixExport');
    const labels = exportModule.buildScheduleMatrixExportLabels(t, monthLabel, year);
    const options = {
      dir: 'ltr' as const,
      monthName: exportModule.getEnglishMonthName(month),
      year,
    };
    if (format === 'excel') exportModule.exportScheduleMatrixToExcel(matrix, labels, options);
    else exportModule.printScheduleMatrixPdf(matrix, labels, options);
  };

  const exportOT = async (format: 'excel' | 'pdf') => {
    if (!otTable) return;
    const exportModule = await import('@/lib/lateScheduleExport');
    const orderedRows = orderLateScheduleRows(otTable.rows, otTable.units);
    const title = t('schedule:publishedTables.otExportTitle', { month: monthLabel });
    const days = exportDays(year, month, locale);
    if (format === 'excel') await exportModule.exportLateScheduleExcel(orderedRows, roster, title, year, month, days);
    else exportModule.exportLateSchedulePdf(orderedRows, roster, title, year, days, i18n.dir() === 'rtl');
  };

  const run = async (format: 'excel' | 'pdf') => {
    setBusy(format);
    try {
      if (tab === 'schedule') await exportSchedule(format);
      else await exportOT(format);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" data-testid="published-export-actions">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={unavailable}
        loading={busy === 'excel'}
        icon={<FileSpreadsheet className="h-4 w-4" />}
        onClick={() => void run('excel')}
      >
        {t('schedule:toolbar.exportExcel')}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={unavailable}
        loading={busy === 'pdf'}
        icon={<FileText className="h-4 w-4" />}
        onClick={() => void run('pdf')}
      >
        {t('schedule:toolbar.exportPDF')}
      </Button>
    </div>
  );
}
