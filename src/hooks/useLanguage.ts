import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getDateLocale, type Language } from '@/i18n';

export function useLanguage() {
  const { i18n } = useTranslation();
  const language = i18n.language as Language;

  const setLanguage = useCallback(async (lng: Language) => {
    await changeLanguage(lng);
  }, []);

  return {
    language,
    isRtl: language === 'ar',
    dateLocale: getDateLocale(language),
    setLanguage,
  };
}
