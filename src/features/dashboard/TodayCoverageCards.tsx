import { CalendarDays, Clock3, Moon, PhoneCall, TimerReset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { operationalShiftGradient, operationalShiftStyle } from '@/lib/occurrenceShiftStyle';
import { defaultOperationalShiftVisual } from '@/lib/operationalShiftVisuals';
import type { CoverageCategory, CoverageMetric } from '@/types/operationalDashboard';

interface TodayCoverageCardsProps {
  metrics: CoverageMetric[];
  hasPublishedSchedule: boolean;
  selectedCategory: CoverageCategory | null;
  onSelect: (category: CoverageCategory) => void;
}

const coverageIcons = {
  day: CalendarDays,
  night: Moon,
  onCallDay: PhoneCall,
  onCallNight: Moon,
  onCall: PhoneCall,
  ot: TimerReset,
};

export default function TodayCoverageCards({ metrics, hasPublishedSchedule, selectedCategory, onSelect }: TodayCoverageCardsProps) {
  const { t } = useTranslation('dashboard');
  return (
    <section aria-labelledby="today-coverage-title" className="space-y-3">
      <div>
        <h2 id="today-coverage-title" className="text-base font-semibold text-text-primary sm:text-lg">{t('coverage.title')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('coverage.description')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = coverageIcons[metric.category];
          const label = t(`coverage.categories.${metric.category}`);
          const isSelected = selectedCategory === metric.category;
          const noPublishedData = metric.category !== 'ot' && !hasPublishedSchedule;
          const shiftColor = (metric.shiftColors && metric.shiftColors.length > 0)
            ? metric.shiftColors[0]
            : defaultOperationalShiftVisual(metric.category);
          const style = operationalShiftStyle(shiftColor);
          const topAccentColor = shiftColor.backgroundColor || style.borderColor || style.backgroundColor;
          return (
            <button
              key={metric.category}
              type="button"
              aria-label={t('coverage.ariaLabel', { shift: label })}
              aria-pressed={isSelected}
              onClick={() => onSelect(metric.category)}
              className={cn(
                'relative min-h-[132px] overflow-hidden rounded-card border bg-surface p-4 text-start shadow-card transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-primary/40 hover:bg-hover',
              )}
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: topAccentColor }}
                data-coverage-shift-color={metric.category}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  {noPublishedData ? (
                    <p className="mt-4 text-sm font-medium text-text-secondary">{t('coverage.noPublishedData')}</p>
                  ) : metric.category === 'ot' ? (
                    <>
                      <p className="mt-3 text-2xl font-semibold text-text-primary">{t('coverage.assignments', { count: metric.assignments })}</p>
                      <p className="mt-1 text-xs font-medium text-text-secondary">{t('coverage.hours', { count: metric.hours ?? 0 })}</p>
                    </>
                  ) : (
                    <p className="mt-3 text-2xl font-semibold text-text-primary">{t('coverage.assignments', { count: metric.assignments })}</p>
                  )}
                </div>
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border"
                  style={style}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
