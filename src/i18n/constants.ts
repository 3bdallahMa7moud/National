export const LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_STORAGE_KEY = 'app-language';

export const NAMESPACES = [
  'common',
  'auth',
  'forms',
  'errors',
  'dashboard',
  'employees',
  'departments',
  'schedule',
  'reports',
  'notifications',
  'calendar',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  ar: 'العربية',
};

export function getStoredLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'en' || stored === 'ar') return stored;
  return DEFAULT_LANGUAGE;
}

export function applyDocumentDirection(lng: Language): void {
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
}

export function getDateLocale(lng: Language): string {
  return lng === 'ar' ? 'ar-SA' : 'en-US';
}
