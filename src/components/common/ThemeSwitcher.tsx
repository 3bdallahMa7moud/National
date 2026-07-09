import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';

interface ThemeSwitcherProps {
  className?: string;
  variant?: 'default' | 'compact' | 'icon' | 'popover';
}

export default function ThemeSwitcher({ className, variant = 'icon' }: ThemeSwitcherProps) {
  const { t } = useTranslation('common');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

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
        onClick={toggleTheme}
        className={cn(
          'relative rounded-xl p-2 transition-colors hover:bg-hover text-text-secondary hover:text-text-primary',
          className,
        )}
        aria-label={t('theme.toggle', 'تبديل المظهر')}
        title={t('theme.toggle', 'تبديل المظهر')}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-5 w-5 text-amber-400" />
        ) : (
          <Moon className="h-5 w-5 text-text-secondary" />
        )}
      </button>
    );
  }

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('theme.light', 'نهاري'), icon: Sun },
    { value: 'dark', label: t('theme.dark', 'ليلي'), icon: Moon },
    { value: 'system', label: t('theme.system', 'النظام'), icon: Monitor },
  ];

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center gap-2 rounded-btn border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-hover"
        aria-label={t('theme.switch', 'المظهر')}
        aria-expanded={isOpen}
      >
        {resolvedTheme === 'dark' ? <Moon className="h-4 w-4 text-primary-teal" /> : <Sun className="h-4 w-4 text-amber-500" />}
        <span>{options.find((o) => o.value === theme)?.label}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden />
          <div className="absolute end-0 top-full z-50 mt-2 min-w-[9rem] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown">
            <div className="py-1">
              {options.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTheme(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-hover',
                      theme === opt.value ? 'font-semibold text-primary' : 'text-text-primary',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-start">{opt.label}</span>
                    {theme === opt.value && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
