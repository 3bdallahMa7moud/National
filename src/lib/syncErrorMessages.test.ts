import { describe, expect, it } from 'vitest';
import { sanitizeSyncErrorMessage } from './syncErrorMessages';

describe('sanitizeSyncErrorMessage', () => {
  it('turns raw read-only database details into a user-facing message', () => {
    const raw = `Invalid db.scheduleMonth.upsert() invocation: ConnectorError(QueryError(SqliteError { message: Some("attempt to write a readonly database") }))`;

    expect(sanitizeSyncErrorMessage(raw, 'Unable to sync schedule state.')).toBe(
      'Database is read-only. Your changes are kept locally, but they were not saved to the server. Restart the backend or check prisma/app.db permissions.',
    );
  });

  it('keeps conflict messages visible', () => {
    expect(sanitizeSyncErrorMessage(
      'Schedule month 2026-08 has been updated by another session.',
      'Unable to sync schedule state.',
    )).toBe('Schedule month 2026-08 has been updated by another session.');
  });
});
