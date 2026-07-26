import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  applyDocumentDirection,
  CRITICAL_NAMESPACES,
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  NAMESPACES,
  type Language,
  type Namespace,
} from './constants';
import { importNamespaceResources } from './resourceLoader';

export { useTranslation, Trans } from 'react-i18next';
export * from './constants';

const namespaceLoadPromises = new Map<string, Promise<void>>();
let initializationPromise: Promise<typeof i18n> | null = null;

export async function loadNamespace(ns: Namespace, lng?: Language): Promise<void> {
  const language = lng ?? (i18n.language as Language);
  if (i18n.hasResourceBundle(language, ns)) return;

  const key = `${language}:${ns}`;
  const existing = namespaceLoadPromises.get(key);
  if (existing) return existing;

  const request = importNamespaceResources(language, ns)
    .then((resources) => {
      i18n.addResourceBundle(language, ns, resources, true, true);
    })
    .finally(() => {
      namespaceLoadPromises.delete(key);
    });

  namespaceLoadPromises.set(key, request);
  return request;
}

export async function loadNamespaces(
  namespaces: readonly Namespace[],
  lng?: Language,
): Promise<void> {
  await Promise.all([...new Set(namespaces)].map((namespace) => loadNamespace(namespace, lng)));
}

export async function changeLanguage(lng: Language): Promise<void> {
  localStorage.setItem('app-language', lng);
  applyDocumentDirection(lng);

  const currentLanguage = (i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE) as Language;
  const namespacesToLoad = NAMESPACES.filter(
    (namespace) =>
      CRITICAL_NAMESPACES.includes(namespace as (typeof CRITICAL_NAMESPACES)[number]) ||
      i18n.hasResourceBundle(currentLanguage, namespace),
  );
  await loadNamespaces(namespacesToLoad, lng);

  await i18n.changeLanguage(lng);

  const { syncAuthUserLocale } = await import('@/stores/authStore');
  syncAuthUserLocale(lng);

  const dayjs = (await import('@/lib/dayjs')).default;
  dayjs.locale(lng === 'ar' ? 'ar' : 'en');
}

async function initializeI18n(): Promise<typeof i18n> {
  const lng = getStoredLanguage();
  applyDocumentDirection(lng);

  const bundles = await Promise.all(
    CRITICAL_NAMESPACES.map(async (ns) => {
      const resources = await importNamespaceResources(lng, ns);
      return [ns, resources] as const;
    })
  );

  const resources = {
    [lng]: Object.fromEntries(bundles),
  };

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: [...CRITICAL_NAMESPACES],
    supportedLngs: ['en', 'ar'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  void import('@/lib/dayjs').then(({ default: dayjs }) => {
    dayjs.locale(lng === 'ar' ? 'ar' : 'en');
  });

  return i18n;
}

export function initI18n(): Promise<typeof i18n> {
  if (!initializationPromise) {
    initializationPromise = initializeI18n().catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

export default i18n;
