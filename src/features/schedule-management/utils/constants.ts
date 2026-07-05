// ============================================================
// Shift Theme Configuration — Premium Design System Colors
// ============================================================
// Uses harmonious, muted pastels that feel clinical and premium.
// Each shift type has distinct light/dark mode colors.

import type { ShiftCategory, ShiftTheme } from '../types/schedule';

export const SHIFT_THEMES: Record<ShiftCategory, ShiftTheme> = {
  morning: {
    bg: 'bg-blue-50',
    bgDark: 'dark:bg-blue-950/40',
    text: 'text-blue-700',
    textDark: 'dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    hex: '#3B82F6',
    label: 'M',
    fullLabel: 'Morning',
    icon: 'Sun',
  },
  evening: {
    bg: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/40',
    text: 'text-amber-700',
    textDark: 'dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    hex: '#F59E0B',
    label: 'E',
    fullLabel: 'Evening',
    icon: 'Sunset',
  },
  night: {
    bg: 'bg-violet-50',
    bgDark: 'dark:bg-violet-950/40',
    text: 'text-violet-700',
    textDark: 'dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800',
    hex: '#8B5CF6',
    label: 'N',
    fullLabel: 'Night',
    icon: 'Moon',
  },
  vacation: {
    bg: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/40',
    text: 'text-emerald-700',
    textDark: 'dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    hex: '#10B981',
    label: 'V',
    fullLabel: 'Vacation',
    icon: 'Palmtree',
  },
  off: {
    bg: 'bg-slate-50',
    bgDark: 'dark:bg-slate-800/40',
    text: 'text-slate-400',
    textDark: 'dark:text-slate-500',
    border: 'border-slate-200 dark:border-slate-700',
    hex: '#94A3B8',
    label: '—',
    fullLabel: 'Off',
  },
  oncall: {
    bg: 'bg-rose-50',
    bgDark: 'dark:bg-rose-950/40',
    text: 'text-rose-700',
    textDark: 'dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    hex: '#F43F5E',
    label: 'OC',
    fullLabel: 'On Call',
    icon: 'Phone',
  },
  training: {
    bg: 'bg-cyan-50',
    bgDark: 'dark:bg-cyan-950/40',
    text: 'text-cyan-700',
    textDark: 'dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
    hex: '#06B6D4',
    label: 'T',
    fullLabel: 'Training',
    icon: 'GraduationCap',
  },
  pending: {
    bg: 'bg-yellow-50',
    bgDark: 'dark:bg-yellow-950/40',
    text: 'text-yellow-700',
    textDark: 'dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    hex: '#EAB308',
    label: 'P',
    fullLabel: 'Pending',
    icon: 'Clock',
  },
  weekend: {
    bg: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-950/40',
    text: 'text-indigo-700',
    textDark: 'dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    hex: '#6366F1',
    label: 'W',
    fullLabel: 'Weekend',
  },
  holiday: {
    bg: 'bg-pink-50',
    bgDark: 'dark:bg-pink-950/40',
    text: 'text-pink-700',
    textDark: 'dark:text-pink-300',
    border: 'border-pink-200 dark:border-pink-800',
    hex: '#EC4899',
    label: 'H',
    fullLabel: 'Public Holiday',
    icon: 'Star',
  },
  sick: {
    bg: 'bg-red-50',
    bgDark: 'dark:bg-red-950/40',
    text: 'text-red-700',
    textDark: 'dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    hex: '#EF4444',
    label: 'S',
    fullLabel: 'Sick Leave',
    icon: 'Thermometer',
  },
  overtime: {
    bg: 'bg-orange-50',
    bgDark: 'dark:bg-orange-950/40',
    text: 'text-orange-700',
    textDark: 'dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    hex: '#F97316',
    label: 'OT',
    fullLabel: 'Overtime',
    icon: 'Clock',
  },
} as const;

/** Department colors used for group headers */
export const DEPARTMENT_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#F97316', // orange
  '#6366F1', // indigo
] as const;

/** Column widths for the schedule grid */
export const GRID_CONFIG = {
  /** Width of the sticky employee name column */
  EMPLOYEE_COL_WIDTH: 220,
  /** Width of each day column */
  DAY_COL_WIDTH: 56,
  /** Height of each employee row */
  ROW_HEIGHT: 48,
  /** Height of department header rows */
  DEPT_HEADER_HEIGHT: 44,
  /** Height of the sticky header */
  HEADER_HEIGHT: 64,
  /** Overscan for virtualizer */
  OVERSCAN: 10,
} as const;
