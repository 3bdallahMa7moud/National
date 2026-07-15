import type { Assignment, AssignmentStatus, LegendEmployee } from '@/types/scheduleMatrix';

interface AssignmentEmployee {
  employeeId: string;
  code: string;
}

/** Creates an assignment without a visual override; the target row owns its shift color. */
export function createShiftAssignment(
  employee: AssignmentEmployee,
  status?: AssignmentStatus,
): Assignment {
  return {
    employeeId: employee.employeeId,
    employeeCode: employee.code,
    ...(status ? { status } : {}),
  };
}

export type BrushMergeResult =
  | { ok: true; changed: boolean; assignments: Assignment[] }
  | { ok: false; reason: 'cell_full' };

export function mergeBrushAssignments(
  current: Assignment[],
  selected: Pick<LegendEmployee, 'employeeId' | 'code'>[],
): BrushMergeResult {
  const currentIds = new Set(current.map((assignment) => assignment.employeeId));
  const uniqueSelected = selected.filter(
    (employee, index, list) =>
      list.findIndex((candidate) => candidate.employeeId === employee.employeeId) === index,
  );
  const additions = uniqueSelected.filter((employee) => !currentIds.has(employee.employeeId));

  return {
    ok: true,
    changed: additions.length > 0,
    assignments: [
      ...current.map((assignment) => ({ ...assignment, status: 'draft' as const })),
      ...additions.map((employee) => createShiftAssignment(employee, 'draft')),
    ],
  };
}
