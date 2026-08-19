import { describe, expect, it } from 'vitest';
import { syncRouteErrorResponse } from './syncRouteErrors.js';

describe('syncRouteErrorResponse', () => {
  it('keeps schedule conflicts actionable', () => {
    expect(syncRouteErrorResponse(
      new Error('Schedule month 2026-08 has been updated by another session.'),
      'SCHEDULE_SYNC_FAILED',
      'Unable to save schedule state.',
    )).toEqual({
      status: 409,
      code: 'CONFLICT',
      message: 'Schedule month 2026-08 has been updated by another session.',
    });
  });

  it('hides raw Prisma read-only database details', () => {
    const raw = `Invalid db.scheduleMonth.upsert() invocation: ConnectorError(QueryError(SqliteError { message: Some("attempt to write a readonly database") }))`;

    expect(syncRouteErrorResponse(raw, 'SCHEDULE_SYNC_FAILED', 'Unable to save schedule state.')).toEqual({
      status: 503,
      code: 'DATABASE_READ_ONLY',
      message: 'Database is read-only. Restart the backend or check database file permissions.',
    });
  });
});
