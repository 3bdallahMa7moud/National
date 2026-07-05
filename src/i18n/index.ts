import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  applyDocumentDirection,
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  NAMESPACES,
  type Language,
  type Namespace,
} from './constants';

export { useTranslation, Trans } from 'react-i18next';
export * from './constants';

async function loadNamespaceResources(lng: Language, ns: Namespace): Promise<Record<string, unknown>> {
  const mod = await import(`./locales/${lng}/${ns}.json`);
  return mod.default as Record<string, unknown>;
}

export async function loadNamespace(ns: Namespace, lng?: Language): Promise<void> {
  const language = lng ?? (i18n.language as Language);
  if (i18n.hasResourceBundle(language, ns)) return;
  const resources = await loadNamespaceResources(language, ns);
  i18n.addResourceBundle(language, ns, resources, true, true);
}

export async function changeLanguage(lng: Language): Promise<void> {
  localStorage.setItem('app-language', lng);
  applyDocumentDirection(lng);

  await Promise.all(NAMESPACES.map((ns) => loadNamespace(ns, lng)));

  await i18n.changeLanguage(lng);

  const { syncAuthUserLocale } = await import('@/stores/authStore');
  syncAuthUserLocale(lng);

  const dayjs = (await import('@/lib/dayjs')).default;
  dayjs.locale(lng === 'ar' ? 'ar' : 'en');
}

export async function initI18n(): Promise<typeof i18n> {
  const lng = getStoredLanguage();
  applyDocumentDirection(lng);

  const bundles = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const resources = await loadNamespaceResources(lng, ns);
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
    ns: [...NAMESPACES],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  const dayjs = (await import('@/lib/dayjs')).default;
  dayjs.locale(lng === 'ar' ? 'ar' : 'en');

  return i18n;
}

export default i18n;
