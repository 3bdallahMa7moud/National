import { useEffect } from 'react';
import axios from 'axios';
import {
  fetchAndHydrateBootstrap,
  fetchAndHydrateOperationalInbox,
  fetchSessionViewer,
} from '@/lib/backendBootstrap';
import { mapViewerToAuthUser } from '@/lib/backendAdapters';
import { startBackendStateSync } from '@/lib/backendStateSync';
import { useAuthStore } from '@/stores/authStore';
import { getStoredLanguage } from '@/i18n/constants';

export default function BackendSessionBootstrap() {
  useEffect(() => {
    startBackendStateSync();
    let cancelled = false;

    const refreshAll = () => {
      if (cancelled || !useAuthStore.getState().user || document.visibilityState === 'hidden') return;
      void fetchAndHydrateBootstrap().catch(() => undefined);
    };

    const refreshInbox = () => {
      if (cancelled || !useAuthStore.getState().user || document.visibilityState === 'hidden') return;
      void fetchAndHydrateOperationalInbox().catch(() => undefined);
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
        await fetchAndHydrateBootstrap();
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
