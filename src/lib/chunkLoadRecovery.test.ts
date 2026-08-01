import { afterEach, describe, expect, it, vi } from 'vitest';
import { installChunkLoadRecovery } from './chunkLoadRecovery';

describe('chunk load recovery', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reloads once when Vite reports a stale lazy chunk', () => {
    const reload = vi.fn();
    const removeListener = installChunkLoadRecovery({ reload, now: () => 1_000 });
    const event = new Event('vite:preloadError', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    removeListener();
  });

  it('lets repeated failures reach the route error UI during the cooldown', () => {
    const reload = vi.fn();
    const removeListener = installChunkLoadRecovery({ reload, now: () => 1_000 });

    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    const repeatedEvent = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(repeatedEvent);

    expect(repeatedEvent.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    removeListener();
  });

  it('keeps the normal error behavior when session storage is unavailable', () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => {
        throw new Error('Storage disabled');
      },
      setItem: vi.fn(),
    };
    const removeListener = installChunkLoadRecovery({ reload, storage });
    const event = new Event('vite:preloadError', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    removeListener();
  });
});
