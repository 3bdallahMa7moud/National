import type { ShiftColorKey } from '@/types/scheduleMatrix';

export const SHIFT_COLOR_KEYS: ShiftColorKey[] = [
  'morning',
  'evening',
  'night',
  'onCall',
  'overtime',
  'vacation',
];

export function resolveAssignmentColorKey(
  assignment: { colorKey?: ShiftColorKey },
  rowColorKey: ShiftColorKey,
): ShiftColorKey {
  return assignment.colorKey || rowColorKey;
}
