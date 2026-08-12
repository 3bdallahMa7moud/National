import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl, shouldHandleUnauthorized } from './axios';

describe('resolveApiBaseUrl', () => {
  it('uses the Vite proxy path during development', () => {
    expect(resolveApiBaseUrl({
      DEV: true,
      VITE_API_URL: 'http://localhost:3000/api',
    })).toBe('/api');
  });

  it('uses the configured API URL outside development', () => {
    expect(resolveApiBaseUrl({
      DEV: false,
      VITE_API_URL: 'http://127.0.0.1:3100/api',
    })).toBe('http://127.0.0.1:3100/api');
  });

  it('falls back to a relative API path outside development when unset', () => {
    expect(resolveApiBaseUrl({
      DEV: false,
      VITE_API_URL: '',
    })).toBe('/api');
  });

  it('handles unauthorized responses from protected endpoints', () => {
    expect(shouldHandleUnauthorized('/employees')).toBe(true);
    expect(shouldHandleUnauthorized('/auth/session')).toBe(true);
  });

  it('does not treat invalid login credentials as an expired app session', () => {
    expect(shouldHandleUnauthorized('/auth/login')).toBe(false);
  });
});
