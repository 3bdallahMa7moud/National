import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

async function loadModules(overrides: Record<string, string>) {
  restoreEnv();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '3100',
    APP_ORIGIN: 'http://127.0.0.1:5173',
    SESSION_SECRET: 'test-session-secret-1234567890',
    DATABASE_URL: 'file:./prisma-test.db',
    ENABLE_DEV_PASSWORD_RESET_CODES: 'true',
    ENABLE_DEV_SIGNUP_OTP_CODES: 'true',
    SIGNUP_OTP_EXPIRY_MINUTES: '10',
    SIGNUP_OTP_MAX_ATTEMPTS: '5',
    SIGNUP_OTP_RESEND_COOLDOWN_SECONDS: '60',
    EMAIL_PROVIDER: 'console',
    EMAIL_FROM: 'no-reply@hospital.local',
    RESEND_API_KEY: '',
    ...overrides,
  });
  vi.resetModules();

  const emailModule = await import('./email.js');
  const authModule = await import('./auth.js');

  return {
    ...emailModule,
    ...authModule,
  };
}

describe('email delivery configuration', () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requires a real email provider outside automated tests', async () => {
    const { sendEmail, includeDevResetCode, includeDevSignupCode } = await loadModules({
      NODE_ENV: 'development',
    });

    await expect(sendEmail({
      to: 'employee@example.com',
      subject: 'Setup password',
      text: 'Body',
      html: '<p>Body</p>',
    })).rejects.toMatchObject({
      name: 'EmailDeliveryError',
      message: 'Real email delivery is not configured. Set EMAIL_PROVIDER="resend", RESEND_API_KEY, and a valid EMAIL_FROM sender.',
    });

    expect(includeDevResetCode('123456')).toBeUndefined();
    expect(includeDevSignupCode('654321')).toBeUndefined();
  });

  it('keeps console preview behavior available for automated tests only', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendEmail, includeDevResetCode, includeDevSignupCode } = await loadModules({
      NODE_ENV: 'test',
    });

    await expect(sendEmail({
      to: 'employee@example.com',
      subject: 'Setup password',
      text: 'Body',
      html: '<p>Body</p>',
    })).resolves.toBeUndefined();

    expect(infoSpy).toHaveBeenCalledOnce();
    expect(includeDevResetCode('123456')).toBe('123456');
    expect(includeDevSignupCode('654321')).toBe('654321');
  });

  it('logs accepted Resend responses without leaking API keys or OTP values', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":"email_123456","token":"re_response_secret"}', {
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendEmail } = await loadModules({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_secret',
      EMAIL_FROM: 'onboarding@resend.dev',
    });

    await expect(sendEmail({
      to: 'employee@example.com',
      subject: 'Reset password',
      text: 'Code 123456',
      html: '<p>Code 123456</p>',
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer re_test_secret',
      }),
    }));

    const logText = infoSpy.mock.calls.flat().join(' ');
    expect(logText).toContain('[email:resend] send accepted');
    expect(logText).not.toContain('123456');
    expect(logText).not.toContain('re_test_secret');
    expect(logText).not.toContain('re_response_secret');
  });

  it('logs rejected Resend responses without leaking provider error secrets or OTP values', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"Bad code 654321 using re_error_secret"}', {
      status: 403,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { sendEmail } = await loadModules({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_secret',
      EMAIL_FROM: 'onboarding@resend.dev',
    });

    await expect(sendEmail({
      to: 'employee@example.com',
      subject: 'Reset password',
      text: 'Code 654321',
      html: '<p>Code 654321</p>',
    })).rejects.toMatchObject({
      name: 'EmailDeliveryError',
      message: 'Email delivery failed with status 403: {"message":"Bad code [REDACTED_OTP] using [REDACTED_API_KEY]"}',
    });

    const logText = errorSpy.mock.calls.flat().join(' ');
    expect(logText).toContain('[email:resend] send rejected');
    expect(logText).not.toContain('654321');
    expect(logText).not.toContain('re_test_secret');
    expect(logText).not.toContain('re_error_secret');
  });
});
