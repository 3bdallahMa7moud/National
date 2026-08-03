import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CalendarSyncCard from '@/components/common/CalendarSyncCard';
import { useAuthStore } from '@/stores/authStore';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import ErrorState from '@/components/common/ErrorState';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';

export default function CalendarSyncPage() {
  const { t } = useTranslation(['calendar']);
  const user = useAuthStore((s) => s.user);
  const [icalUrl, setIcalUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadFeedUrl() {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get<{ feedUrl: string }>('/calendar-sync');
        if (!cancelled) {
          setIcalUrl(response.data.feedUrl);
        }
      } catch {
        if (!cancelled) {
          setError(t('common:errorState.sectionMessage'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadFeedUrl();

    return () => {
      cancelled = true;
    };
  }, [t, user?.id]);

  const retry = () => {
    setIcalUrl('');
    setError('');
    setIsLoading(true);
    void api.get<{ feedUrl: string }>('/calendar-sync')
      .then((response) => setIcalUrl(response.data.feedUrl))
      .catch(() => setError(t('common:errorState.sectionMessage')))
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-primary-50 text-primary">
            <RefreshCw className="w-5 h-5" />
          </span>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{t('calendar:page.title')}</h1>
        </div>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{t('calendar:page.subtitle')}</p>
      </div>

      <div className="flex items-start gap-3 rounded-card border border-primary/20 bg-primary-50/70 p-4">
        <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs text-text-primary space-y-1">
          <p className="font-bold">{t('calendar:page.secureTitle')}</p>
          <p className="text-text-secondary leading-relaxed">{t('calendar:page.secureDescription')}</p>
        </div>
      </div>

      {isLoading ? <LoadingSkeleton lines={4} /> : error ? <ErrorState message={error} onRetry={retry} /> : <CalendarSyncCard icalUrl={icalUrl} />}
    </div>
  );
}
