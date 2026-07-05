// ============================================================
// getShiftChipClasses — Shift color helper
// ============================================================
// Maps colorKey × isDark → inline style object.
// Uses CSS custom properties from schedule-tokens.css.
// NEVER uses plain black or --ink on colored chip backgrounds.

import type { ShiftColorKey } from '@/types/scheduleMatrix';

interface ChipStyle {
  backgroundColor: string;
  color: string;
}

const LIGHT_MAP: Record<ShiftColorKey, ChipStyle> = {
  morning:     { backgroundColor: 'var(--chip-morning-bg)',   color: 'var(--chip-morning-text)' },
  evening:     { backgroundColor: 'var(--chip-evening-bg)',   color: 'var(--chip-evening-text)' },
  night:       { backgroundColor: 'var(--chip-night-bg)',     color: 'var(--chip-night-text)' },
  onCall:      { backgroundColor: 'var(--chip-oncall-bg)',    color: 'var(--chip-oncall-text)' },
  overtime:    { backgroundColor: 'var(--chip-overtime-bg)',  color: 'var(--chip-overtime-text)' },
  vacation:    { backgroundColor: 'var(--chip-vacation-bg)',  color: 'var(--chip-vacation-text)' },
};

const DARK_MAP: Record<ShiftColorKey, ChipStyle> = {
  morning:     { backgroundColor: 'var(--chip-morning-bg-dark)',   color: 'var(--chip-morning-text-dark)' },
  evening:     { backgroundColor: 'var(--chip-evening-bg-dark)',   color: 'var(--chip-evening-text-dark)' },
  night:       { backgroundColor: 'var(--chip-night-bg-dark)',     color: 'var(--chip-night-text-dark)' },
  onCall:      { backgroundColor: 'var(--chip-oncall-bg-dark)',    color: 'var(--chip-oncall-text-dark)' },
  overtime:    { backgroundColor: 'var(--chip-overtime-bg-dark)',  color: 'var(--chip-overtime-text-dark)' },
  vacation:    { backgroundColor: 'var(--chip-vacation-bg-dark)',  color: 'var(--chip-vacation-text-dark)' },
};

/**
 * Get inline style for a shift chip based on color key and dark mode.
 * For now we always return the light variant —
 * dark detection is handled via CSS class strategy in the parent.
 */
export function getShiftChipStyle(colorKey: ShiftColorKey, isDark = false): ChipStyle {
  return isDark ? DARK_MAP[colorKey] : LIGHT_MAP[colorKey];
}

/** Tailwind-compatible class names for the chip wrapper */
export function getShiftChipClasses(colorKey: ShiftColorKey): string {
  // We use data attributes for dark-mode CSS — see EmployeeChip component
  return `chip-${colorKey}`;
}
