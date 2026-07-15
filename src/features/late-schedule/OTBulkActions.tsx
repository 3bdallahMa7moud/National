import { useMemo, useState } from 'react';
import { Eraser, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import type { OTShiftRow } from '@/types/lateSchedule';

interface OTBulkActionsProps {
  rows: OTShiftRow[];
  roster: UnifiedEmployee[];
  daysInMonth: number;
  onApply(rowId: string, from: number, to: number, employeeIds: string[]): void;
  onClear(rowId: string, from: number, to: number): void;
}

export default function OTBulkActions(props: OTBulkActionsProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const activeRows = useMemo(() => props.rows.filter((row) => !row.archived), [props.rows]);
  const [rowId, setRowId] = useState(activeRows[0]?.id || '');
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const filtered = props.roster.filter((employee) => {
    const query = search.trim().toLowerCase();
    return !query || `${employee.code} ${employee.fullName} ${employee.fullNameEn || ''}`.toLowerCase().includes(query);
  });

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-sm font-extrabold text-text-primary">{isRtl ? 'تعديل جماعي لخلايا OT' : 'OT bulk cell actions'}</h2>
        <p className="mt-1 text-xs text-text-secondary">{isRtl ? 'اختر شفتًا ونطاق أيام ثم طبّق نفس الموظفين أو امسح النطاق.' : 'Choose a shift and day range, then apply the same employees or clear the range.'}</p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,1fr)_100px_100px_minmax(220px,1.4fr)]">
        <label className="text-xs font-semibold text-text-secondary">
          {isRtl ? 'الشفت' : 'Shift'}
          <select className="input-field mt-1 min-h-10" value={rowId} onChange={(event) => setRowId(event.target.value)}>
            {activeRows.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-text-secondary">{isRtl ? 'من يوم' : 'From'}<input className="input-field mt-1 min-h-10" type="number" min={1} max={props.daysInMonth} value={from} onChange={(event) => setFrom(Number(event.target.value))} /></label>
        <label className="text-xs font-semibold text-text-secondary">{isRtl ? 'إلى يوم' : 'To'}<input className="input-field mt-1 min-h-10" type="number" min={1} max={props.daysInMonth} value={to} onChange={(event) => setTo(Number(event.target.value))} /></label>
        <label className="text-xs font-semibold text-text-secondary">{isRtl ? 'بحث الموظفين' : 'Search employees'}<input className="input-field mt-1 min-h-10" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border p-3">
        {filtered.map((employee) => {
          const checked = selected.includes(employee.employeeId);
          return (
            <button
              key={employee.employeeId}
              type="button"
              aria-pressed={checked}
              onClick={() => setSelected((current) => checked ? current.filter((id) => id !== employee.employeeId) : [...current, employee.employeeId])}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface-muted text-text-secondary'}`}
            >
              {employee.code} · {isRtl ? employee.fullName : employee.fullNameEn || employee.fullName}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <span className="me-auto rounded-full bg-surface-muted px-3 py-2 text-xs font-bold text-text-secondary">{selected.length} {isRtl ? 'موظف' : 'employees'}</span>
        <Button variant="secondary" disabled={!rowId} icon={<Eraser className="h-4 w-4" />} onClick={() => props.onClear(rowId, from, to)}>{isRtl ? 'مسح النطاق' : 'Clear range'}</Button>
        <Button disabled={!rowId || selected.length === 0} icon={<UsersRound className="h-4 w-4" />} onClick={() => props.onApply(rowId, from, to, selected)}>{isRtl ? 'تطبيق على النطاق' : 'Apply to range'}</Button>
      </div>
    </section>
  );
}
