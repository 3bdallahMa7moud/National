import { describe, expect, it } from 'vitest';
import { resolveOperationalShiftCategory, resolveScheduleShiftType } from './scheduleShiftCategory';

describe('scheduleShiftCategory', () => {
  it('classifies on-call abbreviations even when the stored color is wrong', () => {
    expect(resolveScheduleShiftType({
      colorKey: 'morning',
      shiftLabel: 'Call DSY',
      unitLabel: 'On Cal',
    })).toBe('onCallDay');

    expect(resolveScheduleShiftType({
      colorKey: 'night',
      shiftLabel: 'Call NSY',
    })).toBe('onCallNight');
  });

  it('falls back to shift definition ids and preserves late shifts separately', () => {
    expect(resolveScheduleShiftType({
      colorKey: 'morning',
      rowLabel: 'Weekend Day',
      shiftDefinitionId: 'custom-oncall-day',
    })).toBe('onCallDay');

    expect(resolveScheduleShiftType({
      colorKey: 'evening',
      shiftLabel: 'Late Shift',
    })).toBe('late');
  });

  it('maps late shifts to the night operational bucket', () => {
    expect(resolveOperationalShiftCategory({
      colorKey: 'evening',
      shiftLabel: 'Late Shift',
    })).toBe('night');
  });
});
