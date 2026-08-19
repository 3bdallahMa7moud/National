import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, normalizeEmail, serializeLocalizedUser, verifyPassword } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const updateProfileSchema = z.object({
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const profileRouter = Router();

profileRouter.get('/', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.viewer!.id },
    include: {
      department: true,
      accessProfile: true,
    },
  });

  if (!user) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'User not found.',
      },
    });
    return;
  }

  res.json({
    user: serializeLocalizedUser(user),
  });
});

profileRouter.patch('/', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid profile update payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  const existing = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      id: { not: req.viewer!.id },
    },
  });

  if (existing) {
    res.status(409).json({
      error: {
        code: 'EMAIL_TAKEN',
        message: 'Email address is already in use.',
      },
    });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.viewer!.id },
    data: {
      email: normalizedEmail,
      emailVerifiedAt: new Date(),
    },
    include: {
      department: true,
      accessProfile: true,
    },
  });

  res.json({
    user: serializeLocalizedUser(user),
  });
});

profileRouter.post('/password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid password change payload.',
        details: parsed.error.flatten(),
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.viewer!.id },
  });

  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    res.status(400).json({
      error: {
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect.',
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
    },
  });

  res.json({ ok: true });
});
