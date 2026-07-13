import { useMemo, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { OTCellAssignment } from '@/types/lateSchedule';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';

interface OTAssignmentPanelProps {
  roster: UnifiedEmployee[];
  initialAssignments: OTCellAssignment[];
  onSave(employeeIds: string[], unresolvedLegacyCodes: string[]): void;
  onClear(): void;
  onCancel(): void;
}

export default function OTAssignmentPanel({
  roster,
  initialAssignments,
  onSave,
  onClear,
  onCancel,
}: OTAssignmentPanelProps) {
  const { t, i18n } = useTranslation(['common']);
  const isRtl = i18n.language === 'ar';
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => [
    ...new Set(initialAssignments.flatMap((assignment) =>
      assignment.kind === 'employee' ? [assignment.employeeId] : [])),
  ].slice(0, 2));
  const [unresolvedCodes, setUnresolvedCodes] = useState(() => [
    ...new Set(initialAssignments.flatMap((assignment) =>
      assignment.kind === 'unresolved' ? [assignment.legacyCode] : [])),
  ].slice(0, Math.max(0, 2 - selectedIds.length)));
  const selectionCount = selectedIds.length + unresolvedCodes.length;
  const atCapacity = selectionCount >= 2;

  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter((employee) =>
      employee.code.toLowerCase().includes(query)
      || employee.fullName.toLowerCase().includes(query)
      || employee.fullNameEn?.toLowerCase().includes(query));
  }, [roster, search]);

  const toggleEmployee = (employeeId: string) => {
    setSelectedIds((current) => current.includes(employeeId)
      ? current.filter((id) => id !== employeeId)
      : current.length + unresolvedCodes.length < 2 ? [...current, employeeId] : current);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-text-primary">
            {t('common:lateSchedule.assignment.selectedEmployees', { defaultValue: isRtl ? 'الموظفون المحددون' : 'Selected employees' })}
          </p>
          <p className="text-xs text-text-secondary">
            {t('common:lateSchedule.assignment.maxTwo', { defaultValue: isRtl ? 'اختر موظفًا واحدًا أو اثنين' : 'Choose one or two employees' })}
          </p>
        </div>
        <span className="rounded-full bg-cyan-950 px-3 py-1 text-sm font-bold text-cyan-100" aria-live="polite">
          {selectionCount}/2
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((employeeId) => {
            const employee = roster.find((item) => item.employeeId === employeeId);
            if (!employee) return null;
            const name = isRtl ? employee.fullName : employee.fullNameEn || employee.fullName;
            return (
              <button
                key={employeeId}
                type="button"
                onClick={() => toggleEmployee(employeeId)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={`${isRtl ? 'إزالة' : 'Remove'} ${name}`}
              >
                <span dir="ltr" className="rounded-md bg-primary px-2 py-1 font-mono text-xs font-bold text-white">{employee.code}</span>
                <span>{name}</span>
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            );
          })}
        </div>
      )}

      {unresolvedCodes.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p>
            {t('common:lateSchedule.assignment.unresolved', { defaultValue: isRtl ? 'أكواد غير مرتبطة تحتاج إعادة تعيين:' : 'Unresolved legacy codes require reassignment:' })}
          </p>
          <div className="flex flex-wrap gap-2">
            {unresolvedCodes.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setUnresolvedCodes((current) => current.filter((item) => item !== code))}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-500/15 px-3 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                aria-label={isRtl ? `إزالة الكود غير المرتبط ${code}` : `Remove unresolved code ${code}`}
              >
                <span>{code}?</span>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('common:lateSchedule.assignment.search', { defaultValue: isRtl ? 'ابحث بالاسم أو الاختصار' : 'Search by name or code' })}
          className="input-field min-h-11 ps-10"
        />
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pe-1">
        {filteredRoster.map((employee) => {
          const selected = selectedIds.includes(employee.employeeId);
          const disabled = atCapacity && !selected;
          const name = isRtl ? employee.fullName : employee.fullNameEn || employee.fullName;
          return (
            <button
              key={employee.employeeId}
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={`${employee.code} — ${name}`}
              disabled={disabled}
              onClick={() => toggleEmployee(employee.employeeId)}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-start transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40',
                selected ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-hover',
              )}
            >
              <span className="flex h-9 min-w-10 items-center justify-center rounded-lg bg-slate-900 px-2 font-mono text-xs font-bold text-white dark:bg-cyan-800">
                {employee.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-primary">{name}</span>
                <span className="block text-xs text-text-secondary">
                  {isRtl ? 'إدارة الجدولة' : 'Schedule Management'}
                </span>
              </span>
              <UserRound className={cn('h-5 w-5', selected ? 'text-primary' : 'text-text-secondary')} />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" className="min-h-11" onClick={onCancel}>
          {t('common:lateSchedule.assignment.cancel', { defaultValue: isRtl ? 'إلغاء' : 'Cancel' })}
        </Button>
        <Button variant="secondary" className="min-h-11" onClick={onClear}>
          {t('common:lateSchedule.assignment.clear', { defaultValue: isRtl ? 'مسح التعيين' : 'Clear assignment' })}
        </Button>
        <Button
          className="min-h-11"
          disabled={selectionCount === 0}
          onClick={() => onSave(selectedIds, unresolvedCodes)}
        >
          {t('common:lateSchedule.assignment.save', { defaultValue: isRtl ? 'حفظ التعيين' : 'Save assignment' })}
        </Button>
      </div>
    </div>
  );
}
