export interface SyncRouteErrorResponse {
  status: number;
  code: string;
  message: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

function isConflictError(message: string): boolean {
  return message.includes('another session');
}

function isReadonlyDatabaseError(message: string): boolean {
  return /attempt to write a readonly database|readonly database/i.test(message);
}

function isInternalPersistenceError(message: string): boolean {
  return /Invalid .* invocation|ConnectorError|Prisma|QueryError|SqliteError/i.test(message);
}

export function syncRouteErrorResponse(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): SyncRouteErrorResponse {
  const message = errorText(error);

  if (isConflictError(message)) {
    return {
      status: 409,
      code: 'CONFLICT',
      message,
    };
  }

  if (isReadonlyDatabaseError(message)) {
    return {
      status: 503,
      code: 'DATABASE_READ_ONLY',
      message: 'Database is read-only. Restart the backend or check database file permissions.',
    };
  }

  if (isInternalPersistenceError(message)) {
    return {
      status: 500,
      code: fallbackCode,
      message: fallbackMessage,
    };
  }

  return {
    status: 400,
    code: fallbackCode,
    message: message || fallbackMessage,
  };
}
