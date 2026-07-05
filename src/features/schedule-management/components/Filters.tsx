// ============================================================
// Filters — Department, Room, Shift Type, and Week filters
// ============================================================

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleDepartment, ScheduleFilters, ShiftCategory } from '../types/schedule';
import { SHIFT_THEMES } from '../utils/constants';

interface FiltersProps {
  filters: ScheduleFilters;
  departments: ScheduleDepartment[];
  onFilterChange: <K extends keyof ScheduleFilters>(key: K, value: ScheduleFilters[K]) => void;
  onReset: () => void;
}

const SHIFT_OPTIONS: { value: ShiftCategory; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'oncall', label: 'On Call' },
  { value: 'training', label: 'Training' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'off', label: 'Off' },
];

const selectClasses = cn(
  'h-9 rounded-lg border border-border bg-surface px-3 text-xs font-medium',
  'text-text-primary appearance-none cursor-pointer',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors duration-150',
  'dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200',
  'hover:border-primary/40'
);

function Filters({ filters, departments, onFilterChange, onReset }: FiltersProps) {
  const selectedDept = departments.find((d) => d.id === filters.department);
  const rooms = selectedDept?.rooms ?? [];

  const hasActiveFilters =
    filters.department || filters.room || filters.shiftType || filters.week !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className={cn(
        'flex flex-wrap items-center gap-2.5 rounded-xl border border-border',
        'bg-surface px-4 py-3 shadow-soft',
        'dark:bg-slate-900 dark:border-slate-800'
      )}
    >
      <div className="flex items-center gap-1.5 text-text-secondary dark:text-slate-400">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Filters:</span>
      </div>

      {/* Department */}
      <select
        value={filters.department}
        onChange={(e) => {
          onFilterChange('department', e.target.value);
          onFilterChange('room', ''); // Reset room when dept changes
        }}
        className={selectClasses}
        aria-label="Filter by department"
      >
        <option value="">All Departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {/* Room */}
      <select
        value={filters.room}
        onChange={(e) => onFilterChange('room', e.target.value)}
        className={selectClasses}
        disabled={!filters.department}
        aria-label="Filter by room"
      >
        <option value="">All Rooms</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      {/* Shift Type */}
      <select
        value={filters.shiftType}
        onChange={(e) => onFilterChange('shiftType', e.target.value as ShiftCategory | '')}
        className={selectClasses}
        aria-label="Filter by shift type"
      >
        <option value="">All Shifts</option>
        {SHIFT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {SHIFT_THEMES[opt.value].fullLabel}
          </option>
        ))}
      </select>

      {/* Week */}
      <select
        value={filters.week ?? ''}
        onChange={(e) =>
          onFilterChange('week', e.target.value ? Number(e.target.value) : null)
        }
        className={selectClasses}
        aria-label="Filter by week"
      >
        <option value="">Full Month</option>
        <option value="1">Week 1</option>
        <option value="2">Week 2</option>
        <option value="3">Week 3</option>
        <option value="4">Week 4</option>
        <option value="5">Week 5</option>
      </select>

      {/* Reset */}
      {hasActiveFilters && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onReset}
          className={cn(
            'flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium',
            'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200',
            'dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-800 dark:hover:bg-rose-950/50',
            'transition-colors duration-150'
          )}
          aria-label="Reset all filters"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </motion.button>
      )}
    </motion.div>
  );
}

export default memo(Filters);
