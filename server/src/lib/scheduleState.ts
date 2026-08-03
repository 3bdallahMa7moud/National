import crypto from 'node:crypto';
import type { MonthStatus, OvertimeMonth, Prisma, PrismaClient, ScheduleMonth } from '@prisma/client';
import { z } from 'zod';
import { createAuditEntry } from './audit.js';
import { parseJson } from './json.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

const monthStatusSchema = z.enum(['draft', 'published']);

export const scheduleStatePayloadSchema = z.object({
  draftsByMonth: z.record(z.string(), z.unknown()).default({}),
  matricesByMonth: z.record(z.string(), z.unknown()).default({}),
  versionsByMonth: z.record(z.string(), z.array(z.unknown())).default({}),
  monthStatuses: z.record(z.string(), monthStatusSchema).default({}),
  deletedMonths: z.array(z.string()).default([]),
  updatedAtByMonth: z.record(z.string(), z.string()).default({}),
});

export const overtimeStatePayloadSchema = z.object({
  rowsByMonth: z.record(z.string(), z.array(z.unknown())).default({}),
  unitsByMonth: z.record(z.string(), z.array(z.unknown())).default({}),
  publishedRowsByMonth: z.record(z.string(), z.array(z.unknown())).default({}),
  publishedUnitsByMonth: z.record(z.string(), z.array(z.unknown())).default({}),
  versionsByMonth: z.record(z.string(), z.array(z.unknown())).default({}),
  monthStatuses: z.record(z.string(), monthStatusSchema).default({}),
  deletedMonths: z.array(z.string()).default([]),
  notice: z.string().default(''),
  departmentIdsByMonth: z.record(z.string(), z.string()).default({}),
  updatedAtByMonth: z.record(z.string(), z.string()).default({}),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseMonthKey(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }
  return {
    year,
    monthIndex: monthNumber - 1,
  };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function validateScheduleMatrix(monthKey: string, value: unknown) {
  if (!isRecord(value)) throw new Error(`Schedule month ${monthKey} must be an object.`);
  const parts = parseMonthKey(monthKey);
  if (!parts) throw new Error(`Schedule month key ${monthKey} is invalid.`);
  const year = value.year;
  const month = value.month;
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`Schedule month ${monthKey} is missing year or month.`);
  }
  if (year !== parts.year || month !== parts.monthIndex) {
    throw new Error(`Schedule month ${monthKey} has mismatched year or month.`);
  }
  if (!Array.isArray(value.facilities)) {
    throw new Error(`Schedule month ${monthKey} is missing facilities.`);
  }

  const lastDay = daysInMonth(parts.year, parts.monthIndex);
  for (const facility of value.facilities) {
    if (!isRecord(facility) || !Array.isArray(facility.units)) {
      throw new Error(`Schedule facility in ${monthKey} is invalid.`);
    }
    for (const unit of facility.units) {
      if (!isRecord(unit) || !Array.isArray(unit.rows)) {
        throw new Error(`Schedule unit in ${monthKey} is invalid.`);
      }
      for (const row of unit.rows) {
        if (!isRecord(row) || typeof row.id !== 'string' || !isRecord(row.cellsByDay)) {
          throw new Error(`Schedule row in ${monthKey} is invalid.`);
        }
        for (const [dayText, assignments] of Object.entries(row.cellsByDay)) {
          const day = Number(dayText);
          if (!Number.isInteger(day) || day < 1 || day > lastDay) {
            throw new Error(`Schedule row ${row.id} in ${monthKey} has an invalid day.`);
          }
          if (!Array.isArray(assignments)) {
            throw new Error(`Schedule row ${row.id} in ${monthKey} has invalid assignments.`);
          }
          const seenEmployees = new Set<string>();
          for (const assignment of assignments) {
            if (!isRecord(assignment)) {
              throw new Error(`Schedule row ${row.id} in ${monthKey} contains an invalid assignment.`);
            }
            if (typeof assignment.employeeId !== 'string' || !assignment.employeeId.trim()) {
              throw new Error(`Schedule row ${row.id} in ${monthKey} contains an assignment without employeeId.`);
            }
            if (seenEmployees.has(assignment.employeeId)) {
              throw new Error(`Schedule row ${row.id} in ${monthKey} has duplicate employee assignments in one cell.`);
            }
            seenEmployees.add(assignment.employeeId);
          }
        }
      }
    }
  }
}

function validateOvertimeRows(monthKey: string, rows: unknown) {
  const parts = parseMonthKey(monthKey);
  if (!parts) throw new Error(`OT month key ${monthKey} is invalid.`);
  if (!Array.isArray(rows)) throw new Error(`OT month ${monthKey} rows must be an array.`);
  const lastDay = daysInMonth(parts.year, parts.monthIndex);

  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || !isRecord(row.assignments)) {
      throw new Error(`OT row in ${monthKey} is invalid.`);
    }
    if (typeof row.title !== 'string' || !row.title.trim()) {
      throw new Error(`OT row ${row.id} in ${monthKey} is missing a title.`);
    }
    if (typeof row.location !== 'string' || !row.location.trim()) {
      throw new Error(`OT row ${row.id} in ${monthKey} is missing a location.`);
    }
    if (typeof row.timeRange !== 'string' || !row.timeRange.trim()) {
      throw new Error(`OT row ${row.id} in ${monthKey} is missing a time range.`);
    }
    if (typeof row.hours !== 'number' || !Number.isFinite(row.hours) || row.hours < 0) {
      throw new Error(`OT row ${row.id} in ${monthKey} has invalid hours.`);
    }
    for (const [dayText, assignments] of Object.entries(row.assignments)) {
      const day = Number(dayText);
      if (!Number.isInteger(day) || day < 1 || day > lastDay) {
        throw new Error(`OT row ${row.id} in ${monthKey} has an invalid day.`);
      }
      if (!Array.isArray(assignments)) {
        throw new Error(`OT row ${row.id} in ${monthKey} has invalid assignments.`);
      }
      const seenEmployees = new Set<string>();
      for (const assignment of assignments) {
        if (!isRecord(assignment)) throw new Error(`OT row ${row.id} in ${monthKey} contains an invalid assignment.`);
        if (assignment.kind === 'employee') {
          if (typeof assignment.employeeId !== 'string' || !assignment.employeeId.trim()) {
            throw new Error(`OT row ${row.id} in ${monthKey} contains an employee assignment without employeeId.`);
          }
          if (seenEmployees.has(assignment.employeeId)) {
            throw new Error(`OT row ${row.id} in ${monthKey} has duplicate employee assignments in one cell.`);
          }
          seenEmployees.add(assignment.employeeId);
        }
      }
    }
  }
}

function jsonOrNull(value: unknown) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function asUpdatedAtMap<T extends { monthKey: string; updatedAt: Date }>(months: T[]) {
  return Object.fromEntries(months.map((month) => [month.monthKey, month.updatedAt.toISOString()]));
}

export function serializeScheduleState(months: ScheduleMonth[]) {
  return {
    draftsByMonth: Object.fromEntries(months.flatMap((month) =>
      month.draftJson ? [[month.monthKey, parseJson<Record<string, unknown>>(month.draftJson, {})]] : [],
    )),
    matricesByMonth: Object.fromEntries(months.flatMap((month) =>
      month.publishedJson ? [[month.monthKey, parseJson<Record<string, unknown>>(month.publishedJson, {})]] : [],
    )),
    versionsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, parseJson<unknown[]>(month.versionsJson, [])])),
    monthStatuses: Object.fromEntries(months.map((month) => [month.monthKey, month.status])),
    deletedMonths: months.filter((month) => month.deleted).map((month) => month.monthKey),
    updatedAtByMonth: asUpdatedAtMap(months),
  };
}

export function serializeOvertimeState(months: OvertimeMonth[]) {
  return {
    rowsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, parseJson<unknown[]>(month.rowsJson, [])])),
    unitsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, parseJson<unknown[]>(month.unitsJson, [])])),
    publishedRowsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, parseJson<unknown[]>(month.publishedRowsJson, [])])),
    publishedUnitsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, parseJson<unknown[]>(month.publishedUnitsJson, [])])),
    versionsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, parseJson<unknown[]>(month.versionsJson, [])])),
    monthStatuses: Object.fromEntries(months.map((month) => [month.monthKey, month.status])),
    deletedMonths: months.filter((month) => month.deleted).map((month) => month.monthKey),
    notice: months[0]?.notice ?? '',
    departmentIdsByMonth: Object.fromEntries(months.map((month) => [month.monthKey, month.departmentId])),
    updatedAtByMonth: asUpdatedAtMap(months),
  };
}

function scheduleMonthKeys(payload: z.infer<typeof scheduleStatePayloadSchema>) {
  return [...new Set([
    ...Object.keys(payload.draftsByMonth),
    ...Object.keys(payload.matricesByMonth),
    ...Object.keys(payload.versionsByMonth),
    ...Object.keys(payload.monthStatuses),
    ...payload.deletedMonths,
    ...Object.keys(payload.updatedAtByMonth),
  ])].sort();
}

function overtimeMonthKeys(payload: z.infer<typeof overtimeStatePayloadSchema>) {
  return [...new Set([
    ...Object.keys(payload.rowsByMonth),
    ...Object.keys(payload.unitsByMonth),
    ...Object.keys(payload.publishedRowsByMonth),
    ...Object.keys(payload.publishedUnitsByMonth),
    ...Object.keys(payload.versionsByMonth),
    ...Object.keys(payload.monthStatuses),
    ...payload.deletedMonths,
    ...Object.keys(payload.departmentIdsByMonth),
    ...Object.keys(payload.updatedAtByMonth),
  ])].sort();
}

export async function syncScheduleState(
  db: DbClient,
  viewer: { id: string; name: { en: string }; department: { id: string } },
  payload: z.infer<typeof scheduleStatePayloadSchema>,
) {
  const keys = scheduleMonthKeys(payload);
  const existing = keys.length > 0
    ? await db.scheduleMonth.findMany({ where: { monthKey: { in: keys } } })
    : [];
  const existingByKey = new Map(existing.map((month) => [month.monthKey, month]));

  for (const key of keys) {
    const parts = parseMonthKey(key);
    if (!parts) throw new Error(`Schedule month key ${key} is invalid.`);
    if (payload.draftsByMonth[key] !== undefined) validateScheduleMatrix(key, payload.draftsByMonth[key]);
    if (payload.matricesByMonth[key] !== undefined) validateScheduleMatrix(key, payload.matricesByMonth[key]);

    const current = existingByKey.get(key);
    const clientUpdatedAt = payload.updatedAtByMonth[key];
    const nextDraftJson = jsonOrNull(payload.draftsByMonth[key]);
    const nextPublishedJson = jsonOrNull(payload.matricesByMonth[key]);
    const nextVersionsJson = JSON.stringify(payload.versionsByMonth[key] ?? []);
    const nextStatus = (payload.monthStatuses[key] ?? (nextPublishedJson ? 'published' : 'draft')) as MonthStatus;
    const nextDeleted = payload.deletedMonths.includes(key);

    if (
      current
      && clientUpdatedAt
      && current.updatedAt.getTime() > new Date(clientUpdatedAt).getTime()
      && (
        current.draftJson !== nextDraftJson
        || current.publishedJson !== nextPublishedJson
        || current.versionsJson !== nextVersionsJson
        || current.status !== nextStatus
        || current.deleted !== nextDeleted
      )
    ) {
      throw new Error(`Schedule month ${key} has been updated by another session.`);
    }
  }

  for (const key of keys) {
    const parts = parseMonthKey(key)!;
    const current = existingByKey.get(key);
    const nextDraftJson = jsonOrNull(payload.draftsByMonth[key]);
    const nextPublishedJson = jsonOrNull(payload.matricesByMonth[key]);
    const nextVersionsJson = JSON.stringify(payload.versionsByMonth[key] ?? []);
    const nextStatus = (payload.monthStatuses[key] ?? (nextPublishedJson ? 'published' : 'draft')) as MonthStatus;
    const nextDeleted = payload.deletedMonths.includes(key);
    const nextDepartmentId = payload.matricesByMonth[key] && isRecord(payload.matricesByMonth[key]) && typeof payload.matricesByMonth[key].departmentId === 'string'
      ? payload.matricesByMonth[key].departmentId as string
      : payload.draftsByMonth[key] && isRecord(payload.draftsByMonth[key]) && typeof payload.draftsByMonth[key].departmentId === 'string'
        ? payload.draftsByMonth[key].departmentId as string
        : current?.departmentId ?? viewer.department.id;

    await db.scheduleMonth.upsert({
      where: { monthKey: key },
      update: {
        year: parts.year,
        month: parts.monthIndex,
        departmentId: nextDepartmentId,
        draftJson: nextDraftJson,
        publishedJson: nextPublishedJson,
        versionsJson: nextVersionsJson,
        status: nextStatus,
        deleted: nextDeleted,
        publishedAt: nextStatus === 'published' ? current?.publishedAt ?? new Date() : null,
        publishedByUserId: nextStatus === 'published' ? viewer.id : null,
      },
      create: {
        id: `schedule-${crypto.randomUUID()}`,
        monthKey: key,
        year: parts.year,
        month: parts.monthIndex,
        departmentId: nextDepartmentId,
        draftJson: nextDraftJson,
        publishedJson: nextPublishedJson,
        versionsJson: nextVersionsJson,
        status: nextStatus,
        deleted: nextDeleted,
        publishedAt: nextStatus === 'published' ? new Date() : null,
        publishedByUserId: nextStatus === 'published' ? viewer.id : null,
      },
    });

    const action = !current
      ? 'create'
      : current.deleted !== nextDeleted && nextDeleted
        ? 'delete'
        : current.status !== nextStatus && nextStatus === 'published'
          ? 'publish'
          : 'update';

    const changed = !current
      || current.draftJson !== nextDraftJson
      || current.publishedJson !== nextPublishedJson
      || current.versionsJson !== nextVersionsJson
      || current.status !== nextStatus
      || current.deleted !== nextDeleted;

    if (changed) {
      await createAuditEntry(db, {
        actorUserId: viewer.id,
        actorName: viewer.name.en,
        action,
        module: 'schedule',
        entityId: key,
        entityLabel: `Schedule ${key}`,
        before: current ? { status: current.status, deleted: current.deleted } : undefined,
        after: { status: nextStatus, deleted: nextDeleted },
        context: { route: '/admin/schedule', year: parts.year, month: parts.monthIndex },
      });
    }
  }

  const months = await db.scheduleMonth.findMany({ orderBy: { monthKey: 'asc' } });
  return serializeScheduleState(months);
}

export async function syncOvertimeState(
  db: DbClient,
  viewer: { id: string; name: { en: string }; department: { id: string } },
  payload: z.infer<typeof overtimeStatePayloadSchema>,
) {
  const keys = overtimeMonthKeys(payload);
  const existing = keys.length > 0
    ? await db.overtimeMonth.findMany({ where: { monthKey: { in: keys } } })
    : [];
  const existingByKey = new Map(existing.map((month) => [month.monthKey, month]));

  for (const key of keys) {
    if (!parseMonthKey(key)) throw new Error(`OT month key ${key} is invalid.`);
    validateOvertimeRows(key, payload.rowsByMonth[key] ?? []);
    validateOvertimeRows(key, payload.publishedRowsByMonth[key] ?? []);

    const current = existingByKey.get(key);
    const clientUpdatedAt = payload.updatedAtByMonth[key];
    const nextRowsJson = JSON.stringify(payload.rowsByMonth[key] ?? []);
    const nextUnitsJson = JSON.stringify(payload.unitsByMonth[key] ?? []);
    const nextPublishedRowsJson = JSON.stringify(payload.publishedRowsByMonth[key] ?? []);
    const nextPublishedUnitsJson = JSON.stringify(payload.publishedUnitsByMonth[key] ?? []);
    const nextVersionsJson = JSON.stringify(payload.versionsByMonth[key] ?? []);
    const nextStatus = (payload.monthStatuses[key] ?? (payload.publishedRowsByMonth[key] ? 'published' : 'draft')) as MonthStatus;
    const nextDeleted = payload.deletedMonths.includes(key);
    const nextNotice = payload.notice || '';

    if (
      current
      && clientUpdatedAt
      && current.updatedAt.getTime() > new Date(clientUpdatedAt).getTime()
      && (
        current.rowsJson !== nextRowsJson
        || current.unitsJson !== nextUnitsJson
        || current.publishedRowsJson !== nextPublishedRowsJson
        || current.publishedUnitsJson !== nextPublishedUnitsJson
        || current.versionsJson !== nextVersionsJson
        || current.status !== nextStatus
        || current.deleted !== nextDeleted
        || current.notice !== nextNotice
      )
    ) {
      throw new Error(`OT month ${key} has been updated by another session.`);
    }
  }

  for (const key of keys) {
    const parts = parseMonthKey(key)!;
    const current = existingByKey.get(key);
    const nextRowsJson = JSON.stringify(payload.rowsByMonth[key] ?? []);
    const nextUnitsJson = JSON.stringify(payload.unitsByMonth[key] ?? []);
    const nextPublishedRowsJson = JSON.stringify(payload.publishedRowsByMonth[key] ?? []);
    const nextPublishedUnitsJson = JSON.stringify(payload.publishedUnitsByMonth[key] ?? []);
    const nextVersionsJson = JSON.stringify(payload.versionsByMonth[key] ?? []);
    const nextStatus = (payload.monthStatuses[key] ?? (payload.publishedRowsByMonth[key] ? 'published' : 'draft')) as MonthStatus;
    const nextDeleted = payload.deletedMonths.includes(key);
    const nextDepartmentId = payload.departmentIdsByMonth[key] ?? current?.departmentId ?? viewer.department.id;
    const nextNotice = payload.notice || '';

    await db.overtimeMonth.upsert({
      where: { monthKey: key },
      update: {
        year: parts.year,
        month: parts.monthIndex,
        departmentId: nextDepartmentId,
        rowsJson: nextRowsJson,
        unitsJson: nextUnitsJson,
        publishedRowsJson: nextPublishedRowsJson,
        publishedUnitsJson: nextPublishedUnitsJson,
        versionsJson: nextVersionsJson,
        status: nextStatus,
        deleted: nextDeleted,
        notice: nextNotice,
        publishedAt: nextStatus === 'published' ? current?.publishedAt ?? new Date() : null,
        publishedByUserId: nextStatus === 'published' ? viewer.id : null,
      },
      create: {
        id: `overtime-${crypto.randomUUID()}`,
        monthKey: key,
        year: parts.year,
        month: parts.monthIndex,
        departmentId: nextDepartmentId,
        rowsJson: nextRowsJson,
        unitsJson: nextUnitsJson,
        publishedRowsJson: nextPublishedRowsJson,
        publishedUnitsJson: nextPublishedUnitsJson,
        versionsJson: nextVersionsJson,
        status: nextStatus,
        deleted: nextDeleted,
        notice: nextNotice,
        publishedAt: nextStatus === 'published' ? new Date() : null,
        publishedByUserId: nextStatus === 'published' ? viewer.id : null,
      },
    });

    const action = !current
      ? 'create'
      : current.deleted !== nextDeleted && nextDeleted
        ? 'delete'
        : current.status !== nextStatus && nextStatus === 'published'
          ? 'publish'
          : 'update';

    const changed = !current
      || current.rowsJson !== nextRowsJson
      || current.unitsJson !== nextUnitsJson
      || current.publishedRowsJson !== nextPublishedRowsJson
      || current.publishedUnitsJson !== nextPublishedUnitsJson
      || current.versionsJson !== nextVersionsJson
      || current.status !== nextStatus
      || current.deleted !== nextDeleted
      || current.notice !== nextNotice;

    if (changed) {
      await createAuditEntry(db, {
        actorUserId: viewer.id,
        actorName: viewer.name.en,
        action,
        module: 'ot',
        entityId: key,
        entityLabel: `OT ${key}`,
        before: current ? { status: current.status, deleted: current.deleted } : undefined,
        after: { status: nextStatus, deleted: nextDeleted },
        context: { route: '/admin/late-schedule', year: parts.year, month: parts.monthIndex },
      });
    }
  }

  const months = await db.overtimeMonth.findMany({ orderBy: { monthKey: 'asc' } });
  return serializeOvertimeState(months);
}
