// ============================================================
// ConflictPanel — Conflict summary banner + detail list
// ============================================================

import { memo, useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

interface ConflictInfo {
  employeeCode: string;
  employeeName: string;
  day: number;
  facilityIdA: string;
  rowIdA: string;
  labelA: string;
  labelB: string;
  reason: string;
  type: 'crossFacility' | 'vacation' | 'timeOverlap';
}

interface ConflictPanelProps {
  data: ScheduleMatrixData;
  onJumpToCell?: (facilityId: string, rowId: string, day: number) => void;
}

function ConflictPanel({ data, onJumpToCell }: ConflictPanelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [expanded, setExpanded] = useState(false);

  // Build conflict list
  const conflicts = useMemo<ConflictInfo[]>(() => {
    if (!data) return [];
    const result: ConflictInfo[] = [];
    const seen = new Set<string>();

    for (const f of data.facilities) {
      for (const u of f.units) {
        for (const r of u.rows) {
          for (const dayStr of Object.keys(r.cellsByDay)) {
            const day = Number(dayStr);
            for (const a of r.cellsByDay[day]) {
              if (!a.hasConflict) continue;

              const key = `${a.employeeId}-${day}-${a.conflictType}`;
              if (seen.has(key)) continue;
              seen.add(key);

              const legend = data.legend.find((l) => l.code === a.employeeCode || l.employeeId === a.employeeId);
              const empName = legend?.fullName || a.employeeCode;

              if (a.conflictType === 'vacation') {
                result.push({
                  employeeCode: a.employeeCode,
                  employeeName: empName,
                  day,
                  facilityIdA: f.id,
                  rowIdA: r.id,
                  labelA: `${f.name}/${u.name}/${r.shiftLabel}`,
                  labelB: 'Approved Vacation',
                  reason: a.conflictReason || 'Approved vacation conflict',
                  type: 'vacation',
                });
              } else {
                result.push({
                  employeeCode: a.employeeCode,
                  employeeName: empName,
                  day,
                  facilityIdA: f.id,
                  rowIdA: r.id,
                  labelA: `${f.name}/${u.name}/${r.shiftLabel}`,
                  labelB: a.conflictReason || 'Shift schedule conflict',
                  reason: a.conflictReason || 'Shift schedule conflict',
                  type: a.conflictType || 'crossFacility',
                });
              }
            }
          }
        }
      }
    }

    return result;
  }, [data]);

  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-lg border border-alert-coral/30 bg-red-50 shadow-soft overflow-hidden my-2">
      {/* Banner */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-red-100/50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-alert-coral shrink-0" />
        <span className="text-xs font-bold text-alert-coral">
          {t('schedule:conflict.panelTitle', { defaultValue: '{{count}} conflicts this month', count: conflicts.length })}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-alert-coral ms-auto transition-transform duration-200',
          expanded && 'rotate-180',
        )} />
      </button>

      {/* Detail list */}
      {expanded && (
        <div className="border-t border-alert-coral/20 max-h-60 overflow-y-auto">
          {conflicts.map((c, i) => (
            <div
              key={`${c.employeeCode}-${c.day}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-alert-coral/10 last:border-b-0 text-xs"
            >
              <span dir="ltr" className="font-bold text-ink shrink-0" style={{ unicodeBidi: 'isolate' }}>
                {c.employeeCode} ({c.employeeName})
              </span>
              <span className="text-text-secondary">—</span>
              <span className="text-ink font-semibold">
                {t('schedule:conflict.dayLabel', { defaultValue: 'Day {{day}}', day: c.day })}
              </span>
              <span className="text-text-secondary">—</span>
              <span dir="ltr" className="text-alert-coral font-medium" style={{ unicodeBidi: 'isolate' }}>
                {c.labelA}
              </span>
              <span className="text-text-secondary">←</span>
              <span dir="ltr" className="text-alert-coral font-medium" style={{ unicodeBidi: 'isolate' }}>
                {c.labelB}
              </span>
              {onJumpToCell && (
                <button
                  type="button"
                  onClick={() => onJumpToCell(c.facilityIdA, c.rowIdA, c.day)}
                  className="ms-auto text-primary-teal hover:text-ink flex items-center gap-1 font-semibold shrink-0"
                  title={t('schedule:conflict.jumpToCell', { defaultValue: 'Jump to cell' })}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('schedule:conflict.jumpToCell', { defaultValue: 'Jump to cell' })}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ConflictPanel);

