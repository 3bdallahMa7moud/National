import { CalendarDays, Clock3, Moon, PhoneCall, TimerReset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { CoverageCategory, CoverageMetric } from '@/types/operationalDashboard';

interface TodayCoverageCardsProps {
  metrics: CoverageMetric[];
  hasPublishedSchedule: boolean;
  selectedCategory: CoverageCategory | null;
  onSelect: (category: CoverageCategory) => void;
}

const coverageIcons = { day: CalendarDays, late: Clock3, night: Moon, onCall: PhoneCall, ot: TimerReset };

export default function TodayCoverageCards({ metrics, hasPublishedSchedule, selectedCategory, onSelect }: TodayCoverageCardsProps) {
  const { t } = useTranslation('dashboard');
  return (
    <section aria-labelledby="today-coverage-title" className="space-y-3">
      <div>
        <h2 id="today-coverage-title" className="text-base font-semibold text-text-primary sm:text-lg">{t('coverage.title')}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t('coverage.description')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = coverageIcons[metric.category];
          const label = t(`coverage.categories.${metric.category}`);
          const isSelected = selectedCategory === metric.category;
          const noPublishedData = metric.category !== 'ot' && !hasPublishedSchedule;
          return (
            <button
              key={metric.category}
              type="button"
              aria-label={t('coverage.ariaLabel', { shift: label })}
              aria-pressed={isSelected}
              onClick={() => onSelect(metric.category)}
              className={cn(
                'min-h-[132px] rounded-card border bg-surface p-4 text-start shadow-card transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-primary/40 hover:bg-hover',
              )}
            >
              <div className="flex items-start justify-between gap-3">
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
                    <>
                      <p className="mt-3 text-2xl font-semibold text-text-primary">{metric.coveredSlots ?? 0} / {metric.expectedSlots ?? 0}</p>
                      <p className={cn('mt-1 text-xs font-medium', (metric.uncoveredSlots ?? 0) > 0 ? 'text-danger' : 'text-success')}>
                        {(metric.uncoveredSlots ?? 0) > 0 ? t('coverage.uncovered', { count: metric.uncoveredSlots }) : t('coverage.fullyCovered')}
                      </p>
                    </>
                  )}
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary-50 text-primary ring-1 ring-primary/10">
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
