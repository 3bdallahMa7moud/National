import type { Assignment, ShiftColorKey } from '@/types/scheduleMatrix';

export interface ShiftColorPair {
  background: string;
  text: string;
  border: string;
}

export interface ShiftColorPaletteEntry {
  light: ShiftColorPair;
  dark: ShiftColorPair;
}

export const SHIFT_COLOR_PALETTE: Record<ShiftColorKey, ShiftColorPaletteEntry> = {
  morning: {
    light: { background: '#D4E6E6', text: '#173952', border: '#4BB8AC' },
    dark: { background: '#17383D', text: '#BEE4E2', border: '#4BB8AC' },
  },
  evening: {
    light: { background: '#F9E298', text: '#6B4A00', border: '#FDB153' },
    dark: { background: '#3A2E12', text: '#FBE39C', border: '#A97821' },
  },
  night: {
    light: { background: '#C9EAF9', text: '#174A67', border: '#7DABCB' },
    dark: { background: '#15384C', text: '#BFE8FB', border: '#5E9BC2' },
  },
  onCall: {
    light: { background: '#FECD00', text: '#2B2100', border: '#D6A522' },
    dark: { background: '#4A3A00', text: '#FFE782', border: '#B99100' },
  },
  onCallNight: {
    light: { background: '#96D4F1', text: '#123D58', border: '#4590BA' },
    dark: { background: '#163E56', text: '#BFE9FF', border: '#4D9BC5' },
  },
  overtime: {
    light: { background: '#F8E1EA', text: '#7A1940', border: '#D89AB3' },
    dark: { background: '#401B2C', text: '#FFC1D9', border: '#A75578' },
  },
  vacation: {
    light: { background: '#EEF0F2', text: '#4B535D', border: '#B7C0C9' },
    dark: { background: '#232A33', text: '#D5DCE3', border: '#66717D' },
  },
};

export const SHIFT_COLOR_KEYS = Object.keys(SHIFT_COLOR_PALETTE) as ShiftColorKey[];

export function resolveAssignmentColorKey(_assignment: Pick<Assignment, 'colorKey'>, rowColorKey: ShiftColorKey): ShiftColorKey {
  return rowColorKey;
}

export function shiftCssStyle(colorKey: ShiftColorKey) {
  const cssKey = colorKey === 'onCall' ? 'oncall' : colorKey === 'onCallNight' ? 'oncall-night' : colorKey;
  return {
    backgroundColor: `var(--chip-${cssKey}-bg)`,
    color: `var(--chip-${cssKey}-text)`,
    borderColor: `var(--chip-${cssKey}-border)`,
  };
}

function luminance(hex: string) {
  const channels = hex.replace('#', '').match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255) || [];
  const [red = 0, green = 0, blue = 0] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string) {
  const firstLum = luminance(first);
  const secondLum = luminance(second);
  return (Math.max(firstLum, secondLum) + 0.05) / (Math.min(firstLum, secondLum) + 0.05);
}
