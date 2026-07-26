import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  applyDocumentDirection,
  getStoredLanguage,
  type Language,
} from './constants';
import { initI18n } from './index';

const STARTUP_COPY: Record<
  Language,
  { loading: string; title: string; message: string; retry: string }
> = {
  en: {
    loading: 'Loading application…',
    title: 'Unable to start the application',
    message: 'The files required to start the application could not be loaded. Check your connection and try again.',
    retry: 'Retry',
  },
  ar: {
    loading: 'جارٍ تحميل التطبيق…',
    title: 'تعذر بدء تشغيل التطبيق',
    message: 'تعذر تحميل الملفات اللازمة لبدء التطبيق. تحقق من الاتصال ثم أعد المحاولة.',
    retry: 'إعادة المحاولة',
  },
};

interface I18nBootstrapProps {
  children?: ReactNode;
  initialize?: typeof initI18n;
  loadApplication?: () => Promise<{ default: ComponentType }>;
}

export default function I18nBootstrap({
  children,
  initialize = initI18n,
  loadApplication,
}: I18nBootstrapProps) {
  const [language] = useState<Language>(() => {
    const storedLanguage = getStoredLanguage();
    applyDocumentDirection(storedLanguage);
    return storedLanguage;
  });
  const copy = STARTUP_COPY[language];
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [Application, setApplication] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');

    Promise.resolve()
      .then(initialize)
      .then(async () => loadApplication ? (await loadApplication()).default : null)
      .then((loadedApplication) => {
        if (!active) return;
        if (loadedApplication) setApplication(() => loadedApplication);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        if (attempt > 0) {
          window.location.reload();
          return;
        }
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [attempt, initialize, loadApplication]);

  if (status === 'ready') {
    return Application ? <Application /> : children;
  }

  if (status === 'error') {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-background px-4 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="max-w-md rounded-card border border-danger/30 bg-surface-card p-6 shadow-card">
          <h1 className="text-xl font-bold text-text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.message}</p>
          <button
            type="button"
            className="mt-5 min-h-11 rounded-btn bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40"
            onClick={() => setAttempt((current) => current + 1)}
          >
            {copy.retry}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-4 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm font-semibold text-text-secondary">{copy.loading}</p>
    </main>
  );
}
