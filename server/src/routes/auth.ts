import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  createPasswordResetCode,
  findLoginUser,
  hashPassword,
  includeDevResetCode,
  isEmployeeAccessActive,
  maskEmail,
  serializeLocalizedUser,
  verifyPassword,
} from '../lib/auth.js';
import { EmailDeliveryError, sendPasswordResetEmail } from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import { checkRateLimit, clearRateLimit } from '../lib/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
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

function sendSignupDisabled(res: Response) {
  res.status(404).json({
    error: {
      code: 'SIGNUP_DISABLED',
      message: 'Public sign up is disabled.',
    },
  });
}

authRouter.get('/signup/options', (_req, res) => {
  sendSignupDisabled(res);
});

authRouter.post('/signup/request', (_req, res) => {
  sendSignupDisabled(res);
});

authRouter.post('/signup/verify', (_req, res) => {
  sendSignupDisabled(res);
});

authRouter.post('/signup/resend', (_req, res) => {
  sendSignupDisabled(res);
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

  const verifyKey = rateLimitKey(req, 'forgot-password-verify', parsed.data.identifier);
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

  const resetKey = rateLimitKey(req, 'forgot-password-reset', parsed.data.identifier);
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
