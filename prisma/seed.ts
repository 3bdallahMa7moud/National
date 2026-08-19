import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { createScheduleSeedTemplate } from './scheduleSeedTemplate.js';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = '123456';
const DEFAULT_DEPARTMENT_ID = 'dept-1';
const SEEDED_MONTH = { year: 2026, month: 7 };

const departments = [
  {
    id: 'dept-1',
    nameEn: 'CT Scan Department',
    nameAr: 'قسم الأشعة المقطعية',
    descriptionEn: 'Computerized Tomography (CT Scan) imaging department',
    descriptionAr: 'قسم التصوير بالأشعة المقطعية المحوسبة (CT Scan)',
    managerId: 'emp-1',
  },
] as const;

const users = [
  {
    id: 'emp-1',
    employeeNumber: 'EMP-001',
    code: 'ISH',
    nameEn: 'Dr. Ishraq',
    nameAr: 'د. اشراق',
    email: 'admin@hospital.sa',
    phone: '0501234567',
    role: 'super_admin',
    departmentId: DEFAULT_DEPARTMENT_ID,
    positionEn: 'Department Head',
    positionAr: 'رئيس القسم',
    isActive: true,
    scheduleEmployeeId: 'emp-1',
  },
  {
    id: 'ot-employee-s',
    employeeNumber: 'EMP-002',
    code: 'S',
    nameEn: 'Ali',
    nameAr: 'علي',
    email: 'ali@hospital.sa',
    phone: '0501000001',
    role: 'employee',
    departmentId: DEFAULT_DEPARTMENT_ID,
    positionEn: 'CT Scan Technologist',
    positionAr: 'أخصائي أشعة مقطعية',
    isActive: true,
    scheduleEmployeeId: 'ot-employee-s',
  },
  {
    id: 'emp-m-1',
    employeeNumber: 'EMP-003',
    code: 'A',
    nameEn: 'Ahmed',
    nameAr: 'أحمد',
    email: 'ahmed@hospital.sa',
    phone: '0501000002',
    role: 'admin',
    departmentId: DEFAULT_DEPARTMENT_ID,
    positionEn: 'CT Scan Technologist',
    positionAr: 'أخصائي أشعة مقطعية',
    isActive: true,
    scheduleEmployeeId: 'emp-m-1',
  },
] as const;

async function upsertDepartment() {
  for (const department of departments) {
    await prisma.department.upsert({
      where: { id: department.id },
      update: {
        nameEn: department.nameEn,
        nameAr: department.nameAr,
        descriptionEn: department.descriptionEn,
        descriptionAr: department.descriptionAr,
        managerId: department.managerId ?? null,
      },
      create: {
        id: department.id,
        nameEn: department.nameEn,
        nameAr: department.nameAr,
        descriptionEn: department.descriptionEn,
        descriptionAr: department.descriptionAr,
        managerId: null,
      },
    });
  }
}

function seededUsers(): Array<Prisma.UserUncheckedCreateInput> {
  return users.map((user) => ({
    id: user.id,
    employeeNumber: user.employeeNumber,
    code: user.code,
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    email: user.email,
    emailVerifiedAt: user.email ? new Date('2023-02-01T00:00:00.000Z') : null,
    phone: user.phone,
    role: user.role,
    departmentId: user.departmentId,
    positionEn: user.positionEn,
    positionAr: user.positionAr,
    avatar: null,
    isActive: user.isActive,
    passwordHash: '',
    createdAt: new Date('2023-02-01T00:00:00.000Z'),
    updatedAt: new Date('2023-02-01T00:00:00.000Z'),
    scheduleEmployeeId: user.scheduleEmployeeId,
  }));
}

async function upsertUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  for (const user of seededUsers()) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        ...user,
        passwordHash,
      },
      create: {
        ...user,
        passwordHash,
      },
    });
  }
}

async function upsertAccessProfiles() {
  const existingUsers = await prisma.user.findMany();
  for (const user of existingUsers) {
    if (user.role !== 'employee') continue;
    await prisma.employeeAccessProfile.upsert({
      where: { userId: user.id },
      update: {
        templateId: 'standard',
        overridesJson: '{}',
        isActive: user.isActive,
        updatedAt: new Date('2026-07-01T08:00:00.000Z'),
        updatedByLabel: 'Seeder',
      },
      create: {
        userId: user.id,
        templateId: 'standard',
        overridesJson: '{}',
        isActive: user.isActive,
        updatedAt: new Date('2026-07-01T08:00:00.000Z'),
        updatedByLabel: 'Seeder',
      },
    });
  }
}

async function upsertScheduleMonth() {
  const monthKey = `${SEEDED_MONTH.year}-${String(SEEDED_MONTH.month + 1).padStart(2, '0')}`;
  const templateMonth = createScheduleSeedTemplate(SEEDED_MONTH.year, SEEDED_MONTH.month);
  await prisma.scheduleMonth.upsert({
    where: { monthKey },
    update: {
      departmentId: DEFAULT_DEPARTMENT_ID,
      draftJson: JSON.stringify(templateMonth),
      publishedJson: null,
      versionsJson: '[]',
      status: 'draft',
      deleted: false,
      publishedAt: null,
      publishedByUserId: null,
    },
    create: {
      id: `schedule-${monthKey}`,
      monthKey,
      year: SEEDED_MONTH.year,
      month: SEEDED_MONTH.month,
      departmentId: DEFAULT_DEPARTMENT_ID,
      draftJson: JSON.stringify(templateMonth),
      publishedJson: null,
      versionsJson: '[]',
      status: 'draft',
      deleted: false,
      publishedAt: null,
      publishedByUserId: null,
    },
  });
}

async function upsertOvertimeMonth() {
  const monthKey = `${SEEDED_MONTH.year}-${String(SEEDED_MONTH.month + 1).padStart(2, '0')}`;

  await prisma.overtimeMonth.upsert({
    where: { monthKey },
    update: {
      departmentId: DEFAULT_DEPARTMENT_ID,
      rowsJson: '[]',
      unitsJson: '[]',
      publishedRowsJson: '[]',
      publishedUnitsJson: '[]',
      versionsJson: '[]',
      status: 'draft',
      deleted: false,
      notice: 'New update: Weekday OT is now 4 hours.',
      publishedAt: null,
      publishedByUserId: null,
    },
    create: {
      id: `ot-${monthKey}`,
      monthKey,
      year: SEEDED_MONTH.year,
      month: SEEDED_MONTH.month,
      departmentId: DEFAULT_DEPARTMENT_ID,
      rowsJson: '[]',
      unitsJson: '[]',
      publishedRowsJson: '[]',
      publishedUnitsJson: '[]',
      versionsJson: '[]',
      status: 'draft',
      deleted: false,
      notice: 'New update: Weekday OT is now 4 hours.',
      publishedAt: null,
      publishedByUserId: null,
    },
  });
}

async function ensureCalendarFeedToken() {
  const employee = await prisma.user.findFirst({
    where: { employeeNumber: 'EMP-002' },
  });
  if (!employee) return;

  const activeToken = await prisma.calendarFeedToken.findFirst({
    where: { userId: employee.id, revokedAt: null },
  });

  if (activeToken) return;

  await prisma.calendarFeedToken.create({
    data: {
      id: `calendar-${employee.id}`,
      userId: employee.id,
      token: crypto.randomUUID(),
      label: 'Primary feed',
    },
  });
}

async function main() {
  await upsertDepartment();
  await upsertUsers();
  await upsertDepartment();
  await upsertAccessProfiles();
  await upsertScheduleMonth();
  await upsertOvertimeMonth();
  await ensureCalendarFeedToken();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
