import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Edit3, ListOrdered, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import ManualTableOrder from '@/components/common/ManualTableOrder';
import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';

interface OTStructureControlProps {
  units: OTUnit[];
  rows: OTShiftRow[];
  onAddUnit(name: string): void;
  onRenameUnit(id: string, name: string): void;
  onArchiveUnit(id: string): void;
  onRestoreUnit(id: string): void;
  onDeleteUnit(id: string): void;
  onReorderUnit(sourceUnitId: string, targetUnitId: string, position: 'before' | 'after'): void;
  onReorderRow(
    sourceRowId: string,
    sourceUnitId: string,
    targetUnitId: string,
    targetRowId?: string,
    position?: 'before' | 'after',
  ): void;
  onEditRow(id: string): void;
  onDeleteRow(id: string): void;
}

export default function OTStructureControl(props: OTStructureControlProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [newUnit, setNewUnit] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const orderUnits = useMemo(() => props.units
    .filter((unit) => !unit.archived)
    .map((unit) => ({
      id: unit.id,
      label: unit.name,
      rows: props.rows
        .filter((row) => !row.archived && row.unitId === unit.id)
        .map((row) => ({
          id: row.id,
          label: row.title,
          meta: `${row.timeRange} · ${row.hours}h`,
          color: row.backgroundColor,
        })),
    })), [props.rows, props.units]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-extrabold text-text-primary">{isRtl ? 'ترتيب جدول OT' : 'OT table order'}</h2>
          </div>
          <p className="mt-1 text-xs text-text-secondary">{isRtl ? 'هذا هو مكان الترتيب الوحيد: اسحب الوحدات والشفتات، استخدم الأسهم، أو انقل الشفت بين الوحدات.' : 'This is the only ordering surface: drag units and shifts, use the arrows, or move shifts between units.'}</p>
        </div>
        <div className="mt-4">
          <ManualTableOrder units={orderUnits} onReorderUnit={props.onReorderUnit} onReorderRow={props.onReorderRow} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-text-primary">{isRtl ? 'إدارة وحدات وشفتات OT' : 'Manage OT units and shifts'}</h2>
            <p className="mt-1 text-xs text-text-secondary">{isRtl ? 'الإضافة والتعديل والأرشفة منفصلة عن الترتيب.' : 'Add, edit and archive here; ordering stays in the panel above.'}</p>
          </div>
          <div className="flex gap-2">
            <input className="input-field min-h-10" value={newUnit} onChange={(event) => setNewUnit(event.target.value)} placeholder={isRtl ? 'اسم الوحدة' : 'Unit name'} />
            <Button size="sm" variant="secondary" disabled={!newUnit.trim()} icon={<Plus className="h-4 w-4" />} onClick={() => { props.onAddUnit(newUnit); setNewUnit(''); }}>
              {isRtl ? 'إضافة وحدة' : 'Add unit'}
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {props.units.map((unit) => {
            const unitRows = props.rows.filter((row) => row.unitId === unit.id);
            return (
              <article key={unit.id} className={`overflow-hidden rounded-xl border border-border ${unit.archived ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 bg-surface-muted p-3">
                  <input
                    className="input-field min-h-9 min-w-48 flex-1 font-bold"
                    value={unit.name}
                    disabled={unit.archived}
                    onChange={(event) => props.onRenameUnit(unit.id, event.target.value)}
                    aria-label={isRtl ? 'اسم الوحدة' : 'Unit name'}
                  />
                  <Button size="sm" variant="ghost" onClick={() => unit.archived ? props.onRestoreUnit(unit.id) : props.onArchiveUnit(unit.id)}>
                    {unit.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  {deleteTarget === unit.id ? (
                    <Button size="sm" variant="danger" onClick={() => { props.onDeleteUnit(unit.id); setDeleteTarget(null); }}>{isRtl ? 'تأكيد الحذف' : 'Confirm delete'}</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(unit.id)} aria-label={isRtl ? `حذف ${unit.name}` : `Delete ${unit.name}`}><Trash2 className="h-4 w-4 text-danger" /></Button>
                  )}
                </div>

                {!unit.archived && (
                  <div className="divide-y divide-border">
                    {unitRows.map((row) => (
                      <div key={row.id} className={`flex flex-wrap items-center gap-2 p-3 ${row.archived ? 'opacity-60' : ''}`}>
                        <span className="h-7 w-7 rounded-lg border border-border" style={{ backgroundColor: row.backgroundColor || '#E0F2FE' }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-text-primary">{row.icon ? `${row.icon} ` : ''}{row.title}</p>
                          <p className="text-xs text-text-secondary" dir="ltr">{row.timeRange} · {row.hours}h</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => props.onEditRow(row.id)} aria-label={isRtl ? `تعديل ${row.title}` : `Edit ${row.title}`}><Edit3 className="h-4 w-4" /></Button>
                        {deleteTarget === row.id ? (
                          <Button size="sm" variant="danger" onClick={() => { props.onDeleteRow(row.id); setDeleteTarget(null); }}>{isRtl ? 'تأكيد' : 'Confirm'}</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(row.id)} aria-label={isRtl ? `حذف ${row.title}` : `Delete ${row.title}`}><Trash2 className="h-4 w-4 text-danger" /></Button>
                        )}
                      </div>
                    ))}
                    {unitRows.length === 0 && <p className="p-4 text-center text-xs text-text-secondary">{isRtl ? 'لا توجد شفتات داخل هذه الوحدة.' : 'No shifts in this unit.'}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
