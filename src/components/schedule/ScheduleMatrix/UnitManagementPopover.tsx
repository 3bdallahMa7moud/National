import { useEffect, useState } from 'react';
import { Archive, Plus, Save, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface UnitManagementTarget {
  facilityId: string;
  facilityName: string;
  unitId?: string;
  unitName?: string;
  assignmentCount: number;
  anchorRect: DOMRect;
}

interface UnitManagementPopoverProps {
  target: UnitManagementTarget | null;
  onClose(): void;
  onAddUnit(facilityId: string, name: string): void;
  onRenameUnit?(facilityId: string, unitId: string, name: string): void;
  onAddRow?(facilityId: string, unitId: string, anchorRect: DOMRect): void;
  onArchiveUnit?(facilityId: string, unitId: string): void;
  onDeleteUnit?(facilityId: string, unitId: string): void;
}

export default function UnitManagementPopover({
  target,
  onClose,
  onAddUnit,
  onRenameUnit,
  onAddRow,
  onArchiveUnit,
  onDeleteUnit,
}: UnitManagementPopoverProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [unitName, setUnitName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  useEffect(() => {
    setUnitName(target?.unitName || '');
    setNewUnitName('');
  }, [target]);

  if (!target) return null;

  const saveRename = () => {
    if (!target.unitId || !unitName.trim() || unitName.trim() === target.unitName) return;
    onRenameUnit?.(target.facilityId, target.unitId, unitName.trim());
    onClose();
  };

  const addUnit = () => {
    if (!newUnitName.trim()) return;
    onAddUnit(target.facilityId, newUnitName.trim());
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[240] cursor-default bg-transparent"
        aria-label={t('common:actions.close')}
        onClick={onClose}
      />
      <section
        className="fixed z-[250] w-[min(340px,calc(100vw-32px))] rounded-xl border border-border bg-surface p-4 shadow-2xl"
        style={{
          top: Math.max(16, Math.min(target.anchorRect.bottom + 8, window.innerHeight - 430)),
          left: Math.max(16, Math.min(target.anchorRect.left, window.innerWidth - 356)),
        }}
        role="dialog"
        aria-label={t('schedule:matrix.unitActions', { defaultValue: 'Unit actions' })}
      >
        <header className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold text-text-primary">
              {target.unitName || t('schedule:matrix.addFirstUnit', { defaultValue: 'Add first unit' })}
            </h2>
            <p className="mt-1 text-xs text-text-secondary">{target.facilityName}</p>
            {target.unitId && (
              <p className="mt-1 text-[11px] font-semibold text-warning">
                {t('schedule:matrix.affectedAssignments', {
                  count: target.assignmentCount,
                  defaultValue: '{{count}} assignments affected',
                })}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-hover" aria-label={t('common:actions.close')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {target.unitId && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-text-primary">
              {t('schedule:matrix.renameUnit', { defaultValue: 'Rename unit' })}
              <span className="mt-1 flex gap-2">
                <input
                  value={unitName}
                  onChange={(event) => setUnitName(event.target.value)}
                  className="input-field min-w-0 flex-1"
                />
                <button type="button" onClick={saveRename} disabled={!unitName.trim() || unitName.trim() === target.unitName} className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40" aria-label={t('common:actions.save')}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </label>
            {onAddRow && (
              <button type="button" onClick={() => { onAddRow(target.facilityId, target.unitId!, target.anchorRect); onClose(); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 text-xs font-bold text-primary hover:bg-primary/5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('schedule:matrix.addRow', { defaultValue: 'Add row' })}
              </button>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <label className="block text-xs font-bold text-text-primary">
            {t('schedule:matrix.addUnit', { defaultValue: 'Add unit' })}
            <span className="mt-1 flex gap-2">
              <input
                value={newUnitName}
                onChange={(event) => setNewUnitName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addUnit(); } }}
                placeholder={t('schedule:matrix.newUnitName', { defaultValue: 'New unit name' })}
                className="input-field min-w-0 flex-1"
              />
              <button type="button" onClick={addUnit} disabled={!newUnitName.trim()} className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40" aria-label={t('schedule:matrix.addUnit', { defaultValue: 'Add unit' })}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          </label>
        </div>

        {target.unitId && (onArchiveUnit || onDeleteUnit) && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3">
            {onArchiveUnit && (
              <button type="button" onClick={() => { onArchiveUnit(target.facilityId, target.unitId!); onClose(); }} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border text-xs font-bold text-text-secondary hover:bg-hover">
                <Archive className="h-4 w-4" aria-hidden="true" />
                {t('schedule:settingsPanel.archive', { defaultValue: 'Archive' })}
              </button>
            )}
            {onDeleteUnit && (
              <button type="button" onClick={() => { onDeleteUnit(target.facilityId, target.unitId!); onClose(); }} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-danger/30 text-xs font-bold text-danger hover:bg-danger hover:text-white">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t('common:actions.delete')}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
