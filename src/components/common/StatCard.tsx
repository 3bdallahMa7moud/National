import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: { value: number; label: string };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const colorMap = {
  primary: { bg: 'bg-primary-50', icon: 'text-primary', ring: 'ring-primary/10' },
  success: { bg: 'bg-success-50', icon: 'text-success', ring: 'ring-success/10' },
  warning: { bg: 'bg-warning-50', icon: 'text-warning', ring: 'ring-warning/10' },
  danger: { bg: 'bg-danger-50', icon: 'text-danger', ring: 'ring-danger/10' },
  info: { bg: 'bg-info-50', icon: 'text-info', ring: 'ring-info/10' },
};

export default function StatCard({ title, value, icon: Icon, change, color = 'primary', className }: StatCardProps) {
  const { i18n } = useTranslation();
  const colors = colorMap[color];
  const formatter = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-SA' : 'en-US');
  const displayedValue = typeof value === 'number' ? formatter.format(value) : value;
  return (
    <div className={cn('card flex min-h-[118px] items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-secondary">{title}</p>
        <p className="mt-2 text-2xl font-semibold leading-none text-text-primary">{displayedValue}</p>
        {change && (
          <p className={cn('mt-3 text-xs font-medium', change.value >= 0 ? 'text-success' : 'text-danger')}>
            {change.value >= 0 ? '↑' : '↓'} {formatter.format(Math.abs(change.value))}% {change.label}
          </p>
        )}
      </div>
      <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-btn ring-1', colors.bg, colors.ring)}>
        <Icon className={cn('h-5 w-5', colors.icon)} />
      </div>
    </div>
  );
}
