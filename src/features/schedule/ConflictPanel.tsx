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
  facilityA: string;
  unitA: string;
  shiftA: string;
  facilityB: string;
  unitB: string;
  shiftB: string;
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

    // Index: build employee assignments across facilities
    const empIndex = new Map<string, Array<{
      facilityId: string; facilityName: string; unitName: string;
      shiftLabel: string; rowId: string; day: number; timeRange: string;
    }>>();

    for (const f of data.facilities) {
      for (const u of f.units) {
        for (const r of u.rows) {
          for (const dayStr of Object.keys(r.cellsByDay)) {
            const day = Number(dayStr);
            for (const a of r.cellsByDay[day]) {
              if (!a.hasConflict) continue;
              if (!empIndex.has(a.employeeId)) empIndex.set(a.employeeId, []);
              empIndex.get(a.employeeId)!.push({
                facilityId: f.id, facilityName: f.name, unitName: u.name,
                shiftLabel: r.shiftLabel, rowId: r.id, day, timeRange: r.timeRange,
              });
            }
          }
        }
      }
    }

    // Find pairs
    for (const [empId, entries] of empIndex) {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i];
          const b = entries[j];
          if (a.day !== b.day || a.facilityId === b.facilityId) continue;
          const key = `${empId}-${a.day}-${a.facilityId}-${b.facilityId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const legend = data.legend.find(
            (l) => data.vacations.find((v) => v.employeeId === empId)?.employeeCode === l.code
              || entries.some((e) => {
                // Find code from the assignments
                for (const f of data.facilities) {
                  for (const u of f.units) {
                    for (const r of u.rows) {
                      for (const d of Object.keys(r.cellsByDay)) {
                        for (const assignment of r.cellsByDay[Number(d)]) {
                          if (assignment.employeeId === empId) {
                            return l.code === assignment.employeeCode;
                          }
                        }
                      }
                    }
                  }
                }
                return false;
              }),
          );

          result.push({
            employeeCode: legend?.code || empId,
            employeeName: legend?.fullName || empId,
            day: a.day,
            facilityA: a.facilityName,
            unitA: a.unitName,
            shiftA: a.shiftLabel,
            facilityB: b.facilityName,
            unitB: b.unitName,
            shiftB: b.shiftLabel,
          });
        }
      }
    }

    return result;
  }, [data]);

  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-lg border border-alert-coral/30 bg-red-50 shadow-soft overflow-hidden">
      {/* Banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-red-100/50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-alert-coral shrink-0" />
        <span className="text-xs font-bold text-alert-coral">
          {t('schedule:conflict.panelTitle', { count: conflicts.length })}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-alert-coral ms-auto transition-transform duration-200',
          expanded && 'rotate-180',
        )} />
      </button>

      {/* Detail list */}
      {expanded && (
        <div className="border-t border-alert-coral/20">
          {conflicts.map((c, i) => (
            <div
              key={`${c.employeeCode}-${c.day}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-alert-coral/10 last:border-b-0 text-xs"
            >
              <span dir="ltr" className="font-bold text-ink shrink-0" style={{ unicodeBidi: 'isolate' }}>
                {c.employeeCode}
              </span>
              <span className="text-slate-500">—</span>
              <span className="text-ink">{t('schedule:conflict.dayLabel', { day: c.day })}</span>
              <span className="text-slate-500">—</span>
              <span dir="ltr" className="text-alert-coral font-medium" style={{ unicodeBidi: 'isolate' }}>
                {c.facilityA}/{c.unitA}/{c.shiftA}
              </span>
              <span className="text-slate-500">vs</span>
              <span dir="ltr" className="text-alert-coral font-medium" style={{ unicodeBidi: 'isolate' }}>
                {c.facilityB}/{c.unitB}/{c.shiftB}
              </span>
              {onJumpToCell && (
                <button
                  onClick={() => onJumpToCell(c.facilityA, '', c.day)}
                  className="ms-auto text-primary-teal hover:text-ink"
                  title={t('schedule:conflict.jumpToCell')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
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
