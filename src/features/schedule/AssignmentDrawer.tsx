// ============================================================
// AssignmentDrawer — Employee assignment slide-out panel
// ============================================================
// Opened from cell click in Edit mode or popover "تغيير التعيين".
// Searchable employee list with live conflict preview.

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, Search, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { validateAssignment } from '@/lib/validateAssignment';
import { SHIFT_COLOR_KEYS } from '@/lib/shiftColorOptions';
import type {
  ScheduleMatrixData,
  Assignment,
  ShiftColorKey,
  ValidateResult,
} from '@/types/scheduleMatrix';

interface AssignmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Full matrix data for conflict validation */
  data: ScheduleMatrixData;
  /** Context of the cell being edited */
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
  /** Current assignments in this cell */
  currentAssignments: Assignment[];
  /** Legend for the employee list */
  legend: { code: string; fullName: string }[];
  /** Callback to save */
  onSave: (rowId: string, day: number, assignments: Assignment[]) => void;
  /** Callback to clear */
  onClear: (rowId: string, day: number) => void;
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
  const [search, setSearch] = useState('');
  const [primary, setPrimary] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<string | null>(null);
  const [primaryColorKey, setPrimaryColorKey] = useState<ShiftColorKey>('morning');
  const [secondaryColorKey, setSecondaryColorKey] = useState<ShiftColorKey>('morning');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize slots from current assignments
  useEffect(() => {
    if (isOpen && cell) {
      setPrimary(currentAssignments[0]?.employeeCode || null);
      setSecondary(currentAssignments[1]?.employeeCode || null);
      setPrimaryColorKey(currentAssignments[0]?.colorKey || cell.defaultColorKey);
      setSecondaryColorKey(currentAssignments[1]?.colorKey || cell.defaultColorKey);
      setSearch('');
    }
  }, [isOpen, cell, currentAssignments]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Build code → id map
  const codeToId = useMemo(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    for (const f of data.facilities) {
      for (const u of f.units) {
        for (const r of u.rows) {
          for (const d of Object.keys(r.cellsByDay)) {
            for (const a of r.cellsByDay[Number(d)]) {
              map.set(a.employeeCode, a.employeeId);
            }
          }
        }
      }
    }
    // Also from legend
    legend.forEach((l, i) => {
      if (!map.has(l.code)) map.set(l.code, `emp-m-${i + 1}`);
    });
    return map;
  }, [data, legend]);

  // Filtered legend
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return legend;
    return legend.filter(
      (l) => l.code.toLowerCase().includes(q) || l.fullName.includes(q),
    );
  }, [legend, search]);

  // Validate a potential assignment
  const validate = useCallback(
    (code: string): ValidateResult => {
      if (!cell || !data) return { ok: true };
      const empId = codeToId.get(code) || '';
      return validateAssignment(data, {
        facilityId: cell.facilityId,
        unitId: cell.unitId,
        rowId: cell.rowId,
        day: cell.day,
        employeeId: empId,
        timeRange: cell.timeRange,
      });
    },
    [cell, data, codeToId],
  );

  // Conflict previews for selected employees
  const primaryConflict = primary ? validate(primary) : null;
  const secondaryConflict = secondary ? validate(secondary) : null;
  const hasConflict =
    (primaryConflict && !primaryConflict.ok) ||
    (secondaryConflict && !secondaryConflict.ok);

  const handleSelectEmployee = (code: string) => {
    if (!primary || primary === code) {
      if (code === primary) {
        handleRemovePrimary();
        return;
      }
      setPrimary(code);
    } else if (!secondary || secondary === code) {
      if (code === secondary) {
        handleRemoveSecondary();
        return;
      }
      setSecondary(code);
    } else {
      // Replace secondary
      setSecondary(code);
    }
  };

  const buildAssignments = useCallback(
    (primaryCode: string | null, secondaryCode: string | null): Assignment[] => {
      const assignments: Assignment[] = [];
      if (primaryCode) {
        assignments.push({
          employeeId: codeToId.get(primaryCode) || '',
          employeeCode: primaryCode,
          colorKey: primaryColorKey,
        });
      }
      if (secondaryCode) {
        assignments.push({
          employeeId: codeToId.get(secondaryCode) || '',
          employeeCode: secondaryCode,
          colorKey: secondaryColorKey,
        });
      }
      return assignments;
    },
    [codeToId, primaryColorKey, secondaryColorKey],
  );

  const handleSave = () => {
    if (!cell || hasConflict) return;
    onSave(cell.rowId, cell.day, buildAssignments(primary, secondary));
    onClose();
  };

  const handleRemovePrimary = () => {
    if (!cell) return;
    onSave(cell.rowId, cell.day, buildAssignments(null, secondary));
    setPrimary(null);
  };

  const handleRemoveSecondary = () => {
    if (!cell) return;
    onSave(cell.rowId, cell.day, buildAssignments(primary, null));
    setSecondary(null);
  };

  const handleClear = () => {
    if (!cell) return;
    onClear(cell.rowId, cell.day);
    onClose();
  };

  // Keyboard: Enter = save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !hasConflict) handleSave();
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen || !cell) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 z-50 h-full w-full max-w-md overflow-y-auto',
          'bg-white border-s border-gray-300 shadow-2xl',
          'inset-inline-end-0',
          'animate-slideIn',
        )}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label={t('schedule:assignment.assignTitle')}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-300 bg-white px-5 py-3.5 shadow-sm">
          <h2 className="text-sm font-bold text-ink">{t('schedule:assignment.assignTitle')}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label={t('schedule:assignment.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Cell context */}
          <div className="rounded-lg bg-slate-50 border border-gray-200 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('schedule:assignment.drawerDay')}</span>
              <span className="text-xs font-bold text-ink">{cell.day}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('schedule:assignment.drawerFacility')}</span>
              <span className="text-xs font-bold text-ink">
                {cell.facilityName} / {cell.unitName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('schedule:assignment.drawerShift')}</span>
              <span className="text-xs font-bold text-ink">
                {cell.shiftLabel} ({cell.timeRange})
              </span>
            </div>
          </div>

          {/* Shift Type Control Panel */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">
                اختر نوع الشفت (النهار، الليل، الإجازة، On-call، ...):
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: 'morning', label: t('schedule:shiftColors.morning'), active: 'bg-emerald-600 text-white border-emerald-600' },
                  { key: 'evening', label: t('schedule:shiftColors.evening'), active: 'bg-amber-600 text-white border-amber-600' },
                  { key: 'night', label: t('schedule:shiftColors.night'), active: 'bg-purple-600 text-white border-purple-600' },
                  { key: 'onCall', label: t('schedule:shiftColors.onCall'), active: 'bg-blue-600 text-white border-blue-600' },
                  { key: 'vacation', label: t('schedule:shiftColors.vacation'), active: 'bg-yellow-500 text-white border-yellow-600' },
                  { key: 'overtime', label: t('schedule:shiftColors.overtime'), active: 'bg-slate-700 text-white border-slate-700' },
                ] as const
              ).map((item) => {
                const isSelected = primaryColorKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setPrimaryColorKey(item.key);
                      setSecondaryColorKey(item.key);
                    }}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-[11px] font-bold border transition-all truncate text-center',
                      isSelected
                        ? cn(item.active, 'shadow-sm scale-[1.02]')
                        : 'bg-white text-slate-700 border-gray-200 hover:bg-slate-100 hover:border-gray-300',
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected employees */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              {t('schedule:assignment.selectedEmployees')}
            </label>
            <div className="flex gap-2">
              {/* Primary slot */}
              <div className={cn(
                'flex-1 rounded-lg border-2 p-2.5 text-center text-xs transition-all',
                primary ? 'border-primary-teal bg-primary-teal/5 shadow-sm' : 'border-dashed border-gray-300 bg-slate-50/50',
              )}>
                {primary ? (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{primary}</span>
                    <button onClick={handleRemovePrimary} className="text-slate-400 hover:text-alert-coral">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400">{t('schedule:assignment.primary')}</span>
                )}
                {primaryConflict && !primaryConflict.ok && (
                  <div className="mt-1 text-[10px] text-alert-coral flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('schedule:assignment.conflictWith', { facility: primaryConflict.conflict.facility, unit: primaryConflict.conflict.unit, shift: primaryConflict.conflict.shiftLabel })}
                  </div>
                )}
                <div className="mt-2">
                  <select
                    value={primaryColorKey}
                    onChange={(e) => setPrimaryColorKey(e.target.value as ShiftColorKey)}
                    className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-[11px] font-bold text-ink focus:border-primary-teal focus:outline-none"
                  >
                    {SHIFT_COLOR_KEYS.map((key) => (
                      <option key={key} value={key}>{t(`schedule:shiftColors.${key}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Secondary slot */}
              <div className={cn(
                'flex-1 rounded-lg border-2 p-2.5 text-center text-xs transition-all',
                secondary ? 'border-primary-teal bg-primary-teal/5 shadow-sm' : 'border-dashed border-gray-300 bg-slate-50/50',
              )}>
                {secondary ? (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink">{secondary}</span>
                    <button onClick={handleRemoveSecondary} className="text-slate-400 hover:text-alert-coral">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400">{t('schedule:assignment.secondary')}</span>
                )}
                {secondaryConflict && !secondaryConflict.ok && (
                  <div className="mt-1 text-[10px] text-alert-coral flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('schedule:assignment.conflictWith', { facility: secondaryConflict.conflict.facility, unit: secondaryConflict.conflict.unit, shift: secondaryConflict.conflict.shiftLabel })}
                  </div>
                )}
                <div className="mt-2">
                  <select
                    value={secondaryColorKey}
                    onChange={(e) => setSecondaryColorKey(e.target.value as ShiftColorKey)}
                    className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-[11px] font-bold text-ink focus:border-primary-teal focus:outline-none"
                  >
                    {SHIFT_COLOR_KEYS.map((key) => (
                      <option key={key} value={key}>{t(`schedule:shiftColors.${key}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('schedule:assignment.searchPlaceholder')}
              className={cn(
                'w-full h-9 rounded-lg border border-gray-300 bg-white shadow-inner',
                'ps-9 pe-3 text-xs text-ink',
                'focus:outline-none focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/15',
                'placeholder:text-slate-400',
              )}
            />
          </div>

          {/* Employee list */}
          <div ref={listRef} className="max-h-[40vh] overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-sm">
            {filtered.map((emp) => {
              const isSelected = primary === emp.code || secondary === emp.code;
              const result = validate(emp.code);
              const hasIssue = !result.ok;

              return (
                <button
                  key={emp.code}
                  onClick={() => handleSelectEmployee(emp.code)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 text-right',
                    'border-b border-gray-200 last:border-b-0',
                    'transition-colors duration-100',
                    isSelected
                      ? 'bg-primary-teal/10 font-semibold'
                      : 'hover:bg-slate-50',
                    hasIssue && !isSelected && 'opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-bold px-1.5 py-0.5 rounded min-w-[28px] text-center shrink-0 border',
                      isSelected
                        ? 'bg-primary-teal text-white border-primary-teal'
                        : 'bg-slate-100 border-slate-200 text-ink',
                    )}
                  >
                    {emp.code}
                  </span>
                  <span className="text-xs text-ink flex-1 truncate">{emp.fullName}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary-teal shrink-0" />}
                  {hasIssue && !isSelected && (
                    <AlertTriangle className="w-3.5 h-3.5 text-alert-coral shrink-0" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                {t('schedule:assignment.noResults')}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={handleSave}
              className={cn(
                'flex-1 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors shadow-sm',
                hasConflict
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-primary-teal text-white hover:bg-primary-teal/90',
              )}
              title={hasConflict ? t('schedule:assignment.saveOverrideTitle') : t('schedule:assignment.saveTitle')}
            >
              {hasConflict ? t('schedule:assignment.saveOverride') : t('schedule:assignment.save')}
            </button>
            <button
              onClick={handleClear}
              className="rounded-lg px-4 py-2.5 text-xs font-bold text-alert-coral bg-red-50 border border-alert-coral/20 hover:bg-red-100 transition-colors"
            >
              {t('schedule:matrix.clearCell')}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-gray-200"
            >
              {t('schedule:assignment.cancel')}
            </button>
          </div>
        </div>
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
