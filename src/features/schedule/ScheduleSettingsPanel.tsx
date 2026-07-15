// ============================================================
// ScheduleSettingsPanel - Responsive Shift definitions, units, and rows
// ============================================================

import { memo, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Clock3,
  FileDown,
  FileUp,
  LayoutGrid,
  Palette,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import { SHIFT_COLOR_PALETTE } from '@/lib/shiftColorPalette';
import { useTheme } from '@/hooks/useTheme';
import type { ScheduleMatrixData, ShiftColorKey, ShiftDefinition, ShiftRow } from '@/types/scheduleMatrix';

interface ScheduleSettingsPanelProps {
  data: ScheduleMatrixData;
  onAddShift: (facilityId: string, payload: Omit<ShiftDefinition, 'id' | 'facilityId'>) => void;
  onUpdateShift: (facilityId: string, shiftId: string, updates: Partial<ShiftDefinition>) => void;
  onDeleteShift: (facilityId: string, shiftId: string) => void;
  onArchiveShift: (facilityId: string, shiftId: string) => void;
  onRestoreShift: (facilityId: string, shiftId: string) => void;
  onAddUnit: (facilityId: string, name: string) => void;
  onRenameUnit: (facilityId: string, unitId: string, name: string) => void;
  onArchiveUnit: (facilityId: string, unitId: string) => void;
  onRestoreUnit: (facilityId: string, unitId: string) => void;
  onAddRow: (facilityId: string, unitId: string, shiftDefinitionId: string, rowLabel: string) => void;
  onUpdateRow: (
    rowId: string,
    updates: Partial<Pick<ShiftRow, 'rowLabel' | 'shiftDefinitionId' | 'weekendOnly'>>,
  ) => void;
  onArchiveRow: (rowId: string) => void;
  onRestoreRow?: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
}

const COLOR_OPTIONS: ShiftColorKey[] = ['morning', 'evening', 'night', 'onCall', 'onCallNight', 'overtime'];

const DEFAULT_SHIFT_FORM = {
  arabicName: '',
  englishName: '',
  startTime: '08:00',
  endTime: '17:00',
  colorKey: 'morning' as ShiftColorKey,
  backgroundColor: SHIFT_COLOR_PALETTE.morning.light.background,
  textColor: SHIFT_COLOR_PALETTE.morning.light.text,
  icon: '',
  shortCode: '',
};

function assignmentCount(row: ShiftRow): number {
  return Object.values(row.cellsByDay).reduce((sum, assignments) => sum + assignments.length, 0);
}

function colorForKey(key: ShiftColorKey, isDark = false) {
  return SHIFT_COLOR_PALETTE[key][isDark ? 'dark' : 'light'];
}

function ScheduleSettingsPanel({
  data,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onArchiveShift,
  onRestoreShift,
  onAddUnit,
  onRenameUnit,
  onArchiveUnit,
  onRestoreUnit,
  onAddRow,
  onUpdateRow,
  onArchiveRow,
  onRestoreRow,
  onDeleteRow,
}: ScheduleSettingsPanelProps) {
  const { t } = useTranslation(['schedule', 'common']);
  const { isDark } = useTheme();
  const [facilityId, setFacilityId] = useState(data.facilities[0]?.id || 'kamc');
  const [activeTab, setActiveTab] = useState<'shifts' | 'units' | 'palette'>('shifts');
  const [newUnitName, setNewUnitName] = useState('');
  const [shiftArchiveView, setShiftArchiveView] = useState<'active' | 'archived'>('active');
  const [unitArchiveView, setUnitArchiveView] = useState<'active' | 'archived'>('active');
  const [newShift, setNewShift] = useState(DEFAULT_SHIFT_FORM);
  const [rowDrafts, setRowDrafts] = useState<Record<string, { label: string; definitionId: string }>>({});
  const [paletteImport, setPaletteImport] = useState('');

  const facility = useMemo(
    () => data.facilities.find((item) => item.id === facilityId) || data.facilities[0],
    [data.facilities, facilityId],
  );

  const settings = useMemo(
    () => data.settings.find((item) => item.facilityId === facility?.id),
    [data.settings, facility?.id],
  );

  if (!facility || !settings) return null;

  const visibleShifts = settings.shiftDefinitions.filter((shift) =>
    shiftArchiveView === 'archived' ? shift.archived : !shift.archived,
  );
  const visibleUnits = settings.units.filter((unit) =>
    unitArchiveView === 'archived' ? unit.archived : !unit.archived,
  );
  const activeShiftDefinitions = settings.shiftDefinitions.filter((shift) => !shift.archived);
  const shiftById = new Map(settings.shiftDefinitions.map((shift) => [shift.id, shift]));
  const unitsById = new Map(facility.units.map((unit) => [unit.id, unit]));

  const handleNewShiftColorKey = (colorKey: ShiftColorKey) => {
    const palette = colorForKey(colorKey, isDark);
    setNewShift((current) => ({
      ...current,
      colorKey,
      backgroundColor: palette.background,
      textColor: palette.text,
    }));
  };

  const exportPalette = () => {
    const payload = settings.shiftDefinitions.map((shift) => ({
      id: shift.id,
      englishName: shift.englishName || shift.label,
      backgroundColor: shift.backgroundColor,
      textColor: shift.textColor,
      colorKey: shift.colorKey,
    }));
    setPaletteImport(JSON.stringify(payload, null, 2));
  };

  const importPalette = () => {
    try {
      const palette = JSON.parse(paletteImport) as Array<Partial<ShiftDefinition> & { id: string }>;
      palette.forEach((entry) => {
        if (!entry.id) return;
        onUpdateShift(facility.id, entry.id, {
          backgroundColor: entry.backgroundColor,
          textColor: entry.textColor,
          colorKey: entry.colorKey,
        });
      });
    } catch {
      // Invalid imports are ignored here; callers keep the draft text visible for correction.
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-soft overflow-hidden transition-all">
      {/* ── Top Header Bar ── */}
      <div className="border-b border-border/80 bg-surface-muted/40 px-4 py-3.5 sm:px-6">
        <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-teal/10 text-primary-teal shadow-sm">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-ink sm:text-base">{t('schedule:settingsPanel.title')}</h2>
              <p className="text-[11px] text-text-secondary">Customize shifts, organizational units, and row hierarchy</p>
            </div>
          </div>

          {/* Facility Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-border bg-surface p-0.5 shadow-sm">
              {data.facilities.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFacilityId(item.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                    item.id === facility.id
                      ? 'bg-primary-teal text-white shadow-sm'
                      : 'text-text-secondary hover:bg-hover hover:text-ink',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section Navigation Tabs (Full Width Responsive) ── */}
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all',
              activeTab === 'shifts'
                ? 'bg-surface text-primary-teal shadow-sm border border-border'
                : 'text-text-secondary hover:bg-hover/60 hover:text-ink',
            )}
          >
            <Clock3 className="h-4 w-4" />
            <span>Shift Definitions ({activeShiftDefinitions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all',
              activeTab === 'units'
                ? 'bg-surface text-primary-teal shadow-sm border border-border'
                : 'text-text-secondary hover:bg-hover/60 hover:text-ink',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Units & Rows ({visibleUnits.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('palette')}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all',
              activeTab === 'palette'
                ? 'bg-surface text-primary-teal shadow-sm border border-border'
                : 'text-text-secondary hover:bg-hover/60 hover:text-ink',
            )}
          >
            <Palette className="h-4 w-4" />
            <span>Color Palette & Tools</span>
          </button>
        </div>
      </div>

      {/* ── Main Panel Content ── */}
      <div className="p-4 sm:p-6">
        {/* ========================================================= */}
        {/* TAB 1: SHIFT DEFINITIONS */}
        {/* ========================================================= */}
        {activeTab === 'shifts' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Active/Archived Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-ink sm:text-base">Shift Types & Schedule Codes</h3>
                <p className="text-xs text-text-secondary">Configure shift hours, colors, short codes, and icons used across the schedule grid</p>
              </div>
              <div className="flex rounded-xl border border-border bg-surface-muted p-0.5 shadow-sm">
                {(['active', 'archived'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setShiftArchiveView(tab)}
                    className={cn(
                      'min-h-8 rounded-lg px-3.5 text-xs font-bold transition-all',
                      shiftArchiveView === tab ? 'bg-surface text-primary-teal shadow-sm' : 'text-text-secondary hover:text-ink',
                    )}
                  >
                    {tab === 'active' ? 'Active' : 'Archived'}
                  </button>
                ))}
              </div>
            </div>

            {/* Create New Shift Card (Only when viewing active shifts) */}
            {shiftArchiveView === 'active' && (
              <div className="rounded-2xl border border-primary-teal/25 bg-primary-teal/[0.03] p-4 sm:p-5 shadow-sm">
                <div className="mb-3.5 flex items-center gap-2 text-xs font-extrabold text-primary-teal">
                  <Plus className="h-4 w-4" />
                  <span>Create New Shift Definition</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-secondary">Arabic Name</label>
                    <input
                      value={newShift.arabicName}
                      onChange={(event) => setNewShift((current) => ({ ...current, arabicName: event.target.value }))}
                      placeholder="مثال: صباحي / مسائي"
                      className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15 shadow-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-secondary">English Name</label>
                    <input
                      value={newShift.englishName}
                      onChange={(event) => setNewShift((current) => ({ ...current, englishName: event.target.value }))}
                      placeholder="e.g. Morning / Evening"
                      className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15 shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-text-secondary">Start Time</label>
                      <input
                        type="time"
                        value={newShift.startTime}
                        onChange={(event) => setNewShift((current) => ({ ...current, startTime: event.target.value }))}
                        className="h-9 w-full rounded-xl border border-border bg-surface px-2 text-xs text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-text-secondary">End Time</label>
                      <input
                        type="time"
                        value={newShift.endTime}
                        onChange={(event) => setNewShift((current) => ({ ...current, endTime: event.target.value }))}
                        className="h-9 w-full rounded-xl border border-border bg-surface px-2 text-xs text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-secondary">Category / Preset</label>
                    <select
                      value={newShift.colorKey}
                      onChange={(event) => handleNewShiftColorKey(event.target.value as ShiftColorKey)}
                      className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                    >
                      {COLOR_OPTIONS.map((option) => (
                        <option key={option} value={option}>{t(`schedule:shiftColors.${option}`)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-secondary">Colors (Background & Text)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newShift.backgroundColor}
                        onChange={(event) => setNewShift((current) => ({ ...current, backgroundColor: event.target.value }))}
                        className="h-9 w-12 cursor-pointer rounded-xl border border-border bg-surface p-1 shadow-sm"
                        title="Background color"
                      />
                      <input
                        type="color"
                        value={newShift.textColor}
                        onChange={(event) => setNewShift((current) => ({ ...current, textColor: event.target.value }))}
                        className="h-9 w-12 cursor-pointer rounded-xl border border-border bg-surface p-1 shadow-sm"
                        title="Text color"
                      />
                      <div
                        className="flex-1 h-9 rounded-xl border px-3 flex items-center justify-center text-xs font-bold shadow-sm"
                        style={{ backgroundColor: newShift.backgroundColor, color: newShift.textColor, borderColor: newShift.backgroundColor }}
                      >
                        Live Preview
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-text-secondary">Short Code</label>
                      <input
                        value={newShift.shortCode}
                        onChange={(event) => setNewShift((current) => ({ ...current, shortCode: event.target.value }))}
                        placeholder="e.g. M"
                        className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:border-primary-teal focus:outline-none shadow-sm font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-text-secondary">Icon</label>
                      <input
                        value={newShift.icon}
                        onChange={(event) => setNewShift((current) => ({ ...current, icon: event.target.value }))}
                        placeholder="e.g. ☀️"
                        className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-xs text-ink focus:border-primary-teal focus:outline-none shadow-sm text-center"
                      />
                    </div>
                  </div>

                  <div className="flex items-end sm:col-span-2 md:col-span-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newShift.englishName.trim() && !newShift.arabicName.trim()) return;
                        const label = newShift.englishName.trim() || newShift.arabicName.trim();
                        const palette = SHIFT_COLOR_PALETTE[newShift.colorKey];
                        const isDefaultBg = newShift.backgroundColor === palette?.light.background
                          || newShift.backgroundColor === palette?.dark.background;
                        const isDefaultText = newShift.textColor === palette?.light.text
                          || newShift.textColor === palette?.dark.text;
                        onAddShift(facility.id, {
                          label,
                          arabicName: newShift.arabicName.trim() || label,
                          englishName: newShift.englishName.trim() || label,
                          startTime: newShift.startTime,
                          endTime: newShift.endTime,
                          timeRange: `${newShift.startTime} - ${newShift.endTime}`,
                          colorKey: newShift.colorKey,
                          backgroundColor: isDefaultBg ? undefined : newShift.backgroundColor,
                          textColor: isDefaultBg && isDefaultText ? undefined : newShift.textColor,
                          icon: newShift.icon.trim(),
                          shortCode: newShift.shortCode.trim(),
                          effectiveFromDay: 1,
                        });
                        setNewShift(DEFAULT_SHIFT_FORM);
                      }}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary-teal px-4 text-xs font-bold text-white shadow-md hover:bg-primary-teal/90 transition-all active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                      Add Shift Definition
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Shift Definitions Grid / List */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleShifts.map((shift) => {
                const palette = colorForKey(shift.colorKey, isDark);
                const backgroundColor = shift.backgroundColor || palette.background;
                const textColor = shift.textColor || palette.text;
                return (
                  <div
                    key={shift.id}
                    className={cn(
                      'rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary-teal/40 flex flex-col justify-between',
                      shift.archived && 'bg-surface-muted/60 opacity-60',
                    )}
                  >
                    {/* Shift Card Header with Preview Badge */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3">
                      <span
                        className="rounded-lg border px-3 py-1.5 text-xs font-extrabold shadow-sm"
                        style={{ backgroundColor, color: textColor, borderColor: backgroundColor }}
                      >
                        {shift.icon ? `${shift.icon} ` : ''}
                        {shift.englishName || shift.label} ({shift.shortCode || shift.colorKey})
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                        {t(`schedule:shiftColors.${shift.colorKey}`)}
                      </span>
                    </div>

                    {/* Editable Form Inputs */}
                    <div className="space-y-3 flex-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">Arabic Name</label>
                          <input
                            value={shift.arabicName || ''}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { arabicName: event.target.value })}
                            placeholder="Arabic"
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 text-xs text-ink focus:border-primary-teal focus:bg-surface focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">English Name</label>
                          <input
                            value={shift.englishName || shift.label}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { englishName: event.target.value, label: event.target.value })}
                            placeholder="English"
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2.5 text-xs font-semibold text-ink focus:border-primary-teal focus:bg-surface focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">Start Time</label>
                          <input
                            type="time"
                            value={shift.startTime || shift.timeRange.split(' - ')[0] || ''}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { startTime: event.target.value })}
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2 text-xs text-ink focus:border-primary-teal focus:bg-surface focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">End Time</label>
                          <input
                            type="time"
                            value={shift.endTime || shift.timeRange.split(' - ')[1] || ''}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { endTime: event.target.value })}
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2 text-xs text-ink focus:border-primary-teal focus:bg-surface focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_42px_42px] gap-2 items-end">
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">Preset Category</label>
                          <select
                            value={shift.colorKey}
                            disabled={shift.archived}
                            onChange={(event) => {
                              const colorKey = event.target.value as ShiftColorKey;
                              onUpdateShift(facility.id, shift.id, {
                                colorKey,
                                backgroundColor: undefined,
                                textColor: undefined,
                              });
                            }}
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2 text-xs text-ink focus:border-primary-teal focus:bg-surface focus:outline-none"
                          >
                            {COLOR_OPTIONS.map((option) => (
                              <option key={option} value={option}>{t(`schedule:shiftColors.${option}`)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5 text-center">BG</label>
                          <input
                            type="color"
                            value={backgroundColor}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { backgroundColor: event.target.value })}
                            className="h-8.5 w-full cursor-pointer rounded-xl border border-border bg-surface p-1 shadow-sm"
                            title="Background color"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5 text-center">Text</label>
                          <input
                            type="color"
                            value={textColor}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { textColor: event.target.value })}
                            className="h-8.5 w-full cursor-pointer rounded-xl border border-border bg-surface p-1 shadow-sm"
                            title="Text color"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">Short Code</label>
                          <input
                            value={shift.shortCode || ''}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { shortCode: event.target.value })}
                            placeholder="Code (M)"
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2 text-xs font-mono font-bold text-ink focus:border-primary-teal focus:bg-surface focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">Icon</label>
                          <input
                            value={shift.icon || ''}
                            disabled={shift.archived}
                            onChange={(event) => onUpdateShift(facility.id, shift.id, { icon: event.target.value })}
                            placeholder="Icon (☀️)"
                            className="h-8.5 w-full rounded-xl border border-border bg-surface-muted/50 px-2 text-xs text-ink focus:border-primary-teal focus:bg-surface focus:outline-none text-center"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-4">
                      <div />

                      <div className="flex items-center gap-1.5">
                        {!shift.archived ? (
                          <button
                            type="button"
                            onClick={() => onArchiveShift(facility.id, shift.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:bg-hover hover:text-ink"
                            aria-label="Archive shift"
                            title="Archive shift"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRestoreShift(facility.id, shift.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-teal/30 bg-primary-teal/10 text-primary-teal hover:bg-primary-teal/20"
                            aria-label="Restore shift"
                            title="Restore shift"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteShift(facility.id, shift.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger/30 bg-danger-50 text-danger hover:bg-danger hover:text-white transition-colors"
                          aria-label="Delete shift"
                          title="Delete shift"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleShifts.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Clock3 className="mx-auto h-8 w-8 text-text-secondary/50 mb-2" />
                <p className="text-sm font-bold text-ink">No shift definitions found in this view</p>
                <p className="text-xs text-text-secondary mt-1">Switch tabs above or create your first shift definition</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: UNITS & ROWS */}
        {/* ========================================================= */}
        {activeTab === 'units' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Quick Add Unit Bar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-ink sm:text-base">Organizational Units & Bed Hierarchy</h3>
                <p className="text-xs text-text-secondary">Rename departments, reorder rows, and assign default shift types</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl border border-border bg-surface-muted p-0.5 shadow-sm">
                  {(['active', 'archived'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setUnitArchiveView(tab)}
                      className={cn(
                        'min-h-8 rounded-lg px-3.5 text-xs font-bold transition-all',
                        unitArchiveView === tab ? 'bg-surface text-primary-teal shadow-sm' : 'text-text-secondary hover:text-ink',
                      )}
                    >
                      {tab === 'active' ? 'Active Units' : 'Archived Units'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Add New Unit Card */}
            {unitArchiveView === 'active' && (
              <div className="rounded-2xl border border-border bg-surface-muted/40 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-ink shrink-0">
                  <Plus className="h-4 w-4 text-primary-teal" />
                  <span>Add Organizational Unit:</span>
                </div>
                <input
                  value={newUnitName}
                  onChange={(event) => setNewUnitName(event.target.value)}
                  placeholder="e.g. ICU - Ward A / Emergency Department"
                  className="h-9 flex-1 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newUnitName.trim()) return;
                    onAddUnit(facility.id, newUnitName.trim());
                    setNewUnitName('');
                  }}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary-teal px-5 text-xs font-bold text-white shadow-sm hover:bg-primary-teal/90 transition-all active:scale-95 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Unit
                </button>
              </div>
            )}

            {/* Units & Rows List */}
            <div className="space-y-4">
              {visibleUnits.map((unitDef, idx) => {
                const unit = unitsById.get(unitDef.id);
                const draft = rowDrafts[unitDef.id] || { label: '', definitionId: activeShiftDefinitions[0]?.id || '' };
                return (
                  <div
                    key={unitDef.id}
                    className={cn(
                      'rounded-2xl border border-border bg-surface shadow-sm overflow-hidden transition-all',
                      unitDef.archived && 'opacity-70 bg-surface-muted/40',
                    )}
                  >
                    {/* Unit Header Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-surface-muted/60 p-4">
                      <div className="flex items-center gap-2.5 flex-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-teal/10 text-primary-teal font-extrabold text-xs">
                          {idx + 1}
                        </div>
                        <input
                          value={unitDef.name}
                          disabled={unitDef.archived}
                          onChange={(event) => onRenameUnit(facility.id, unitDef.id, event.target.value)}
                          placeholder="Unit Name"
                          className="h-9 w-full max-w-md rounded-xl border border-border bg-surface px-3 text-sm font-extrabold text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                        />
                      </div>

                      {/* Unit Action Controls */}
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            unitDef.archived ? onRestoreUnit(facility.id, unitDef.id) : onArchiveUnit(facility.id, unitDef.id)
                          }
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors',
                            unitDef.archived
                              ? 'border-primary-teal/30 bg-primary-teal/10 text-primary-teal hover:bg-primary-teal/20'
                              : 'border-border bg-surface text-text-secondary hover:bg-hover hover:text-ink',
                          )}
                          aria-label={unitDef.archived ? 'Restore unit' : 'Archive unit'}
                          title={unitDef.archived ? 'Restore unit' : 'Archive unit'}
                        >
                          {unitDef.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Rows Inside Unit */}
                    {!unitDef.archived && (
                      <div className="p-4 space-y-3">
                        <div className="space-y-2">
                          {(unit?.rows || []).map((row, rowIndex) => {
                            const rowShift = row.shiftDefinitionId ? shiftById.get(row.shiftDefinitionId) : undefined;
                            const count = assignmentCount(row);
                            return (
                              <div
                                key={row.id}
                                className={cn(
                                  'flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-surface-muted/30 p-3 transition-all hover:border-border hover:bg-surface-muted/60',
                                  row.archived && 'opacity-50 bg-surface-muted',
                                )}
                              >
                                {/* Row Label Input */}
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-text-secondary/70 shrink-0 w-6">#{rowIndex + 1}</span>
                                  <input
                                    value={row.rowLabel}
                                    disabled={row.archived}
                                    onChange={(event) => onUpdateRow(row.id, { rowLabel: event.target.value })}
                                    placeholder="Row / Bed Label"
                                    className="h-8.5 w-full rounded-lg border border-border bg-surface px-3 text-xs font-bold text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                                  />
                                </div>

                                {/* Default Shift Selector & Count */}
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                                  <select
                                    value={row.shiftDefinitionId || ''}
                                    disabled={row.archived}
                                    onChange={(event) => onUpdateRow(row.id, { shiftDefinitionId: event.target.value })}
                                    className="h-8.5 w-full sm:w-[190px] rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                                  >
                                    {activeShiftDefinitions.map((definition) => (
                                      <option key={definition.id} value={definition.id}>{definition.englishName || definition.label}</option>
                                    ))}
                                  </select>

                                  <span
                                    className="h-8.5 min-w-[36px] rounded-lg border px-2.5 flex items-center justify-center text-xs font-extrabold shadow-sm shrink-0"
                                    style={{
                                      backgroundColor: rowShift?.backgroundColor || colorForKey(row.colorKey, isDark).background,
                                      color: rowShift?.textColor || colorForKey(row.colorKey, isDark).text,
                                      borderColor: rowShift?.backgroundColor || colorForKey(row.colorKey, isDark).border,
                                    }}
                                    title="Total employee shift assignments in this row"
                                  >
                                    {count} shifts
                                  </span>

                                  {/* Row Action Buttons */}
                                  <div className="flex items-center gap-1 ms-auto sm:ms-0 bg-surface rounded-lg border border-border p-0.5 shadow-sm">
                                    {row.archived ? (
                                      <button
                                        type="button"
                                        onClick={() => onRestoreRow?.(row.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-primary-teal hover:bg-primary-teal/10"
                                        aria-label="Restore row"
                                        title="Restore row"
                                      >
                                        <ArchiveRestore className="h-3.5 w-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onArchiveRow(row.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-hover hover:text-ink"
                                        aria-label="Archive row"
                                        title="Archive row"
                                      >
                                        <Archive className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onDeleteRow(row.id)}
                                      className="flex h-7 w-7 items-center justify-center rounded-md text-danger hover:bg-danger-50"
                                      aria-label="Delete row"
                                      title="Delete row"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {(unit?.rows || []).length === 0 && (
                            <p className="py-4 text-center text-xs text-text-secondary italic">
                              No rows inside this unit yet. Add one below!
                            </p>
                          )}
                        </div>

                        {/* Add Row Bar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 border-t border-border/60">
                          <input
                            value={draft.label}
                            onChange={(event) =>
                              setRowDrafts((current) => ({ ...current, [unitDef.id]: { ...draft, label: event.target.value } }))
                            }
                            placeholder="New Row / Bed Name (e.g. Bed 1 - Morning)"
                            className="h-9 flex-1 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                          />
                          <select
                            value={draft.definitionId}
                            onChange={(event) =>
                              setRowDrafts((current) => ({ ...current, [unitDef.id]: { ...draft, definitionId: event.target.value } }))
                            }
                            className="h-9 w-full sm:w-[200px] rounded-xl border border-border bg-surface px-3 text-xs font-medium text-ink focus:border-primary-teal focus:outline-none shadow-sm"
                          >
                            {activeShiftDefinitions.map((definition) => (
                              <option key={definition.id} value={definition.id}>{definition.englishName || definition.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!draft.label.trim() || !draft.definitionId}
                            onClick={() => {
                              onAddRow(facility.id, unitDef.id, draft.definitionId, draft.label.trim());
                              setRowDrafts((current) => ({ ...current, [unitDef.id]: { ...draft, label: '' } }));
                            }}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary-teal px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-teal/90 disabled:opacity-40 transition-all active:scale-95 shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                            Add Row
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleUnits.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                  <LayoutGrid className="mx-auto h-8 w-8 text-text-secondary/50 mb-2" />
                  <p className="text-sm font-bold text-ink">No units found in this view</p>
                  <p className="text-xs text-text-secondary mt-1">Add a new unit above to organize your facility schedule</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: COLOR PALETTE & TOOLS */}
        {/* ========================================================= */}
        {activeTab === 'palette' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary-teal" />
                    <span>Export & Import Color Palettes</span>
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    Backup or transfer customized shift background and text color presets across hospital facilities
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={exportPalette} icon={<FileDown className="h-4 w-4" />}>
                    Export JSON
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={importPalette} icon={<FileUp className="h-4 w-4" />}>
                    Import JSON
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      settings.shiftDefinitions.forEach((shift) => {
                        onUpdateShift(facility.id, shift.id, { backgroundColor: undefined, textColor: undefined });
                      });
                    }}
                    icon={<RotateCcw className="h-4 w-4" />}
                  >
                    Reset Defaults
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-ink">Palette JSON Data</label>
                <textarea
                  value={paletteImport}
                  onChange={(event) => setPaletteImport(event.target.value)}
                  rows={8}
                  placeholder="Click 'Export JSON' to view current palette, or paste an exported palette JSON here and click 'Import JSON' to apply."
                  className="w-full rounded-xl border border-border bg-surface-muted/40 p-3.5 font-mono text-xs text-ink focus:border-primary-teal focus:bg-surface focus:outline-none shadow-inner"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default memo(ScheduleSettingsPanel);
