import { create } from 'zustand';
import type { AuthUser } from '@/types';
import type { Language } from '@/i18n/constants';
import api from '@/lib/axios';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, token?: string) => void;
  logout: () => Promise<void>;
  logoutLocal: () => void;
  setUser: (user: AuthUser) => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
  changePassword: (currentPw: string, newPw: string) => boolean;
  syncLocale: (lang: Language) => void;
}

const AUTH_USER_KEY = 'user';
const AUTH_TOKEN_KEY = 'token';

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

const loadUser = (): AuthUser | null => {
  try {
    const stored = window.sessionStorage.getItem(AUTH_USER_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadUser(),
  isAuthenticated: Boolean(loadUser()),
  login: (user, token = 'session-authenticated') => {
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(user));
    writeAuthValue(AUTH_TOKEN_KEY, token);
    set({ user, isAuthenticated: true });
  },
  logoutLocal: () => {
    removeAuthValue(AUTH_USER_KEY);
    removeAuthValue(AUTH_TOKEN_KEY);
    set({ user: null, isAuthenticated: false });
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Local logout still wins when the network is unavailable.
    }
    get().logoutLocal();
  },
  setUser: (user) => {
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(user));
    set({ user });
  },
  updateProfile: (updates) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...updates };
    writeAuthValue(AUTH_USER_KEY, JSON.stringify(updated));
    set({ user: updated });
  },
  changePassword: () => false,
  syncLocale: () => undefined,
}));

export function syncAuthUserLocale(lang: Language) {
  useAuthStore.getState().syncLocale(lang);
}
