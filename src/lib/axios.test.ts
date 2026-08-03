import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './axios';

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
});
