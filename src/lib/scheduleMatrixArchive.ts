import type { ScheduleMatrixData, ShiftRow } from '@/types/scheduleMatrix';

type ScheduleArchiveSource = Pick<ScheduleMatrixData, 'settings'>;
type ArchiveAwareShiftRow = Pick<
  ShiftRow,
  'shiftDefinitionId' | 'shiftLabel' | 'timeRange' | 'colorKey'
>;

export function isShiftRowArchived(
  data: ScheduleArchiveSource,
  facilityId: string,
  row: ArchiveAwareShiftRow,
): boolean {
  const definitions = data.settings
    .find((settings) => settings.facilityId === facilityId)
    ?.shiftDefinitions ?? [];

  if (row.shiftDefinitionId) {
    return definitions.find((definition) => definition.id === row.shiftDefinitionId)?.archived === true;
  }

  const legacyMatches = definitions.filter((definition) =>
    definition.label === row.shiftLabel
    && definition.timeRange === row.timeRange
    && definition.colorKey === row.colorKey,
  );

  return legacyMatches.length > 0 && legacyMatches.every((definition) => definition.archived === true);
}

export function filterActiveScheduleRows<T extends ArchiveAwareShiftRow>(
  data: ScheduleArchiveSource,
  facilityId: string,
  rows: T[],
): T[] {
  const activeRows = rows.filter((row) => !isShiftRowArchived(data, facilityId, row));
  return activeRows.length === rows.length ? rows : activeRows;
}
