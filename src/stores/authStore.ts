import { create } from 'zustand';
import type { AuthUser } from '@/types';
import { mockEmployees } from '@/mocks/mockData';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

// Load user from localStorage and refresh name from mockEmployees
const loadUser = (): AuthUser | null => {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const parsed: AuthUser = JSON.parse(stored);
    // Always sync the name from the latest mockData
    const fresh = mockEmployees.find((e) => e.id === parsed.id);
    if (fresh) {
      const updated = { ...parsed, name: fresh.name };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
}));
