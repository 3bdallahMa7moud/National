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
  onEmployeeClick: (employeeId: string) => void;
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
      className={cn(
        'flex flex-col rounded-lg border border-gray-300 bg-white shadow-soft',
        'w-[200px] min-w-[200px] overflow-hidden',
      )}
    >
      {/* Header */}
      <div className="border-b border-gray-300 bg-slate-50 px-3 py-2.5">
        <h3 className="text-xs font-bold text-ink">
          {t('schedule:matrix.legendTitle')}
        </h3>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {months[month] || ''} {year}
        </p>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 max-h-[60vh]">
        {legend.map((entry, idx) => {
          const empId = codeToId.get(entry.code) || '';
          const isActive = highlightedEmployeeId === empId;
          const isBrushSelected = brushEmployeeCodes.includes(entry.code);

          return (
            <button
              key={entry.code}
              onClick={() => onEmployeeClick(empId)}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-right',
                'border-b border-gray-200 last:border-b-0',
                'transition-colors duration-100 hover:bg-slate-50',
                isActive && 'bg-signal-cyan/10',
                isBrushSelected && 'bg-violet-50',
              )}
            >
              <span className="text-[10px] text-slate-500 font-medium w-4 text-center shrink-0">
                {idx + 1}
              </span>
              <span
                dir="ltr"
                className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-md min-w-[28px] text-center shrink-0',
                  'bg-slate-100 border border-slate-200 text-ink',
                  isActive && 'bg-signal-cyan/20 text-primary-teal border-primary-teal/30',
                  isBrushSelected && 'bg-violet-100 text-violet-800 border-violet-300',
                )}
                style={{ unicodeBidi: 'isolate' }}
              >
                {entry.code}
              </span>
              <span className="text-xs font-semibold text-ink truncate">
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
