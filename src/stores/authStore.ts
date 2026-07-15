import { create } from 'zustand';
import type { AuthUser } from '@/types';
import type { Language } from '@/i18n/constants';
import { getStoredLanguage } from '@/i18n/constants';
import i18n from '@/i18n';
import { mockEmployeesSource } from '@/mocks/sources';
import { resolveAuthUser } from '@/mocks/resolveMockData';
import { verifyEmployeePassword, setEmployeePassword } from '@/mocks/mockPasswordStore';
import { resolveCurrentEmployeeAccess } from './employeeAccessStore';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
  changePassword: (currentPw: string, newPw: string) => boolean;
  syncLocale: (lang: Language) => void;
}

function getCurrentLanguage(): Language {
  const lang = i18n.language || getStoredLanguage();
  return lang === 'ar' ? 'ar' : 'en';
}

function applyEmployeeAccess(user: AuthUser): AuthUser {
  if (user.role !== 'employee') return user;
  const access = resolveCurrentEmployeeAccess(user);
  return { ...user, scheduleEmployeeId: access.scheduleEmployeeId };
}

const loadUser = (): AuthUser | null => {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const parsed: AuthUser = JSON.parse(stored);
    const source = mockEmployeesSource.find((e) => e.id === parsed.id);
    if (source) {
      const localized = resolveAuthUser(source, getCurrentLanguage());
      const updated = applyEmployeeAccess({ ...localized, email: parsed.email, avatar: parsed.avatar });
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    }
    return applyEmployeeAccess(parsed);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadUser(),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (user, token) => {
    const resolvedUser = applyEmployeeAccess(user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(resolvedUser));
    set({ user: resolvedUser, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
  setUser: (user) => {
    const resolvedUser = applyEmployeeAccess(user);
    localStorage.setItem('user', JSON.stringify(resolvedUser));
    set({ user: resolvedUser });
  },
  updateProfile: (updates) => {
    const current = get().user;
    if (!current) return;
    const updated = applyEmployeeAccess({ ...current, ...updates });
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },
  changePassword: (currentPw, newPw) => {
    const current = get().user;
    if (!current) return false;
    if (!verifyEmployeePassword(current.id, currentPw)) return false;
    setEmployeePassword(current.id, newPw);
    return true;
  },
  syncLocale: (lang) => {
    const current = get().user;
    if (!current) return;
    const source = mockEmployeesSource.find((e) => e.id === current.id);
    if (!source) return;
    const localized = resolveAuthUser(source, lang);
    const updated = applyEmployeeAccess({ ...localized, email: current.email, avatar: current.avatar });
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },
}));

export function syncAuthUserLocale(lang: Language) {
  useAuthStore.getState().syncLocale(lang);
}
