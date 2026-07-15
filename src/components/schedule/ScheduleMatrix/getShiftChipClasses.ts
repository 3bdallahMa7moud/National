// ============================================================
// getShiftChipClasses — Shift color helper
// ============================================================
// Maps a row color key to the shared CSS custom properties.
// Uses CSS custom properties from schedule-tokens.css.
// NEVER uses plain black or --ink on colored chip backgrounds.

import type { ShiftColorKey } from '@/types/scheduleMatrix';
import { shiftChipStyle } from '@/lib/shiftColorPalette';

interface ChipStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

/**
 * Dark mode is resolved automatically by the token overrides on the root theme.
 */
export function getShiftChipStyle(colorKey: ShiftColorKey, backgroundColor?: string, textColor?: string): ChipStyle {
  return shiftChipStyle(colorKey, backgroundColor, textColor);
}
