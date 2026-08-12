import {
  DEFAULT_JUSTIFICATION_STATE,
  type JustificationEmployeeRow,
  type JustificationReportState,
} from '@/types/employeeJustification';

export const EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY = 'ngh_employee_justification_reports_v1';

interface PersistedJustificationReports {
  version: 1;
  reportsByMonth: Record<string, JustificationReportState>;
}

type JustificationDraftStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): JustificationDraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function emptyPayload(): PersistedJustificationReports {
  return { version: 1, reportsByMonth: {} };
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function logoValue(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' || value === null ? value : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRow(value: unknown, index: number): JustificationEmployeeRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<JustificationEmployeeRow>;
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : `row-${index + 1}`;
  return {
    id,
    employeeId: optionalString(row.employeeId),
    bn: stringValue(row.bn, ''),
    manualBn: row.manualBn === true,
    name: stringValue(row.name, ''),
    manualName: row.manualName === true,
    branch: stringValue(row.branch, 'General'),
    totalShifts: finiteNumber(row.totalShifts, 0),
    claimedHours: finiteNumber(row.claimedHours, 0),
  };
}

export function normalizeJustificationReport(value: unknown): JustificationReportState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Partial<JustificationReportState>;
  const headers = (
    report.headers && typeof report.headers === 'object'
      ? report.headers
      : {}
  ) as Partial<JustificationReportState['headers']>;
  const rows = Array.isArray(report.rows)
    ? report.rows
      .map((row, index) => normalizeRow(row, index))
      .filter((row): row is JustificationEmployeeRow => Boolean(row))
    : [];

  return {
    ...DEFAULT_JUSTIFICATION_STATE,
    kingdomLabel: stringValue(report.kingdomLabel, DEFAULT_JUSTIFICATION_STATE.kingdomLabel),
    ministryName: stringValue(report.ministryName, DEFAULT_JUSTIFICATION_STATE.ministryName),
    departmentName: stringValue(report.departmentName, DEFAULT_JUSTIFICATION_STATE.departmentName),
    reportTitle: stringValue(report.reportTitle, DEFAULT_JUSTIFICATION_STATE.reportTitle),
    section: stringValue(report.section, DEFAULT_JUSTIFICATION_STATE.section),
    month: stringValue(report.month, DEFAULT_JUSTIFICATION_STATE.month),
    year: stringValue(report.year, DEFAULT_JUSTIFICATION_STATE.year),
    numberOfStaff: stringValue(report.numberOfStaff, String(rows.length)),
    leftLogo: logoValue(report.leftLogo, DEFAULT_JUSTIFICATION_STATE.leftLogo),
    rightLogo: logoValue(report.rightLogo, DEFAULT_JUSTIFICATION_STATE.rightLogo),
    headers: {
      no: stringValue(headers.no, DEFAULT_JUSTIFICATION_STATE.headers.no),
      bn: stringValue(headers.bn, DEFAULT_JUSTIFICATION_STATE.headers.bn),
      name: stringValue(headers.name, DEFAULT_JUSTIFICATION_STATE.headers.name),
      totalShifts: stringValue(headers.totalShifts, DEFAULT_JUSTIFICATION_STATE.headers.totalShifts),
      claimedHours: stringValue(headers.claimedHours, DEFAULT_JUSTIFICATION_STATE.headers.claimedHours),
    },
    rows,
    confirmationParagraph: stringValue(report.confirmationParagraph, DEFAULT_JUSTIFICATION_STATE.confirmationParagraph),
    supervisorLabel: stringValue(report.supervisorLabel, DEFAULT_JUSTIFICATION_STATE.supervisorLabel),
    footerText: stringValue(report.footerText, DEFAULT_JUSTIFICATION_STATE.footerText),
    notes: stringValue(report.notes, DEFAULT_JUSTIFICATION_STATE.notes),
  };
}

function readPayload(storage: JustificationDraftStorage | null): PersistedJustificationReports {
  if (!storage) return emptyPayload();
  try {
    const parsed = JSON.parse(storage.getItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY) || 'null') as Partial<PersistedJustificationReports> | null;
    if (!parsed || parsed.version !== 1 || !parsed.reportsByMonth || typeof parsed.reportsByMonth !== 'object') {
      return emptyPayload();
    }
    const reportsByMonth: Record<string, JustificationReportState> = {};
    for (const [monthKey, report] of Object.entries(parsed.reportsByMonth)) {
      const normalized = normalizeJustificationReport(report);
      if (normalized) reportsByMonth[monthKey] = normalized;
    }
    return { version: 1, reportsByMonth };
  } catch {
    return emptyPayload();
  }
}

export function readJustificationReportDraft(
  monthKey: string,
  storage: JustificationDraftStorage | null = browserStorage(),
): JustificationReportState | null {
  return readPayload(storage).reportsByMonth[monthKey] ?? null;
}

export function hasJustificationReportDraft(
  monthKey: string,
  storage: JustificationDraftStorage | null = browserStorage(),
): boolean {
  return Boolean(readJustificationReportDraft(monthKey, storage));
}

export function writeJustificationReportDraft(
  monthKey: string,
  report: JustificationReportState,
  storage: JustificationDraftStorage | null = browserStorage(),
): boolean {
  if (!storage || !monthKey) return false;
  try {
    const payload = readPayload(storage);
    payload.reportsByMonth[monthKey] = normalizeJustificationReport(report) ?? report;
    storage.setItem(EMPLOYEE_JUSTIFICATION_DRAFTS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
