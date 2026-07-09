// ============================================================
// ScheduleSettingsPanel - Shift definitions and facility units
// ============================================================

import { memo, useMemo, useState } from 'react';
import { Archive, Clock3, Plus, Save, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { ScheduleMatrixData, ShiftColorKey, ShiftDefinition } from '@/types/scheduleMatrix';

interface ScheduleSettingsPanelProps {
  data: ScheduleMatrixData;
  colorblindMode: boolean;
  onToggleColorblindMode: () => void;
  onAddShift: (facilityId: string, payload: Omit<ShiftDefinition, 'id' | 'facilityId'>) => void;
  onUpdateShift: (facilityId: string, shiftId: string, updates: Partial<ShiftDefinition>) => void;
  onArchiveShift: (facilityId: string, shiftId: string) => void;
  onAddUnit: (facilityId: string, name: string) => void;
  onRenameUnit: (facilityId: string, unitId: string, name: string) => void;
  onArchiveUnit: (facilityId: string, unitId: string) => void;
}

const COLOR_OPTIONS: { value: ShiftColorKey; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
  { value: 'onCall', label: 'On-call' },
  { value: 'overtime', label: 'Weekend' },
];

function ScheduleSettingsPanel({
  data,
  colorblindMode,
  onToggleColorblindMode,
  onAddShift,
  onUpdateShift,
  onArchiveShift,
  onAddUnit,
  onRenameUnit,
  onArchiveUnit,
}: ScheduleSettingsPanelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const [facilityId, setFacilityId] = useState(data.facilities[0]?.id || 'kamc');
  const [newShiftLabel, setNewShiftLabel] = useState('');
  const [newShiftRange, setNewShiftRange] = useState('08:00 - 17:00');
  const [newShiftColor, setNewShiftColor] = useState<ShiftColorKey>('morning');
  const [newUnitName, setNewUnitName] = useState('');

  const facility = useMemo(
    () => data.facilities.find((item) => item.id === facilityId) || data.facilities[0],
    [data.facilities, facilityId],
  );

  const settings = useMemo(
    () => data.settings.find((item) => item.facilityId === facility?.id),
    [data.settings, facility?.id],
  );

  if (!facility || !settings) return null;

  return (
    <section className="rounded-lg border border-border bg-surface px-4 py-3 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary-teal" />
        <h2 className="text-sm font-bold text-ink">{t('schedule:settingsPanel.title')}</h2>
        <div className="ms-auto flex rounded-lg border border-border bg-surface-muted p-0.5">
          {data.facilities.map((item) => (
            <button
              key={item.id}
              onClick={() => setFacilityId(item.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-bold transition-colors',
                item.id === facility.id ? 'bg-surface text-primary-teal shadow-sm' : 'text-text-secondary hover:bg-hover',
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button
          onClick={onToggleColorblindMode}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-xs font-bold',
            colorblindMode ? 'border-primary-teal bg-primary-teal text-white' : 'border-border bg-surface text-text-primary',
          )}
        >
          {t('schedule:settingsPanel.colorBlindMode')}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-text-secondary" />
            <h3 className="text-xs font-bold text-ink">{t('schedule:settingsPanel.shiftsSection')}</h3>
            <span className="text-[10px] text-text-secondary">{t('schedule:settingsPanel.shiftsSubtitle')}</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {settings.shiftDefinitions.map((shift) => (
              <div key={shift.id} className={cn('grid grid-cols-[1fr_130px_110px_auto] gap-2 border-b border-border p-2 last:border-b-0', shift.archived && 'bg-surface-muted opacity-60')}>
                <input
                  value={shift.label}
                  disabled={shift.archived}
                  onChange={(event) => onUpdateShift(facility.id, shift.id, { label: event.target.value })}
                  className="h-8 rounded-md border border-border px-2 text-xs font-semibold text-ink focus:border-primary-teal focus:outline-none"
                />
                <input
                  value={shift.timeRange}
                  disabled={shift.archived}
                  onChange={(event) => onUpdateShift(facility.id, shift.id, { timeRange: event.target.value })}
                  className="h-8 rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
                  dir="ltr"
                />
                <select
                  value={shift.colorKey}
                  disabled={shift.archived}
                  onChange={(event) => onUpdateShift(facility.id, shift.id, { colorKey: event.target.value as ShiftColorKey })}
                  className="h-8 rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
                >
                  {COLOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => onArchiveShift(facility.id, shift.id)}
                  disabled={shift.archived}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-hover disabled:opacity-30"
                  aria-label={t('schedule:settingsPanel.archive')}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_130px_110px_auto] gap-2">
            <input
              value={newShiftLabel}
              onChange={(event) => setNewShiftLabel(event.target.value)}
              placeholder={t('schedule:settingsPanel.shiftNamePlaceholder')}
              className="h-8 rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
            />
            <input
              value={newShiftRange}
              onChange={(event) => setNewShiftRange(event.target.value)}
              className="h-8 rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
            />
            <select
              value={newShiftColor}
              onChange={(event) => setNewShiftColor(event.target.value as ShiftColorKey)}
              className="h-8 rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
            >
              {COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!newShiftLabel.trim()) return;
                onAddShift(facility.id, {
                  label: newShiftLabel.trim(),
                  timeRange: newShiftRange.trim(),
                  colorKey: newShiftColor,
                  effectiveFromDay: 1,
                });
                setNewShiftLabel('');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-teal text-white hover:bg-primary-teal/90"
              aria-label={t('schedule:settingsPanel.addShift')}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4 text-text-secondary" />
            <h3 className="text-xs font-bold text-ink">{t('schedule:settingsPanel.unitsSection')}</h3>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {settings.units.map((unit) => (
              <div key={unit.id} className={cn('grid grid-cols-[1fr_auto] gap-2 border-b border-border p-2 last:border-b-0', unit.archived && 'bg-surface-muted opacity-60')}>
                <input
                  value={unit.name}
                  disabled={unit.archived}
                  onChange={(event) => onRenameUnit(facility.id, unit.id, event.target.value)}
                  className="h-8 rounded-md border border-border px-2 text-xs font-semibold text-ink focus:border-primary-teal focus:outline-none"
                />
                <button
                  onClick={() => onArchiveUnit(facility.id, unit.id)}
                  disabled={unit.archived}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-hover disabled:opacity-30"
                  aria-label={t('schedule:settingsPanel.archive')}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={newUnitName}
              onChange={(event) => setNewUnitName(event.target.value)}
              placeholder={t('schedule:settingsPanel.unitNamePlaceholder')}
              className="h-8 rounded-md border border-border px-2 text-xs text-ink focus:border-primary-teal focus:outline-none"
            />
            <button
              onClick={() => {
                if (!newUnitName.trim()) return;
                onAddUnit(facility.id, newUnitName.trim());
                setNewUnitName('');
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-teal px-3 text-xs font-bold text-white hover:bg-primary-teal/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('schedule:settingsPanel.addUnit')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(ScheduleSettingsPanel);
