// ============================================================
// AssignmentDrawer - Employee assignment slide-out panel
// ============================================================
// Opened from cell click in Edit mode or popover change assignment action.
// Searchable employee list with live conflict preview.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { validateAssignment } from '@/lib/validateAssignment';
import { SHIFT_COLOR_KEYS } from '@/lib/shiftColorOptions';
import type {
  Assignment,
  ScheduleMatrixData,
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

  const shiftOptions = [
    {
      key: 'morning' as const,
      label: t('schedule:shiftColors.morning'),
      dot: 'bg-shift-morning',
      active: 'border-shift-morning bg-shift-morning/15 ring-shift-morning/20',
    },
    {
      key: 'evening' as const,
      label: t('schedule:shiftColors.evening'),
      dot: 'bg-shift-evening',
      active: 'border-shift-evening bg-shift-evening/15 ring-shift-evening/20',
    },
    {
      key: 'night' as const,
      label: t('schedule:shiftColors.night'),
      dot: 'bg-shift-night',
      active: 'border-shift-night bg-shift-night/15 ring-shift-night/20',
    },
    {
      key: 'onCall' as const,
      label: t('schedule:shiftColors.onCall'),
      dot: 'bg-shift-oncall',
      active: 'border-shift-oncall bg-shift-oncall/15 ring-shift-oncall/20',
    },
    {
      key: 'vacation' as const,
      label: t('schedule:shiftColors.vacation'),
      dot: 'bg-shift-vacation',
      active: 'border-shift-vacation bg-shift-vacation/15 ring-shift-vacation/20',
    },
    {
      key: 'overtime' as const,
      label: t('schedule:shiftColors.overtime'),
      dot: 'bg-shift-overtime',
      active: 'border-shift-overtime bg-shift-overtime/15 ring-shift-overtime/20',
    },
  ];

  useEffect(() => {
    if (isOpen && cell) {
      setPrimary(currentAssignments[0]?.employeeCode || null);
      setSecondary(currentAssignments[1]?.employeeCode || null);
      setPrimaryColorKey(currentAssignments[0]?.colorKey || cell.defaultColorKey);
      setSecondaryColorKey(currentAssignments[1]?.colorKey || cell.defaultColorKey);
      setSearch('');
    }
  }, [isOpen, cell, currentAssignments]);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const codeToId = useMemo(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    for (const facility of data.facilities) {
      for (const unit of facility.units) {
        for (const row of unit.rows) {
          for (const day of Object.keys(row.cellsByDay)) {
            for (const assignment of row.cellsByDay[Number(day)]) {
              map.set(assignment.employeeCode, assignment.employeeId);
            }
          }
        }
      }
    }
    legend.forEach((employee, index) => {
      if (!map.has(employee.code)) map.set(employee.code, `emp-m-${index + 1}`);
    });
    return map;
  }, [data, legend]);

  const employeeByCode = useMemo(() => {
    const map = new Map<string, { code: string; fullName: string }>();
    legend.forEach((employee) => map.set(employee.code, employee));
    return map;
  }, [legend]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return legend;
    return legend.filter(
      (employee) =>
        employee.code.toLowerCase().includes(query) ||
        employee.fullName.toLowerCase().includes(query),
    );
  }, [legend, search]);

  const validate = useCallback(
    (code: string): ValidateResult => {
      if (!cell || !data) return { ok: true };
      const employeeId = codeToId.get(code) || '';
      return validateAssignment(data, {
        facilityId: cell.facilityId,
        unitId: cell.unitId,
        rowId: cell.rowId,
        day: cell.day,
        employeeId,
        timeRange: cell.timeRange,
      });
    },
    [cell, data, codeToId],
  );

  const primaryConflict = primary ? validate(primary) : null;
  const secondaryConflict = secondary ? validate(secondary) : null;
  const hasConflict =
    (primaryConflict && !primaryConflict.ok) ||
    (secondaryConflict && !secondaryConflict.ok);
  const selectedCount = Number(Boolean(primary)) + Number(Boolean(secondary));
  const canSave = selectedCount > 0 && !hasConflict;

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
    if (!cell || !canSave) return;
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && canSave) handleSave();
    if (event.key === 'Escape') onClose();
  };

  const renderConflict = (result: ValidateResult | null) => {
    if (!result || result.ok) return null;
    return (
      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-danger/25 bg-danger-500/10 px-2 py-1.5 text-[11px] font-semibold text-danger">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {t('schedule:assignment.conflictWith', {
            facility: result.conflict.facility,
            unit: result.conflict.unit,
            shift: result.conflict.shiftLabel,
          })}
        </span>
      </div>
    );
  };

  const renderSlot = (
    label: string,
    code: string | null,
    colorKey: ShiftColorKey,
    onColorChange: (value: ShiftColorKey) => void,
    onRemove: () => void,
    conflict: ValidateResult | null,
  ) => {
    const employee = code ? employeeByCode.get(code) : null;

    return (
      <div
        className={cn(
          'rounded-xl border p-3 transition-colors',
          code
            ? 'border-primary-teal/40 bg-primary-teal/5'
            : 'border-dashed border-border bg-surface-muted/35',
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{label}</span>
          {code && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger-500/10 hover:text-danger"
              aria-label={t('schedule:assignment.remove')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {code ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-teal/35 bg-primary-teal text-xs font-black text-white">
              {code}
            </span>
            <div className="min-w-0 text-start">
              <p className="truncate text-sm font-bold text-text-primary">{employee?.fullName ?? code}</p>
              <p className="text-[11px] font-semibold text-text-secondary">{t('schedule:assignment.slotShift')}</p>
            </div>
          </div>
        ) : (
          <div className="mb-3 flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-muted">
            {t('schedule:assignment.emptySlot')}
          </div>
        )}

        <select
          value={colorKey}
          onChange={(event) => onColorChange(event.target.value as ShiftColorKey)}
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs font-bold text-text-primary outline-none transition-colors focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/15"
        >
          {SHIFT_COLOR_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`schedule:shiftColors.${key}`)}
            </option>
          ))}
        </select>

        {renderConflict(conflict)}
      </div>
    );
  };

  if (!isOpen || !cell) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] dark:bg-black/45" onClick={onClose} />

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
        <header className="border-b border-border bg-surface px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-text-primary">{t('schedule:assignment.assignTitle')}</h2>
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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1">
                  <Clock3 className="h-3.5 w-3.5 text-primary-teal" />
                  {cell.shiftLabel} ({cell.timeRange})
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="rounded-xl border border-border bg-surface-muted/35 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">{t('schedule:assignment.shiftType')}</h3>
                <p className="mt-0.5 text-xs font-medium text-text-secondary">
                  {t('schedule:assignment.shiftTypeHint')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {shiftOptions.map((item) => {
                const isSelected = primaryColorKey === item.key && secondaryColorKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setPrimaryColorKey(item.key);
                      setSecondaryColorKey(item.key);
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-start text-xs font-bold leading-4 outline-none transition-colors focus:ring-2',
                      isSelected
                        ? cn(item.active, 'text-text-primary ring-2')
                        : 'border-border bg-surface text-text-secondary hover:border-primary-teal/45 hover:bg-hover hover:text-text-primary focus:ring-primary-teal/20',
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', item.dot)} />
                    <span className="min-w-0">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

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
              {hasConflict && (
                <span className="rounded-full border border-danger/25 bg-danger-500/10 px-2.5 py-1 text-[11px] font-bold text-danger">
                  {t('schedule:assignment.cannotSaveConflict')}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {renderSlot(
                t('schedule:assignment.primary'),
                primary,
                primaryColorKey,
                setPrimaryColorKey,
                handleRemovePrimary,
                primaryConflict,
              )}
              {renderSlot(
                t('schedule:assignment.secondary'),
                secondary,
                secondaryColorKey,
                setSecondaryColorKey,
                handleRemoveSecondary,
                secondaryConflict,
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">{t('schedule:assignment.employeeList')}</h3>
                <p className="text-xs font-semibold text-text-muted">
                  {t('schedule:assignment.employeesFound', { count: filtered.length })}
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('schedule:assignment.searchPlaceholder')}
                className={cn(
                  'h-11 w-full rounded-xl border border-border bg-surface ps-10 pe-3 text-sm font-semibold text-text-primary shadow-inner outline-none',
                  'transition-colors placeholder:text-text-muted focus:border-primary-teal focus:ring-2 focus:ring-primary-teal/20',
                )}
              />
            </div>

            <div ref={listRef} className="max-h-[38vh] overflow-y-auto rounded-xl border border-border bg-surface">
              {filtered.map((employee) => {
                const isPrimary = primary === employee.code;
                const isSecondary = secondary === employee.code;
                const isSelected = isPrimary || isSecondary;
                const result = validate(employee.code);
                const hasIssue = !result.ok;

                return (
                  <button
                    key={employee.code}
                    type="button"
                    onClick={() => handleSelectEmployee(employee.code)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border px-3 py-3 text-start transition-colors last:border-b-0',
                      isSelected
                        ? 'bg-primary-teal/10'
                        : 'hover:bg-hover',
                      hasIssue && !isSelected && 'opacity-70',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-black',
                        isSelected
                          ? 'border-primary-teal bg-primary-teal text-white'
                          : 'border-border bg-surface-muted text-text-primary',
                      )}
                    >
                      {employee.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-text-primary">{employee.fullName}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-text-muted">
                        {isPrimary
                          ? t('schedule:assignment.primary')
                          : isSecondary
                            ? t('schedule:assignment.secondary')
                            : employee.code}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary-teal" />}
                    {hasIssue && !isSelected && (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-10 text-center text-sm font-semibold text-text-muted">
                  {t('schedule:assignment.noResults')}
                </div>
              )}
            </div>
          </section>
        </div>

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
              title={hasConflict ? t('schedule:assignment.cannotSaveConflict') : t('schedule:assignment.saveTitle')}
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
