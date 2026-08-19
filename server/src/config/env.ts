import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  SESSION_SECRET: z.string().min(16).default('development-session-secret-change-me'),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  ENABLE_DEV_PASSWORD_RESET_CODES: z.coerce.boolean().default(true),
  ENABLE_DEV_SIGNUP_OTP_CODES: z.coerce.boolean().default(false),
  SIGNUP_OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().max(60).default(1),
  SIGNUP_OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().max(20).default(5),
  SIGNUP_OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().min(1).default('no-reply@hospital.local'),
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

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';
