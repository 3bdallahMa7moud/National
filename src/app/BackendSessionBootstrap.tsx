import { useEffect } from 'react';
import axios from 'axios';
import { fetchAndHydrateBootstrap, fetchSessionViewer } from '@/lib/backendBootstrap';
import { mapViewerToAuthUser } from '@/lib/backendAdapters';
import { startBackendStateSync } from '@/lib/backendStateSync';
import { useAuthStore } from '@/stores/authStore';
import { getStoredLanguage } from '@/i18n/constants';

export default function BackendSessionBootstrap() {
  useEffect(() => {
    startBackendStateSync();
    let cancelled = false;

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
    };
  }, []);

  return null;
}
