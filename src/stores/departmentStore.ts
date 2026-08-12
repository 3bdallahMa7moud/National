import { create } from 'zustand';
import type { DepartmentRecord } from '@/types';

interface DepartmentState {
  records: DepartmentRecord[];
  setRecords: (records: DepartmentRecord[]) => void;
}

export const useDepartmentStore = create<DepartmentState>((set) => ({
  records: [],
  setRecords: (records) => set({ records }),
}));
