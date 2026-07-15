// ============================================================
// Schedule Management — Zustand Store
// ============================================================
// Centralized state management for the schedule page.
// Handles filters, drawer, context menu, collapsed departments,
// selected month/year, and search state.

import { create } from 'zustand';
import type {
  ScheduleFilters,
  DrawerState,
  ContextMenuState,
  ScheduleEntry,
  ScheduleEmployee,
  ShiftCategory,
} from '../types/schedule';

interface ScheduleManagementState {
  // ── Date Navigation ──
  year: number;
  month: number; // 0-indexed
  setYear: (y: number) => void;
  setMonth: (m: number) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;

  // ── Filters ──
  filters: ScheduleFilters;
  setFilter: <K extends keyof ScheduleFilters>(key: K, value: ScheduleFilters[K]) => void;
  resetFilters: () => void;

  // ── Search ──
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  highlightedEmployeeId: string | null;
  setHighlightedEmployeeId: (id: string | null) => void;

  // ── Department Collapse ──
  collapsedDepartments: Set<string>;
  toggleDepartment: (deptId: string) => void;
  collapseAll: () => void;
  expandAll: (deptIds: string[]) => void;

  // ── Side Drawer ──
  drawer: DrawerState;
  openDrawer: (entry: ScheduleEntry, employee: ScheduleEmployee) => void;
  closeDrawer: () => void;

  // ── Context Menu ──
  contextMenu: ContextMenuState | null;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;

  // ── Selected Cells ──
  selectedCells: Set<string>;
  toggleCellSelection: (cellId: string) => void;
  clearCellSelection: () => void;

  // ── Clipboard ──
  clipboard: { entryId: string; category: ShiftCategory } | null;
  copyToClipboard: (entryId: string, category: ShiftCategory) => void;
  clearClipboard: () => void;
}

const DEFAULT_FILTERS: ScheduleFilters = {
  department: '',
  room: '',
  shiftType: '',
  search: '',
  week: null,
};

const now = new Date();

export const useScheduleManagementStore = create<ScheduleManagementState>((set) => ({
  // ── Date Navigation ──
  year: now.getFullYear(),
  month: now.getMonth(),
  setYear: (y) => set({ year: y }),
  setMonth: (m) => set({ month: m }),
  goToPrevMonth: () =>
    set((s) => {
      if (s.month === 0) return { month: 11, year: s.year - 1 };
      return { month: s.month - 1 };
    }),
  goToNextMonth: () =>
    set((s) => {
      if (s.month === 11) return { month: 0, year: s.year + 1 };
      return { month: s.month + 1 };
    }),
  goToToday: () => {
    const today = new Date();
    set({ year: today.getFullYear(), month: today.getMonth() });
  },

  // ── Filters ──
  filters: { ...DEFAULT_FILTERS },
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  // ── Search ──
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  highlightedEmployeeId: null,
  setHighlightedEmployeeId: (id) => set({ highlightedEmployeeId: id }),

  // ── Department Collapse ──
  collapsedDepartments: new Set<string>(),
  toggleDepartment: (deptId) =>
    set((s) => {
      const next = new Set(s.collapsedDepartments);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return { collapsedDepartments: next };
    }),
  collapseAll: () =>
    set({ collapsedDepartments: new Set<string>() }),
  expandAll: () =>
    set({ collapsedDepartments: new Set<string>() }),

  // ── Side Drawer ──
  drawer: { isOpen: false, entry: null, employee: null },
  openDrawer: (entry, employee) =>
    set({ drawer: { isOpen: true, entry, employee } }),
  closeDrawer: () =>
    set({ drawer: { isOpen: false, entry: null, employee: null } }),

  // ── Context Menu ──
  contextMenu: null,
  openContextMenu: (state) => set({ contextMenu: state }),
  closeContextMenu: () => set({ contextMenu: null }),

  // ── Selected Cells ──
  selectedCells: new Set<string>(),
  toggleCellSelection: (cellId) =>
    set((s) => {
      const next = new Set(s.selectedCells);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return { selectedCells: next };
    }),
  clearCellSelection: () => set({ selectedCells: new Set<string>() }),

  // ── Clipboard ──
  clipboard: null,
  copyToClipboard: (entryId, category) =>
    set({ clipboard: { entryId, category } }),
  clearClipboard: () => set({ clipboard: null }),
}));
