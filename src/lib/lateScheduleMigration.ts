import type { OTRosterEmployee, OTShiftRow } from '@/types/lateSchedule';

interface LegacyLateShiftRow {
  id: unknown;
  title: unknown;
  location: unknown;
  timeRange: unknown;
  hours?: unknown;
  highlightedDays?: unknown;
  assignments?: unknown;
}

export interface LateScheduleMigrationResult {
  rows: OTShiftRow[];
  warnings: string[];
}

export interface LateScheduleIdentityMigrationResult {
  rowsByMonth: Record<string, OTShiftRow[]>;
  warnings: string[];
}

const RETIRED_EMPLOYEE_CODES: Record<string, string> = {
  'emp-m-15': 'GH',
  'emp-m-21': 'RH',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHighlightedDays(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const days = [...new Set(value
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))].sort((left, right) => left - right);
  return days.length > 0 ? days : undefined;
}

export function inferOTHours(timeRange: string, title = ''): number {
  if (/transplant/i.test(title)) return 8;
  const matches = timeRange.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!matches) return 4;
  const start = Number(matches[1]) * 60 + Number(matches[2]);
  let end = Number(matches[3]) * 60 + Number(matches[4]);
  if (end <= start) end += 24 * 60;
  const duration = (end - start) / 60;
  return Number.isFinite(duration) && duration > 0 && duration <= 12 ? duration : 4;
}

export function migrateRetiredOTEmployeeIds(
  input: Record<string, OTShiftRow[]>,
): LateScheduleIdentityMigrationResult {
  const warnings = new Set<string>();
  const rowsByMonth = Object.fromEntries(
    Object.entries(input).map(([monthKey, rows]) => [
      monthKey,
      rows.map((row) => ({
        ...row,
        assignments: Object.fromEntries(
          Object.entries(row.assignments).map(([day, assignments]) => [
            day,
            assignments.map((assignment) => {
              if (assignment.kind === 'unresolved') {
                warnings.add(assignment.legacyCode);
                return assignment;
              }
              const legacyCode = RETIRED_EMPLOYEE_CODES[assignment.employeeId];
              if (!legacyCode) return assignment;
              warnings.add(legacyCode);
              return { kind: 'unresolved' as const, legacyCode };
            }),
          ]),
        ),
      })),
    ]),
  );

  return { rowsByMonth, warnings: [...warnings] };
}

export function migrateLateSchedulePayload(
  input: unknown,
  roster: Pick<OTRosterEmployee, 'employeeId' | 'code'>[],
): LateScheduleMigrationResult {
  const legacyRows = Array.isArray(input) ? input : [];
  const codeToId = new Map(
    roster.map((employee) => [employee.code.trim().toUpperCase(), employee.employeeId]),
  );
  const warnings = new Set<string>();

  const rows = legacyRows.flatMap((rawRow, rowIndex): OTShiftRow[] => {
    if (!isRecord(rawRow)) return [];
    const legacy = rawRow as unknown as LegacyLateShiftRow;
    const title = safeText(legacy.title);
    const location = safeText(legacy.location);
    const timeRange = safeText(legacy.timeRange);
    const rawAssignments = isRecord(legacy.assignments) ? legacy.assignments : {};
    const assignments: OTShiftRow['assignments'] = {};

    for (const [rawDay, rawValue] of Object.entries(rawAssignments)) {
      const day = Number(rawDay);
      if (!Number.isInteger(day) || day < 1 || day > 31 || typeof rawValue !== 'string') continue;
      const uniqueCodes = [...new Set(rawValue.split('-').map((code) => code.trim().toUpperCase()).filter(Boolean))];
      assignments[day] = uniqueCodes.slice(0, 2).map((code) => {
        const employeeId = codeToId.get(code);
        if (employeeId) return { kind: 'employee', employeeId } as const;
        warnings.add(code);
        return { kind: 'unresolved', legacyCode: code } as const;
      });
    }

    const explicitHours = Number(legacy.hours);
    return [{
      id: safeText(legacy.id) || `legacy-ot-row-${rowIndex + 1}`,
      title,
      location,
      timeRange,
      hours: Number.isFinite(explicitHours) && explicitHours > 0
        ? explicitHours
        : inferOTHours(timeRange, title),
      highlightedDays: normalizeHighlightedDays(legacy.highlightedDays),
      assignments,
    }];
  });

  return { rows, warnings: [...warnings].sort() };
}
