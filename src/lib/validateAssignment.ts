// ============================================================
// validateAssignment - Pure client-side conflict detection
// ============================================================
// Conflicts have been disabled as per user request.

import type {
  Assignment,
  ScheduleMatrixData,
  ValidateResult,
} from '@/types/scheduleMatrix';

/**
 * Validate a proposed assignment against the full matrix.
 * Conflicts disabled: always returns ok.
 */
export function validateAssignment(
  _data: ScheduleMatrixData,
  _proposed: {
    facilityId: string;
    unitId: string;
    rowId: string;
    day: number;
    employeeId: string;
    timeRange: string;
  },
): ValidateResult {
  void _data;
  void _proposed;
  return { ok: true };
}

export function validateAssignmentsForCell(
  _data: ScheduleMatrixData,
  _proposed: {
    facilityId: string;
    unitId: string;
    rowId: string;
    day: number;
    timeRange: string;
    assignments: Assignment[];
  },
): ValidateResult {
  void _data;
  void _proposed;
  return { ok: true };
}

/**
 * Scan entire matrix and clear any conflict flags.
 */
export function recalculateAllConflicts(data: ScheduleMatrixData): void {
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const day of Object.keys(row.cellsByDay).map(Number)) {
          const assignments = row.cellsByDay[day] || [];
          for (const assignment of assignments) {
            if (assignment.hasConflict || assignment.conflictReason || assignment.conflictType) {
              assignment.hasConflict = false;
              assignment.conflictReason = undefined;
              assignment.conflictType = undefined;
            }
          }
        }
      }
    }
  }
}
