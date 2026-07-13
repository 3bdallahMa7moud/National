import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation(['common']);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="alert" aria-live="assertive">
      <div className="p-4 rounded-full bg-danger-50 mb-4">
        <AlertTriangle className="w-10 h-10 text-danger" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">
        {title ?? t('common:errorState.title')}
      </h3>
      <p className="text-sm text-text-secondary max-w-sm mb-4">
        {message ?? t('common:errorState.message')}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RefreshCw className="w-4 h-4" />}>
          {t('common:actions.retry')}
        </Button>
      )}
    </div>
  );
}
