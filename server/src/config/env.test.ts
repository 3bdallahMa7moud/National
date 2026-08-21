import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const developmentEnv = {
  NODE_ENV: 'development',
  APP_ORIGIN: 'http://127.0.0.1:5173',
  SESSION_SECRET: 'development-session-secret-change-me',
  DATABASE_URL: 'file:./dev.db',
  EMAIL_PROVIDER: 'console',
  EMAIL_FROM: 'no-reply@hospital.local',
  ENABLE_DEV_PASSWORD_RESET_CODES: 'true',
  ENABLE_DEV_SIGNUP_OTP_CODES: 'false',
};

const productionEnv = {
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://schedule.example.com',
  SESSION_SECRET: 'production-session-secret-that-is-long-enough-123',
  DATABASE_URL: 'file:/var/lib/ct-scan-scheduling/production.db',
  EMAIL_PROVIDER: 'resend',
  EMAIL_FROM: 'schedule@example.com',
  RESEND_API_KEY: 're_test_key',
  ENABLE_DEV_PASSWORD_RESET_CODES: 'false',
  ENABLE_DEV_SIGNUP_OTP_CODES: 'false',
};

describe('production environment validation', () => {
  it('keeps local defaults available outside production', () => {
    const parsed = parseEnv(developmentEnv);

    expect(parsed.SESSION_SECRET).toBe('development-session-secret-change-me');
    expect(parsed.DATABASE_URL).toBe('file:./dev.db');
  });

  it('rejects development defaults in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/production/i);
  });

  it('accepts explicit HTTPS production settings', () => {
    const parsed = parseEnv(productionEnv);

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.EMAIL_PROVIDER).toBe('resend');
  });

  it('rejects insecure production origins', () => {
    expect(() => parseEnv({
      ...productionEnv,
      APP_ORIGIN: 'http://schedule.example.com',
    })).toThrow(/HTTPS/i);
  });
});
