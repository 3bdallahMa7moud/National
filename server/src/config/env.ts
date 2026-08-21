import { z } from 'zod';

const DEVELOPMENT_SESSION_SECRET = 'development-session-secret-change-me';
const DEVELOPMENT_DATABASE_URL = 'file:./dev.db';
const DEVELOPMENT_APP_ORIGIN = 'http://127.0.0.1:5173';
const DEVELOPMENT_EMAIL_FROM = 'no-reply@hospital.local';
const envBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url().default(DEVELOPMENT_APP_ORIGIN),
  SESSION_SECRET: z.string().min(16).default(DEVELOPMENT_SESSION_SECRET),
  DATABASE_URL: z.string().min(1).default(DEVELOPMENT_DATABASE_URL),
  ENABLE_DEV_PASSWORD_RESET_CODES: envBoolean.default(true),
  ENABLE_DEV_SIGNUP_OTP_CODES: envBoolean.default(false),
  SIGNUP_OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().max(60).default(1),
  SIGNUP_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().max(20).default(5),
  SIGNUP_OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().min(1).default(DEVELOPMENT_EMAIL_FROM),
  RESEND_API_KEY: z.string().optional(),
}).superRefine((value, context) => {
  if (value.EMAIL_PROVIDER === 'resend' && !value.RESEND_API_KEY) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY is required when EMAIL_PROVIDER is set to resend.',
    });
  }
});

export function parseEnv(input: NodeJS.ProcessEnv) {
  const parsed = envSchema.safeParse(input);
  if (!parsed.success) {
    throw parsed.error;
  }

  const value = parsed.data;
  if (value.NODE_ENV !== 'production') {
    return value;
  }

  const issues: z.ZodIssue[] = [];
  const hasInputValue = (key: keyof NodeJS.ProcessEnv) => Boolean(input[key]?.trim());
  const addIssue = (path: string, message: string) => {
    issues.push({
      code: z.ZodIssueCode.custom,
      path: [path],
      message,
    });
  };

  if (!hasInputValue('SESSION_SECRET') || value.SESSION_SECRET === DEVELOPMENT_SESSION_SECRET || value.SESSION_SECRET.length < 32) {
    addIssue('SESSION_SECRET', 'A custom SESSION_SECRET of at least 32 characters is required in production.');
  }

  if (!hasInputValue('DATABASE_URL') || value.DATABASE_URL === DEVELOPMENT_DATABASE_URL) {
    addIssue('DATABASE_URL', 'DATABASE_URL must be explicitly configured in production.');
  }

  if (!hasInputValue('APP_ORIGIN') || value.APP_ORIGIN === DEVELOPMENT_APP_ORIGIN) {
    addIssue('APP_ORIGIN', 'APP_ORIGIN must be explicitly configured in production.');
  } else if (new URL(value.APP_ORIGIN).protocol !== 'https:') {
    addIssue('APP_ORIGIN', 'APP_ORIGIN must use HTTPS in production.');
  }

  if (value.EMAIL_PROVIDER !== 'resend') {
    addIssue('EMAIL_PROVIDER', 'EMAIL_PROVIDER must be set to resend in production.');
  }

  if (!hasInputValue('EMAIL_FROM') || value.EMAIL_FROM === DEVELOPMENT_EMAIL_FROM) {
    addIssue('EMAIL_FROM', 'A real EMAIL_FROM sender is required in production.');
  }

  if (value.ENABLE_DEV_PASSWORD_RESET_CODES || value.ENABLE_DEV_SIGNUP_OTP_CODES) {
    addIssue('ENABLE_DEV_PASSWORD_RESET_CODES', 'Development OTP code responses must be disabled in production.');
  }

  if (issues.length > 0) {
    throw new z.ZodError(issues);
  }

  return value;
}

export const env = parseEnv(process.env);

export const isProduction = env.NODE_ENV === 'production';
