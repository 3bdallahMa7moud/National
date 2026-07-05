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
  morning: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  evening: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  night: { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  oncall: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' },
  overtime: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' },
  vacation: { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  sick: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  training: { color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
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
