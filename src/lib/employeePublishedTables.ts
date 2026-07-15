import type { OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { ScheduleMatrixData } from '@/types/scheduleMatrix';

export const DEFAULT_SCHEDULE_DEPARTMENT_ID = 'dept-1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Produces the employee-facing Schedule matrix. It deliberately removes audit
 * history and draft/archived content while retaining facility, unit and row
 * order. Supplying an employee id keeps the complete table structure but only
 * that employee's assignments and vacation row.
 */
export function projectPublishedScheduleMatrix(
  source: ScheduleMatrixData | undefined,
  departmentId: string,
  employeeId?: string,
): ScheduleMatrixData | null {
  if (!source || (source.departmentId || DEFAULT_SCHEDULE_DEPARTMENT_ID) !== departmentId) return null;

  const matrix = clone(source);
  matrix.departmentId = matrix.departmentId || DEFAULT_SCHEDULE_DEPARTMENT_ID;
  matrix.auditLog = [];
  matrix.facilities = matrix.facilities.map((facility) => ({
    ...facility,
    units: facility.units
      .filter((unit) => !unit.archived)
      .map((unit) => ({
        ...unit,
        rows: unit.rows
          .filter((row) => !row.archived)
          .map((row) => ({
            ...row,
            cellsByDay: Object.fromEntries(
              Object.entries(row.cellsByDay).map(([day, assignments]) => [
                day,
                assignments.filter((assignment) =>
                  assignment.status !== 'draft'
                  && (!employeeId || assignment.employeeId === employeeId)),
              ]),
            ),
          })),
      })),
  }));

  matrix.vacations = matrix.vacations
    .filter((vacation) => !employeeId || vacation.employeeId === employeeId)
    .map((vacation) => {
      const publishedRanges = vacation.ranges?.filter((range) => range.status !== 'draft');
      return {
        ...vacation,
        ranges: publishedRanges,
        daysOff: vacation.ranges
          ? [...new Set((publishedRanges || []).flatMap((range) =>
              Array.from({ length: range.endDay - range.startDay + 1 }, (_, index) => range.startDay + index),
            ))].sort((left, right) => left - right)
          : vacation.daysOff,
      };
    });

  if (employeeId) {
    matrix.legend = matrix.legend.filter((employee) => employee.employeeId === employeeId);
  }

  return matrix;
}

/** Retains OT unit/row order and filters only cell assignments for My Schedule. */
export function projectPublishedOTTable(
  rows: OTShiftRow[] | undefined,
  units: OTUnit[] | undefined,
  employeeId?: string,
): { rows: OTShiftRow[]; units: OTUnit[] } | null {
  if (!rows || !units) return null;
  const activeUnits = clone(units).filter((unit) => !unit.archived);
  const activeUnitIds = new Set(activeUnits.map((unit) => unit.id));
  const projectedRows = clone(rows)
    .filter((row) => !row.archived && (!row.unitId || activeUnitIds.has(row.unitId)))
    .map((row) => ({
      ...row,
      assignments: Object.fromEntries(
        Object.entries(row.assignments).map(([day, assignments]) => [
          day,
          employeeId
            ? assignments.filter((assignment) => assignment.kind === 'employee' && assignment.employeeId === employeeId)
            : assignments,
        ]),
      ),
    }));
  return { rows: projectedRows, units: activeUnits };
}

