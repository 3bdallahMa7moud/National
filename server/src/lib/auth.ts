import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { type Prisma, type User, type UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { parseJson } from './json.js';

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    department: true;
    accessProfile: true;
  };
}>;

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findLoginUser(identifier: string) {
  const trimmed = identifier.trim();
  const normalized = trimmed.toLowerCase();
  const uppercase = trimmed.toUpperCase();

  const fastCandidates = Array.from(new Set([trimmed, normalized, uppercase]));
  const fastPathUsers = await prisma.user.findMany({
    where: {
      OR: [
        ...fastCandidates.map((value) => ({ employeeNumber: value })),
        ...fastCandidates.map((value) => ({ code: value })),
        ...fastCandidates.map((value) => ({ email: value })),
      ],
    },
    include: {
      department: true,
      accessProfile: true,
    },
  });

  const fastMatch = fastPathUsers.find((user) =>
    user.employeeNumber.toLowerCase() === normalized
    || user.code.toLowerCase() === normalized
    || (user.email?.toLowerCase() ?? '') === normalized
    || user.nameEn.toLowerCase() === normalized
    || user.nameAr === trimmed
  );

  if (fastMatch) {
    return fastMatch;
  }

  const users = await prisma.user.findMany({
    include: {
      department: true,
      accessProfile: true,
    },
  });

  return users.find((user) =>
    user.employeeNumber.toLowerCase() === normalized
    || user.code.toLowerCase() === normalized
    || (user.email?.toLowerCase() ?? '') === normalized
    || user.nameEn.toLowerCase() === normalized
    || user.nameAr === trimmed,
  ) ?? null;
}

export function serializeLocalizedUser(user: UserWithRelations) {
  return {
    id: user.id,
    employeeNumber: user.employeeNumber,
    code: user.code,
    role: user.role,
    email: user.email ?? '',
    phone: user.phone,
    isActive: user.isActive,
    scheduleEmployeeId: user.scheduleEmployeeId ?? undefined,
    name: {
      en: user.nameEn,
      ar: user.nameAr,
    },
    department: {
      id: user.department.id,
      name: {
        en: user.department.nameEn,
        ar: user.department.nameAr,
      },
    },
    position: {
      en: user.positionEn,
      ar: user.positionAr,
    },
    access: user.accessProfile ? {
      templateId: user.accessProfile.templateId,
      overrides: parseJson<Record<string, boolean>>(user.accessProfile.overridesJson, {}),
      active: user.accessProfile.isActive,
      updatedAt: user.accessProfile.updatedAt.toISOString(),
      updatedBy: user.accessProfile.updatedByLabel,
    } : null,
  };
}

export async function getViewer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      accessProfile: true,
    },
  });
  if (!user) return null;
  return serializeLocalizedUser(user);
}

export function ensureRole(user: { role: UserRole }, allowedRoles: UserRole[]) {
  return allowedRoles.includes(user.role);
}

export function createSixDigitOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function createPasswordResetCode() {
  return createSixDigitOtp();
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 1))}@${domain}`;
}

export function includeDevResetCode(code: string) {
  return env.NODE_ENV !== 'production' && env.ENABLE_DEV_PASSWORD_RESET_CODES ? code : undefined;
}

export function includeDevSignupCode(code: string) {
  return env.NODE_ENV !== 'production' && env.ENABLE_DEV_SIGNUP_OTP_CODES ? code : undefined;
}

export function isEmployeeAccessActive(user: Pick<User, 'role'> & { accessProfile?: { isActive: boolean } | null }) {
  return user.role !== 'employee' || user.accessProfile?.isActive !== false;
}
