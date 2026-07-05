// ============================================================
// Mock Data Generator — Schedule Management
// ============================================================
// Generates realistic hospital schedule data for development.
// Supports 1000+ employees across multiple departments.

import type {
  ScheduleDepartment,
  ScheduleEmployee,
  ScheduleEntry,
  ShiftCategory,
  ScheduleRoom,
} from '../types/schedule';
import { DEPARTMENT_COLORS } from './constants';

// ── Department & Room Definitions ──────────────────────────

const DEPARTMENT_DEFS: Array<{
  name: string;
  rooms: string[];
}> = [
  {
    name: 'CT Department',
    rooms: ['GE VCT', 'GE Discovery', 'SIEMENS Flash', 'ER CT', 'Late Shift', 'Weekend'],
  },
  {
    name: 'MRI Department',
    rooms: ['Room 1', 'Room 2', 'Room 3', 'Weekend'],
  },
  {
    name: 'Emergency',
    rooms: ['Day Shift', 'Night Shift', 'Triage', 'Resuscitation'],
  },
  {
    name: 'X-Ray Department',
    rooms: ['Room A', 'Room B', 'Portable', 'OR Suite', 'Weekend'],
  },
  {
    name: 'Ultrasound',
    rooms: ['Room 1', 'Room 2', 'Emergency US'],
  },
  {
    name: 'Nuclear Medicine',
    rooms: ['PET/CT', 'SPECT', 'Therapy Room'],
  },
  {
    name: 'Interventional Radiology',
    rooms: ['Cath Lab 1', 'Cath Lab 2', 'Angio Suite'],
  },
  {
    name: 'Mammography',
    rooms: ['Screening', 'Diagnostic', 'Biopsy'],
  },
];

const FIRST_NAMES = [
  'Mohammed', 'Ahmed', 'Abdullah', 'Khaled', 'Omar', 'Ali', 'Hassan', 'Ibrahim',
  'Saad', 'Faisal', 'Nasser', 'Sultan', 'Youssef', 'Tariq', 'Waleed',
  'Fatima', 'Noura', 'Sara', 'Maha', 'Aisha', 'Huda', 'Layla', 'Reem',
  'Dalal', 'Haifa', 'Mariam', 'Rana', 'Lina', 'Dina', 'Samira',
];

const LAST_NAMES = [
  'Al-Saeed', 'Al-Zahrani', 'Al-Otaibi', 'Al-Qahtani', 'Al-Shammari',
  'Al-Malki', 'Al-Dossari', 'Al-Harbi', 'Al-Ghamdi', 'Al-Mutairi',
  'Al-Rashidi', 'Al-Anazi', 'Al-Subaie', 'Al-Enezi', 'Al-Tamimi',
];

const POSITIONS = [
  'Senior Technologist', 'Technologist', 'Technician', 'Senior Technician',
  'Specialist', 'Consultant', 'Registrar', 'Fellow',
];

const SHIFT_PATTERNS: ShiftCategory[][] = [
  ['morning', 'morning', 'morning', 'evening', 'evening', 'off', 'off'],
  ['evening', 'evening', 'night', 'night', 'off', 'off', 'morning'],
  ['night', 'night', 'off', 'off', 'morning', 'morning', 'evening'],
  ['morning', 'evening', 'morning', 'evening', 'morning', 'off', 'off'],
  ['morning', 'morning', 'morning', 'morning', 'morning', 'off', 'off'],
  ['evening', 'evening', 'evening', 'evening', 'evening', 'off', 'off'],
  ['night', 'night', 'night', 'night', 'off', 'off', 'off'],
];

const SHIFT_TIMES: Record<ShiftCategory, { start: string; end: string; hours: number }> = {
  morning:  { start: '07:00', end: '15:00', hours: 8 },
  evening:  { start: '15:00', end: '23:00', hours: 8 },
  night:    { start: '23:00', end: '07:00', hours: 8 },
  vacation: { start: '00:00', end: '23:59', hours: 0 },
  off:      { start: '00:00', end: '23:59', hours: 0 },
  oncall:   { start: '00:00', end: '23:59', hours: 24 },
  training: { start: '08:00', end: '16:00', hours: 8 },
  pending:  { start: '00:00', end: '23:59', hours: 0 },
  weekend:  { start: '07:00', end: '19:00', hours: 12 },
  holiday:  { start: '00:00', end: '23:59', hours: 0 },
  sick:     { start: '00:00', end: '23:59', hours: 0 },
  overtime: { start: '15:00', end: '19:00', hours: 4 },
};

// ── Generator Functions ────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate departments with rooms.
 */
export function generateDepartments(): ScheduleDepartment[] {
  return DEPARTMENT_DEFS.map((def, i) => {
    const deptId = `dept-${i + 1}`;
    const rooms: ScheduleRoom[] = def.rooms.map((roomName, ri) => ({
      id: `room-${deptId}-${ri + 1}`,
      name: roomName,
      departmentId: deptId,
    }));
    return {
      id: deptId,
      name: def.name,
      color: DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length],
      rooms,
      employeeCount: 0, // will be set later
    };
  });
}

/**
 * Generate employees spread across departments and rooms.
 * @param count Number of employees to generate.
 */
export function generateEmployees(
  count: number,
  departments: ScheduleDepartment[]
): ScheduleEmployee[] {
  const rand = seededRandom(42);
  const employees: ScheduleEmployee[] = [];

  for (let i = 0; i < count; i++) {
    const dept = departments[Math.floor(rand() * departments.length)];
    const room = dept.rooms[Math.floor(rand() * dept.rooms.length)];
    const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const name = `${firstName} ${lastName}`;
    const initials = `${firstName[0]}${lastName.replace('Al-', '')[0]}`;

    employees.push({
      id: `sch-emp-${i + 1}`,
      name,
      initials,
      departmentId: dept.id,
      departmentName: dept.name,
      roomId: room.id,
      roomName: room.name,
      position: POSITIONS[Math.floor(rand() * POSITIONS.length)],
      employeeNumber: `EMP-${String(i + 1).padStart(4, '0')}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace('al-', '')}${i}@hospital.sa`,
      phone: `050${String(Math.floor(rand() * 10000000)).padStart(7, '0')}`,
    });
  }

  // Update department employee counts
  departments.forEach((dept) => {
    dept.employeeCount = employees.filter((e) => e.departmentId === dept.id).length;
  });

  return employees;
}

/**
 * Generate a full month of schedule entries for all employees.
 */
export function generateScheduleEntries(
  employees: ScheduleEmployee[],
  year: number,
  month: number
): ScheduleEntry[] {
  const rand = seededRandom(year * 100 + month);
  const entries: ScheduleEntry[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  let id = 1;

  employees.forEach((emp, empIndex) => {
    const pattern = SHIFT_PATTERNS[empIndex % SHIFT_PATTERNS.length];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, day).getDay();
      const dateObj = new Date(year, month, day);
      const isPast = dateObj < today;

      // Determine shift category
      let shiftCategory: ShiftCategory = pattern[day % pattern.length];

      // Friday/Saturday are weekends in Saudi Arabia
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        // 30% chance of weekend duty
        if (rand() < 0.3) {
          shiftCategory = 'weekend';
        } else {
          shiftCategory = 'off';
        }
      }

      // Random vacation/sick/training overrides (5% each)
      const override = rand();
      if (override < 0.03) shiftCategory = 'vacation';
      else if (override < 0.05) shiftCategory = 'sick';
      else if (override < 0.065) shiftCategory = 'training';
      else if (override < 0.08) shiftCategory = 'oncall';

      const times = SHIFT_TIMES[shiftCategory];

      entries.push({
        id: `entry-${id++}`,
        employeeId: emp.id,
        date,
        shiftCategory,
        startTime: times.start,
        endTime: times.end,
        hours: times.hours,
        status: isPast ? 'completed' : 'scheduled',
        notes: rand() < 0.05 ? 'Coverage for absent colleague' : undefined,
      });
    }
  });

  return entries;
}

/**
 * Public holidays for Saudi Arabia (sample set).
 */
export function getPublicHolidays(year: number): string[] {
  return [
    `${year}-09-23`, // National Day
    `${year}-02-22`, // Founding Day
  ];
}
