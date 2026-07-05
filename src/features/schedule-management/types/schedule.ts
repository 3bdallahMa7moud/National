// ============================================================
// Schedule Management — Type Definitions
// ============================================================

/** All possible shift categories displayed in the schedule grid */
export type ShiftCategory =
  | 'morning'
  | 'evening'
  | 'night'
  | 'vacation'
  | 'off'
  | 'oncall'
  | 'training'
  | 'pending'
  | 'weekend'
  | 'holiday'
  | 'sick'
  | 'overtime';

/** Visual configuration for each shift type badge */
export interface ShiftTheme {
  /** Tailwind bg class for the badge */
  bg: string;
  /** Tailwind bg class for the badge in dark mode */
  bgDark: string;
  /** Tailwind text color */
  text: string;
  /** Tailwind text color in dark mode */
  textDark: string;
  /** Tailwind border color */
  border: string;
  /** Hex color for exports */
  hex: string;
  /** Short label displayed inside badge */
  label: string;
  /** Full label */
  fullLabel: string;
  /** Icon name from lucide (optional) */
  icon?: string;
}

/** A room/station within a department */
export interface ScheduleRoom {
  id: string;
  name: string;
  departmentId: string;
}

/** Department with nested rooms */
export interface ScheduleDepartment {
  id: string;
  name: string;
  color: string;
  rooms: ScheduleRoom[];
  employeeCount: number;
}

/** An employee in the schedule grid */
export interface ScheduleEmployee {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  departmentId: string;
  departmentName: string;
  roomId: string;
  roomName: string;
  position: string;
  employeeNumber: string;
  phone?: string;
  email?: string;
}

/** A single schedule cell — one employee on one day */
export interface ScheduleEntry {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftCategory: ShiftCategory;
  startTime: string;
  endTime: string;
  hours: number;
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
}

/** Flattened row used in the virtualized grid */
export interface ScheduleGridRow {
  type: 'department-header' | 'employee';
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  /** Only present when type === 'employee' */
  employee?: ScheduleEmployee;
  /** Entries keyed by date string (YYYY-MM-DD) */
  entries?: Record<string, ScheduleEntry>;
}

/** Active filter state */
export interface ScheduleFilters {
  department: string;
  room: string;
  shiftType: ShiftCategory | '';
  search: string;
  week: number | null; // 1-5 or null for full month
}

/** Statistics displayed in top cards */
export interface ScheduleStats {
  totalEmployees: number;
  morningShifts: number;
  eveningShifts: number;
  nightShifts: number;
  vacations: number;
  onCall: number;
  pendingRequests: number;
}

/** Side drawer state */
export interface DrawerState {
  isOpen: boolean;
  entry: ScheduleEntry | null;
  employee: ScheduleEmployee | null;
}

/** Context menu state */
export interface ContextMenuState {
  x: number;
  y: number;
  entry: ScheduleEntry | null;
  employee: ScheduleEmployee | null;
  date: string;
}
