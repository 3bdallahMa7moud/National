import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorState from '@/components/common/ErrorState';
import { loadNamespaces } from './index';
import type { Language, Namespace } from './constants';

interface NamespaceBoundaryProps {
  namespaces: readonly Namespace[];
  children: ReactNode;
  fallback?: ReactNode;
}

function activeLanguage(language: string): Language {
  return language.startsWith('ar') ? 'ar' : 'en';
}

export default function NamespaceBoundary({
  namespaces,
  children,
  fallback,
}: NamespaceBoundaryProps) {
  const { i18n, t } = useTranslation('common');
  const language = activeLanguage(i18n.resolvedLanguage || i18n.language);
  const namespaceKey = namespaces.join('|');
  const requestKey = `${language}:${namespaceKey}`;
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<{
    key: string;
    status: 'loading' | 'error';
    error?: unknown;
  }>({ key: requestKey, status: 'loading' });
  const ready = namespaces.every((namespace) => i18n.hasResourceBundle(language, namespace));

  useEffect(() => {
    if (ready) return;

    let active = true;
    setLoadState({ key: requestKey, status: 'loading' });

    loadNamespaces(namespaces, language)
      .then(() => {
        if (active) setLoadState({ key: requestKey, status: 'loading' });
      })
      .catch((error: unknown) => {
        if (active) setLoadState({ key: requestKey, status: 'error', error });
      });

    return () => {
      active = false;
    };
  }, [attempt, language, namespaces, ready, requestKey]);

  if (ready) return children;

  if (loadState.key === requestKey && loadState.status === 'error') {
    return (
      <ErrorState
        level="route"
        error={loadState.error}
        onRetry={() => setAttempt((current) => current + 1)}
      />
    );
  }

  return fallback ?? (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4 text-sm font-semibold text-text-secondary"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {t('common:loading')}
    </div>
  );
}
