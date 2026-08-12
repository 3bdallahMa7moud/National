import type { LocalizedText } from './localized';

export interface Department {
  id: string;
  name: string;
  description: string;
  managerId?: string;
  employeeCount?: number;
}

export interface DepartmentRecord {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  managerId?: string;
}

export type ShiftTypeKey = 'morning' | 'evening' | 'night' | 'oncall' | 'overtime' | 'vacation' | 'sick' | 'training';

export interface ShiftType {
  id: string;
  key: ShiftTypeKey;
  name: string;
  nameAr: string;
  color: string;
  startTime: string;
  endTime: string;
  hours: number;
}
