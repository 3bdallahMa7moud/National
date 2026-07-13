import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ScheduleViewControlsProps {
  statsExpanded: boolean;
  onToggleStats: () => void;
}

export default function ScheduleViewControls({
  statsExpanded,
  onToggleStats,
}: ScheduleViewControlsProps) {
  const { t } = useTranslation('schedule');

  return (
    <div className="hidden items-center justify-end gap-3 rounded-lg border border-border bg-surface px-3 py-2 shadow-soft md:flex print:hidden">
      <button
        type="button"
        aria-label={statsExpanded ? t('viewControls.hideStats') : t('viewControls.showStats')}
        aria-expanded={statsExpanded}
        onClick={onToggleStats}
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-bold text-text-secondary hover:bg-hover"
      >
        {statsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {statsExpanded ? t('viewControls.hideStatsLabel') : t('viewControls.showStatsLabel')}
      </button>
    </div>
  );
}
