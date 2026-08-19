import crypto from 'node:crypto';
import {
  MonthStatus,
  type Prisma,
  type PrismaClient,
  type ShiftRequest,
  type ShiftRequestStatus,
  type ShiftRequestType,
  type User,
  type UserRole,
} from '@prisma/client';
import { parseJson } from './json.js';
import { createAuditEntry } from './audit.js';
import { createNotification } from './notifications.js';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ShiftRequestSource = 'schedule' | 'ot';

export interface ShiftAssignmentRef {
  source: ShiftRequestSource;
  departmentId: string;
  monthKey: string;
  year: number;
  month: number;
  day: number;
  rowId: string;
  employeeId: string;
  employeeCode: string;
  facilityId?: string;
  unitId?: string;
  facilityLabel: string;
  unitLabel: string;
  shiftLabel: string;
  timeRange: string;
  fingerprint: string;
  startsAt: string;
}

export interface ShiftRequestWarning {
  code: 'schedule_conflict' | 'approved_vacation';
  employeeId: string;
  assignment: ShiftAssignmentRef;
  message: string;
}

export interface ShiftRequestTimelineEvent {
  id: string;
  action:
    | 'created'
    | 'recipient_accepted'
    | 'recipient_rejected'
    | 'admin_approved'
    | 'admin_rejected'
    | 'cancelled'
    | 'expired'
    | 'stale'
    | 'conflict_overridden';
  actorRole: 'requester' | 'recipient' | 'admin' | 'system';
  actorAccountId?: string;
  actorName: string;
  createdAt: string;
  note?: string;
}

export interface ShiftRequestParty {
  accountId: string;
  employeeId: string;
  employeeCode: string;
  name: string;
}

export interface SerializedShiftRequest {
  id: string;
  type: ShiftRequestType;
  departmentId: string;
  requester: ShiftRequestParty;
  recipient: ShiftRequestParty;
  requesterAssignment: ShiftAssignmentRef;
  offeredAssignment?: ShiftAssignmentRef;
  status: ShiftRequestStatus;
  warnings: ShiftRequestWarning[];
  adminRejectionReason?: string;
  adminRejectionNote?: string;
  conflictOverride?: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  timeline: ShiftRequestTimelineEvent[];
}

export interface ValidationFailure {
  ok: false;
  reason: 'not_found' | 'not_published' | 'past_shift' | 'stale';
  message?: string;
}

export interface ValidationSuccess {
  ok: true;
  assignment: ShiftAssignmentRef;
}

export type ValidationResult = ValidationFailure | ValidationSuccess;

interface ScheduleAssignment {
  employeeId: string;
  employeeCode: string;
  colorKey?: string;
  status?: string;
  hasConflict?: boolean;
  conflictReason?: string;
  conflictType?: 'crossFacility' | 'vacation' | 'timeOverlap';
}

interface ScheduleRow {
  id: string;
  rowLabel?: string;
  shiftLabel: string;
  timeRange: string;
  unitLabel?: string;
  shiftDefinitionId?: string;
  cellsByDay: Record<string, ScheduleAssignment[]>;
}

interface ScheduleUnit {
  id: string;
  name: string;
  archived?: boolean;
  rows: ScheduleRow[];
}

interface ScheduleFacility {
  id: string;
  name: string;
  units: ScheduleUnit[];
}

interface ScheduleVacation {
  employeeId: string;
  daysOff?: number[];
  ranges?: Array<{ startDay: number; endDay: number; status?: string }>;
}

interface ScheduleMatrixData {
  departmentId?: string;
  month: number;
  year: number;
  facilities: ScheduleFacility[];
  vacations?: ScheduleVacation[];
  auditLog?: Array<Record<string, unknown>>;
}

interface OTCellAssignment {
  kind: 'employee' | 'unresolved';
  employeeId?: string;
  legacyCode?: string;
}

interface OTRow {
  id: string;
  unitId?: string;
  title: string;
  location: string;
  timeRange: string;
  archived?: boolean;
  assignments: Record<string, OTCellAssignment[]>;
}

interface OTUnit {
  id: string;
  name: string;
  archived?: boolean;
}

const ACTIVE_STATUSES: ShiftRequestStatus[] = ['pending_recipient', 'pending_admin'];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseMonthKey(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
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

function parseTimeRange(timeRange: string) {
  const [startText, endText] = timeRange.split('-');
  const start = startText?.match(/\d{1,2}:\d{2}/)?.[0] ?? '00:00';
  const end = endText?.match(/\d{1,2}:\d{2}/)?.[0] ?? '23:59';
  return { start, end };
}

function startTimeFromRange(timeRange: string) {
  return timeRange.match(/\b\d{1,2}:\d{2}\b/)?.[0]?.padStart(5, '0') ?? '00:00';
}

function startsAt(year: number, month: number, day: number, timeRange: string) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${startTimeFromRange(timeRange)}:00`;
}

function parseStartsAt(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function overlap(left: ShiftAssignmentRef, right: ShiftAssignmentRef) {
  const [leftStart, leftEnd] = [parseStartsAt(left.startsAt), parseEndAt(left)];
  const [rightStart, rightEnd] = [parseStartsAt(right.startsAt), parseEndAt(right)];
  return leftStart < rightEnd && rightStart < leftEnd;
}

function parseEndAt(assignment: ShiftAssignmentRef) {
  const { start, end } = parseTimeRange(assignment.timeRange);
  const date = assignment.startsAt.slice(0, 10);
  const startTimestamp = new Date(`${date}T${start}:00`).getTime();
  let endTimestamp = new Date(`${date}T${end}:00`).getTime();
  if (endTimestamp <= startTimestamp) {
    endTimestamp += 24 * 60 * 60 * 1000;
  }
  return Number.isFinite(endTimestamp) ? endTimestamp : Number.POSITIVE_INFINITY;
}



function isMatchingEmployeeId(
  candidateEmployeeId: string | undefined,
  candidateCode: string | undefined,
  targetEmployeeId: string | undefined,
  targetCode: string | undefined,
): boolean {
  if (!candidateEmployeeId && !candidateCode) return false;
  if (!targetEmployeeId && !targetCode) return false;
  if (candidateEmployeeId && targetEmployeeId) {
    if (candidateEmployeeId === targetEmployeeId) return true;
    const cleanCand = candidateEmployeeId.replace(/^directory-account:/, '');
    const cleanTarg = targetEmployeeId.replace(/^directory-account:/, '');
    if (cleanCand && cleanCand === cleanTarg) return true;
  }
  if (candidateCode && targetCode && candidateCode.trim().toUpperCase() === targetCode.trim().toUpperCase()) {
    return true;
  }
  return false;
}

function isShiftPast(startsAtValue: string, timeRange: string, now: Date): boolean {
  const [year, month, day] = startsAtValue.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return false;
  // A shift is only past if its entire scheduled day has ended
  const shiftDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
  return shiftDateEnd.getTime() < now.getTime();
}

function scheduleFingerprint(
  monthKey: string,
  facilityId: string,
  unitId: string,
  row: ScheduleRow,
  day: number,
  employeeId: string,
) {
  const cleanId = employeeId.replace(/^directory-account:/, '');
  const cleanCellIds = (row.cellsByDay[String(day)] ?? [])
    .map((a) => (a.employeeId ?? `code:${a.employeeCode ?? ''}`).replace(/^directory-account:/, ''))
    .sort()
    .join(',');
  return [
    'schedule',
    monthKey,
    facilityId,
    unitId,
    row.id,
    day,
    cleanId,
    row.shiftDefinitionId ?? '',
    row.unitLabel ?? '',
    row.rowLabel ?? '',
    row.shiftLabel,
    row.timeRange,
    cleanCellIds,
  ].join('|');
}

function otFingerprint(monthKey: string, row: OTRow, day: number, employeeId: string) {
  const cleanId = employeeId.replace(/^directory-account:/, '');
  const cleanCellIds = (row.assignments[String(day)] ?? [])
    .map((a) => (a.kind === 'employee' ? (a.employeeId ?? '').replace(/^directory-account:/, '') : `unresolved:${a.legacyCode ?? ''}`))
    .sort()
    .join(',');
  return [
    'ot',
    monthKey,
    row.id,
    day,
    cleanId,
    row.unitId ?? '',
    row.location,
    row.title,
    row.timeRange,
    cleanCellIds,
  ].join('|');
}

function findScheduleRow(matrix: ScheduleMatrixData, rowId: string) {
  for (const facility of matrix.facilities ?? []) {
    for (const unit of facility.units ?? []) {
      const row = unit.rows.find((candidate) => candidate.id === rowId);
      if (row) return { facility, unit, row };
    }
  }
  return null;
}

function serializeParty(user: Pick<User, 'id' | 'nameEn' | 'nameAr' | 'code' | 'scheduleEmployeeId'>) {
  return {
    accountId: user.id,
    employeeId: user.scheduleEmployeeId ?? '',
    employeeCode: user.code,
    name: user.nameAr || user.nameEn,
  };
}

export function serializeShiftRequest(
  request: ShiftRequest,
  requester: Pick<User, 'id' | 'nameEn' | 'nameAr' | 'code' | 'scheduleEmployeeId'>,
  recipient: Pick<User, 'id' | 'nameEn' | 'nameAr' | 'code' | 'scheduleEmployeeId'>,
): SerializedShiftRequest {
  return {
    id: request.id,
    type: request.type,
    departmentId: request.departmentId,
    requester: serializeParty(requester),
    recipient: serializeParty(recipient),
    requesterAssignment: parseJson<ShiftAssignmentRef>(request.requesterAssignmentJson, {} as ShiftAssignmentRef),
    offeredAssignment: parseJson<ShiftAssignmentRef | undefined>(request.offeredAssignmentJson, undefined),
    status: request.status,
    warnings: parseJson<ShiftRequestWarning[]>(request.warningsJson, []),
    adminRejectionReason: request.adminRejectionReason ?? undefined,
    adminRejectionNote: request.adminRejectionNote ?? undefined,
    conflictOverride: request.conflictOverride,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    timeline: parseJson<ShiftRequestTimelineEvent[]>(request.timelineJson, []),
  };
}

export function shiftRequestVisibleToViewer(
  request: ShiftRequest,
  viewer: { id: string; role: UserRole; department: { id: string } },
) {
  if (viewer.role === 'super_admin') return true;
  if (viewer.role === 'admin') return request.departmentId === viewer.department.id;
  return request.requesterUserId === viewer.id || request.recipientUserId === viewer.id;
}

export function timelineEvent(
  action: ShiftRequestTimelineEvent['action'],
  actorRole: ShiftRequestTimelineEvent['actorRole'],
  actorName: string,
  actorAccountId?: string,
  note?: string,
): ShiftRequestTimelineEvent {
  return {
    id: `shift-request-event-${crypto.randomUUID()}`,
    action,
    actorRole,
    actorAccountId,
    actorName,
    createdAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };
}

export function assignmentRequestKey(assignment: ShiftAssignmentRef) {
  return `${assignment.source}|${assignment.monthKey}|${assignment.rowId}|${assignment.day}|${assignment.employeeId}`;
}

function requestAssignmentKeys(request: ShiftRequest) {
  const requesterAssignment = parseJson<ShiftAssignmentRef>(request.requesterAssignmentJson, {} as ShiftAssignmentRef);
  const offeredAssignment = parseJson<ShiftAssignmentRef | undefined>(request.offeredAssignmentJson, undefined);
  return [
    assignmentRequestKey(requesterAssignment),
    ...(offeredAssignment ? [assignmentRequestKey(offeredAssignment)] : []),
  ];
}

function addScheduleVersion(existingJson: string, monthKey: string, matrix: ScheduleMatrixData, actorName: string) {
  const versions = parseJson<Array<Record<string, unknown>>>(existingJson, []);
  return JSON.stringify([
    {
      id: `schedule-request-version-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      actorName: `Before shift request approval · ${actorName}`,
      reason: 'shift_request',
      data: clone(matrix),
    },
    ...versions,
  ].slice(0, 5));
}

function addOTVersion(existingJson: string, monthKey: string, rows: OTRow[], units: OTUnit[], notice: string, actorName: string) {
  const versions = parseJson<Array<Record<string, unknown>>>(existingJson, []);
  void monthKey;
  return JSON.stringify([
    {
      id: `ot-request-version-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      actorName: `Before shift request approval · ${actorName}`,
      reason: 'shift_request',
      rows: clone(rows),
      units: clone(units),
      notice,
    },
    ...versions,
  ].slice(0, 5));
}

export async function validateAssignmentRef(
  db: DbClient,
  assignment: ShiftAssignmentRef,
  now: Date,
): Promise<ValidationResult> {
  const keyParts = parseMonthKey(assignment.monthKey);
  if (!keyParts || assignment.year !== keyParts.year || assignment.month !== keyParts.monthIndex) {
    return { ok: false, reason: 'stale', message: 'The assignment month is invalid.' };
  }

  if (assignment.source === 'schedule') {
    const month = await db.scheduleMonth.findUnique({ where: { monthKey: assignment.monthKey } });
    if (!month || month.deleted) return { ok: false, reason: 'not_found', message: 'Schedule month not found.' };
    if (month.status !== 'published' || !month.publishedJson) {
      return { ok: false, reason: 'not_published', message: 'Schedule month is not published.' };
    }

    const matrix = parseJson<ScheduleMatrixData | null>(month.publishedJson, null);
    if (!matrix) return { ok: false, reason: 'not_found', message: 'Published schedule data is missing.' };
    const found = findScheduleRow(matrix, assignment.rowId);
    if (!found) return { ok: false, reason: 'not_found', message: 'Schedule row not found.' };
    const cell = found.row.cellsByDay[String(assignment.day)] ?? [];
    const active = cell.find((candidate) =>
      isMatchingEmployeeId(candidate.employeeId, candidate.employeeCode, assignment.employeeId, assignment.employeeCode) && candidate.status !== 'draft'
    );
    if (!active) return { ok: false, reason: 'not_found', message: 'Employee is no longer assigned to that shift.' };

    const canonical: ShiftAssignmentRef = {
      source: 'schedule',
      departmentId: month.departmentId,
      monthKey: assignment.monthKey,
      year: matrix.year,
      month: matrix.month,
      day: assignment.day,
      rowId: assignment.rowId,
      employeeId: active.employeeId,
      employeeCode: active.employeeCode,
      facilityId: found.facility.id,
      unitId: found.unit.id,
      facilityLabel: found.facility.name,
      unitLabel: found.unit.name || found.row.unitLabel || '',
      shiftLabel: found.row.shiftLabel,
      timeRange: found.row.timeRange,
      fingerprint: scheduleFingerprint(assignment.monthKey, found.facility.id, found.unit.id, found.row, assignment.day, active.employeeId),
      startsAt: startsAt(matrix.year, matrix.month, assignment.day, found.row.timeRange),
    };

    if (isShiftPast(canonical.startsAt, canonical.timeRange, now)) {
      return { ok: false, reason: 'past_shift', message: 'Past shifts cannot be requested.' };
    }
    if (assignment.fingerprint !== canonical.fingerprint) {
      return { ok: false, reason: 'stale', message: 'That schedule assignment has changed.' };
    }
    return { ok: true, assignment: canonical };
  }

  const month = await db.overtimeMonth.findUnique({ where: { monthKey: assignment.monthKey } });
  if (!month || month.deleted) return { ok: false, reason: 'not_found', message: 'Overtime month not found.' };
  if (month.status !== 'published') {
    return { ok: false, reason: 'not_published', message: 'Overtime month is not published.' };
  }

  const rows = parseJson<OTRow[]>(month.publishedRowsJson, []);
  const units = parseJson<OTUnit[]>(month.publishedUnitsJson, []);
  const row = rows.find((candidate) => candidate.id === assignment.rowId);
  if (!row) return { ok: false, reason: 'not_found', message: 'Overtime row not found.' };
  if (row.archived) return { ok: false, reason: 'not_found', message: 'Overtime row is archived.' };
  if (row.unitId && units.some((unit) => unit.id === row.unitId && unit.archived)) {
    return { ok: false, reason: 'not_found', message: 'Overtime unit is archived.' };
  }
  const active = (row.assignments[String(assignment.day)] ?? []).find((candidate) =>
    candidate.kind === 'employee' && isMatchingEmployeeId(candidate.employeeId, assignment.employeeCode, assignment.employeeId, assignment.employeeCode),
  );
  if (!active?.employeeId) {
    return { ok: false, reason: 'not_found', message: 'Employee is no longer assigned to that OT shift.' };
  }

  const canonical: ShiftAssignmentRef = {
    source: 'ot',
    departmentId: month.departmentId,
    monthKey: assignment.monthKey,
    year: month.year,
    month: month.month,
    day: assignment.day,
    rowId: assignment.rowId,
    employeeId: active.employeeId,
    employeeCode: assignment.employeeCode,
    facilityLabel: row.location,
    unitLabel: row.title,
    shiftLabel: row.title,
    timeRange: row.timeRange,
    fingerprint: otFingerprint(assignment.monthKey, row, assignment.day, active.employeeId),
    startsAt: startsAt(month.year, month.month, assignment.day, row.timeRange),
    ...(row.unitId ? { unitId: row.unitId } : {}),
  };

  if (isShiftPast(canonical.startsAt, canonical.timeRange, now)) {
    return { ok: false, reason: 'past_shift', message: 'Past shifts cannot be requested.' };
  }
  if (assignment.fingerprint !== canonical.fingerprint) {
    return { ok: false, reason: 'stale', message: 'That OT assignment has changed.' };
  }
  return { ok: true, assignment: canonical };
}

async function assignmentsForDate(
  db: DbClient,
  employeeId: string,
  target: ShiftAssignmentRef,
) {
  const scheduleMonth = await db.scheduleMonth.findUnique({
    where: { monthKey: target.monthKey },
  });
  const overtimeMonth = await db.overtimeMonth.findUnique({
    where: { monthKey: target.monthKey },
  });

  const items: ShiftAssignmentRef[] = [];
  if (scheduleMonth?.publishedJson && !scheduleMonth.deleted) {
    const matrix = parseJson<ScheduleMatrixData | null>(scheduleMonth.publishedJson, null);
    if (matrix) {
      for (const facility of matrix.facilities ?? []) {
        for (const unit of facility.units ?? []) {
          for (const row of unit.rows ?? []) {
            const assignments = row.cellsByDay[String(target.day)] ?? [];
            const match = assignments.find((candidate) =>
              isMatchingEmployeeId(candidate.employeeId, candidate.employeeCode, employeeId, undefined) && candidate.status !== 'draft'
            );
            if (!match) continue;
            items.push({
              source: 'schedule',
              departmentId: scheduleMonth.departmentId,
              monthKey: target.monthKey,
              year: matrix.year,
              month: matrix.month,
              day: target.day,
              rowId: row.id,
              employeeId: match.employeeId,
              employeeCode: match.employeeCode,
              facilityId: facility.id,
              unitId: unit.id,
              facilityLabel: facility.name,
              unitLabel: unit.name || row.unitLabel || '',
              shiftLabel: row.shiftLabel,
              timeRange: row.timeRange,
              fingerprint: scheduleFingerprint(target.monthKey, facility.id, unit.id, row, target.day, match.employeeId),
              startsAt: startsAt(matrix.year, matrix.month, target.day, row.timeRange),
            });
          }
        }
      }
    }
  }

  if (!overtimeMonth?.deleted) {
    const rows = parseJson<OTRow[]>(overtimeMonth?.publishedRowsJson ?? '[]', []);
    for (const row of rows) {
      const match = (row.assignments[String(target.day)] ?? []).find((candidate) =>
        candidate.kind === 'employee' && isMatchingEmployeeId(candidate.employeeId, undefined, employeeId, undefined),
      );
      if (!match?.employeeId) continue;
      items.push({
        source: 'ot',
        departmentId: overtimeMonth!.departmentId,
        monthKey: target.monthKey,
        year: overtimeMonth!.year,
        month: overtimeMonth!.month,
        day: target.day,
        rowId: row.id,
        employeeId: match.employeeId,
        employeeCode: employeeId,
        facilityLabel: row.location,
        unitLabel: row.title,
        shiftLabel: row.title,
        timeRange: row.timeRange,
        fingerprint: otFingerprint(target.monthKey, row, target.day, match.employeeId),
        startsAt: startsAt(overtimeMonth!.year, overtimeMonth!.month, target.day, row.timeRange),
        ...(row.unitId ? { unitId: row.unitId } : {}),
      });
    }
  }

  return items;
}

function employeeVacationOnDay(month: ScheduleMonthLike | null, employeeId: string, day: number) {
  if (!month?.publishedJson) return false;
  const matrix = parseJson<ScheduleMatrixData | null>(month.publishedJson, null);
  if (!matrix) return false;
  return (matrix.vacations ?? []).some((vacation) => {
    if (!isMatchingEmployeeId(vacation.employeeId, undefined, employeeId, undefined)) return false;
    if (vacation.daysOff?.includes(day)) return true;
    return (vacation.ranges ?? []).some((range) =>
      (range.status ?? 'published') !== 'draft' && day >= range.startDay && day <= range.endDay,
    );
  });
}

type ScheduleMonthLike = { publishedJson: string | null };

async function warningsForMove(
  db: DbClient,
  employeeId: string,
  target: ShiftAssignmentRef,
  excludedAssignment?: ShiftAssignmentRef,
) {
  const warnings: ShiftRequestWarning[] = [];
  const conflicts = (await assignmentsForDate(db, employeeId, target)).filter((existing) => {
    if (excludedAssignment) {
      if (
        existing.source === excludedAssignment.source &&
        existing.monthKey === excludedAssignment.monthKey &&
        existing.rowId === excludedAssignment.rowId &&
        existing.day === excludedAssignment.day
      ) {
        return false;
      }
    }
    const isSameCell =
      existing.source === target.source &&
      existing.monthKey === target.monthKey &&
      existing.rowId === target.rowId &&
      existing.day === target.day;
    if (isSameCell) return false;
    return overlap(existing, target);
  });
  if (conflicts.length > 0) {
    warnings.push({
      code: 'schedule_conflict',
      employeeId,
      assignment: target,
      message: `Employee already has ${conflicts.length} overlapping assignment(s).`,
    });
  }

  const scheduleMonth = await db.scheduleMonth.findUnique({ where: { monthKey: target.monthKey } });
  if (employeeVacationOnDay(scheduleMonth, employeeId, target.day)) {
    warnings.push({
      code: 'approved_vacation',
      employeeId,
      assignment: target,
      message: 'Employee has approved vacation on this day.',
    });
  }

  return warnings;
}

export async function inspectRequestWarnings(
  db: DbClient,
  request: {
    type: ShiftRequestType;
    requester: ShiftRequestParty;
    recipient: ShiftRequestParty;
    requesterAssignment: ShiftAssignmentRef;
    offeredAssignment?: ShiftAssignmentRef;
  },
) {
  if (request.type === 'replace') {
    return warningsForMove(db, request.recipient.employeeId, request.requesterAssignment);
  }
  if (!request.offeredAssignment) return [];
  return [
    ...(await warningsForMove(db, request.recipient.employeeId, request.requesterAssignment, request.offeredAssignment)),
    ...(await warningsForMove(db, request.requester.employeeId, request.offeredAssignment, request.requesterAssignment)),
  ];
}

function parseScheduleRangeMinutes(timeRange: string) {
  const cleaned = timeRange.replace('–', '-');
  const parts = cleaned.split('-').map((value) => value.trim());
  if (parts.length !== 2) return null;
  const parseMinutes = (value: string) => {
    const match = value.match(/\b(\d{1,2}):(\d{2})\b/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = parseMinutes(parts[0]);
  let end = parseMinutes(parts[1]);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function scheduleRangesOverlap(left: string, right: string) {
  const leftRange = parseScheduleRangeMinutes(left);
  const rightRange = parseScheduleRangeMinutes(right);
  if (!leftRange || !rightRange) return true;
  return Math.max(leftRange.start, rightRange.start) < Math.min(leftRange.end, rightRange.end);
}

function recalculateScheduleConflicts(matrix: ScheduleMatrixData) {
  type Occurrence = {
    facilityId: string;
    facilityName: string;
    timeRange: string;
    assignment: ScheduleAssignment;
  };

  const vacationsByEmployee = new Map<string, Set<number>>();
  for (const vacation of matrix.vacations ?? []) {
    let days = vacationsByEmployee.get(vacation.employeeId);
    if (!days) {
      days = new Set<number>();
      vacationsByEmployee.set(vacation.employeeId, days);
    }
    for (const day of vacation.daysOff ?? []) days.add(day);
    for (const range of vacation.ranges ?? []) {
      if ((range.status ?? 'published') === 'draft') continue;
      for (let day = range.startDay; day <= range.endDay; day += 1) days.add(day);
    }
  }

  const occurrencesByEmployeeDay = new Map<string, Occurrence[]>();
  for (const facility of matrix.facilities ?? []) {
    for (const unit of facility.units ?? []) {
      for (const row of unit.rows ?? []) {
        for (const [dayKey, assignments] of Object.entries(row.cellsByDay ?? {})) {
          const day = Number(dayKey);
          if (!Number.isFinite(day)) continue;
          for (const assignment of assignments ?? []) {
            assignment.hasConflict = false;
            assignment.conflictReason = undefined;
            assignment.conflictType = undefined;
            const key = `${assignment.employeeId}::${day}`;
            const bucket = occurrencesByEmployeeDay.get(key) ?? [];
            bucket.push({
              facilityId: facility.id,
              facilityName: facility.name,
              timeRange: row.timeRange,
              assignment,
            });
            occurrencesByEmployeeDay.set(key, bucket);
          }
        }
      }
    }
  }

  for (const [key, occurrences] of occurrencesByEmployeeDay.entries()) {
    const [employeeId, dayText] = key.split('::');
    const day = Number(dayText);
    if (vacationsByEmployee.get(employeeId)?.has(day)) {
      for (const occurrence of occurrences) {
        occurrence.assignment.hasConflict = true;
        occurrence.assignment.conflictType = 'vacation';
        occurrence.assignment.conflictReason = 'Employee has an approved vacation on this day';
      }
    }

    for (let index = 0; index < occurrences.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < occurrences.length; nextIndex += 1) {
        const left = occurrences[index];
        const right = occurrences[nextIndex];
        const isCrossFacility = left.facilityId !== right.facilityId;
        const overlapsInTime = scheduleRangesOverlap(left.timeRange, right.timeRange);
        if (!isCrossFacility && !overlapsInTime) continue;
        const conflictType = isCrossFacility ? 'crossFacility' : 'timeOverlap';
        const conflictReason = isCrossFacility
          ? `Double assignment conflict between facility (${left.facilityName}) and (${right.facilityName})`
          : `Overlapping shift schedules on the same day (${left.timeRange} & ${right.timeRange})`;
        left.assignment.hasConflict = true;
        left.assignment.conflictType = conflictType;
        left.assignment.conflictReason = conflictReason;
        right.assignment.hasConflict = true;
        right.assignment.conflictType = conflictType;
        right.assignment.conflictReason = conflictReason;
      }
    }
  }
}

function transferScheduleAssignment(
  matrix: ScheduleMatrixData,
  ref: ShiftAssignmentRef,
  fromEmployeeId: string,
  to: ShiftRequestParty,
) {
  const row = findScheduleRow(matrix, ref.rowId)?.row;
  if (!row) return false;
  const current = row.cellsByDay[String(ref.day)] ?? [];
  const sourceIndex = current.findIndex((assignment) =>
    isMatchingEmployeeId(assignment.employeeId, assignment.employeeCode, ref.employeeId, ref.employeeCode) ||
    isMatchingEmployeeId(assignment.employeeId, assignment.employeeCode, fromEmployeeId, undefined)
  );
  if (sourceIndex < 0) return false;
  if (current.some((assignment, index) =>
    index !== sourceIndex && isMatchingEmployeeId(assignment.employeeId, assignment.employeeCode, to.employeeId, to.employeeCode)
  )) return false;
  current[sourceIndex] = {
    ...current[sourceIndex],
    employeeId: to.employeeId,
    employeeCode: to.employeeCode,
    status: 'published',
    hasConflict: undefined,
    conflictReason: undefined,
    conflictType: undefined,
  };
  row.cellsByDay[String(ref.day)] = current;
  return true;
}

function transferOTAssignment(
  rows: OTRow[],
  ref: ShiftAssignmentRef,
  fromEmployeeId: string,
  to: ShiftRequestParty,
) {
  const row = rows.find((candidate) => candidate.id === ref.rowId);
  if (!row) return false;
  const current = row.assignments[String(ref.day)] ?? [];
  const sourceIndex = current.findIndex((assignment) =>
    assignment.kind === 'employee' && (
      isMatchingEmployeeId(assignment.employeeId, undefined, ref.employeeId, ref.employeeCode) ||
      isMatchingEmployeeId(assignment.employeeId, undefined, fromEmployeeId, undefined)
    )
  );
  if (sourceIndex < 0) return false;
  if (current.some((assignment, index) =>
    index !== sourceIndex && assignment.kind === 'employee' && isMatchingEmployeeId(assignment.employeeId, undefined, to.employeeId, to.employeeCode)
  )) return false;
  row.assignments[String(ref.day)] = current.map((assignment, index) =>
    index === sourceIndex ? { kind: 'employee', employeeId: to.employeeId } : assignment,
  );
  return true;
}

export async function applyApprovedShiftRequest(
  db: DbClient,
  request: SerializedShiftRequest,
  actorName: string,
) {
  if (request.requesterAssignment.source === 'schedule') {
    const refs = [request.requesterAssignment, ...(request.offeredAssignment ? [request.offeredAssignment] : [])];
    const months = await db.scheduleMonth.findMany({
      where: { monthKey: { in: [...new Set(refs.map((ref) => ref.monthKey))] } },
    });
    const monthByKey = new Map(months.map((month) => [month.monthKey, month]));

    const nextByKey = new Map<string, { published: ScheduleMatrixData; draft: ScheduleMatrixData | null; versionsJson: string }>();
    for (const ref of refs) {
      const month = monthByKey.get(ref.monthKey);
      if (!month?.publishedJson) return { ok: false as const, reason: 'not_found' as const, message: 'Published schedule month not found.' };
      const published = parseJson<ScheduleMatrixData | null>(month.publishedJson, null);
      if (!published) return { ok: false as const, reason: 'not_found' as const, message: 'Published schedule data is missing.' };
      const draft = month.draftJson ? parseJson<ScheduleMatrixData | null>(month.draftJson, null) : null;
      if (!nextByKey.has(ref.monthKey)) {
        nextByKey.set(ref.monthKey, {
          published: clone(published),
          draft: draft ? clone(draft) : null,
          versionsJson: addScheduleVersion(month.versionsJson, ref.monthKey, published, actorName),
        });
      }
    }

    const first = nextByKey.get(request.requesterAssignment.monthKey)!;
    if (!transferScheduleAssignment(first.published, request.requesterAssignment, request.requester.employeeId, request.recipient)) {
      return { ok: false as const, reason: 'not_found' as const, message: 'Requester assignment no longer matches the schedule.' };
    }
    if (request.type === 'exchange') {
      if (!request.offeredAssignment) return { ok: false as const, reason: 'not_found' as const, message: 'Exchange request is missing the offered assignment.' };
      const second = nextByKey.get(request.offeredAssignment.monthKey)!;
      if (!transferScheduleAssignment(second.published, request.offeredAssignment, request.recipient.employeeId, request.requester)) {
        return { ok: false as const, reason: 'not_found' as const, message: 'Recipient assignment no longer matches the schedule.' };
      }
    }

    const auditTimestamp = new Date().toISOString();
    for (const ref of refs) {
      const next = nextByKey.get(ref.monthKey)!;
      next.published.auditLog = Array.isArray(next.published.auditLog) ? next.published.auditLog : [];
      next.published.auditLog.unshift({
        id: `schedule-request-audit-${crypto.randomUUID()}`,
        actorName,
        action: 'assign',
        facilityId: ref.facilityId,
        unitId: ref.unitId,
        rowId: ref.rowId,
        day: ref.day,
        oldValue: request.type === 'exchange' ? 'Before employee exchange' : request.requester.employeeCode,
        newValue: request.type === 'exchange'
          ? `${request.requester.employeeCode} ↔ ${request.recipient.employeeCode}`
          : request.recipient.employeeCode,
        timestamp: auditTimestamp,
      });
      if (next.draft) {
        const publishedRow = findScheduleRow(next.published, ref.rowId)?.row;
        const draftRow = findScheduleRow(next.draft, ref.rowId)?.row;
        if (publishedRow && draftRow) {
          draftRow.cellsByDay[String(ref.day)] = clone(publishedRow.cellsByDay[String(ref.day)] ?? []);
        }
      }
    }

    for (const next of nextByKey.values()) {
      recalculateScheduleConflicts(next.published);
      if (next.draft) recalculateScheduleConflicts(next.draft);
    }

    for (const [monthKey, next] of nextByKey.entries()) {
      await db.scheduleMonth.update({
        where: { monthKey },
        data: {
          publishedJson: JSON.stringify(next.published),
          draftJson: next.draft ? JSON.stringify(next.draft) : null,
          versionsJson: next.versionsJson,
          status: MonthStatus.published,
          deleted: false,
          publishedAt: new Date(),
        },
      });
    }

    return { ok: true as const };
  }

  const refs = [request.requesterAssignment, ...(request.offeredAssignment ? [request.offeredAssignment] : [])];
  const months = await db.overtimeMonth.findMany({
    where: { monthKey: { in: [...new Set(refs.map((ref) => ref.monthKey))] } },
  });
  const monthByKey = new Map(months.map((month) => [month.monthKey, month]));
  const nextByKey = new Map<string, { publishedRows: OTRow[]; draftRows: OTRow[]; publishedUnits: OTUnit[]; versionsJson: string; notice: string }>();

  for (const ref of refs) {
    const month = monthByKey.get(ref.monthKey);
    if (!month) return { ok: false as const, reason: 'not_found' as const, message: 'Overtime month not found.' };
    const publishedRows = parseJson<OTRow[]>(month.publishedRowsJson, []);
    const draftRows = parseJson<OTRow[]>(month.rowsJson, []);
    if (!nextByKey.has(ref.monthKey)) {
      nextByKey.set(ref.monthKey, {
        publishedRows: clone(publishedRows),
        draftRows: clone(draftRows),
        publishedUnits: parseJson<OTUnit[]>(month.publishedUnitsJson, []),
        versionsJson: addOTVersion(month.versionsJson, ref.monthKey, publishedRows, parseJson<OTUnit[]>(month.publishedUnitsJson, []), month.notice, actorName),
        notice: month.notice,
      });
    }
  }

  const first = nextByKey.get(request.requesterAssignment.monthKey)!;
  if (!transferOTAssignment(first.publishedRows, request.requesterAssignment, request.requester.employeeId, request.recipient)) {
    return { ok: false as const, reason: 'not_found' as const, message: 'Requester OT assignment no longer matches.' };
  }
  if (request.type === 'exchange') {
    if (!request.offeredAssignment) return { ok: false as const, reason: 'not_found' as const, message: 'Exchange request is missing the offered OT assignment.' };
    const second = nextByKey.get(request.offeredAssignment.monthKey)!;
    if (!transferOTAssignment(second.publishedRows, request.offeredAssignment, request.recipient.employeeId, request.requester)) {
      return { ok: false as const, reason: 'not_found' as const, message: 'Recipient OT assignment no longer matches.' };
    }
  }

  for (const ref of refs) {
    const next = nextByKey.get(ref.monthKey)!;
    const publishedRow = next.publishedRows.find((row) => row.id === ref.rowId);
    const draftRow = next.draftRows.find((row) => row.id === ref.rowId);
    if (publishedRow && draftRow) {
      draftRow.assignments[String(ref.day)] = clone(publishedRow.assignments[String(ref.day)] ?? []);
    }
  }

  for (const [monthKey, next] of nextByKey.entries()) {
    await db.overtimeMonth.update({
      where: { monthKey },
      data: {
        publishedRowsJson: JSON.stringify(next.publishedRows),
        rowsJson: JSON.stringify(next.draftRows),
        versionsJson: next.versionsJson,
        status: MonthStatus.published,
        deleted: false,
        publishedAt: new Date(),
      },
    });
  }

  return { ok: true as const };
}

export async function markConflictingRequestsStale(
  db: DbClient,
  approvedRequest: ShiftRequest,
) {
  const approvedKeys = requestAssignmentKeys(approvedRequest);
  const candidates = await db.shiftRequest.findMany({
    where: {
      id: { not: approvedRequest.id },
      status: { in: ACTIVE_STATUSES },
      departmentId: approvedRequest.departmentId,
    },
  });

  const staleAt = new Date().toISOString();
  const updated: ShiftRequest[] = [];
  for (const candidate of candidates) {
    const candidateKeys = requestAssignmentKeys(candidate);
    if (!candidateKeys.some((key) => approvedKeys.includes(key))) continue;
    const timeline = [
      timelineEvent('stale', 'system', 'System'),
      ...parseJson<ShiftRequestTimelineEvent[]>(candidate.timelineJson, []),
    ];
    updated.push(await db.shiftRequest.update({
      where: { id: candidate.id },
      data: {
        status: 'stale',
        timelineJson: JSON.stringify(timeline),
        updatedAt: new Date(staleAt),
      },
    }));
  }
  return updated;
}

export async function createShiftRequestNotifications(
  db: DbClient,
  event: 'created' | 'recipient_accepted' | 'recipient_rejected' | 'approved' | 'admin_rejected' | 'stale' | 'expired' | 'cancelled',
  request: SerializedShiftRequest,
) {
  const adminRejectionReason = request.adminRejectionReason
    ? request.adminRejectionNote?.trim() || request.adminRejectionReason.replace(/_/g, ' ')
    : '';
  const params = {
    requesterAccountId: request.requester.accountId,
    recipientAccountId: request.recipient.accountId,
    requester: request.requester.name,
    recipient: request.recipient.name,
    adminRejectionReasonKey: request.adminRejectionReason ?? '',
    adminRejectionReason,
  };
  const accountDraft = (
    accountId: string,
    type: string,
    urgent = false,
    actionUrl = '/shift-requests',
  ) => ({
    audience: { kind: 'account' as const, accountId },
    type,
    title: 'Shift request update',
    message: 'A shift request was updated.',
    isUrgent: urgent,
    actionUrl,
    departmentId: request.departmentId,
    relatedRequestId: request.id,
    dedupeKey: `${request.id}:${event}:account:${accountId}`,
    titleKey: `notifications:shiftRequests.${event}.${type}.${request.type}.title`,
    messageKey: `notifications:shiftRequests.${event}.${type}.${request.type}.message`,
    params,
  });

  const drafts = event === 'created'
    ? [
      accountDraft(request.recipient.accountId, 'shift_request_received'),
      accountDraft(request.requester.accountId, 'shift_request_submitted'),
    ]
    : event === 'recipient_accepted'
      ? [
        accountDraft(request.requester.accountId, 'shift_request_recipient_accepted'),
        {
          audience: { kind: 'departmentRole' as const, role: 'admin' as UserRole, departmentId: request.departmentId },
          type: 'shift_request_recipient_accepted',
          title: 'Shift request awaiting approval',
          message: 'A recipient accepted a shift request.',
          isUrgent: true,
          actionUrl: '/admin/shift-requests',
          departmentId: request.departmentId,
          relatedRequestId: request.id,
          dedupeKey: `${request.id}:${event}:admin:${request.departmentId}`,
          titleKey: `notifications:shiftRequests.${event}.shift_request_recipient_accepted.${request.type}.title`,
          messageKey: `notifications:shiftRequests.${event}.shift_request_recipient_accepted.${request.type}.message`,
          params,
        },
      ]
      : event === 'recipient_rejected'
        ? [accountDraft(request.requester.accountId, 'shift_request_rejected')]
        : event === 'approved'
          ? [
            accountDraft(request.requester.accountId, 'shift_request_approved', true),
            accountDraft(request.recipient.accountId, 'shift_request_approved', true),
          ]
          : event === 'admin_rejected'
            ? [
              accountDraft(request.requester.accountId, 'shift_request_rejected'),
              accountDraft(request.recipient.accountId, 'shift_request_rejected'),
            ]
            : event === 'cancelled'
              ? [accountDraft(request.recipient.accountId, 'shift_request_cancelled')]
              : [
                accountDraft(request.requester.accountId, 'shift_request_stale'),
                accountDraft(request.recipient.accountId, 'shift_request_stale'),
              ];

  for (const draft of drafts) {
    await createNotification(db, draft);
  }
}

export async function createShiftRequestAudit(
  db: DbClient,
  action: 'request' | 'approve' | 'reject' | 'cancel' | 'expire',
  actorUserId: string | null,
  actorName: string,
  request: SerializedShiftRequest,
) {
  await createAuditEntry(db, {
    actorUserId,
    actorName,
    action,
    module: 'shift_requests',
    entityId: request.id,
    entityLabel: `${request.type === 'exchange' ? 'Exchange' : 'Replace'} shift request`,
    before: request.timeline[1]?.action,
    after: request.status,
    context: {
      departmentId: request.departmentId,
      year: request.requesterAssignment.year,
      month: request.requesterAssignment.month,
      rowId: request.requesterAssignment.rowId,
      day: request.requesterAssignment.day,
      route: action === 'approve' || (action === 'reject' && request.status === 'admin_rejected')
        ? '/admin/shift-requests'
        : '/shift-requests',
    },
  });
}
