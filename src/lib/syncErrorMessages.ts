export function sanitizeSyncErrorMessage(message: string, fallback: string) {
  if (/attempt to write a readonly database|readonly database/i.test(message)) {
    return 'Database is read-only. Your changes are kept locally, but they were not saved to the server. Restart the backend or check prisma/app.db permissions.';
  }

  if (/Invalid .* invocation|ConnectorError|Prisma|QueryError|SqliteError/i.test(message)) {
    return fallback;
  }

  return message || fallback;
}
