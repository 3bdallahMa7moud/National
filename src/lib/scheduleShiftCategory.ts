import type { OperationalShiftCategory } from '@/types/operationalSchedule';
import type { ShiftColorKey } from '@/types/scheduleMatrix';

export type ResolvedScheduleShiftType =
  | 'day'
  | 'late'
  | 'night'
  | 'onCallDay'
  | 'onCallNight'
  | 'ot';

interface ScheduleShiftCategoryInput {
  colorKey?: ShiftColorKey;
  shiftLabel?: string;
  rowLabel?: string;
  unitLabel?: string;
  shiftDefinitionId?: string;
}

const OVERTIME_PATTERN = /\b(overtime|ot)\b|إضافي|اضافي/i;
const ON_CALL_PATTERN = /\b(on\s*-?\s*call|oncall|on\s*cal)\b|\bcall\s*(dsy|day|nsy|night)\b|استدعاء|تحت\s*الطلب|طلب/i;
const NIGHT_PATTERN = /\b(night|nsy|noc)\b|ليلي|ليل/i;
const LATE_PATTERN = /\b(late|evening)\b|مسائي|مساء/i;
const DAY_PATTERN = /\b(day|dsy|morning)\b|نهاري|نهار|صباح/i;

function combinedText({
  shiftLabel,
  rowLabel,
  unitLabel,
  shiftDefinitionId,
}: ScheduleShiftCategoryInput): string {
  return [shiftLabel, rowLabel, unitLabel, shiftDefinitionId]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function byColorKey(colorKey?: ShiftColorKey): ResolvedScheduleShiftType | null {
  switch (colorKey) {
    case 'morning': return 'day';
    case 'evening': return 'late';
    case 'night': return 'night';
    case 'onCall': return 'onCallDay';
    case 'onCallNight': return 'onCallNight';
    case 'overtime': return 'ot';
    default: return null;
  }
}

export function resolveScheduleShiftType(input: ScheduleShiftCategoryInput): ResolvedScheduleShiftType | null {
  const text = combinedText(input);

  if (OVERTIME_PATTERN.test(text)) return 'ot';

  const hasOnCall = ON_CALL_PATTERN.test(text);
  if (hasOnCall && NIGHT_PATTERN.test(text)) return 'onCallNight';
  if (hasOnCall) return 'onCallDay';

  if (NIGHT_PATTERN.test(text)) return 'night';
  if (LATE_PATTERN.test(text)) return 'late';
  if (DAY_PATTERN.test(text)) return 'day';

  return byColorKey(input.colorKey);
}

export function resolveOperationalShiftCategory(
  input: ScheduleShiftCategoryInput,
): OperationalShiftCategory | null {
  const resolved = resolveScheduleShiftType(input);
  if (resolved === 'late') return 'night';
  return resolved;
}
