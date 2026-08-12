import type { ShiftType, ShiftTypeKey } from '@/types';

export const SHIFT_TYPES: ShiftType[] = [
  { id: 'st-1', key: 'morning', name: 'Day Shift', nameAr: 'Day Shift', color: '#22C55E', startTime: '07:00', endTime: '15:00', hours: 8 },
  { id: 'st-2', key: 'evening', name: 'Evening', nameAr: 'Evening', color: '#F59E0B', startTime: '15:00', endTime: '23:00', hours: 8 },
  { id: 'st-3', key: 'night', name: 'Night', nameAr: 'Night', color: '#8B5CF6', startTime: '23:00', endTime: '07:00', hours: 8 },
  { id: 'st-4', key: 'oncall', name: 'On-Call', nameAr: 'On-Call', color: '#2563EB', startTime: '00:00', endTime: '23:59', hours: 24 },
  { id: 'st-5', key: 'overtime', name: 'Overtime', nameAr: 'Overtime', color: '#F97316', startTime: '15:00', endTime: '19:00', hours: 4 },
  { id: 'st-6', key: 'vacation', name: 'Vacation', nameAr: 'Vacation', color: '#94A3B8', startTime: '00:00', endTime: '23:59', hours: 0 },
  { id: 'st-7', key: 'sick', name: 'Sick Leave', nameAr: 'Sick Leave', color: '#EF4444', startTime: '00:00', endTime: '23:59', hours: 0 },
  { id: 'st-8', key: 'training', name: 'Training', nameAr: 'Training', color: '#06B6D4', startTime: '08:00', endTime: '16:00', hours: 8 },
];

export function findShiftType(idOrKey: string): ShiftType | undefined {
  return SHIFT_TYPES.find((shiftType) => shiftType.id === idOrKey || shiftType.key === idOrKey);
}

export function isShiftTypeKey(value: string): value is ShiftTypeKey {
  return SHIFT_TYPES.some((shiftType) => shiftType.key === value);
}
