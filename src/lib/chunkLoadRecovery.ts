const CHUNK_RELOAD_TIMESTAMP_KEY = 'ct-scan:chunk-reload-timestamp';
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;

type ChunkLoadRecoveryOptions = {
  eventTarget?: Window;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  reload?: () => void;
  now?: () => number;
};

/**
 * Refreshes a stale Vite entry after a deployment removes one of its old
 * content-hashed lazy chunks. A timestamp guard lets a persistent network
 * failure reach the route error UI instead of creating a reload loop.
 */
export function installChunkLoadRecovery({
  eventTarget = window,
  storage = window.sessionStorage,
  reload = () => window.location.reload(),
  now = Date.now,
}: ChunkLoadRecoveryOptions = {}) {
  const handlePreloadError = (event: Event) => {
    const currentTimestamp = now();

    try {
      const storedTimestamp = storage.getItem(CHUNK_RELOAD_TIMESTAMP_KEY);
      const previousTimestamp = Number(storedTimestamp);

      if (
        storedTimestamp !== null
        && Number.isFinite(previousTimestamp)
        && currentTimestamp - previousTimestamp < CHUNK_RELOAD_COOLDOWN_MS
      ) {
        return;
      }

      storage.setItem(CHUNK_RELOAD_TIMESTAMP_KEY, String(currentTimestamp));
    } catch {
      // If session storage is unavailable, keep the normal route error UI.
      return;
    }

    event.preventDefault();
    reload();
  };

  eventTarget.addEventListener('vite:preloadError', handlePreloadError);

  return () => {
    eventTarget.removeEventListener('vite:preloadError', handlePreloadError);
  };
}
