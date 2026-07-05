import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@/i18n/constants';
import { useLanguage } from '@/hooks/useLanguage';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'default' | 'compact' | 'icon' | 'popover';
}

export default function LanguageSwitcher({ className, variant = 'default' }: LanguageSwitcherProps) {
  const { t } = useTranslation('common');
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = useCallback((lng: Language) => {
    if (lng !== language) {
      void setLanguage(lng);
    }
  }, [language, setLanguage]);

  const otherLanguage: Language = language === 'en' ? 'ar' : 'en';
  const otherLanguageLabel = t(`language.${otherLanguage}`);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => handleChange(otherLanguage)}
        className={cn(
          'relative rounded-xl p-2 transition-colors hover:bg-gray-100',
          className,
        )}
        aria-label={t('language.switchTo', { lang: otherLanguageLabel })}
        title={t('language.switchTo', { lang: otherLanguageLabel })}
      >
        <Globe className="h-5 w-5 text-text-secondary" />
      </button>
    );
  }

  if (variant === 'popover') {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative flex items-center gap-2 rounded-btn border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50"
          aria-label={t('language.switch')}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <Globe className="h-4 w-4 text-text-secondary" aria-hidden />
          <span>{t(`language.${language}`)}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden />
            <div
              role="listbox"
              aria-label={t('language.switch')}
              className="absolute end-0 top-full z-50 mt-2 min-w-[10rem] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown"
            >
              <div className="border-b border-border px-4 py-2.5">
                <p className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  {t('language.switch')}
                </p>
              </div>
              <div className="py-1">
                {LANGUAGES.map((lng) => (
                  <button
                    key={lng}
                    type="button"
                    role="option"
                    aria-selected={language === lng}
                    onClick={() => {
                      handleChange(lng);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50',
                      language === lng ? 'font-semibold text-primary' : 'text-text-primary',
                    )}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">
                      {language === lng && <Check className="h-4 w-4" aria-hidden />}
                    </span>
                    <span>{t(`language.${lng}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn('inline-flex items-center rounded-btn border border-border bg-surface p-0.5', className)}
        role="group"
        aria-label={t('language.switch')}
      >
        {LANGUAGES.map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => handleChange(lng)}
            aria-pressed={language === lng}
            aria-label={LANGUAGE_LABELS[lng]}
            className={cn(
              'rounded-btn px-2.5 py-1 text-xs font-semibold transition-colors',
              language === lng
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary',
            )}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <label htmlFor="language-select" className="sr-only">
        {t('language.switch')}
      </label>
      <div className="relative flex items-center">
        <Globe className="pointer-events-none absolute start-2.5 h-4 w-4 text-text-secondary" aria-hidden />
        <select
          id="language-select"
          value={language}
          onChange={(e) => handleChange(e.target.value as Language)}
          className="cursor-pointer appearance-none rounded-btn border border-border bg-surface py-1.5 ps-8 pe-8 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label={t('language.switch')}
        >
          {LANGUAGES.map((lng) => (
            <option key={lng} value={lng}>
              {LANGUAGE_LABELS[lng]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
