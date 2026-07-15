import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import { recalculateAllConflicts } from '@/lib/validateAssignment';
import { LATE_SCHEDULE_STORAGE_KEY, useLateScheduleStore, type LateScheduleState } from '@/stores/lateScheduleStore';
import { useScheduleMatrixStore } from '@/stores/scheduleMatrixStore';
import type { OTMonthVersion, OTShiftRow, OTUnit } from '@/types/lateSchedule';
import type { Assignment, ScheduleMatrixData, ScheduleMatrixVersion, ShiftRow } from '@/types/scheduleMatrix';
import type {
  ShiftApplyReceipt,
  ShiftAssignmentApplyResult,
  ShiftAssignmentGateway,
  ShiftAssignmentRef,
  ShiftRequest,
  ShiftRequestParty,
  ShiftRequestWarning,
} from '@/types/shiftRequest';

type ScheduleState = ReturnType<typeof useScheduleMatrixStore.getState>;
type LateScheduleStateWithPublished = LateScheduleState & {
  publishedRowsByMonth: Record<string, OTShiftRow[]>;
};

interface ScheduleGatewayBackup {
  data: ScheduleState['data'];
  matricesByMonth: ScheduleState['matricesByMonth'];
  draftsByMonth: ScheduleState['draftsByMonth'];
  snapshot: string;
  undoStack: ScheduleState['undoStack'];
  versionsByMonth: ScheduleState['versionsByMonth'];
  monthStatuses: ScheduleState['monthStatuses'];
  storageError: string | null;
}

interface OTGatewayBackup {
  rows: OTShiftRow[];
  rowsByMonth: Record<string, OTShiftRow[]>;
  publishedRowsByMonth: Record<string, OTShiftRow[]>;
  publishedUnitsByMonth: LateScheduleState['publishedUnitsByMonth'];
  departmentIdsByMonth: LateScheduleState['departmentIdsByMonth'];
  versionsByMonth: LateScheduleState['versionsByMonth'];
  monthStatuses: LateScheduleState['monthStatuses'];
  storageError: string | null;
}

interface GatewayReceiptPayload {
  schedule?: ScheduleGatewayBackup;
  ot?: OTGatewayBackup;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function startTimeFromRange(timeRange: string): string {
  return timeRange.match(/\b\d{1,2}:\d{2}\b/)?.[0]?.padStart(5, '0') ?? '00:00';
}

function startsAt(year: number, month: number, day: number, timeRange: string): string {
  return `${formatMonthKey(year, month)}-${String(day).padStart(2, '0')}T${startTimeFromRange(timeRange)}:00`;
}

function parseStart(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function idsSignature(assignments: Assignment[]): string {
  return assignments.map((assignment) => assignment.employeeId).sort().join(',');
}

function otIdsSignature(row: OTShiftRow, day: number): string {
  return (row.assignments[day] ?? []).map((assignment) =>
    assignment.kind === 'employee' ? assignment.employeeId : `legacy:${assignment.legacyCode}`,
  ).sort().join(',');
}

function scheduleFingerprint(
  monthKey: string,
  facilityId: string,
  unitId: string,
  row: ShiftRow,
  day: number,
  employeeId: string,
): string {
  return [
    'schedule', monthKey, facilityId, unitId, row.id, day, employeeId, row.shiftDefinitionId ?? '', row.unitLabel,
    row.rowLabel, row.shiftLabel, row.timeRange,
    idsSignature(row.cellsByDay[day] ?? []),
  ].join('|');
}

function otFingerprint(monthKey: string, row: OTShiftRow, day: number, employeeId: string): string {
  return [
    'ot', monthKey, row.id, day, employeeId, row.unitId ?? '', row.location, row.title,
    row.timeRange, otIdsSignature(row, day),
  ].join('|');
}

function findScheduleRow(matrix: ScheduleMatrixData, rowId: string) {
  for (const facility of matrix.facilities) {
    for (const unit of facility.units) {
      const row = unit.rows.find((candidate) => candidate.id === rowId);
      if (row) return { facility, unit, row };
    }
  }
  return null;
}

function publishedOTRows(state: LateScheduleStateWithPublished, monthKey: string): OTShiftRow[] | undefined {
  return state.publishedRowsByMonth[monthKey];
}

export function createScheduleAssignmentRef(
  matrix: ScheduleMatrixData,
  rowId: string,
  day: number,
  employeeId: string,
  departmentId = 'dept-1',
): ShiftAssignmentRef | null {
  if (matrix.departmentId !== departmentId) return null;
  const context = findScheduleRow(matrix, rowId);
  if (!context || context.unit.archived || context.row.archived) return null;
  const assignment = (context.row.cellsByDay[day] ?? []).find((candidate) =>
    candidate.employeeId === employeeId && candidate.status !== 'draft',
  );
  if (!assignment) return null;
  const monthKey = formatMonthKey(matrix.year, matrix.month);
  return {
    source: 'schedule',
    departmentId,
    monthKey,
    year: matrix.year,
    month: matrix.month,
    day,
    rowId,
    employeeId,
    employeeCode: assignment.employeeCode,
    facilityId: context.facility.id,
    unitId: context.unit.id,
    facilityLabel: context.facility.name,
    unitLabel: context.unit.name || context.row.unitLabel,
    shiftLabel: context.row.shiftLabel,
    timeRange: context.row.timeRange,
    fingerprint: scheduleFingerprint(monthKey, context.facility.id, context.unit.id, context.row, day, employeeId),
    startsAt: startsAt(matrix.year, matrix.month, day, context.row.timeRange),
  };
}

export function createOTAssignmentRef(
  rows: OTShiftRow[],
  year: number,
  month: number,
  rowId: string,
  day: number,
  employeeId: string,
  departmentId = 'dept-1',
  units: OTUnit[] = [],
): ShiftAssignmentRef | null {
  const row = rows.find((candidate) => candidate.id === rowId && !candidate.archived);
  if (row?.unitId && units.some((unit) => unit.id === row.unitId && unit.archived)) return null;
  if (!row || !(row.assignments[day] ?? []).some((assignment) => assignment.kind === 'employee' && assignment.employeeId === employeeId)) return null;
  const monthKey = formatMonthKey(year, month);
  const employee = OFFICIAL_EMPLOYEE_ROSTER.find((candidate) => candidate.employeeId === employeeId);
  return {
    source: 'ot',
    departmentId,
    monthKey,
    year,
    month,
    day,
    rowId,
    employeeId,
    employeeCode: employee?.code ?? employeeId,
    facilityLabel: row.location,
    unitLabel: row.title,
    shiftLabel: row.title,
    timeRange: row.timeRange,
    fingerprint: otFingerprint(monthKey, row, day, employeeId),
    startsAt: startsAt(year, month, day, row.timeRange),
  };
}

export function assignmentRequestKey(assignment: ShiftAssignmentRef): string {
  return `${assignment.source}|${assignment.monthKey}|${assignment.rowId}|${assignment.day}|${assignment.employeeId}`;
}

export function assignmentCellHasEmployee(assignment: ShiftAssignmentRef, employeeId: string): boolean {
  if (assignment.source === 'schedule') {
    const matrix = useScheduleMatrixStore.getState().matricesByMonth[assignment.monthKey];
    const row = matrix ? findScheduleRow(matrix, assignment.rowId)?.row : undefined;
    return row?.cellsByDay[assignment.day]?.some((item) => item.employeeId === employeeId) === true;
  }
  const state = useLateScheduleStore.getState() as LateScheduleStateWithPublished;
  const row = state.publishedRowsByMonth[assignment.monthKey]?.find((item) => item.id === assignment.rowId);
  return row?.assignments[assignment.day]?.some((item) => item.kind === 'employee' && item.employeeId === employeeId) === true;
}

function cellRequestKey(assignment: ShiftAssignmentRef): string {
  return `${assignment.source}|${assignment.monthKey}|${assignment.rowId}|${assignment.day}`;
}

export function listPublishedAssignmentsForEmployee(
  employeeId: string,
  departmentId = 'dept-1',
  source?: 'schedule' | 'ot',
): ShiftAssignmentRef[] {
  const refs: ShiftAssignmentRef[] = [];
  if (!source || source === 'schedule') {
    for (const matrix of Object.values(useScheduleMatrixStore.getState().matricesByMonth)) {
      for (const facility of matrix.facilities) {
        for (const unit of facility.units) {
          for (const row of unit.rows) {
            for (const dayText of Object.keys(row.cellsByDay)) {
              const ref = createScheduleAssignmentRef(matrix, row.id, Number(dayText), employeeId, departmentId);
              if (ref) refs.push(ref);
            }
          }
        }
      }
    }
  }
  if (!source || source === 'ot') {
    const state = useLateScheduleStore.getState() as LateScheduleStateWithPublished;
    const months = state.publishedRowsByMonth;
    for (const [monthKey, rows] of Object.entries(months)) {
      if ((state.departmentIdsByMonth[monthKey] || 'dept-1') !== departmentId) continue;
      const [yearText, monthText] = monthKey.split('-');
      for (const row of rows) {
        for (const dayText of Object.keys(row.assignments)) {
          const ref = createOTAssignmentRef(
            rows,
            Number(yearText),
            Number(monthText) - 1,
            row.id,
            Number(dayText),
            employeeId,
            departmentId,
            state.publishedUnitsByMonth[monthKey] ?? [],
          );
          if (ref) refs.push(ref);
        }
      }
    }
  }
  return refs.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

function validateCurrentAssignment(assignment: ShiftAssignmentRef, now: Date) {
  if (assignment.monthKey !== formatMonthKey(assignment.year, assignment.month)) {
    return { ok: false as const, reason: 'stale' as const };
  }
  if (assignment.source === 'schedule') {
    const matrix = useScheduleMatrixStore.getState().matricesByMonth[assignment.monthKey];
    if (!matrix) return { ok: false as const, reason: 'not_published' as const };
    if (matrix.departmentId !== assignment.departmentId) return { ok: false as const, reason: 'not_found' as const };
    const current = createScheduleAssignmentRef(matrix, assignment.rowId, assignment.day, assignment.employeeId, assignment.departmentId);
    if (!current) return { ok: false as const, reason: 'not_found' as const };
    if (current.fingerprint !== assignment.fingerprint) return { ok: false as const, reason: 'stale' as const };
    if (parseStart(current.startsAt) <= now.getTime()) return { ok: false as const, reason: 'past_shift' as const };
    return { ok: true as const, assignment: current };
  }
  const state = useLateScheduleStore.getState() as LateScheduleStateWithPublished;
  if ((state.departmentIdsByMonth[assignment.monthKey] || 'dept-1') !== assignment.departmentId) {
    return { ok: false as const, reason: 'not_found' as const };
  }
  const rows = publishedOTRows(state, assignment.monthKey);
  if (!rows) return { ok: false as const, reason: 'not_published' as const };
  const current = createOTAssignmentRef(
    rows,
    assignment.year,
    assignment.month,
    assignment.rowId,
    assignment.day,
    assignment.employeeId,
    assignment.departmentId,
    state.publishedUnitsByMonth[assignment.monthKey] ?? [],
  );
  if (!current) return { ok: false as const, reason: 'not_found' as const };
  if (current.fingerprint !== assignment.fingerprint) return { ok: false as const, reason: 'stale' as const };
  if (parseStart(current.startsAt) <= now.getTime()) return { ok: false as const, reason: 'past_shift' as const };
  return { ok: true as const, assignment: current };
}

function timeInterval(timeRange: string): [number, number] {
  const matches = timeRange.match(/\b\d{1,2}:\d{2}\b/g) ?? [];
  const toMinutes = (value: string | undefined) => {
    const [hours, minutes] = (value ?? '00:00').split(':').map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(matches[0]);
  let end = toMinutes(matches[1]);
  if (end <= start) end += 24 * 60;
  return [start, end];
}

function absoluteInterval(assignment: ShiftAssignmentRef): [number, number] {
  const [startMinutes, endMinutes] = timeInterval(assignment.timeRange);
  const dayStart = new Date(assignment.year, assignment.month, assignment.day).getTime();
  return [dayStart + startMinutes * 60_000, dayStart + endMinutes * 60_000];
}

function overlaps(left: ShiftAssignmentRef, right: ShiftAssignmentRef): boolean {
  const [leftStart, leftEnd] = absoluteInterval(left);
  const [rightStart, rightEnd] = absoluteInterval(right);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function allAssignmentsOnDate(employeeId: string, target: ShiftAssignmentRef): ShiftAssignmentRef[] {
  return listPublishedAssignmentsForEmployee(employeeId, target.departmentId)
    .filter((assignment) => overlaps(assignment, target));
}

function employeeVacationOnDay(employeeId: string, assignment: ShiftAssignmentRef): boolean {
  const matrix = useScheduleMatrixStore.getState().matricesByMonth[assignment.monthKey];
  return matrix?.vacations.some((vacation) => vacation.employeeId === employeeId && vacation.daysOff.includes(assignment.day)) === true;
}

function warningsForMove(
  employeeId: string,
  target: ShiftAssignmentRef,
  excludedAssignment?: ShiftAssignmentRef,
): ShiftRequestWarning[] {
  const warnings: ShiftRequestWarning[] = [];
  const conflicts = allAssignmentsOnDate(employeeId, target).filter((existing) =>
    (!excludedAssignment || assignmentRequestKey(existing) !== assignmentRequestKey(excludedAssignment))
    && cellRequestKey(existing) !== cellRequestKey(target)
    && overlaps(existing, target),
  );
  if (conflicts.length > 0) {
    warnings.push({
      code: 'schedule_conflict',
      employeeId,
      assignment: target,
      message: `Employee already has ${conflicts.length} overlapping assignment(s).`,
    });
  }
  if (employeeVacationOnDay(employeeId, target)) {
    warnings.push({
      code: 'approved_vacation',
      employeeId,
      assignment: target,
      message: 'Employee has approved vacation on this day.',
    });
  }
  return warnings;
}

function inspectWarnings(request: ShiftRequest): ShiftRequestWarning[] {
  if (request.type === 'replace') {
    return warningsForMove(request.recipient.employeeId, request.requesterAssignment);
  }
  if (!request.offeredAssignment) return [];
  return [
    ...warningsForMove(request.recipient.employeeId, request.requesterAssignment, request.offeredAssignment),
    ...warningsForMove(request.requester.employeeId, request.offeredAssignment, request.requesterAssignment),
  ];
}

function equivalentScheduleCell(left: ScheduleMatrixData, right: ScheduleMatrixData, ref: ShiftAssignmentRef): boolean {
  const leftRow = findScheduleRow(left, ref.rowId)?.row;
  const rightRow = findScheduleRow(right, ref.rowId)?.row;
  return Boolean(leftRow && rightRow && idsSignature(leftRow.cellsByDay[ref.day] ?? []) === idsSignature(rightRow.cellsByDay[ref.day] ?? []));
}

function equivalentOTCell(left: OTShiftRow[], right: OTShiftRow[], ref: ShiftAssignmentRef): boolean {
  const leftRow = left.find((row) => row.id === ref.rowId);
  const rightRow = right.find((row) => row.id === ref.rowId);
  return Boolean(leftRow && rightRow && otIdsSignature(leftRow, ref.day) === otIdsSignature(rightRow, ref.day));
}

function transferScheduleAssignment(
  matrix: ScheduleMatrixData,
  ref: ShiftAssignmentRef,
  fromEmployeeId: string,
  to: ShiftRequestParty,
): boolean {
  const row = findScheduleRow(matrix, ref.rowId)?.row;
  if (!row) return false;
  const current = row.cellsByDay[ref.day] ?? [];
  if (!current.some((assignment) => assignment.employeeId === fromEmployeeId)) return false;
  if (current.some((assignment) => assignment.employeeId === to.employeeId)) return false;
  const next = current.filter((assignment) => assignment.employeeId !== fromEmployeeId);
  next.push({ employeeId: to.employeeId, employeeCode: to.employeeCode, status: 'published' });
  row.cellsByDay[ref.day] = next;
  return true;
}

function transferOTAssignment(
  rows: OTShiftRow[],
  ref: ShiftAssignmentRef,
  fromEmployeeId: string,
  to: ShiftRequestParty,
): boolean {
  const row = rows.find((candidate) => candidate.id === ref.rowId);
  if (!row) return false;
  const current = row.assignments[ref.day] ?? [];
  if (!current.some((assignment) => assignment.kind === 'employee' && assignment.employeeId === fromEmployeeId)) return false;
  if (current.some((assignment) => assignment.kind === 'employee' && assignment.employeeId === to.employeeId)) return false;
  const next = current.filter((assignment) => assignment.kind !== 'employee' || assignment.employeeId !== fromEmployeeId);
  next.push({ kind: 'employee', employeeId: to.employeeId });
  row.assignments[ref.day] = next;
  return true;
}

function addScheduleVersion(
  versions: Record<string, ScheduleMatrixVersion[]>,
  key: string,
  matrix: ScheduleMatrixData,
  actorName: string,
): Record<string, ScheduleMatrixVersion[]> {
  const version: ScheduleMatrixVersion = {
    id: `schedule-request-version-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    actorName: `Before shift request approval · ${actorName}`,
    reason: 'shift_request',
    data: clone(matrix),
  };
  return { ...versions, [key]: [version, ...(versions[key] ?? [])].slice(0, 5) };
}

function applySchedule(request: ShiftRequest, actorName: string): { ok: true; backup: ScheduleGatewayBackup } | { ok: false; reason: 'not_found' | 'draft_conflict' | 'storage_error' } {
  const state = useScheduleMatrixStore.getState();
  const refs = [request.requesterAssignment, ...(request.offeredAssignment ? [request.offeredAssignment] : [])];
  const keys = [...new Set(refs.map((ref) => ref.monthKey))];
  const matricesByMonth = { ...state.matricesByMonth };
  const beforeMatrices: Record<string, ScheduleMatrixData> = {};
  for (const key of keys) {
    const matrix = state.matricesByMonth[key];
    if (!matrix) return { ok: false, reason: 'not_found' };
    beforeMatrices[key] = matrix;
    matricesByMonth[key] = clone(matrix);
  }

  for (const ref of refs) {
    const draft = state.draftsByMonth[ref.monthKey];
    if (draft && !equivalentScheduleCell(beforeMatrices[ref.monthKey], draft, ref)) return { ok: false, reason: 'draft_conflict' };
    if (state.data && formatMonthKey(state.data.year, state.data.month) === ref.monthKey
      && !equivalentScheduleCell(beforeMatrices[ref.monthKey], state.data, ref)) return { ok: false, reason: 'draft_conflict' };
  }
  const first = matricesByMonth[request.requesterAssignment.monthKey];
  if (!transferScheduleAssignment(first, request.requesterAssignment, request.requester.employeeId, request.recipient)) {
    return { ok: false, reason: 'not_found' };
  }
  if (request.type === 'exchange') {
    if (!request.offeredAssignment) return { ok: false, reason: 'not_found' };
    const second = matricesByMonth[request.offeredAssignment.monthKey];
    if (!transferScheduleAssignment(second, request.offeredAssignment, request.recipient.employeeId, request.requester)) {
      return { ok: false, reason: 'not_found' };
    }
  }
  for (const key of keys) recalculateAllConflicts(matricesByMonth[key]);

  for (const ref of refs) {
    matricesByMonth[ref.monthKey].auditLog.unshift({
      id: `schedule-request-audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      timestamp: new Date().toISOString(),
    });
  }

  const draftsByMonth = { ...state.draftsByMonth };
  for (const ref of refs) {
    const draft = draftsByMonth[ref.monthKey];
    if (!draft) continue;
    const nextDraft = clone(draft);
    const publishedRow = findScheduleRow(matricesByMonth[ref.monthKey], ref.rowId)?.row;
    const draftRow = findScheduleRow(nextDraft, ref.rowId)?.row;
    if (publishedRow && draftRow) draftRow.cellsByDay[ref.day] = clone(publishedRow.cellsByDay[ref.day] ?? []);
    recalculateAllConflicts(nextDraft);
    draftsByMonth[ref.monthKey] = nextDraft;
  }

  const data = state.data ? clone(state.data) : null;
  if (data) {
    const currentKey = formatMonthKey(data.year, data.month);
    for (const ref of refs.filter((item) => item.monthKey === currentKey)) {
      const publishedRow = findScheduleRow(matricesByMonth[currentKey], ref.rowId)?.row;
      const dataRow = findScheduleRow(data, ref.rowId)?.row;
      if (publishedRow && dataRow) dataRow.cellsByDay[ref.day] = clone(publishedRow.cellsByDay[ref.day] ?? []);
    }
    recalculateAllConflicts(data);
  }

  const activeKey = state.data ? formatMonthKey(state.data.year, state.data.month) : '';
  let snapshot = state.snapshot;
  if (activeKey && keys.includes(activeKey)) {
    let snapshotData: ScheduleMatrixData;
    try {
      snapshotData = state.snapshot ? JSON.parse(state.snapshot) as ScheduleMatrixData : clone(matricesByMonth[activeKey]);
    } catch {
      snapshotData = clone(matricesByMonth[activeKey]);
    }
    for (const ref of refs.filter((item) => item.monthKey === activeKey)) {
      const publishedRow = findScheduleRow(matricesByMonth[activeKey], ref.rowId)?.row;
      const snapshotRow = findScheduleRow(snapshotData, ref.rowId)?.row;
      if (publishedRow && snapshotRow) snapshotRow.cellsByDay[ref.day] = clone(publishedRow.cellsByDay[ref.day] ?? []);
    }
    recalculateAllConflicts(snapshotData);
    snapshot = JSON.stringify(snapshotData);
  }

  const undoStack = state.undoStack.map((entry) => {
    const entryKey = formatMonthKey(entry.data.year, entry.data.month);
    if (!keys.includes(entryKey)) return entry;
    const next = clone(entry);
    for (const ref of refs.filter((item) => item.monthKey === entryKey)) {
      const publishedRow = findScheduleRow(matricesByMonth[entryKey], ref.rowId)?.row;
      const undoRow = findScheduleRow(next.data, ref.rowId)?.row;
      if (publishedRow && undoRow) undoRow.cellsByDay[ref.day] = clone(publishedRow.cellsByDay[ref.day] ?? []);
    }
    recalculateAllConflicts(next.data);
    return next;
  });

  let versionsByMonth = state.versionsByMonth;
  for (const key of keys) versionsByMonth = addScheduleVersion(versionsByMonth, key, beforeMatrices[key], actorName);
  const backup: ScheduleGatewayBackup = {
    data: state.data,
    matricesByMonth: state.matricesByMonth,
    draftsByMonth: state.draftsByMonth,
    snapshot: state.snapshot,
    undoStack: state.undoStack,
    versionsByMonth: state.versionsByMonth,
    monthStatuses: state.monthStatuses,
    storageError: state.storageError,
  };

  useScheduleMatrixStore.setState({ data, matricesByMonth, draftsByMonth, snapshot, undoStack, versionsByMonth });
  if (useScheduleMatrixStore.getState().storageError) {
    useScheduleMatrixStore.setState(backup);
    return { ok: false, reason: 'storage_error' };
  }
  return { ok: true, backup };
}

function addOTVersion(
  versions: Record<string, OTMonthVersion[]>,
  key: string,
  rows: OTShiftRow[],
  state: LateScheduleState,
  actorName: string,
): Record<string, OTMonthVersion[]> {
  const version: OTMonthVersion = {
    id: `ot-request-version-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    actorName: `Before shift request approval · ${actorName}`,
    reason: 'shift_request',
    rows: clone(rows),
    units: clone(state.publishedUnitsByMonth[key] ?? state.unitsByMonth[key] ?? []),
    notice: state.notice,
  };
  return { ...versions, [key]: [version, ...(versions[key] ?? [])].slice(0, 5) };
}

function persistLateScheduleState(state: LateScheduleStateWithPublished): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const payload: Record<string, unknown> = {
      version: 5,
      currentYear: state.year,
      currentMonth: state.month,
      rowsByMonth: state.rowsByMonth,
      unitsByMonth: state.unitsByMonth,
      publishedRowsByMonth: state.publishedRowsByMonth,
      publishedUnitsByMonth: state.publishedUnitsByMonth,
      departmentIdsByMonth: state.departmentIdsByMonth,
      monthStatuses: state.monthStatuses,
      versionsByMonth: state.versionsByMonth,
      deletedMonths: state.deletedMonths,
      notice: state.notice,
    };
    window.localStorage.setItem(LATE_SCHEDULE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function applyOT(request: ShiftRequest, actorName: string): { ok: true; backup: OTGatewayBackup } | { ok: false; reason: 'not_found' | 'draft_conflict' | 'storage_error' } {
  const state = useLateScheduleStore.getState() as LateScheduleStateWithPublished;
  const refs = [request.requesterAssignment, ...(request.offeredAssignment ? [request.offeredAssignment] : [])];
  const keys = [...new Set(refs.map((ref) => ref.monthKey))];
  const publishedRowsByMonth = { ...state.publishedRowsByMonth };
  const rowsByMonth = { ...state.rowsByMonth };
  const beforePublished: Record<string, OTShiftRow[]> = {};

  for (const key of keys) {
    const rows = publishedOTRows(state, key);
    if (!rows) return { ok: false, reason: 'not_found' };
    beforePublished[key] = rows;
    publishedRowsByMonth[key] = clone(rows);
  }
  const outputRows = (key: string) => publishedRowsByMonth[key];

  for (const ref of refs) {
    const draft = state.rowsByMonth[ref.monthKey];
    if (draft && !equivalentOTCell(beforePublished[ref.monthKey], draft, ref)) return { ok: false, reason: 'draft_conflict' };
  }

  if (!transferOTAssignment(outputRows(request.requesterAssignment.monthKey), request.requesterAssignment, request.requester.employeeId, request.recipient)) {
    return { ok: false, reason: 'not_found' };
  }
  if (request.type === 'exchange') {
    if (!request.offeredAssignment
      || !transferOTAssignment(outputRows(request.offeredAssignment.monthKey), request.offeredAssignment, request.recipient.employeeId, request.requester)) {
      return { ok: false, reason: 'not_found' };
    }
  }

  for (const ref of refs) {
    const draft = rowsByMonth[ref.monthKey];
    if (!draft) continue;
    const nextDraft = clone(draft);
    const publishedRow = outputRows(ref.monthKey).find((row) => row.id === ref.rowId);
    const draftRow = nextDraft.find((row) => row.id === ref.rowId);
    if (publishedRow && draftRow) draftRow.assignments[ref.day] = clone(publishedRow.assignments[ref.day] ?? []);
    rowsByMonth[ref.monthKey] = nextDraft;
  }

  let versionsByMonth = state.versionsByMonth;
  for (const key of keys) versionsByMonth = addOTVersion(versionsByMonth, key, beforePublished[key], state, actorName);
  const activeKey = formatMonthKey(state.year, state.month);
  const rows = rowsByMonth[activeKey] ?? state.rows;
  const backup: OTGatewayBackup = {
    rows: state.rows,
    rowsByMonth: state.rowsByMonth,
    publishedRowsByMonth: state.publishedRowsByMonth,
    publishedUnitsByMonth: state.publishedUnitsByMonth,
    departmentIdsByMonth: state.departmentIdsByMonth,
    versionsByMonth: state.versionsByMonth,
    monthStatuses: state.monthStatuses,
    storageError: state.storageError,
  };

  const nextState = { rows, rowsByMonth, versionsByMonth, storageError: null } as Partial<LateScheduleStateWithPublished>;
  nextState.publishedRowsByMonth = publishedRowsByMonth;
  useLateScheduleStore.setState(nextState as Partial<LateScheduleState>);
  if (!persistLateScheduleState(useLateScheduleStore.getState() as LateScheduleStateWithPublished)) {
    useLateScheduleStore.setState(backup as Partial<LateScheduleState>);
    persistLateScheduleState(useLateScheduleStore.getState() as LateScheduleStateWithPublished);
    return { ok: false, reason: 'storage_error' };
  }
  return { ok: true, backup };
}

export const browserShiftAssignmentGateway: ShiftAssignmentGateway = {
  validate: validateCurrentAssignment,
  inspectWarnings,
  apply: (request, options): ShiftAssignmentApplyResult => {
    const requesterValidation = validateCurrentAssignment(request.requesterAssignment, new Date());
    if (!requesterValidation.ok) return {
      ok: false,
      reason: requesterValidation.reason === 'not_found' ? 'not_found' : 'stale',
    };
    if (request.offeredAssignment) {
      const offeredValidation = validateCurrentAssignment(request.offeredAssignment, new Date());
      if (!offeredValidation.ok) return {
        ok: false,
        reason: offeredValidation.reason === 'not_found' ? 'not_found' : 'stale',
      };
    }
    const warnings = inspectWarnings(request);
    const result = request.requesterAssignment.source === 'schedule'
      ? applySchedule(request, options.actorName)
      : applyOT(request, options.actorName);
    if (!result.ok) return { ok: false, reason: result.reason, warnings };
    const payload: GatewayReceiptPayload = request.requesterAssignment.source === 'schedule'
      ? { schedule: result.backup as ScheduleGatewayBackup }
      : { ot: result.backup as OTGatewayBackup };
    return {
      ok: true,
      warnings,
      receipt: {
        id: `shift-apply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        before: payload,
        after: { requestId: request.id },
      },
    };
  },
  rollback: (receipt: ShiftApplyReceipt) => {
    const payload = receipt.before as GatewayReceiptPayload;
    if (payload.schedule) useScheduleMatrixStore.setState(payload.schedule);
    if (payload.ot) {
      useLateScheduleStore.setState(payload.ot as Partial<LateScheduleState>);
      persistLateScheduleState(useLateScheduleStore.getState() as LateScheduleStateWithPublished);
    }
  },
};

/** Refresh employee-facing published snapshots after another browser tab approves a request. */
export function reloadPublishedAssignmentSnapshots(): void {
  try {
    if (typeof window === 'undefined') return;
    // Reloading lets each store hydrate its complete versioned payload without triggering
    // its local persistence subscriber against a partial external snapshot.
    window.location.reload();
  } catch {
    // Restricted embedded contexts may disallow reload; a manual refresh still hydrates persisted data.
  }
}
