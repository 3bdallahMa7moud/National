import type { Language } from '@/i18n/constants';

export type LocalizedText = Record<Language, string>;

export function getLocalizedText(text: LocalizedText, lang: Language): string {
  return text[lang] ?? text.en;
}
