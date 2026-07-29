import type {
  MarkerColor,
  ScheduleCellMarkerMap,
} from '@/types/scheduleMatrix';

export const MARKER_COLORS = [
  'yellow',
  'green',
  'red',
  'blue',
  'orange',
  'purple',
] as const satisfies readonly MarkerColor[];

export const SCHEDULE_CELL_MARKER_SWATCHES: ReadonlyArray<{
  color: MarkerColor;
  hex: string;
}> = [
  { color: 'yellow', hex: '#EAB308' },
  { color: 'green', hex: '#16A34A' },
  { color: 'red', hex: '#DC2626' },
  { color: 'blue', hex: '#2563EB' },
  { color: 'orange', hex: '#EA580C' },
  { color: 'purple', hex: '#9333EA' },
];

const markerColors = new Set<string>(MARKER_COLORS);
const markerKeyPattern = /^cell\|([^|]+)\|([1-9]\d*)$/;

export function scheduleCellMarkerKey(rowId: string, day: number): string {
  return `cell|${rowId}|${day}`;
}

export function isMarkerColor(value: unknown): value is MarkerColor {
  return typeof value === 'string' && markerColors.has(value);
}

export function normalizeScheduleCellMarkers(value: unknown): ScheduleCellMarkerMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const markers: ScheduleCellMarkerMap = {};
  for (const [key, color] of Object.entries(value)) {
    if (markerKeyPattern.test(key) && isMarkerColor(color)) markers[key] = color;
  }
  return markers;
}

export function countScheduleCellMarkers(value: unknown): number {
  return Object.keys(normalizeScheduleCellMarkers(value)).length;
}

export function pruneScheduleCellMarkers(
  value: unknown,
  activeRowIds: Iterable<string>,
  daysInMonth: number,
): ScheduleCellMarkerMap {
  const rowIds = new Set(activeRowIds);
  const markers = normalizeScheduleCellMarkers(value);

  return Object.fromEntries(
    Object.entries(markers).filter(([key]) => {
      const match = markerKeyPattern.exec(key);
      if (!match) return false;
      const day = Number(match[2]);
      return rowIds.has(match[1]) && day >= 1 && day <= daysInMonth;
    }),
  );
}

export function removeScheduleCellMarkersForRows(
  value: unknown,
  rowIdsToRemove: Iterable<string>,
): ScheduleCellMarkerMap {
  const removedRows = new Set(rowIdsToRemove);
  const markers = normalizeScheduleCellMarkers(value);

  return Object.fromEntries(
    Object.entries(markers).filter(([key]) => {
      const match = markerKeyPattern.exec(key);
      return !!match && !removedRows.has(match[1]);
    }),
  );
}

export function scheduleCellMarkerHex(color: MarkerColor): string {
  return SCHEDULE_CELL_MARKER_SWATCHES.find((swatch) => swatch.color === color)?.hex
    ?? '#EAB308';
}

export function scheduleCellMarkerBackground(color: MarkerColor): string {
  return `${scheduleCellMarkerHex(color)}4D`;
}
