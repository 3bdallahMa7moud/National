import { create } from 'zustand';
import type { MockDepartmentSource } from '@/mocks/types';

interface DepartmentState {
  records: MockDepartmentSource[];
  setRecords: (records: MockDepartmentSource[]) => void;
}

export const useDepartmentStore = create<DepartmentState>((set) => ({
  records: [],
  setRecords: (records) => set({ records }),
}));
