// ============================================================
// useScheduleData — Data fetching & preparation hook
// ============================================================
// Generates mock data, computes statistics, applies filters,
// and builds the flat row array for the virtualized grid.

import { useMemo } from 'react';
import type {
  ScheduleDepartment,
  ScheduleEmployee,
  ScheduleEntry,
  ScheduleGridRow,
  ScheduleStats,
  ScheduleFilters,
} from '../types/schedule';
import {
  generateDepartments,
  generateEmployees,
  generateScheduleEntries,
} from '../utils/mockDataGenerator';

/** Number of mock employees to generate */
const EMPLOYEE_COUNT = 120;

interface UseScheduleDataReturn {
  departments: ScheduleDepartment[];
  employees: ScheduleEmployee[];
  entries: ScheduleEntry[];
  /** Map of employeeId -> { date -> ScheduleEntry } */
  entryMap: Map<string, Map<string, ScheduleEntry>>;
  /** Flat rows ready for virtualization */
  gridRows: ScheduleGridRow[];
  /** Aggregated statistics */
  stats: ScheduleStats;
  /** Days in the current month */
  daysInMonth: number;
  /** Array of Date objects for each day in the month */
  monthDays: Date[];
}

export function useScheduleData(
  year: number,
  month: number,
  filters: ScheduleFilters,
  collapsedDepartments: Set<string>,
  searchQuery: string
): UseScheduleDataReturn {
  // Generate base data — memoized on count only (stable)
  const departments = useMemo(() => generateDepartments(), []);
  const employees = useMemo(
    () => generateEmployees(EMPLOYEE_COUNT, departments),
    [departments]
  );

  // Generate entries for the current month
  const entries = useMemo(
    () => generateScheduleEntries(employees, year, month),
    [employees, year, month]
  );

  // Build entry lookup map: employeeId -> date -> entry
  const entryMap = useMemo(() => {
    const map = new Map<string, Map<string, ScheduleEntry>>();
    entries.forEach((entry) => {
      if (!map.has(entry.employeeId)) {
        map.set(entry.employeeId, new Map());
      }
      map.get(entry.employeeId)!.set(entry.date, entry);
    });
    return map;
  }, [entries]);

  // Compute statistics
  const stats = useMemo<ScheduleStats>(() => {
    const s: ScheduleStats = {
      totalEmployees: employees.length,
      morningShifts: 0,
      eveningShifts: 0,
      nightShifts: 0,
      vacations: 0,
      onCall: 0,
      pendingRequests: 0,
    };
    entries.forEach((e) => {
      switch (e.shiftCategory) {
        case 'morning': s.morningShifts++; break;
        case 'evening': s.eveningShifts++; break;
        case 'night': s.nightShifts++; break;
        case 'vacation': s.vacations++; break;
        case 'oncall': s.onCall++; break;
        case 'pending': s.pendingRequests++; break;
      }
    });
    return s;
  }, [entries, employees.length]);

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDays = useMemo(() => {
    const days: Date[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [year, month, daysInMonth]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Department filter
    if (filters.department) {
      result = result.filter((e) => e.departmentId === filters.department);
    }

    // Room filter
    if (filters.room) {
      result = result.filter((e) => e.roomId === filters.room);
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeNumber.toLowerCase().includes(q) ||
          e.roomName.toLowerCase().includes(q)
      );
    }

    // Shift type filter — keep only employees that have at least one entry of this type
    if (filters.shiftType) {
      const shiftType = filters.shiftType;
      result = result.filter((e) => {
        const empEntries = entryMap.get(e.id);
        if (!empEntries) return false;
        return Array.from(empEntries.values()).some(
          (entry) => entry.shiftCategory === shiftType
        );
      });
    }

    return result;
  }, [employees, filters, searchQuery, entryMap]);

  // Build flat grid rows (department headers + employee rows)
  const gridRows = useMemo<ScheduleGridRow[]>(() => {
    // Group employees by department
    const deptMap = new Map<string, ScheduleEmployee[]>();
    filteredEmployees.forEach((emp) => {
      if (!deptMap.has(emp.departmentId)) {
        deptMap.set(emp.departmentId, []);
      }
      deptMap.get(emp.departmentId)!.push(emp);
    });

    const rows: ScheduleGridRow[] = [];

    departments.forEach((dept) => {
      const deptEmployees = deptMap.get(dept.id);
      if (!deptEmployees || deptEmployees.length === 0) return;

      // Department header row
      rows.push({
        type: 'department-header',
        departmentId: dept.id,
        departmentName: dept.name,
        departmentColor: dept.color,
      });

      // If department is collapsed, skip employee rows
      if (collapsedDepartments.has(dept.id)) return;

      // Employee rows
      deptEmployees.forEach((emp) => {
        const empEntries = entryMap.get(emp.id);
        const entriesRecord: Record<string, ScheduleEntry> = {};
        if (empEntries) {
          empEntries.forEach((entry, date) => {
            entriesRecord[date] = entry;
          });
        }

        rows.push({
          type: 'employee',
          departmentId: dept.id,
          departmentName: dept.name,
          departmentColor: dept.color,
          employee: emp,
          entries: entriesRecord,
        });
      });
    });

    return rows;
  }, [departments, filteredEmployees, collapsedDepartments, entryMap]);

  return {
    departments,
    employees,
    entries,
    entryMap,
    gridRows,
    stats,
    daysInMonth,
    monthDays,
  };
}
