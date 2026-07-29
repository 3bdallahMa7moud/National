import { describe, expect, it } from 'vitest';
import {
  countScheduleCellMarkers,
  normalizeScheduleCellMarkers,
  pruneScheduleCellMarkers,
  removeScheduleCellMarkersForRows,
  scheduleCellMarkerBackground,
  scheduleCellMarkerKey,
} from './scheduleCellMarkers';

describe('schedule cell marker utilities', () => {
  it('constructs stable keys and rejects malformed keys and colors', () => {
    expect(scheduleCellMarkerKey('row-1', 12)).toBe('cell|row-1|12');
    expect(normalizeScheduleCellMarkers({
      'cell|row-1|1': 'yellow',
      'cell|row-2|2': 'purple',
      'cell||3': 'red',
      'cell|row-3|0': 'green',
      'cell|row-4|4': 'pink',
      unrelated: 'blue',
    })).toEqual({
      'cell|row-1|1': 'yellow',
      'cell|row-2|2': 'purple',
    });
    expect(countScheduleCellMarkers({
      'cell|row-1|1': 'yellow',
      bad: 'blue',
    })).toBe(1);
    expect(scheduleCellMarkerBackground('purple')).toBe('#9333EA4D');
  });

  it('prunes inactive rows, out-of-month days, and permanently removed rows', () => {
    const source = {
      'cell|row-1|1': 'blue',
      'cell|row-1|31': 'orange',
      'cell|row-2|2': 'green',
    } as const;

    expect(pruneScheduleCellMarkers(source, ['row-1'], 30)).toEqual({
      'cell|row-1|1': 'blue',
    });
    expect(removeScheduleCellMarkersForRows(source, ['row-1'])).toEqual({
      'cell|row-2|2': 'green',
    });
  });
});
