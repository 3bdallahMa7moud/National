import { fetchAndHydrateBootstrap } from './backendBootstrap';
import { startBackendStateSync } from './backendStateSync';

/**
 * Loads protected operational state only after authentication succeeds.
 * Keeping this behind a dynamic import prevents the public sign-in shell from
 * downloading the schedule and overtime stores before they are needed.
 */
export async function startAuthenticatedBackend(): Promise<void> {
  startBackendStateSync();
  await fetchAndHydrateBootstrap();
}
