import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';

export function orderLateScheduleRows(rows: OTShiftRow[], units: OTUnit[]): OTShiftRow[] {
  const knownUnitIds = new Set(units.map((unit) => unit.id));
  const grouped = units.flatMap((unit) => rows.filter((row) => row.unitId === unit.id));
  const ungrouped = rows.filter((row) => !row.unitId || !knownUnitIds.has(row.unitId));
  return [...grouped, ...ungrouped];
}

export function isActiveLateScheduleRow(row: OTShiftRow, units: OTUnit[]): boolean {
  if (row.archived) return false;
  if (!row.unitId) return true;
  const unit = units.find((candidate) => candidate.id === row.unitId);
  return !unit || !unit.archived;
}
