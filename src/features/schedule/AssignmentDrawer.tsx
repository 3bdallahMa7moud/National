// ============================================================
// AssignmentDrawer - Employee assignment slide-out panel
// ============================================================
// Primary + Secondary shown side-by-side (2-col grid).
// Additional employees (#3, #4 …) stack below in the same grid.
// Supports Enter-to-select in every combobox.

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { validateAssignment } from '@/lib/validateAssignment';
import { getShiftChipStyle } from '@/components/schedule/ScheduleMatrix/getShiftChipClasses';
import { EmployeeCombobox } from './EmployeeCombobox';
import type {
  Assignment,
  LegendEmployee,
  ScheduleMatrixData,
  ShiftColorKey,
  ValidateResult,
} from '@/types/scheduleMatrix';

interface AssignmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ScheduleMatrixData;
  cell: {
    facilityId: string;
    facilityName: string;
    unitId: string;
    unitName: string;
    rowId: string;
    shiftLabel: string;
    timeRange: string;
    defaultColorKey: ShiftColorKey;
    day: number;
  } | null;
  currentAssignments: Assignment[];
  legend: LegendEmployee[];
  onSave: (rowId: string, day: number, assignments: Assignment[]) => void;
  onClear: (rowId: string, day: number) => void;
}

/** Slot label: Primary → Secondary → #3 → #4 … */
function useSlotLabel() {
  const { t } = useTranslation(['schedule']);
  return (index: number) => {
    if (index === 0) return t('schedule:assignment.primary');
    if (index === 1) return t('schedule:assignment.secondary');
    return `#${index + 1}`;
  };
}

function AssignmentDrawer({
  isOpen,
  onClose,
  data,
  cell,
  currentAssignments = [],
  legend,
  onSave,
  onClear,
}: AssignmentDrawerProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const slotLabel = useSlotLabel();

  // slots[i] = employee code | null (empty)
  const [slots, setSlots] = useState<(string | null)[]>([null, null]);

  // Sync from currentAssignments when drawer opens
  useEffect(() => {
    if (isOpen && cell) {
      const loaded: (string | null)[] = currentAssignments.map((a) => a.employeeCode);
      // Always keep at least 2 slots (Primary + Secondary)
      while (loaded.length < 2) loaded.push(null);
      setSlots(loaded);
    }
  }, [isOpen, cell, currentAssignments]);

  // ── codeToId lookup ─────────────────────────────────────────
  const codeToId = useMemo(() => {
    const map = new Map<string, string>();
    if (!data || !data.facilities) return map;
    for (const facility of data.facilities)
      for (const unit of facility?.units || [])
        for (const row of unit?.rows || [])
          for (const day of Object.keys(row?.cellsByDay || {}))
            for (const a of (row.cellsByDay[Number(day)] || []))
              if (a?.employeeCode) map.set(a.employeeCode, a.employeeId);
    (legend || []).forEach((e) => { if (e?.code && !map.has(e.code)) map.set(e.code, e.employeeId); });
    return map;
  }, [data, legend]);

  // ── Validation ───────────────────────────────────────────────
  const validate = useCallback(
    (code: string): ValidateResult => {
      if (!cell || !data || !data.facilities) return { ok: true };
      return validateAssignment(data, {
        facilityId: cell.facilityId,
        unitId: cell.unitId,
        rowId: cell.rowId,
        day: cell.day,
        employeeId: codeToId.get(code) || '',
        timeRange: cell.timeRange,
      });
    },
    [cell, data, codeToId],
  );

  // ── Derived ──────────────────────────────────────────────────
  const filledCodes = slots.filter((s): s is string => s !== null);
  const hasConflict = filledCodes.some((c) => !validate(c).ok);
  const canSave = filledCodes.length > 0 && !hasConflict;
  const selectedCount = filledCodes.length;

  // ── Build assignments array ──────────────────────────────────
  const buildAssignments = useCallback(
    (s: (string | null)[]): Assignment[] =>
      s.filter((c): c is string => c !== null).map((code) => ({
        employeeId: codeToId.get(code) || '',
        employeeCode: code,
      })),
    [codeToId],
  );

  const persistNow = useCallback(
    (updatedSlots: (string | null)[]) => {
      if (!cell) return;
      onSave(cell.rowId, cell.day, buildAssignments(updatedSlots));
    },
    [cell, onSave, buildAssignments],
  );

  // ── Slot mutations ───────────────────────────────────────────
  const handleChange = (index: number, code: string | null) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? code : s)));
  };

  const handleRemove = (index: number) => {
    setSlots((prev) => {
      let next = prev.map((s, i) => (i === index ? null : s));
      // Trim trailing nulls beyond the mandatory 2 slots
      while (next.length > 2 && next[next.length - 1] === null) {
        next = next.slice(0, -1);
      }
      persistNow(next);
      return next;
    });
  };

  const handleAddSlot = () => {
    setSlots((prev) => [...prev, null]);
  };

  // ── Save / clear ─────────────────────────────────────────────
  const handleSave = () => {
    if (!cell || !canSave) return;
    onSave(cell.rowId, cell.day, buildAssignments(slots));
    onClose();
  };

  const handleClear = () => {
    if (!cell) return;
    onClear(cell.rowId, cell.day);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };

  // ── Per-slot legend: exclude codes used in other slots ──────
  const legendForSlot = useCallback(
    (index: number): LegendEmployee[] => {
      const others = new Set(
        slots.filter((s, i) => i !== index && s !== null) as string[],
      );
      return (legend || []).filter((e) => e?.code && !others.has(e.code));
    },
    [legend, slots],
  );

  const activeRow = useMemo(() => {
    if (!cell || !data || !data.facilities) return undefined;
    return data.facilities
      .find((facility) => facility?.id === cell.facilityId)
      ?.units?.find((unit) => unit?.id === cell.unitId)
      ?.rows?.find((row) => row?.id === cell.rowId);
  }, [cell, data]);

  if (!isOpen || !cell) return null;

  const shiftColorKey = activeRow?.colorKey ?? cell.defaultColorKey;
  const shiftStyle = getShiftChipStyle(
    shiftColorKey,
    activeRow?.backgroundColor,
    activeRow?.textColor,
  );
  const shiftLabel = activeRow?.shiftLabel || activeRow?.rowLabel || cell.shiftLabel;
  const shiftTimeRange = activeRow?.timeRange || cell.timeRange;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] dark:bg-black/45"
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed top-0 z-50 flex h-full w-full max-w-[520px] flex-col',
          'border-s border-border bg-surface shadow-dropdown',
          'inset-inline-end-0 animate-slideIn',
        )}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label={t('schedule:assignment.assignTitle')}
      >
        {/* ── Header ── */}
        <header className="border-b border-border bg-surface px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-text-primary">
                {t('schedule:assignment.assignTitle')}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-secondary">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1">
                  <CalendarDays className="h-3.5 w-3.5 text-primary-teal" />
                  {t('schedule:assignment.drawerDay')} {cell.day}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-teal" />
                  <span className="truncate">
                    {cell.facilityName} / {cell.unitName}
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                  style={shiftStyle}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {shiftLabel} ({shiftTimeRange})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
              aria-label={t('schedule:assignment.close')}
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">

          {/* Shift type pill */}
          <section className="rounded-xl border border-border bg-surface-muted/35 p-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                {t('schedule:assignment.shiftType')}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-text-secondary">
                {t('schedule:assignment.shiftColorFromRow')}
              </p>
            </div>
            <div
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"
              style={shiftStyle}
              data-testid="row-shift-color"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
              <span>{shiftLabel}</span>
            </div>
          </section>

          {/* Conflict banner */}
          {hasConflict && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger-500/10 px-3 py-2.5 text-xs font-bold text-danger">
              <span>{t('schedule:assignment.cannotSaveConflict')}</span>
            </div>
          )}

          {/* Employee slots */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  {t('schedule:assignment.selectedEmployees')}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-text-muted">
                  {t('schedule:assignment.selectedCount', { count: selectedCount })}
                </p>
              </div>
            </div>

            {/* Render slots in rows of 2 */}
            {Array.from({ length: Math.ceil(slots.length / 2) }, (_, rowIdx) => {
              const a = rowIdx * 2;
              const b = a + 1;
              return (
                <div key={rowIdx} className="grid gap-3 sm:grid-cols-2">
                  {[a, b].map((idx) =>
                    idx < slots.length ? (
                      <EmployeeCombobox
                        key={idx}
                        label={slotLabel(idx)}
                        legend={legendForSlot(idx)}
                        value={slots[idx]}
                        onChange={(code) => handleChange(idx, code)}
                        onRemove={() => handleRemove(idx)}
                        onValidate={validate}
                      />
                    ) : (
                      // Filler — keeps grid alignment when odd number of slots
                      <div key={idx} />
                    ),
                  )}
                </div>
              );
            })}

            {/* Add extra employee button */}
            <button
              type="button"
              onClick={handleAddSlot}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5',
                'text-xs font-bold text-text-muted transition-colors',
                'hover:border-primary-teal/50 hover:bg-primary-teal/5 hover:text-primary-teal',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('schedule:assignment.addEmployee')}
            </button>
          </section>
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-border bg-surface px-5 py-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors',
                canSave
                  ? 'bg-primary-teal text-white shadow-sm hover:bg-primary-teal/90'
                  : 'cursor-not-allowed bg-surface-muted text-text-muted',
              )}
              title={
                hasConflict
                  ? t('schedule:assignment.cannotSaveConflict')
                  : t('schedule:assignment.saveTitle')
              }
            >
              {t('schedule:assignment.save')}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-danger/30 bg-danger-500/10 px-4 text-sm font-bold text-danger transition-colors hover:bg-danger hover:text-white"
            >
              {t('schedule:matrix.clearCell')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface-muted px-4 text-sm font-bold text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
            >
              {t('schedule:assignment.cancel')}
            </button>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        [dir="rtl"] .animate-slideIn {
          animation: slideInRTL 0.25s ease-out;
        }
        @keyframes slideInRTL {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </>
  );
}

export default memo(AssignmentDrawer);
