import { create } from 'zustand';
import type { AuthUser } from '@/types';
import type { Language } from '@/i18n/constants';
import { getStoredLanguage } from '@/i18n/constants';
import i18n from '@/i18n';
import { mockEmployeesSource } from '@/mocks/sources';
import { resolveAuthUser, updateLocalizedField } from '@/mocks/resolveMockData';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
  syncLocale: (lang: Language) => void;
}

function getCurrentLanguage(): Language {
  const lang = i18n.language || getStoredLanguage();
  return lang === 'ar' ? 'ar' : 'en';
}

const loadUser = (): AuthUser | null => {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    const parsed: AuthUser = JSON.parse(stored);
    const source = mockEmployeesSource.find((e) => e.id === parsed.id);
    if (source) {
      const updated = resolveAuthUser(source, getCurrentLanguage());
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
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
  updateProfile: (updates) => {
    const current = get().user;
    if (!current) return;
    const lang = getCurrentLanguage();
    const empIndex = mockEmployeesSource.findIndex((e) => e.id === current.id);
    if (empIndex !== -1) {
      if (updates.name) {
        mockEmployeesSource[empIndex].name = updateLocalizedField(
          mockEmployeesSource[empIndex].name,
          lang,
          updates.name,
        );
      }
      if (updates.email) mockEmployeesSource[empIndex].email = updates.email;
      if (updates.avatar !== undefined) mockEmployeesSource[empIndex].avatar = updates.avatar;
    }
    const updated = resolveAuthUser(mockEmployeesSource[empIndex], lang);
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },
  syncLocale: (lang) => {
    const current = get().user;
    if (!current) return;
    const source = mockEmployeesSource.find((e) => e.id === current.id);
    if (!source) return;
    const updated = resolveAuthUser(source, lang);
    localStorage.setItem('user', JSON.stringify(updated));
    set({ user: updated });
  },
}));

export function syncAuthUserLocale(lang: Language) {
  useAuthStore.getState().syncLocale(lang);
}
