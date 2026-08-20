import { useEffect } from 'react';
import axios from 'axios';
import { fetchSessionViewer } from '@/lib/backendSession';
import { mapViewerToAuthUser } from '@/lib/backendAdapters';
import { useAuthStore } from '@/stores/authStore';
import { getStoredLanguage } from '@/i18n/constants';

export default function BackendSessionBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let fullRefreshInFlight: Promise<unknown> | null = null;
    let inboxRefreshInFlight: Promise<unknown> | null = null;

    const refreshAll = () => {
      if (
        cancelled
        || fullRefreshInFlight
        || !useAuthStore.getState().user
        || document.visibilityState === 'hidden'
      ) return;
      fullRefreshInFlight = import('@/lib/backendBootstrap')
        .then(({ fetchAndHydrateBootstrap }) => fetchAndHydrateBootstrap())
        .catch(() => undefined)
        .finally(() => {
          fullRefreshInFlight = null;
        });
    };

    const refreshInbox = () => {
      if (
        cancelled
        || inboxRefreshInFlight
        || !useAuthStore.getState().user
        || document.visibilityState === 'hidden'
      ) return;
      inboxRefreshInFlight = import('@/lib/backendBootstrap')
        .then(({ fetchAndHydrateOperationalInbox }) => fetchAndHydrateOperationalInbox())
        .catch(() => undefined)
        .finally(() => {
          inboxRefreshInFlight = null;
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };

    window.addEventListener('focus', refreshAll);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const inboxInterval = window.setInterval(refreshInbox, 10_000);

    async function bootstrap() {
      try {
        const viewer = await fetchSessionViewer();
        if (cancelled) return;
        const language = getStoredLanguage();
        useAuthStore.getState().login(mapViewerToAuthUser(viewer, language));
        const { startAuthenticatedBackend } = await import('@/lib/authenticatedBackend');
        if (cancelled) return;
        await startAuthenticatedBackend();
      } catch (error) {
        if (cancelled) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          useAuthStore.getState().logoutLocal();
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      window.clearInterval(inboxInterval);
      window.removeEventListener('focus', refreshAll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
