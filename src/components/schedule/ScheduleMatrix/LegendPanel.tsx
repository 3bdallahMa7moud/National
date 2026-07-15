// ============================================================
// LegendPanel — Employee code → full name mapping
// ============================================================

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface LegendPanelProps {
  legend: { code: string; fullName: string }[];
  month: number;
  year: number;
  highlightedEmployeeId: string | null;
  brushEmployeeCodes?: string[];
  onEmployeeClick?: (employeeId: string) => void;
  /** Map code → id */
  codeToId: Map<string, string>;
}



function LegendPanel({
  legend,
  month,
  year,
  highlightedEmployeeId,
  brushEmployeeCodes = [],
  onEmployeeClick,
  codeToId,
}: LegendPanelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const months = (t('schedule:months', { returnObjects: true }) as string[]) || [];

  return (
    <div
      data-testid="schedule-legend"
      className="flex w-[200px] min-w-[200px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-soft"
    >
      {/* Header */}
      <div className="border-b border-border bg-surface-muted px-3 py-2.5">
        <h3 className="text-xs font-bold text-ink">
          {t('schedule:matrix.legendTitle')}
        </h3>
        <p className="text-[10px] text-text-secondary mt-0.5">
          {months[month] || ''} {year}
        </p>
      </div>

      {/* Scrollable list */}
      <div className="max-h-[60vh] flex-1 overflow-y-auto">
        {legend.map((entry, idx) => {
          const empId = codeToId.get(entry.code) || '';
          const isActive = highlightedEmployeeId === empId;
          const isBrushSelected = brushEmployeeCodes.includes(entry.code);

          return (
            <button
              key={entry.code}
              type="button"
              disabled={!onEmployeeClick}
              onClick={() => onEmployeeClick?.(empId)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-right',
                'border-b border-border last:border-b-0',
                onEmployeeClick && 'transition-colors duration-100 hover:bg-hover',
                isActive && 'bg-signal-cyan/10',
                isBrushSelected && 'bg-violet-50',
              )}
            >
              <span className="text-[10px] text-text-secondary font-medium w-4 text-center shrink-0">
                {idx + 1}
              </span>
              <span
                dir="ltr"
                className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-md min-w-[28px] text-center shrink-0',
                  'bg-surface-muted border border-border text-ink',
                  isActive && 'bg-signal-cyan/20 text-primary-teal border-primary-teal/30',
                  isBrushSelected && 'bg-violet-100 text-violet-800 border-violet-300',
                )}
                style={{ unicodeBidi: 'isolate' }}
              >
                {entry.code}
              </span>
              <span className="truncate text-xs font-semibold text-ink">
                {entry.fullName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(LegendPanel);
