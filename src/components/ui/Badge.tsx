import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const variantClasses = {
  default: 'bg-surface-muted text-text-secondary ring-border',
  success: 'bg-success-50 text-success-600 ring-success/15',
  warning: 'bg-warning-50 text-warning-600 ring-warning/15',
  danger: 'bg-danger-50 text-danger-600 ring-danger/15',
  info: 'bg-info-50 text-info-600 ring-info/15',
};

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-center text-xs font-medium leading-tight ring-1',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
