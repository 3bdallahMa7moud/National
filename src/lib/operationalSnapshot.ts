import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import { operationalShiftVisualKey } from '@/lib/occurrenceShiftStyle';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import type { OTShiftRow } from '@/types/lateSchedule';
import type {
  CoverageCategory,
  CoverageMetric,
  DailyShiftGroup,
  OperationalIssue,
  OperationalSnapshot,
} from '@/types/operationalDashboard';
import type { OperationalShiftCategory, OperationalShiftVisual } from '@/types/operationalSchedule';
import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';

const COVERAGE_ORDER: CoverageCategory[] = ['day', 'late', 'night', 'onCall', 'ot'];
const ISSUE_ORDER: Record<OperationalIssue['kind'], number> = {
  uncovered: 0,
  conflict: 1,
  approvedAbsence: 2,
  unresolvedEmployee: 3,
};

function parseDate(value: string): { year: number; month: number; day: number; date: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return { year, month, day, date };
}

function categoryFromColor(colorKey: ShiftColorKey): OperationalShiftCategory | null {
  switch (colorKey) {
    case 'morning': return 'day';
    case 'evening': return 'late';
    case 'night': return 'night';
    case 'onCall': return 'onCallDay';
    case 'onCallNight': return 'onCallNight';
    case 'overtime': return 'ot';
    case 'vacation': return null;
  }
}

function coverageCategory(category: OperationalShiftCategory): CoverageCategory {
  if (category === 'onCallDay' || category === 'onCallNight') return 'onCall';
  return category;
}

function hoursFromRange(timeRange: string): number {
  const times = timeRange.match(/\b\d{1,2}:\d{2}\b/g);
  if (!times || times.length < 2) return 0;
  const minutes = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  };
  const start = minutes(times[0]);
  let end = minutes(times[1]);
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

function scheduleHref(date: string, category: CoverageCategory, rowId: string, day: number): string {
  return `/admin/schedule?date=${date}&category=${category}&rowId=${encodeURIComponent(rowId)}&day=${day}`;
}

function otHref(year: number, month: number, rowId: string, day: number): string {
  return `/admin/late-schedule?year=${year}&month=${month + 1}&rowId=${encodeURIComponent(rowId)}&day=${day}`;
}

function blankMetric(category: CoverageCategory, hasMatrix: boolean): CoverageMetric {
  const standard = category !== 'ot';
  return {
    category,
    assignedEmployees: 0,
    assignments: 0,
    expectedSlots: standard && hasMatrix ? 0 : null,
    coveredSlots: standard && hasMatrix ? 0 : null,
    uncoveredSlots: standard && hasMatrix ? 0 : null,
    hours: category === 'ot' ? 0 : null,
    scheduledRows: 0,
    conflicts: 0,
    approvedAbsences: 0,
    shiftColors: [],
  };
}

function addMetricShiftColor(metric: CoverageMetric, visual: OperationalShiftVisual): void {
  const colors = metric.shiftColors ?? [];
  const key = operationalShiftVisualKey(visual);
  if (!colors.some((entry) => operationalShiftVisualKey(entry) === key)) colors.push(visual);
  metric.shiftColors = colors;
}

export function buildOperationalSnapshot(
  dateValue: string,
  matrix: ScheduleMatrixData | undefined,
  otRows: OTShiftRow[] | undefined,
  roster: UnifiedEmployee[],
): OperationalSnapshot {
  const { year, month, day, date } = parseDate(dateValue);
  const publishedMatrix = matrix?.year === year && matrix.month === month ? matrix : undefined;
  const metrics = new Map(COVERAGE_ORDER.map((category) => [category, blankMetric(category, !!publishedMatrix)]));
  const assignedIds = new Map(COVERAGE_ORDER.map((category) => [category, new Set<string>()]));
  const groups = new Map<CoverageCategory, DailyShiftGroup>(COVERAGE_ORDER.map((category) => [category, {
    category,
    assignmentCount: 0,
    issueCount: 0,
    items: [],
  }]));
  const issues: OperationalIssue[] = [];
  const employeeById = new Map(roster.map((employee) => [employee.employeeId, employee]));
  const scheduledEmployees = new Set<string>();
  let standardAssignments = 0;
  let otAssignments = 0;
  let otHours = 0;
  let vacationEmployees = 0;

  if (publishedMatrix) {
    const vacationSet = new Set(
      publishedMatrix.vacations.filter((vacation) => vacation.daysOff.includes(day)).map((vacation) => vacation.employeeId),
    );
    vacationEmployees = vacationSet.size;
    const weekend = date.getDay() === 5 || date.getDay() === 6;

    for (const facility of publishedMatrix.facilities) {
      const settings = publishedMatrix.settings.find((entry) => entry.facilityId === facility.id);
      for (const unit of facility.units) {
        const archivedInSettings = settings?.units.find((definition) => definition.id === unit.id)?.archived === true;
        if (unit.archived || archivedInSettings || unit.blockType === 'vacation') continue;
        for (const row of filterActiveScheduleRows(publishedMatrix, facility.id, unit.rows)) {
          if (row.blockType === 'vacation' || (row.weekendOnly && !weekend)) continue;
          const definition = row.shiftDefinitionId
            ? settings?.shiftDefinitions.find((entry) => entry.id === row.shiftDefinitionId)
            : undefined;
          if (definition && definition.effectiveFromDay > day) continue;
          const subcategory = categoryFromColor(row.colorKey);
          if (!subcategory) continue;
          const category = coverageCategory(subcategory);
          const metric = metrics.get(category)!;
          const group = groups.get(category)!;
          const shiftVisual = {
            colorKey: row.colorKey,
            backgroundColor: row.backgroundColor,
            textColor: row.textColor,
          } satisfies OperationalShiftVisual;
          addMetricShiftColor(metric, shiftVisual);
          const assignments = (row.cellsByDay[day] ?? []).filter((assignment) => assignment.status !== 'draft');
          const href = scheduleHref(dateValue, category, row.id, day);

          if (category !== 'ot') {
            metric.expectedSlots = (metric.expectedSlots ?? 0) + 1;
            metric.scheduledRows += 1;
            if (assignments.length > 0) metric.coveredSlots = (metric.coveredSlots ?? 0) + 1;
            else {
              metric.uncoveredSlots = (metric.uncoveredSlots ?? 0) + 1;
              issues.push({
                id: `uncovered:${dateValue}:${row.id}`,
                severity: 'critical',
                kind: 'uncovered',
                label: `${row.shiftLabel} · ${facility.name} · ${unit.name}`,
                count: 1,
                href,
                category,
              });
              group.items.push({
                id: `gap:${dateValue}:${row.id}`,
                source: 'schedule',
                category,
                subcategory,
                ...shiftVisual,
                facility: facility.name,
                unit: unit.name,
                label: row.shiftLabel,
                timeRange: row.timeRange,
                hours: hoursFromRange(row.timeRange),
                rowId: row.id,
                day,
                uncovered: true,
                unresolvedEmployee: false,
                hasConflict: false,
                isOnApprovedVacation: false,
                href,
              });
            }
          } else if (assignments.length > 0) {
            metric.scheduledRows += 1;
          }

          for (const assignment of assignments) {
            const employee = employeeById.get(assignment.employeeId);
            const onVacation = vacationSet.has(assignment.employeeId);
            metric.assignments += 1;
            assignedIds.get(category)!.add(assignment.employeeId);
            scheduledEmployees.add(assignment.employeeId);
            if (category === 'ot') {
              const hours = hoursFromRange(row.timeRange);
              metric.hours = (metric.hours ?? 0) + hours;
              otAssignments += 1;
              otHours += hours;
            } else {
              standardAssignments += 1;
            }
            if (assignment.hasConflict) {
              metric.conflicts += 1;
              issues.push({
                id: `conflict:${dateValue}:${row.id}:${assignment.employeeId}`,
                severity: 'critical',
                kind: 'conflict',
                label: assignment.conflictReason || `${row.shiftLabel} · ${employee?.code ?? assignment.employeeCode}`,
                count: 1,
                href,
                category,
              });
            }
            if (onVacation) {
              metric.approvedAbsences += 1;
              issues.push({
                id: `absence:${dateValue}:${row.id}:${assignment.employeeId}`,
                severity: 'warning',
                kind: 'approvedAbsence',
                label: `${employee?.fullNameEn || employee?.fullName || assignment.employeeCode} · ${row.shiftLabel}`,
                count: 1,
                href,
                category,
              });
            }
            group.items.push({
              id: `schedule:${dateValue}:${row.id}:${assignment.employeeId}`,
              source: 'schedule',
              category,
              subcategory,
              ...shiftVisual,
              employeeId: assignment.employeeId,
              employeeCode: employee?.code ?? assignment.employeeCode,
              employeeName: employee?.fullNameEn || employee?.fullName || assignment.employeeCode,
              facility: facility.name,
              unit: unit.name,
              label: row.shiftLabel,
              timeRange: row.timeRange,
              hours: hoursFromRange(row.timeRange),
              rowId: row.id,
              day,
              uncovered: false,
              unresolvedEmployee: false,
              hasConflict: assignment.hasConflict === true,
              isOnApprovedVacation: onVacation,
              href,
            });
          }
        }
      }
    }
  }

  for (const row of otRows ?? []) {
    if (row.archived) continue;
    const assignments = row.assignments[day] ?? [];
    if (assignments.length === 0) continue;
    const metric = metrics.get('ot')!;
    const group = groups.get('ot')!;
    const shiftVisual = {
      colorKey: 'overtime',
      backgroundColor: row.backgroundColor,
      textColor: row.textColor,
    } satisfies OperationalShiftVisual;
    addMetricShiftColor(metric, shiftVisual);
    metric.scheduledRows += 1;
    const href = otHref(year, month, row.id, day);
    for (const assignment of assignments) {
      metric.assignments += 1;
      otAssignments += 1;
      if (assignment.kind === 'unresolved') {
        issues.push({
          id: `unresolved:${dateValue}:${row.id}:${assignment.legacyCode}`,
          severity: 'warning',
          kind: 'unresolvedEmployee',
          label: `${assignment.legacyCode}? · ${row.title}`,
          count: 1,
          href,
          category: 'ot',
        });
        group.items.push({
          id: `ot:${dateValue}:${row.id}:unresolved:${assignment.legacyCode}`,
          source: 'ot',
          category: 'ot',
          subcategory: 'ot',
          ...shiftVisual,
          employeeCode: `${assignment.legacyCode}?`,
          facility: row.location,
          unit: row.title,
          label: row.title,
          timeRange: row.timeRange,
          hours: row.hours,
          rowId: row.id,
          day,
          uncovered: false,
          unresolvedEmployee: true,
          hasConflict: false,
          isOnApprovedVacation: false,
          href,
        });
        continue;
      }
      const employee = employeeById.get(assignment.employeeId);
      assignedIds.get('ot')!.add(assignment.employeeId);
      scheduledEmployees.add(assignment.employeeId);
      metric.hours = (metric.hours ?? 0) + row.hours;
      otHours += row.hours;
      group.items.push({
        id: `ot:${dateValue}:${row.id}:${assignment.employeeId}`,
        source: 'ot',
        category: 'ot',
        subcategory: 'ot',
        ...shiftVisual,
        employeeId: assignment.employeeId,
        employeeCode: employee?.code ?? assignment.employeeId,
        employeeName: employee?.fullNameEn || employee?.fullName || assignment.employeeId,
        facility: row.location,
        unit: row.title,
        label: row.title,
        timeRange: row.timeRange,
        hours: row.hours,
        rowId: row.id,
        day,
        uncovered: false,
        unresolvedEmployee: !employee,
        hasConflict: false,
        isOnApprovedVacation: false,
        href,
      });
    }
  }

  for (const category of COVERAGE_ORDER) {
    const metric = metrics.get(category)!;
    metric.assignedEmployees = assignedIds.get(category)!.size;
    const group = groups.get(category)!;
    group.assignmentCount = group.items.filter((item) => !item.uncovered).length;
    group.issueCount = issues.filter((issue) => issue.category === category).length;
    group.items.sort((left, right) => {
      if (left.uncovered !== right.uncovered) return left.uncovered ? 1 : -1;
      const subtypeOrder: OperationalShiftCategory[] = ['day', 'late', 'night', 'onCallDay', 'onCallNight', 'ot'];
      return subtypeOrder.indexOf(left.subcategory) - subtypeOrder.indexOf(right.subcategory)
        || (left.employeeCode ?? '').localeCompare(right.employeeCode ?? '')
        || left.rowId.localeCompare(right.rowId);
    });
  }

  issues.sort((left, right) => ISSUE_ORDER[left.kind] - ISSUE_ORDER[right.kind] || left.id.localeCompare(right.id));

  return {
    date: dateValue,
    availability: publishedMatrix ? 'available' : 'missing',
    coverage: COVERAGE_ORDER.map((category) => metrics.get(category)!),
    shiftGroups: COVERAGE_ORDER.map((category) => groups.get(category)!),
    issues,
    secondary: {
      activeEmployees: roster.length,
      scheduledEmployees: scheduledEmployees.size,
      standardAssignments,
      otAssignments,
      otHours,
      vacationEmployees,
    },
  };
}
