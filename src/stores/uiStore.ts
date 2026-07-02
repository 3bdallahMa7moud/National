import { create } from 'zustand';

type ViewMode = 'monthly' | 'weekly' | 'daily';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  viewMode: ViewMode;
  selectedCells: string[];
  bulkEditOpen: boolean;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setSidebarOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleCellSelection: (cellId: string) => void;
  clearSelection: () => void;
  setBulkEditOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  viewMode: 'monthly',
  selectedCells: [],
  bulkEditOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleCellSelection: (cellId) =>
    set((s) => ({
      selectedCells: s.selectedCells.includes(cellId)
        ? s.selectedCells.filter((id) => id !== cellId)
        : [...s.selectedCells, cellId],
    })),
  clearSelection: () => set({ selectedCells: [], bulkEditOpen: false }),
  setBulkEditOpen: (open) => set({ bulkEditOpen: open }),
}));
