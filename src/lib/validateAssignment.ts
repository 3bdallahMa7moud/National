// ============================================================
// validateAssignment - Pure client-side conflict detection
// ============================================================

import type {
  Assignment,
  ConflictDetail,
  ScheduleMatrixData,
  ValidateResult,
} from '@/types/scheduleMatrix';

/**
 * Parse time range string (e.g. "08:00 - 16:00" or "08:00–16:00") into minutes from midnight.
 */
export function parseTimeRange(timeRangeStr: string): { start: number; end: number } | null {
  if (!timeRangeStr) return null;
  const cleaned = timeRangeStr.replace('–', '-');
  const parts = cleaned.split('-').map((s) => s.trim());
  if (parts.length !== 2) return null;

  const parseMinutes = (t: string) => {
    const match = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };

  const start = parseMinutes(parts[0]);
  let end = parseMinutes(parts[1]);

  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60; // Overnight shift

  return { start, end };
}

/**
 * Check if two time ranges overlap.
 */
export function isTimeRangeOverlapping(rangeA: string, rangeB: string): boolean {
  const timeA = parseTimeRange(rangeA);
  const timeB = parseTimeRange(rangeB);
  if (!timeA || !timeB) return true; // Default to true if time ranges cannot be parsed safely

  return Math.max(timeA.start, timeB.start) < Math.min(timeA.end, timeB.end);
}

/**
 * Scan entire matrix and recalculate all conflict flags across facilities, units, rows, and vacations.
 */
export function recalculateAllConflicts(data: ScheduleMatrixData): void {
  if (!data) return;

  // 1. Reset all conflict flags
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const dayStr of Object.keys(row.cellsByDay)) {
          const day = Number(dayStr);
          const assignments = row.cellsByDay[day] || [];
          for (const assignment of assignments) {
            assignment.hasConflict = false;
            assignment.conflictReason = undefined;
            assignment.conflictType = undefined;
          }
        }
      }
    }
  }

  // 2. Build index of employee vacations: Map<employeeId, Set<day>>
  const vacationIndex = new Map<string, Set<number>>();
  if (data.vacations) {
    for (const v of data.vacations) {
      if (!vacationIndex.has(v.employeeId)) {
        vacationIndex.set(v.employeeId, new Set());
      }
      const daysSet = vacationIndex.get(v.employeeId)!;
      for (const d of v.daysOff) {
        daysSet.add(d);
      }
    }
  }

  // 3. Index all assignments by employeeId and day
  interface AssignmentOccurrence {
    facilityId: string;
    facilityName: string;
    unitId: string;
    unitName: string;
    rowId: string;
    shiftLabel: string;
    timeRange: string;
    day: number;
    assignment: Assignment;
  }

  const occurrencesByEmpDay = new Map<string, AssignmentOccurrence[]>();

  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        for (const dayStr of Object.keys(row.cellsByDay)) {
          const day = Number(dayStr);
          const assignments = row.cellsByDay[day] || [];
          for (const assignment of assignments) {
            const key = `${assignment.employeeId}::${day}`;
            if (!occurrencesByEmpDay.has(key)) {
              occurrencesByEmpDay.set(key, []);
            }
            occurrencesByEmpDay.get(key)!.push({
              facilityId: facility.id,
              facilityName: facility.name,
              unitId: unit.id,
              unitName: unit.name,
              rowId: row.id,
              shiftLabel: row.shiftLabel,
              timeRange: row.timeRange,
              day,
              assignment,
            });
          }
        }
      }
    }
  }

  // 4. Check for vacation conflicts
  for (const [key, occurrences] of occurrencesByEmpDay.entries()) {
    const [empId, dayStr] = key.split('::');
    const day = Number(dayStr);
    const daysOffSet = vacationIndex.get(empId);

    if (daysOffSet && daysOffSet.has(day)) {
      for (const occ of occurrences) {
        occ.assignment.hasConflict = true;
        occ.assignment.conflictType = 'vacation';
        occ.assignment.conflictReason = 'Employee has an approved vacation on this day';
      }
    }
  }

  // 5. Check for double booking & time overlap conflicts
  for (const occurrences of occurrencesByEmpDay.values()) {
    if (occurrences.length <= 1) continue;

    for (let i = 0; i < occurrences.length; i++) {
      for (let j = i + 1; j < occurrences.length; j++) {
        const occA = occurrences[i];
        const occB = occurrences[j];

        // Different facility or unit
        const isCrossFacility = occA.facilityId !== occB.facilityId;
        const overlapsInTime = isTimeRangeOverlapping(occA.timeRange, occB.timeRange);

        if (isCrossFacility || overlapsInTime) {
          const type: 'crossFacility' | 'timeOverlap' = isCrossFacility ? 'crossFacility' : 'timeOverlap';
          const reason = isCrossFacility
            ? `Double assignment conflict between facility (${occA.facilityName}) and (${occB.facilityName})`
            : `Overlapping shift schedules on the same day (${occA.timeRange} & ${occB.timeRange})`;

          occA.assignment.hasConflict = true;
          occA.assignment.conflictType = type;
          occA.assignment.conflictReason = reason;

          occB.assignment.hasConflict = true;
          occB.assignment.conflictType = type;
          occB.assignment.conflictReason = reason;
        }
      }
    }
  }
}

/**
 * Validate a proposed single assignment against the full matrix.
 */
export function validateAssignment(
  data: ScheduleMatrixData,
  proposed: {
    facilityId: string;
    unitId: string;
    rowId: string;
    day: number;
    employeeId: string;
    timeRange: string;
  },
): ValidateResult {
  if (!data) return { ok: true };

  // Check vacation conflict
  const vacationRow = data.vacations?.find((v) => v.employeeId === proposed.employeeId);
  if (vacationRow && vacationRow.daysOff.includes(proposed.day)) {
    const conflict: ConflictDetail = {
      day: proposed.day,
      type: 'vacation',
      reason: 'Employee has an approved vacation on this day',
    };
    return { ok: false, conflict };
  }

  // Check existing assignments on the same day
  for (const facility of data.facilities) {
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        const assignments = row.cellsByDay[proposed.day] || [];
        for (const a of assignments) {
          if (a.employeeId === proposed.employeeId) {
            const isCrossFacility = facility.id !== proposed.facilityId;
            const overlapsInTime = isTimeRangeOverlapping(row.timeRange, proposed.timeRange);

            if (isCrossFacility || overlapsInTime) {
              const conflict: ConflictDetail = {
                facility: facility.name,
                unit: unit.name,
                shiftLabel: row.shiftLabel,
                day: proposed.day,
                timeRange: row.timeRange,
                type: isCrossFacility ? 'crossFacility' : 'vacation',
                reason: isCrossFacility
                  ? `Double booking conflict with facility ${facility.name}`
                  : `Overlapping time with shift ${row.shiftLabel} (${row.timeRange})`,
              };
              return { ok: false, conflict };
            }
          }
        }
      }
    }
  }

  return { ok: true };
}

export function validateAssignmentsForCell(
  data: ScheduleMatrixData,
  proposed: {
    facilityId: string;
    unitId: string;
    rowId: string;
    day: number;
    timeRange: string;
    assignments: Assignment[];
  },
): ValidateResult {
  for (const a of proposed.assignments) {
    const result = validateAssignment(data, {
      facilityId: proposed.facilityId,
      unitId: proposed.unitId,
      rowId: proposed.rowId,
      day: proposed.day,
      employeeId: a.employeeId,
      timeRange: proposed.timeRange,
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

