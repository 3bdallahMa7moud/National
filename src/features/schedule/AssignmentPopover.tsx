// ============================================================
// AssignmentPopover - Inline cell editor anchored to a grid cell
// ============================================================

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarOff, Check, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { validateAssignmentsForCell } from '@/lib/validateAssignment';
import { SHIFT_COLOR_KEYS } from '@/lib/shiftColorOptions';
import { resolveAssignmentColorKey } from '@/lib/shiftColorOptions';
import type { Assignment, MatrixCellRef, ScheduleMatrixData, ShiftColorKey, ValidateResult } from '@/types/scheduleMatrix';

interface AssignmentPopoverProps {
  data: ScheduleMatrixData;
  cell: MatrixCellRef & {
    facilityName: string;
    unitName: string;
    shiftLabel: string;
    timeRange: string;
    defaultColorKey: ShiftColorKey;
  };
  anchorRect: DOMRect | null;
  currentAssignments: Assignment[];
  onClose: () => void;
  onSave: (rowId: string, day: number, assignments: Assignment[]) => void;
  onClear: (rowId: string, day: number) => void;
  onMarkVacation: (rowId: string, day: number, employeeId?: string) => void;
}

function AssignmentPopover({
  data,
  cell,
  anchorRect,
  currentAssignments,
  onClose,
  onSave,
  onClear,
  onMarkVacation,
}: AssignmentPopoverProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [search, setSearch] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() =>
    currentAssignments.map((assignment) => assignment.employeeCode),
  );
  const [colorKeysByCode, setColorKeysByCode] = useState<Record<string, ShiftColorKey>>(() => {
    const map: Record<string, ShiftColorKey> = {};
    currentAssignments.forEach((a) => {
      map[a.employeeCode] = a.colorKey || cell.defaultColorKey;
    });
    return map;
  });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedCodes(currentAssignments.map((assignment) => assignment.employeeCode).slice(0, 2));
    const map: Record<string, ShiftColorKey> = {};
    currentAssignments.forEach((a) => {
      map[a.employeeCode] = a.colorKey || cell.defaultColorKey;
    });
    setColorKeysByCode(map);
    setSearch('');
    const timeout = window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => window.clearTimeout(timeout);
  }, [currentAssignments, cell.rowId, cell.day, cell.defaultColorKey]);


  const filteredLegend = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.legend;
    return data.legend.filter((employee) =>
      employee.code.toLowerCase().includes(q) || employee.fullName.toLowerCase().includes(q),
    );
  }, [data.legend, search]);

  const selectedAssignments = useMemo<Assignment[]>(() =>
    selectedCodes.flatMap((code) => {
      const employee = data.legend.find((emp) => emp.code === code);
      if (!employee) return [];
      return [
        {
          employeeId: employee.employeeId,
          employeeCode: employee.code,
          colorKey: colorKeysByCode[code] || cell.defaultColorKey,
          status: 'draft',
        },
      ];
    }),
  [data.legend, selectedCodes, colorKeysByCode, cell.defaultColorKey]);

  const validation = useMemo<ValidateResult>(() => {
    if (selectedAssignments.length === 0) return { ok: true };
    return validateAssignmentsForCell(data, {
      facilityId: cell.facilityId,
      unitId: cell.unitId,
      rowId: cell.rowId,
      day: cell.day,
      timeRange: cell.timeRange,
      assignments: selectedAssignments,
    });
  }, [cell, data, selectedAssignments]);

  const handleSave = useCallback(() => {
    if (!validation.ok) return;
    onSave(cell.rowId, cell.day, selectedAssignments);
  }, [validation.ok, onSave, cell.rowId, cell.day, selectedAssignments]);

  const handleRemove = useCallback(() => {
    const originalCodes = currentAssignments.map((assignment) => assignment.employeeCode).slice(0, 2);
    const selectionChanged =
      selectedCodes.length !== originalCodes.length
      || selectedCodes.some((code, index) => code !== originalCodes[index]);

    if (selectionChanged) {
      handleSave();
      return;
    }
    onClear(cell.rowId, cell.day);
  }, [currentAssignments, selectedCodes, handleSave, onClear, cell.rowId, cell.day]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, handleSave]);

  const hasCurrentAssignments = currentAssignments.length > 0;
  const top = anchorRect ? Math.min(anchorRect.bottom + 8, window.innerHeight - 420) : 120;
  const left = anchorRect ? Math.max(16, Math.min(anchorRect.left, window.innerWidth - 340)) : 24;

  function toggleEmployee(code: string) {
    setSelectedCodes((current) => {
      if (current.includes(code)) {
        setColorKeysByCode((keys) => {
          const next = { ...keys };
          delete next[code];
          return next;
        });
        return current.filter((item) => item !== code);
      }
      setColorKeysByCode((keys) => ({
        ...keys,
        [code]: keys[code] || cell.defaultColorKey,
      }));
      return [...current, code].slice(0, 2);
    });
  }

  function setEmployeeColorKey(code: string, colorKey: ShiftColorKey) {
    setColorKeysByCode((keys) => ({ ...keys, [code]: colorKey }));
  }


  return (
    <>
      <button
        className="fixed inset-0 z-[220] cursor-default bg-transparent"
        aria-label={t('schedule:assignment.closeEditor')}
        onClick={onClose}
        type="button"
      />
      <div
        className="fixed z-[230] w-[320px] rounded-lg border border-gray-300 bg-white p-3 text-start shadow-2xl"
        style={{ top, left }}
        role="dialog"
        aria-label={t('schedule:assignment.editAssignment')}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink">
              {hasCurrentAssignments ? t('schedule:assignment.editTitle') : t('schedule:assignment.assignTitle')}
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              {t('schedule:matrix.day', { day: cell.day })} · {cell.shiftLabel} · <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{cell.facilityName}/{cell.unitName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label={t('schedule:assignment.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t('schedule:assignment.selectedEmployees')}
          </p>
          {[0, 1].map((slot) => {
            const code = selectedCodes[slot];
            return (
              <div
                key={slot}
                className={cn(
                  'rounded-md border px-2 py-2',
                  code ? 'border-primary-teal bg-primary-teal/5' : 'border-dashed border-gray-300 bg-slate-50',
                )}
              >
                <div className="flex min-h-7 items-center justify-between gap-2">
                  <span dir="ltr" className={cn('text-xs font-bold', !code && 'text-slate-400')} style={{ unicodeBidi: 'isolate' }}>
                    {code || t(`schedule:assignment.${slot === 0 ? 'primary' : 'secondary'}`)}
                  </span>
                  {code && (
                    <button type="button" onClick={() => toggleEmployee(code)} className="text-slate-400 hover:text-alert-coral">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {code && (
                  <select
                    value={colorKeysByCode[code] || cell.defaultColorKey}
                    onChange={(e) => setEmployeeColorKey(code, e.target.value as ShiftColorKey)}
                    className="mt-1.5 h-7 w-full rounded border border-gray-300 bg-white px-2 text-[11px] text-ink focus:border-primary-teal focus:outline-none"
                  >
                    {SHIFT_COLOR_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`schedule:shiftColors.${key}`)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        {!validation.ok && (
          <div className="mb-3 flex gap-2 rounded-md border border-alert-coral/30 bg-red-50 px-2.5 py-2 text-[11px] font-semibold text-alert-coral">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{validation.conflict.reason}</span>
          </div>
        )}

        <div className="relative mb-2">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('schedule:assignment.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-3 text-xs text-ink shadow-inner focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15"
          />
        </div>

        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-300">
          {filteredLegend.map((employee) => {
            const selected = selectedCodes.includes(employee.code);
            return (
              <button
                key={employee.employeeId}
                onClick={() => toggleEmployee(employee.code)}
                className={cn(
                  'flex w-full items-center gap-2 border-b border-gray-200 px-2.5 py-2 text-start last:border-b-0',
                  selected ? 'bg-primary-teal/10' : 'hover:bg-slate-50',
                )}
              >
                <span
                  dir="ltr"
                  className={cn(
                    'min-w-8 rounded border px-1.5 py-0.5 text-center text-xs font-bold',
                    selected ? 'border-primary-teal bg-primary-teal text-white' : 'border-slate-200 bg-slate-100 text-ink',
                  )}
                  style={{ unicodeBidi: 'isolate' }}
                >
                  {employee.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{employee.fullName}</span>
                {selected && <Check className="h-4 w-4 text-primary-teal" />}
              </button>
            );
          })}
          {filteredLegend.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-slate-400">{t('schedule:assignment.noResults')}</div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
          <button
            onClick={handleSave}
            disabled={!validation.ok}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-bold text-white transition-colors',
              !validation.ok ? 'bg-slate-300' : 'bg-primary-teal hover:bg-primary-teal/90',
            )}
          >
            {hasCurrentAssignments ? t('schedule:assignment.reassign') : t('schedule:assignment.save')}
          </button>
          {hasCurrentAssignments && (
            <>
              <button
                onClick={handleRemove}
                className="inline-flex items-center gap-1 rounded-lg border border-alert-coral/20 bg-red-50 px-3 py-2 text-xs font-bold text-alert-coral hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('schedule:assignment.remove')}
              </button>
              <button
                onClick={() => onMarkVacation(cell.rowId, cell.day, currentAssignments[0]?.employeeId)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <CalendarOff className="h-3.5 w-3.5" />
                {t('schedule:assignment.vacation')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(AssignmentPopover);
