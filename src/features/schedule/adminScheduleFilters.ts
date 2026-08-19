import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';

interface AdminScheduleDisplayOptions {
  facilityFilter: string;
  shiftFilter: ShiftColorKey | '';
  conflictsOnly: boolean;
}

export function buildAdminScheduleDisplayData(
  data: ScheduleMatrixData | null,
  options: AdminScheduleDisplayOptions,
): ScheduleMatrixData | null {
  if (!data) return null;

  const facilities = data.facilities
    .filter((facility) => !options.facilityFilter || facility.id === options.facilityFilter)
    .map((facility) => {
      const units = facility.units
        .filter((unit) => !unit.archived)
        .map((unit) => {
          let rows = filterActiveScheduleRows(data, facility.id, unit.rows);

          if (options.shiftFilter) {
            rows = rows.filter((row) => row.colorKey === options.shiftFilter);
          }

          if (options.conflictsOnly) {
            rows = rows.filter((row) =>
              Object.values(row.cellsByDay).some((assignments) =>
                assignments.some((assignment) => assignment.hasConflict),
              ),
            );
          }

          return rows === unit.rows ? unit : { ...unit, rows };
        })
        .filter((unit) => unit.rows.length > 0);

      return units === facility.units ? facility : { ...facility, units };
    })
    .filter((facility) => facility.units.length > 0);

  return facilities === data.facilities ? data : { ...data, facilities };
}
