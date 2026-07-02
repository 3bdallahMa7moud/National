export interface Department {
  id: string;
  name: string;
  description: string;
  managerId?: string;
  employeeCount?: number;
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
