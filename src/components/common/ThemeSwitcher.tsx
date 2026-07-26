import { useCallback, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { usePopoverFocus } from '@/hooks/usePopoverFocus';

interface ThemeSwitcherProps {
  className?: string;
  variant?: 'default' | 'compact' | 'icon' | 'popover';
}

export default function ThemeSwitcher({ className, variant = 'icon' }: ThemeSwitcherProps) {
  const { t } = useTranslation('common');
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = `theme-switcher-${useId()}`;

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  usePopoverFocus({
    isOpen,
    onClose: () => setIsOpen(false),
    triggerRef,
    popoverRef,
  });

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-hover hover:text-text-primary',
          className,
        )}
        aria-label={t('theme.toggle', 'Toggle theme')}
        title={t('theme.toggle', 'Toggle theme')}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-5 w-5 text-warning" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    );
  }

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('theme.light', 'Light'), icon: Sun },
    { value: 'dark', label: t('theme.dark', 'Dark'), icon: Moon },
    { value: 'system', label: t('theme.system', 'System'), icon: Monitor },
  ];

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex min-h-11 items-center gap-2 rounded-btn border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-hover"
        aria-label={t('theme.switch', 'Theme')}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-haspopup="dialog"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4 text-warning" aria-hidden="true" />
        )}
        <span>{options.find((option) => option.value === theme)?.label}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label={t('theme.switch', 'Theme')}
            tabIndex={-1}
            className="absolute end-0 top-full z-50 mt-2 min-w-[9rem] overflow-hidden rounded-card border border-border bg-surface shadow-dropdown"
          >
            <ul className="py-1">
              {options.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      data-popover-autofocus={isSelected ? true : undefined}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setTheme(option.value);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-hover',
                        isSelected ? 'font-semibold text-primary' : 'text-text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-start">{option.label}</span>
                      {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
