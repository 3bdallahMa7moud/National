import { useState } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  level?: 'global' | 'route' | 'section';
  error?: Error | unknown;
  onRetry?: () => void;
  onHome?: () => void;
  onReload?: () => void;
}

export default function ErrorState({
  title,
  message,
  level = 'section',
  error,
  onRetry,
  onHome,
  onReload,
}: ErrorStateProps) {
  const { t } = useTranslation(['common']);
  const [showDetails, setShowDetails] = useState(false);

  const resolvedTitle =
    title ??
    (level === 'route'
      ? t('common:errorState.routeTitle')
      : level === 'global'
      ? t('common:errorState.title')
      : t('common:errorState.sectionTitle'));

  const resolvedMessage =
    message ??
    (level === 'route'
      ? t('common:errorState.routeMessage')
      : level === 'global'
      ? t('common:errorState.message')
      : t('common:errorState.sectionMessage'));

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : error
      ? JSON.stringify(error)
      : null;

  const errorStack = error instanceof Error ? error.stack : null;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        level === 'global' || level === 'route' ? 'min-h-[60vh] py-16 px-4' : 'py-12 px-4'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="p-4 rounded-full bg-danger-50 mb-4 shadow-soft">
        <AlertTriangle className="w-10 h-10 text-danger" aria-hidden="true" />
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">
        {resolvedTitle}
      </h3>

      <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
        {resolvedMessage}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {onRetry && (
          <Button
            variant="primary"
            onClick={onRetry}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {level === 'section'
              ? t('common:errorState.resetSection')
              : t('common:actions.retry')}
          </Button>
        )}

        {onReload && (
          <Button
            variant="secondary"
            onClick={onReload}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            {t('common:errorState.reloadPage')}
          </Button>
        )}

        {onHome && (
          <Button
            variant="secondary"
            onClick={onHome}
            icon={<Home className="w-4 h-4" />}
          >
            {t('common:errorState.goHome')}
          </Button>
        )}
      </div>

      {errorMessage && (
        <div className="w-full max-w-2xl text-start mt-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors py-1.5 px-3 rounded-btn border border-border bg-surface-muted mx-auto block mb-3"
            aria-expanded={showDetails}
          >
            <span>
              {showDetails
                ? t('common:errorState.hideDetails')
                : t('common:errorState.showDetails')}
            </span>
            {showDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showDetails && (
            <div className="rounded-card border border-danger/30 bg-danger-50/50 p-4 text-xs font-mono overflow-x-auto text-text-primary shadow-inner space-y-2">
              <p className="font-bold text-danger break-words">{errorMessage}</p>
              {errorStack && (
                <pre className="text-[11px] text-text-secondary whitespace-pre-wrap break-all leading-normal max-h-60 overflow-y-auto">
                  {errorStack}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
