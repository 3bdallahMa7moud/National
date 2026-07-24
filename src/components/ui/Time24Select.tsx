import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Time24SelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Pre-generated 24-hour time options (HH:mm) */
function generate24HourOptions(currentValue: string): string[] {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const hh = String(hour).padStart(2, '0');
    times.push(`${hh}:00`);
    times.push(`${hh}:30`);
  }
  times.push('23:59');

  if (currentValue && !times.includes(currentValue)) {
    times.push(currentValue);
    times.sort();
  }

  return times;
}

export default function Time24Select({ value, onChange, disabled, className }: Time24SelectProps) {
  const options = useMemo(() => generate24HourOptions(value), [value]);

  return (
    <div className="relative flex items-center">
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'w-full appearance-none rounded-xl border border-border bg-surface py-1.5 pl-3 pr-8 text-xs font-mono font-semibold text-ink shadow-sm transition-colors',
          'focus:border-primary-teal focus:outline-none focus:ring-2 focus:ring-primary-teal/15',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        {options.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
      <Clock className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-secondary/60" aria-hidden="true" />
    </div>
  );
}
