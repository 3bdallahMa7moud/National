import { create } from 'zustand';
import type { AuthUser } from '@/types';
import type { Language } from '@/i18n/constants';
import { getStoredLanguage } from '@/i18n/constants';
import i18n from '@/i18n';
import { resolveAuthUser } from '@/mocks/resolveMockData';
import { verifyEmployeePassword, setEmployeePassword } from '@/mocks/mockPasswordStore';
import { resolveCurrentEmployeeAccess } from './employeeAccessStore';
import {
  directoryRecordToMockSource,
  getEmployeeDirectoryRecord,
  useEmployeeDirectoryStore,
} from './employeeDirectoryStore';

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

const AUTH_USER_KEY = 'user';
const AUTH_TOKEN_KEY = 'token';

function readAuthValue(key: string): string | null {
  try {
    const current = window.sessionStorage.getItem(key);
    if (current) return current;
    const legacy = window.localStorage.getItem(key);
    if (!legacy) return null;
    window.sessionStorage.setItem(key, legacy);
    window.localStorage.removeItem(key);
    return legacy;
  } catch {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function writeAuthValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  } catch {
    window.localStorage.setItem(key, value);
  }
}

function removeAuthValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Fall through to legacy cleanup.
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // The in-memory logout still completes in restricted browser contexts.
  }
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
    const stored = readAuthValue(AUTH_USER_KEY);
    if (!stored) return null;
    const parsed: AuthUser = JSON.parse(stored);
    const record = getEmployeeDirectoryRecord(parsed.id);
    if (record) {
      const localized = resolveAuthUser(directoryRecordToMockSource(record), getCurrentLanguage());
      const updated = applyEmployeeAccess(localized);
      writeAuthValue(AUTH_USER_KEY, JSON.stringify(updated));
      return updated;
    }
    return applyEmployeeAccess(parsed);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadUser(),
  isAuthenticated: Boolean(readAuthValue(AUTH_TOKEN_KEY)),
  login: (user, token) => {
    const resolvedUser = applyEmployeeAccess(user);
    writeAuthValue(AUTH_TOKEN_KEY, token);
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(resolvedUser));
    set({ user: resolvedUser, isAuthenticated: true });
  },
  logout: () => {
    removeAuthValue(AUTH_TOKEN_KEY);
    removeAuthValue(AUTH_USER_KEY);
    set({ user: null, isAuthenticated: false });
  },
  setUser: (user) => {
    const resolvedUser = applyEmployeeAccess(user);
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(resolvedUser));
    set({ user: resolvedUser });
  },
  updateProfile: (updates) => {
    const current = get().user;
    if (!current) return;
    const record = getEmployeeDirectoryRecord(current.id);
    if (record) {
      const result = useEmployeeDirectoryStore.getState().updateEmployee(current.id, {
        ...(updates.name ? { name: { ar: updates.name, en: updates.name } } : {}),
        ...(updates.email !== undefined ? { email: updates.email } : {}),
        ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
      }, current.name);
      if (!result.ok) return;
      return;
    }
    const updated = applyEmployeeAccess({ ...current, ...updates });
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(updated));
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
    const record = getEmployeeDirectoryRecord(current.id);
    if (!record) return;
    const localized = resolveAuthUser(directoryRecordToMockSource(record), lang);
    const updated = applyEmployeeAccess(localized);
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(updated));
    set({ user: updated });
  },
}));

export function syncAuthUserLocale(lang: Language) {
  useAuthStore.getState().syncLocale(lang);
}

useEmployeeDirectoryStore.subscribe(() => {
  const current = useAuthStore.getState().user;
  if (!current) return;
  const record = getEmployeeDirectoryRecord(current.id);
  if (!record) return;
  const localized = applyEmployeeAccess(resolveAuthUser(directoryRecordToMockSource(record), getCurrentLanguage()));
  try {
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(localized));
  } catch {
    // The active in-memory session still receives the canonical identity.
  }
  useAuthStore.setState({ user: localized });
});
