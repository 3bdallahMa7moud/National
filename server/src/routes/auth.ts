import crypto from 'node:crypto';
import { AccessTemplateId } from '@prisma/client';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { createAuditEntry } from '../lib/audit.js';
import {
  createPasswordResetCode,
  createSixDigitOtp,
  findLoginUser,
  hashPassword,
  includeDevResetCode,
  includeDevSignupCode,
  isEmployeeAccessActive,
  maskEmail,
  normalizeEmail,
  serializeLocalizedUser,
  verifyPassword,
} from '../lib/auth.js';
import { EmailDeliveryError, sendPasswordResetEmail, sendSignupVerificationEmail } from '../lib/email.js';
import { ensureDefaultDepartments } from '../lib/defaultDepartments.js';
import { prisma } from '../lib/prisma.js';
import { checkRateLimit, clearRateLimit } from '../lib/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const signupRequestSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
  employeeNumber: z.string().trim().min(4).max(64),
  phone: z.string().trim().min(9).max(32),
  position: z.string().trim().min(2).max(120),
  departmentId: z.string().trim().min(1),
  password: z.string().min(6).max(128),
});

const signupVerifySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().regex(/^\d{6}$/),
});

const signupResendSchema = z.object({
  email: z.string().trim().email(),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1),
});

const verifyResetSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

const resetPasswordSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(6),
});

export const authRouter = Router();

function rateLimitKey(req: Request, scope: string, identifier: string) {
  return `${scope}:${req.ip}:${identifier.trim().toLowerCase()}`;
}

function sendRateLimit(res: Response, retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again later.',
    },
  });
}

function signupSuccessPayload(email: string, code?: string) {
  return {
    ok: true,
    verificationRequired: true,
    maskedEmail: maskEmail(email),
    expiresInMinutes: env.SIGNUP_OTP_EXPIRY_MINUTES,
    resendCooldownSeconds: env.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
    devCode: code ? includeDevSignupCode(code) : undefined,
  };
}

function nowPlusSignupExpiry() {
  return new Date(Date.now() + env.SIGNUP_OTP_EXPIRY_MINUTES * 60 * 1000);
}

function nowPlusPasswordResetExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

async function issuePasswordResetCode(args: {
  userId: string;
  email: string;
  identifier: string;
  purpose?: 'reset' | 'setup';
}) {
  const code = createPasswordResetCode();
  const codeHash = await hashPassword(code);
  const expiresAt = nowPlusPasswordResetExpiry();
  let resetCodeId = '';

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetCode.deleteMany({
      where: {
        userId: args.userId,
      },
    });

    const resetCode = await tx.passwordResetCode.create({
      data: {
        id: `reset-${args.userId}-${Date.now()}`,
        userId: args.userId,
        codeHash,
        deliveryTarget: args.email,
        expiresAt,
      },
      select: { id: true },
    });

    resetCodeId = resetCode.id;
  });

  try {
    await sendPasswordResetEmail({
      to: args.email,
      code,
      expiryMinutes: 10,
      appOrigin: env.APP_ORIGIN,
      identifier: args.identifier,
      purpose: args.purpose,
    });
  } catch (error) {
    await prisma.passwordResetCode.deleteMany({
      where: {
        id: resetCodeId,
      },
    });
    throw error;
  }

  return {
    code,
    expiresAt,
  };
}

async function createUniqueEmployeeCode(employeeNumber: string, name: string) {
  const normalizedEmployeeNumber = employeeNumber.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const normalizedName = name.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const base = (normalizedEmployeeNumber.slice(-5) || normalizedName.slice(0, 5) || 'USER').slice(0, 5);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = attempt === 0
      ? base
      : `${base[0] ?? 'U'}${String(attempt).padStart(4, '0')}`.slice(0, 5);
    const existing = await prisma.user.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }

  return `U${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)}`;
}

authRouter.get('/signup/options', async (_req, res) => {
  if (env.NODE_ENV !== 'production') {
    await ensureDefaultDepartments(prisma);
  }

  const departments = await prisma.department.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
  });

  res.json({
    departments: departments.map((department) => ({
      id: department.id,
      name: {
        en: department.nameEn,
        ar: department.nameAr,
      },
    })),
  });
});

authRouter.post('/signup/request', async (req, res) => {
  const parsed = signupRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid sign-up payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const requestByEmail = checkRateLimit(
    rateLimitKey(req, 'signup-request-email', normalizedEmail),
    5,
    15 * 60 * 1000,
  );
  if (!requestByEmail.allowed) {
    sendRateLimit(res, requestByEmail.retryAfterMs);
    return;
  }

  const requestByIp = checkRateLimit(
    rateLimitKey(req, 'signup-request-ip', 'all'),
    20,
    15 * 60 * 1000,
  );
  if (!requestByIp.allowed) {
    sendRateLimit(res, requestByIp.retryAfterMs);
    return;
  }

  const [department, existingByEmail, conflictingEmployeeNumber] = await Promise.all([
    prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        role: true,
        emailVerifiedAt: true,
        employeeNumber: true,
        nameEn: true,
        phone: true,
        departmentId: true,
        positionEn: true,
      },
    }),
    prisma.user.findUnique({
      where: { employeeNumber: parsed.data.employeeNumber },
      select: {
        id: true,
        emailVerifiedAt: true,
      },
    }),
  ]);

  if (!department) {
    res.status(400).json({
      error: {
        code: 'INVALID_DEPARTMENT',
        message: 'Department does not exist.',
      },
    });
    return;
  }

  if (existingByEmail?.emailVerifiedAt) {
    res.status(409).json({
      error: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'This email is already registered. Please sign in instead.',
      },
    });
    return;
  }

  if (existingByEmail && existingByEmail.role !== 'employee') {
    res.status(409).json({
      error: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'This email cannot be used for public registration.',
      },
    });
    return;
  }

  if (conflictingEmployeeNumber && conflictingEmployeeNumber.id !== existingByEmail?.id) {
    res.status(409).json({
      error: {
        code: 'EMPLOYEE_NUMBER_TAKEN',
        message: 'Employee number is already in use.',
      },
    });
    return;
  }

  const code = createSixDigitOtp();
  const [passwordHash, codeHash] = await Promise.all([
    hashPassword(parsed.data.password),
    hashPassword(code),
  ]);

  let verificationId = '';
  let userId = existingByEmail?.id ?? '';
  const expiresAt = nowPlusSignupExpiry();

  await prisma.$transaction(async (tx) => {
    const existingUser = existingByEmail
      ? await tx.user.findUnique({
        where: { id: existingByEmail.id },
        select: {
          id: true,
          employeeNumber: true,
          email: true,
          nameEn: true,
          phone: true,
          departmentId: true,
          positionEn: true,
          role: true,
        },
      })
      : null;

    const user = existingUser
      ? await tx.user.update({
        where: { id: existingUser.id },
        data: {
          employeeNumber: parsed.data.employeeNumber,
          nameEn: parsed.data.name,
          nameAr: parsed.data.name,
          email: normalizedEmail,
          phone: parsed.data.phone,
          departmentId: parsed.data.departmentId,
          positionEn: parsed.data.position,
          positionAr: parsed.data.position,
          passwordHash,
          isActive: false,
          emailVerifiedAt: null,
        },
        select: {
          id: true,
          employeeNumber: true,
          email: true,
          nameEn: true,
          phone: true,
          departmentId: true,
          positionEn: true,
        },
      })
      : await tx.user.create({
        data: {
          id: `user-${crypto.randomUUID()}`,
          employeeNumber: parsed.data.employeeNumber,
          code: await createUniqueEmployeeCode(parsed.data.employeeNumber, parsed.data.name),
          nameEn: parsed.data.name,
          nameAr: parsed.data.name,
          email: normalizedEmail,
          phone: parsed.data.phone,
          role: 'employee',
          departmentId: parsed.data.departmentId,
          positionEn: parsed.data.position,
          positionAr: parsed.data.position,
          isActive: false,
          emailVerifiedAt: null,
          passwordHash,
          accessProfile: {
            create: {
              templateId: AccessTemplateId.standard,
              overridesJson: '{}',
              isActive: true,
              updatedByLabel: 'Public Sign Up',
            },
          },
        },
        select: {
          id: true,
          employeeNumber: true,
          email: true,
          nameEn: true,
          phone: true,
          departmentId: true,
          positionEn: true,
        },
      });

    userId = user.id;

    await tx.emailVerificationCode.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });

    const verification = await tx.emailVerificationCode.create({
      data: {
        id: `verify-${user.id}-${Date.now()}`,
        userId: user.id,
        codeHash,
        deliveryTarget: normalizedEmail,
        expiresAt,
      },
      select: { id: true },
    });
    verificationId = verification.id;

    await createAuditEntry(tx, {
      actorName: 'public-signup',
      action: existingUser ? 'signup_request_update' : 'signup_request_create',
      module: 'auth',
      entityId: user.id,
      entityLabel: user.nameEn,
      before: existingUser ? {
        employeeNumber: existingUser.employeeNumber,
        email: existingUser.email,
        phone: existingUser.phone,
        departmentId: existingUser.departmentId,
        position: existingUser.positionEn,
      } : undefined,
      after: {
        employeeNumber: user.employeeNumber,
        email: user.email,
        phone: user.phone,
        departmentId: user.departmentId,
        position: user.positionEn,
        verificationPending: true,
      },
      context: {
        route: '/api/auth/signup/request',
      },
    });
  });

  try {
    await sendSignupVerificationEmail({
      to: normalizedEmail,
      code,
      expiryMinutes: env.SIGNUP_OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    await prisma.emailVerificationCode.update({
      where: { id: verificationId },
      data: {
        invalidatedAt: new Date(),
      },
    });

    const message = error instanceof EmailDeliveryError ? error.message : 'Unable to send verification email.';
    res.status(502).json({
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message,
      },
    });
    return;
  }

  res.status(existingByEmail ? 200 : 201).json({
    ...signupSuccessPayload(normalizedEmail, code),
    userId,
  });
});

authRouter.post('/signup/verify', async (req, res) => {
  const parsed = signupVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid sign-up verification payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const verifyLimit = checkRateLimit(
    rateLimitKey(req, 'signup-verify', normalizedEmail),
    12,
    10 * 60 * 1000,
  );
  if (!verifyLimit.allowed) {
    sendRateLimit(res, verifyLimit.retryAfterMs);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      nameEn: true,
      emailVerifiedAt: true,
      isActive: true,
    },
  });

  if (!user) {
    res.status(400).json({
      error: {
        code: 'INVALID_SIGNUP_OTP',
        message: 'Verification code is invalid.',
      },
    });
    return;
  }

  const latestCode = await prisma.emailVerificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { requestedAt: 'desc' },
  });

  if (!latestCode) {
    res.status(400).json({
      error: {
        code: user.emailVerifiedAt ? 'ACCOUNT_ALREADY_VERIFIED' : 'INVALID_SIGNUP_OTP',
        message: user.emailVerifiedAt
          ? 'This account is already verified.'
          : 'Verification code is invalid.',
      },
    });
    return;
  }

  const matchesLatestCode = await verifyPassword(parsed.data.code, latestCode.codeHash);

  if (latestCode.usedAt && matchesLatestCode) {
    res.status(409).json({
      error: {
        code: 'SIGNUP_OTP_ALREADY_USED',
        message: 'Verification code has already been used.',
      },
    });
    return;
  }

  if (latestCode.failedAttempts >= env.SIGNUP_OTP_MAX_ATTEMPTS) {
    res.status(429).json({
      error: {
        code: 'SIGNUP_OTP_ATTEMPTS_EXCEEDED',
        message: 'Verification attempts exceeded. Please request a new code.',
      },
    });
    return;
  }

  if (latestCode.invalidatedAt || !matchesLatestCode) {
    if (!latestCode.usedAt && !latestCode.invalidatedAt && latestCode.expiresAt > new Date()) {
      const nextFailedAttempts = latestCode.failedAttempts + 1;
      await prisma.emailVerificationCode.update({
        where: { id: latestCode.id },
        data: {
          failedAttempts: nextFailedAttempts,
          invalidatedAt: nextFailedAttempts >= env.SIGNUP_OTP_MAX_ATTEMPTS ? new Date() : null,
        },
      });
      if (nextFailedAttempts >= env.SIGNUP_OTP_MAX_ATTEMPTS) {
        res.status(429).json({
          error: {
            code: 'SIGNUP_OTP_ATTEMPTS_EXCEEDED',
            message: 'Verification attempts exceeded. Please request a new code.',
          },
        });
        return;
      }
    }

    res.status(400).json({
      error: {
        code: 'INVALID_SIGNUP_OTP',
        message: 'Verification code is invalid.',
      },
    });
    return;
  }

  if (latestCode.expiresAt <= new Date()) {
    res.status(400).json({
      error: {
        code: 'SIGNUP_OTP_EXPIRED',
        message: 'Verification code has expired.',
      },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });

    await tx.emailVerificationCode.update({
      where: { id: latestCode.id },
      data: {
        usedAt: new Date(),
      },
    });

    await tx.emailVerificationCode.updateMany({
      where: {
        userId: user.id,
        id: { not: latestCode.id },
        usedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });

    await createAuditEntry(tx, {
      actorUserId: user.id,
      actorName: user.nameEn,
      action: 'signup_verify',
      module: 'auth',
      entityId: user.id,
      entityLabel: user.nameEn,
      after: {
        emailVerified: true,
        isActive: true,
      },
      context: {
        route: '/api/auth/signup/verify',
      },
    });
  });

  clearRateLimit(rateLimitKey(req, 'signup-verify', normalizedEmail));

  res.json({
    ok: true,
    message: 'Email verified successfully.',
  });
});

authRouter.post('/signup/resend', async (req, res) => {
  const parsed = signupResendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid sign-up resend payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);
  const resendByEmail = checkRateLimit(
    rateLimitKey(req, 'signup-resend-email', normalizedEmail),
    4,
    15 * 60 * 1000,
  );
  if (!resendByEmail.allowed) {
    sendRateLimit(res, resendByEmail.retryAfterMs);
    return;
  }

  const resendByIp = checkRateLimit(
    rateLimitKey(req, 'signup-resend-ip', 'all'),
    12,
    15 * 60 * 1000,
  );
  if (!resendByIp.allowed) {
    sendRateLimit(res, resendByIp.retryAfterMs);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      nameEn: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || user.emailVerifiedAt) {
    res.json({
      ok: true,
      resent: false,
    });
    return;
  }

  const latestCode = await prisma.emailVerificationCode.findFirst({
    where: { userId: user.id },
    orderBy: { requestedAt: 'desc' },
  });

  if (latestCode) {
    const availableAt = latestCode.requestedAt.getTime() + env.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS * 1000;
    const retryAfterMs = availableAt - Date.now();
    if (retryAfterMs > 0) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      res.status(429).json({
        error: {
          code: 'SIGNUP_OTP_RESEND_COOLDOWN',
          message: 'Please wait before requesting another verification code.',
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        },
      });
      return;
    }
  }

  const code = createSixDigitOtp();
  const codeHash = await hashPassword(code);
  const expiresAt = nowPlusSignupExpiry();
  let verificationId = '';

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });

    const verification = await tx.emailVerificationCode.create({
      data: {
        id: `verify-${user.id}-${Date.now()}`,
        userId: user.id,
        codeHash,
        deliveryTarget: normalizedEmail,
        expiresAt,
      },
      select: { id: true },
    });

    verificationId = verification.id;

    await createAuditEntry(tx, {
      actorName: 'public-signup',
      action: 'signup_resend',
      module: 'auth',
      entityId: user.id,
      entityLabel: user.nameEn,
      after: {
        verificationPending: true,
      },
      context: {
        route: '/api/auth/signup/resend',
      },
    });
  });

  try {
    await sendSignupVerificationEmail({
      to: normalizedEmail,
      code,
      expiryMinutes: env.SIGNUP_OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    await prisma.emailVerificationCode.update({
      where: { id: verificationId },
      data: {
        invalidatedAt: new Date(),
      },
    });

    const message = error instanceof EmailDeliveryError ? error.message : 'Unable to send verification email.';
    res.status(502).json({
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message,
      },
    });
    return;
  }

  res.json({
    ...signupSuccessPayload(normalizedEmail, code),
    resent: true,
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid login payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const loginKey = rateLimitKey(req, 'login', parsed.data.identifier);
  const loginLimit = checkRateLimit(loginKey, 8, 15 * 60 * 1000);
  if (!loginLimit.allowed) {
    sendRateLimit(res, loginLimit.retryAfterMs);
    return;
  }

  const user = await findLoginUser(parsed.data.identifier);
  if (!user) {
    res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials.',
      },
    });
    return;
  }

  if (user.email && !user.emailVerifiedAt) {
    res.status(403).json({
      error: {
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Please verify your email address before signing in.',
      },
    });
    return;
  }

  if (!user.isActive || !isEmployeeAccessActive(user)) {
    res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials.',
      },
    });
    return;
  }

  const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials.',
      },
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  req.session.userId = user.id;
  req.session.role = user.role;
  clearRateLimit(loginKey);

  res.json({
    user: serializeLocalizedUser(user),
  });
});

authRouter.get('/session', requireAuth, async (req, res) => {
  res.json({
    user: req.viewer,
  });
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  res.clearCookie('sid');
  res.status(204).send();
});

authRouter.post('/forgot-password/request', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid forgot-password request.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const requestKey = rateLimitKey(req, 'forgot-password-request', parsed.data.identifier);
  const requestLimit = checkRateLimit(requestKey, 5, 15 * 60 * 1000);
  if (!requestLimit.allowed) {
    sendRateLimit(res, requestLimit.retryAfterMs);
    return;
  }

  const user = await findLoginUser(parsed.data.identifier);
  if (!user || !user.isActive) {
    res.json({ ok: true, accountFound: false });
    return;
  }

  if (!user.email) {
    res.json({
      ok: true,
      accountFound: true,
      hasEmail: false,
      maskedEmail: null,
      userId: user.id,
      displayName: {
        en: user.nameEn,
        ar: user.nameAr,
      },
    });
    return;
  }

  let code = '';
  try {
    const result = await issuePasswordResetCode({
      userId: user.id,
      email: user.email,
      identifier: user.email,
    });
    code = result.code;
  } catch (error) {
    const message = error instanceof EmailDeliveryError ? error.message : 'Unable to send password reset email.';
    res.status(502).json({
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message,
      },
    });
    return;
  }

  res.json({
    ok: true,
    accountFound: true,
    hasEmail: true,
    maskedEmail: maskEmail(user.email),
    userId: user.id,
    displayName: {
      en: user.nameEn,
      ar: user.nameAr,
    },
    devCode: includeDevResetCode(code),
  });
});

authRouter.post('/forgot-password/verify', async (req, res) => {
  const parsed = verifyResetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid verification payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const verifyKey = rateLimitKey(req, 'forgot-password-verify', `${parsed.data.identifier}:${parsed.data.code}`);
  const verifyLimit = checkRateLimit(verifyKey, 10, 10 * 60 * 1000);
  if (!verifyLimit.allowed) {
    sendRateLimit(res, verifyLimit.retryAfterMs);
    return;
  }

  const user = await findLoginUser(parsed.data.identifier);
  if (!user) {
    res.status(400).json({
      error: {
        code: 'INVALID_RESET_CODE',
        message: 'Reset code is invalid or expired.',
      },
    });
    return;
  }

  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { requestedAt: 'desc' },
  });

  if (!resetCode || !(await verifyPassword(parsed.data.code, resetCode.codeHash))) {
    res.status(400).json({
      error: {
        code: 'INVALID_RESET_CODE',
        message: 'Reset code is invalid or expired.',
      },
    });
    return;
  }

  clearRateLimit(verifyKey);

  res.json({ ok: true });
});

authRouter.post('/forgot-password/reset', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid reset payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const resetKey = rateLimitKey(req, 'forgot-password-reset', `${parsed.data.identifier}:${parsed.data.code}`);
  const resetLimit = checkRateLimit(resetKey, 6, 10 * 60 * 1000);
  if (!resetLimit.allowed) {
    sendRateLimit(res, resetLimit.retryAfterMs);
    return;
  }

  const user = await findLoginUser(parsed.data.identifier);
  if (!user) {
    res.status(400).json({
      error: {
        code: 'INVALID_RESET_CODE',
        message: 'Reset code is invalid or expired.',
      },
    });
    return;
  }

  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { requestedAt: 'desc' },
  });

  if (!resetCode || !(await verifyPassword(parsed.data.code, resetCode.codeHash))) {
    res.status(400).json({
      error: {
        code: 'INVALID_RESET_CODE',
        message: 'Reset code is invalid or expired.',
      },
    });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        emailVerifiedAt: user.email && !user.emailVerifiedAt ? new Date() : user.emailVerifiedAt,
        isActive: true,
      },
    }),
    prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: {
        consumedAt: new Date(),
      },
    }),
  ]);

  clearRateLimit(resetKey);

  res.json({ ok: true });
});
