import { shiftChipStyle } from '@/lib/shiftColorPalette';
import type { OperationalShiftVisual } from '@/types/operationalSchedule';

/**
 * Resolves one operational occurrence to the same shift colors used by the
 * schedule matrix. Custom row colors win; the shared light/dark tokens remain
 * the fallback when a row has no explicit override.
 */
export function operationalShiftStyle(occurrence: OperationalShiftVisual) {
  return shiftChipStyle(
    occurrence.colorKey,
    occurrence.backgroundColor,
    occurrence.textColor,
  );
}

export const occurrenceShiftStyle = operationalShiftStyle;

export function operationalShiftVisualKey(visual: OperationalShiftVisual): string {
  return `${visual.colorKey}|${visual.backgroundColor || ''}|${visual.textColor || ''}`;
}

export function uniqueOperationalShiftVisuals(
  visuals: OperationalShiftVisual[],
): OperationalShiftVisual[] {
  const seen = new Set<string>();
  return visuals.filter((visual) => {
    const key = operationalShiftVisualKey(visual);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function operationalShiftBackgrounds(visuals: OperationalShiftVisual[]): string[] {
  return uniqueOperationalShiftVisuals(visuals).map((visual) => operationalShiftStyle(visual).backgroundColor);
}

export function operationalShiftGradient(visuals: OperationalShiftVisual[]): string {
  const backgrounds = operationalShiftBackgrounds(visuals);
  if (backgrounds.length <= 1) return backgrounds[0] || 'transparent';
  const segment = 100 / backgrounds.length;
  const stops = backgrounds.flatMap((color, index) => [
    `${color} ${index * segment}%`,
    `${color} ${(index + 1) * segment}%`,
  ]);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
