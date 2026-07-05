import type { TFunction } from 'i18next';
import type { ShiftTypeKey } from '@/types';

export function getShiftLabel(t: TFunction, type: ShiftTypeKey | string): string {
  return t(`common:shifts.${type}`, { defaultValue: type });
}
