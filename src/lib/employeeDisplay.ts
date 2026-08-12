import type { LegendEmployee } from '@/types/scheduleMatrix';
import type { OTRosterEmployee } from '@/types/lateSchedule';
import type { EmployeeDirectoryRecord } from '@/types/employeeDirectory';

type EmployeeDisplaySource = {
  employeeId?: string;
  code?: string;
  fullName?: string;
  fullNameEn?: string;
  employeeNumber?: string;
};

export interface EmployeeDisplayInfo {
  name: string;
  employeeNumber?: string;
  code?: string;
  tooltip: string;
}

function normalize(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pickLocalizedName(source: EmployeeDisplaySource, isRtl: boolean): string | undefined {
  return normalize(isRtl ? source.fullName : source.fullNameEn)
    || normalize(source.fullName)
    || normalize(source.fullNameEn);
}

function buildInfo(source: EmployeeDisplaySource, isRtl: boolean): EmployeeDisplayInfo | null {
  const name = pickLocalizedName(source, isRtl);
  const code = normalize(source.code);
  if (!name && !code) return null;
  const employeeNumber = normalize(source.employeeNumber);
  const resolvedName = name || code || 'Unknown employee';
  return {
    name: resolvedName,
    employeeNumber,
    code,
    tooltip: formatEmployeeTooltip(resolvedName, employeeNumber),
  };
}

function register(
  byId: Map<string, EmployeeDisplayInfo>,
  byCode: Map<string, EmployeeDisplayInfo>,
  source: EmployeeDisplaySource,
  isRtl: boolean,
) {
  const info = buildInfo(source, isRtl);
  if (!info) return;

  const employeeId = normalize(source.employeeId);
  const code = normalize(source.code);

  if (employeeId) byId.set(employeeId, info);
  if (code) byCode.set(code, info);
}

export function formatEmployeeTooltip(name: string, employeeNumber?: string) {
  return employeeNumber ? `${name} (${employeeNumber})` : name;
}

export function buildEmployeeDisplayLookup(
  sources: Array<LegendEmployee | OTRosterEmployee>,
  directoryRecords: EmployeeDirectoryRecord[],
  isRtl: boolean,
) {
  const byId = new Map<string, EmployeeDisplayInfo>();
  const byCode = new Map<string, EmployeeDisplayInfo>();

  for (const source of sources) register(byId, byCode, source, isRtl);

  for (const record of directoryRecords) {
    register(byId, byCode, {
      employeeId: record.scheduleEmployeeId || record.accountId,
      code: record.code,
      fullName: record.name.ar,
      fullNameEn: record.name.en,
      employeeNumber: record.employeeNumber,
    }, isRtl);
  }

  function resolve(assignment: { employeeId?: string; employeeCode?: string }): EmployeeDisplayInfo {
    const match = normalize(assignment.employeeId)
      ? byId.get(assignment.employeeId!)
      : undefined;
    const fallbackMatch = normalize(assignment.employeeCode)
      ? byCode.get(assignment.employeeCode!)
      : undefined;
    const info = match || fallbackMatch;

    if (info) {
      return {
        name: info.name,
        employeeNumber: info.employeeNumber,
        code: info.code || normalize(assignment.employeeCode),
        tooltip: info.tooltip,
      };
    }

    const code = normalize(assignment.employeeCode);
    const name = code || 'Unknown employee';
    return {
      name,
      code,
      tooltip: formatEmployeeTooltip(name),
    };
  }

  return { resolve };
}
