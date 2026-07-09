import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Phone, Clock } from 'lucide-react';
import type { ShiftTypeKey } from '@/types';
import { getShiftLabel } from '@/i18n/helpers';

interface ShiftBadgeProps {
  type: ShiftTypeKey;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const shiftStyles: Record<ShiftTypeKey, { color: string; bg: string; border: string }> = {
  morning: { color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-green-200 dark:border-green-800' },
  evening: { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
  night: { color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800' },
  oncall: { color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-300 dark:border-blue-800' },
  overtime: { color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-300 dark:border-orange-800' },
  vacation: { color: 'text-text-secondary', bg: 'bg-surface-muted', border: 'border-border' },
  sick: { color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800' },
  training: { color: 'text-cyan-700 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-200 dark:border-cyan-800' },
};

export default function ShiftBadge({ type, label, size = 'md', className }: ShiftBadgeProps) {
  const { t } = useTranslation(['common']);
  const config = shiftStyles[type];
  if (!config) return null;

  const isUrgent = type === 'oncall' || type === 'overtime';
  const displayLabel = label ?? getShiftLabel(t, type);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border font-medium',
        config.bg,
        config.color,
        config.border,
        isUrgent && 'ring-1 ring-current/10',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        className
      )}
    >
      {type === 'oncall' && <Phone className={cn(size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3')} />}
      {type === 'overtime' && <Clock className={cn(size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3')} />}
      {displayLabel}
    </span>
  );
}
