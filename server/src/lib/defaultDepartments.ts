import type { PrismaClient } from '@prisma/client';

export const DEFAULT_DEPARTMENTS = [
  {
    id: 'dept-1',
    nameEn: 'CT Scan Department',
    nameAr: 'قسم الأشعة المقطعية',
    descriptionEn: 'Computerized Tomography (CT Scan) imaging department',
    descriptionAr: 'قسم التصوير بالأشعة المقطعية المحوسبة (CT Scan)',
  },
] as const;

type DepartmentPrisma = Pick<PrismaClient, 'department'>;

export async function ensureDefaultDepartments(prisma: DepartmentPrisma) {
  const existingCount = await prisma.department.count();
  if (existingCount > 0) {
    return false;
  }

  for (const department of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: department.id },
      update: {
        nameEn: department.nameEn,
        nameAr: department.nameAr,
        descriptionEn: department.descriptionEn,
        descriptionAr: department.descriptionAr,
        managerId: null,
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

  return true;
}
