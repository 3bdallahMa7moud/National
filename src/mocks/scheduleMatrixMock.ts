// ============================================================
// Schedule Matrix - Mock Data
// ============================================================
// Realistic one-month schedule across KAMC, KASCH, WHH.
// The row structure mirrors the parsed Excel templates:
// equipmentDay = 3 sub-rows (staff + time + SCDP), late/night = 2 sub-rows,
// on-call = weekend-only 2-4 sub-rows, vacations = full-name band.

import type {
  Assignment,
  Facility,
  FacilitySettings,
  ScheduleBlockType,
  ScheduleMatrixData,
  ShiftColorKey,
  ShiftDefinition,
  ShiftRow,
  Unit,
  UnitDefinition,
  VacationRow,
  VacationType,
} from '@/types/scheduleMatrix';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';

const LEGEND = OFFICIAL_EMPLOYEE_ROSTER.map((employee) => ({
  employeeId: employee.employeeId,
  code: employee.code,
  fullName: employee.fullName,
  fullNameEn: employee.fullNameEn,
}));

const codeToEmployee = new Map(LEGEND.map((employee) => [employee.code, employee]));

const LEGACY_CODE_MAP: Record<string, string> = {
  MQ: 'L',
  NR: 'NQ',
  SK: 'U',
  OD: 'P',
  KS: 'Z',
  RM: 'MA',
  HG: 'S',
  TZ: 'TG',
  LS: 'I',
  BA: 'B',
  DM: 'D',
  WH: 'H',
  SA: 'Q',
  HN: 'F',
};

function isSaudiWeekend(year: number, month: number, day: number) {
  const dow = new Date(year, month, day).getDay();
  return dow === 5 || dow === 6;
}

function assignment(code: string): Assignment {
  const officialCode = LEGACY_CODE_MAP[code] || code;
  const employee = codeToEmployee.get(officialCode);
  return {
    employeeId: employee?.employeeId || `emp-${officialCode.toLowerCase()}`,
    employeeCode: officialCode,
    status: 'published',
  };
}

function buildCells(
  daysInMonth: number,
  year: number,
  month: number,
  codes: string[],
  options: {
    weekendOnly?: boolean;
    weekdaysOnly?: boolean;
    empty?: boolean;
    offset?: number;
    occasionalOverflow?: boolean;
  },
): Record<number, Assignment[]> {
  const cells: Record<number, Assignment[]> = {};
  const offset = options.offset || 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekend = isSaudiWeekend(year, month, day);
    const allowed =
      (!options.weekendOnly && !options.weekdaysOnly) ||
      (options.weekendOnly && weekend) ||
      (options.weekdaysOnly && !weekend);

    if (!allowed || options.empty || codes.length === 0) {
      cells[day] = [];
      continue;
    }

    const primary = codes[(day + offset) % codes.length];
    const entries = [assignment(primary)];

    if (options.occasionalOverflow && day % 9 === 0) {
      const overflow = codes[(day + offset + 3) % codes.length];
      if (overflow !== primary) entries.push(assignment(overflow));
    }

    cells[day] = entries.slice(0, 2);
  }

  return cells;
}

let rowCounter = 0;

function row(
  blockType: ScheduleBlockType,
  unitLabel: string,
  rowLabel: string,
  shiftLabel: string,
  timeRange: string,
  colorKey: ShiftColorKey,
  weekendOnly: boolean,
  cellsByDay: Record<number, Assignment[]>,
  isOverflowRow = false,
): ShiftRow {
  return {
    id: `matrix-row-${++rowCounter}`,
    blockType,
    unitLabel,
    rowLabel,
    shiftLabel,
    timeRange,
    colorKey,
    weekendOnly,
    cellsByDay,
    isOverflowRow,
  };
}

function mergeStaffPools(
  daysInMonth: number,
  year: number,
  month: number,
  pool0: string[],
  pool1: string[],
  options: { weekdaysOnly?: boolean; weekendOnly?: boolean },
): Record<number, Assignment[]> {
  const cells0 = buildCells(daysInMonth, year, month, pool0, options);
  const cells1 = buildCells(daysInMonth, year, month, pool1, { ...options, offset: 2 });
  const merged: Record<number, Assignment[]> = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    merged[day] = [...(cells0[day] || []), ...(cells1[day] || [])].slice(0, 2);
  }
  return merged;
}

function equipmentDayUnit(
  id: string,
  unitName: string,
  timeRange: string,
  pools: [string[], string[], string[], string[]],
  daysInMonth: number,
  year: number,
  month: number,
): Unit {
  return {
    id,
    name: unitName,
    blockType: 'equipmentDay',
    rows: [
      row('equipmentDay', unitName, unitName, 'Day Shift', timeRange, 'morning', false,
        mergeStaffPools(daysInMonth, year, month, pools[0], pools[1], { weekdaysOnly: true })),
      row('equipmentDay', unitName, timeRange, 'Day Shift', timeRange, 'morning', false,
        buildCells(daysInMonth, year, month, pools[2], { weekdaysOnly: true, offset: 4, occasionalOverflow: true }), true),
      row('equipmentDay', unitName, 'SCDP', 'Day Shift', timeRange, 'morning', false,
        buildCells(daysInMonth, year, month, pools[3], { weekdaysOnly: true, offset: 6, occasionalOverflow: true }), true),
    ],
  };
}

function lateOrNightUnit(
  id: string,
  unitName: string,
  timeRange: string,
  colorKey: ShiftColorKey,
  pools: [string[], string[]],
  daysInMonth: number,
  year: number,
  month: number,
): Unit {
  return {
    id,
    name: unitName,
    blockType: 'lateOrNight',
    rows: [
      row('lateOrNight', unitName, unitName, unitName, timeRange, colorKey, false,
        buildCells(daysInMonth, year, month, pools[0], { weekdaysOnly: true })),
      row('lateOrNight', unitName, timeRange, unitName, timeRange, colorKey, false,
        buildCells(daysInMonth, year, month, pools[1], { weekdaysOnly: true, offset: 3 })),
    ],
  };
}

function onCallUnit(
  id: string,
  unitName: string,
  timeRange: string,
  colorKey: 'onCall' | 'onCallNight',
  pools: string[][],
  daysInMonth: number,
  year: number,
  month: number,
): Unit {
  const labels = [unitName, timeRange, 'فريق إضافي', 'احتياطي'];

  return {
    id,
    name: unitName,
    blockType: 'onCall',
    rows: pools.map((pool, index) =>
      row('onCall', unitName, labels[index] || 'احتياطي', unitName, timeRange, index > 1 ? 'overtime' : colorKey, true,
        buildCells(daysInMonth, year, month, pool, { weekendOnly: true, offset: index * 2 }), index > 1),
    ),
  };
}

function vacationRow(
  code: string,
  daysOff: number[],
  type: VacationType,
): VacationRow {
  const employee = codeToEmployee.get(code);
  const sorted = [...new Set(daysOff)].sort((a, b) => a - b);
  return {
    employeeId: employee?.employeeId || `emp-${code.toLowerCase()}`,
    employeeCode: code,
    fullName: employee?.fullName || code,
    daysOff: sorted,
    type,
    ranges: sorted.length > 0
      ? [
          {
            id: `vac-${code.toLowerCase()}-${sorted[0]}`,
            employeeId: employee?.employeeId || `emp-${code.toLowerCase()}`,
            startDay: sorted[0],
            endDay: sorted[sorted.length - 1],
            type,
            status: 'published',
          },
        ]
      : [],
  };
}

function shiftDefinitions(facilityId: string): ShiftDefinition[] {
  return [
    { id: `${facilityId}-morning`, facilityId, label: 'Day Shift', timeRange: '08:00 - 17:00', colorKey: 'morning', effectiveFromDay: 1 },
    { id: `${facilityId}-late`, facilityId, label: 'Late Shift', timeRange: '15:00 - 00:00', colorKey: 'evening', effectiveFromDay: 1 },
    { id: `${facilityId}-night`, facilityId, label: 'Night Shift', timeRange: '00:00 - 08:00', colorKey: 'night', effectiveFromDay: 1 },
    { id: `${facilityId}-oncall-day`, facilityId, label: 'On-Call Day', timeRange: '08:00 - 20:00', colorKey: 'onCall', effectiveFromDay: 1 },
    { id: `${facilityId}-oncall-night`, facilityId, label: 'On-call Night', timeRange: '20:00 - 08:00', colorKey: 'onCallNight', effectiveFromDay: 1 },
  ];
}

function unitDefinitions(facilityId: string, units: Unit[]): UnitDefinition[] {
  return units.map((unit) => ({
    id: unit.id,
    facilityId,
    name: unit.name,
    archived: unit.archived,
  }));
}

function buildMockData(year: number, month: number): ScheduleMatrixData {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  rowCounter = 0;

  const kamcUnits: Unit[] = [
    equipmentDayUnit('kamc-gevct', 'GE VCT', '08:00 - 17:00',
      [['AH', 'YK', 'MQ'], ['FA', 'NR', 'SK'], ['OD'], ['KS']], daysInMonth, year, month),
    equipmentDayUnit('kamc-gediscovery', 'GE Discovery', '08:00 - 17:00',
      [['RM', 'S', 'TZ'], ['LS', 'BA'], ['DM'], []], daysInMonth, year, month),
    equipmentDayUnit('kamc-flash', 'SIEMENS Flash', '08:00 - 17:00',
      [['WH', 'SA'], ['MA', 'HN'], ['AH'], []], daysInMonth, year, month),
    equipmentDayUnit('kamc-erct', 'ER CT', '08:00 - 17:00',
      [['MQ', 'KS'], ['YK', 'OD'], ['FA'], ['SK']], daysInMonth, year, month),
    lateOrNightUnit('kamc-late', 'Late Shift', '15:00 - 00:00', 'evening',
      [['FA', 'NR', 'RM'], ['S', 'TZ', 'LS']], daysInMonth, year, month),
    lateOrNightUnit('kamc-night', 'Night Shift', '00:00 - 08:00', 'night',
      [['SK', 'OD', 'BA'], ['DM', 'WH', 'SA']], daysInMonth, year, month),
    onCallUnit('kamc-in-oncall-day', 'IN-OnCall Day', '08:00 - 20:00', 'onCall',
      [['AH', 'MQ', 'KS'], ['YK', 'OD'], ['BA']], daysInMonth, year, month),
    onCallUnit('kamc-er-oncall-day', 'ER-OnCall Day', '08:00 - 20:00', 'onCall',
      [['FA', 'NR', 'RM'], ['S', 'TZ']], daysInMonth, year, month),
    onCallUnit('kamc-night-oncall', 'Night OnCall', '20:00 - 08:00', 'onCallNight',
      [['SK', 'OD', 'BA'], ['DM', 'WH'], ['SA', 'MA'], ['HN']], daysInMonth, year, month),
  ];

  const kaschUnits: Unit[] = [
    equipmentDayUnit('kasch-room1', 'Room 1', '08:00 - 17:00',
      [['AH', 'FA', 'NR'], ['YK', 'MQ'], ['RM'], []], daysInMonth, year, month),
    equipmentDayUnit('kasch-room2', 'Room 2', '08:00 - 17:00',
      [['KS', 'S', 'TZ'], ['OD', 'SK'], ['LS'], []], daysInMonth, year, month),
    equipmentDayUnit('kasch-room3', 'Room 3', '08:00 - 17:00',
      [['BA', 'DM', 'WH'], ['SA', 'MA'], ['HN'], []], daysInMonth, year, month),
    lateOrNightUnit('kasch-late', 'Late Shift', '15:00 - 00:00', 'evening',
      [['NR', 'RM', 'S'], ['TZ', 'LS', 'BA']], daysInMonth, year, month),
    lateOrNightUnit('kasch-night', 'Night Shift', '00:00 - 08:00', 'night',
      [['OD', 'SK', 'DM'], ['WH', 'SA', 'MA']], daysInMonth, year, month),
    onCallUnit('kasch-weekend-day', 'Weekend Day', '08:00 - 20:00', 'onCall',
      [['LS', 'DM', 'HN'], ['BA', 'WH']], daysInMonth, year, month),
    onCallUnit('kasch-weekend-night', 'Weekend Night', '20:00 - 08:00', 'onCallNight',
      [['AH', 'YK', 'MQ'], ['FA', 'SK']], daysInMonth, year, month),
  ];

  const whhUnits: Unit[] = [
    equipmentDayUnit('whh-day', 'Day Shift', '08:00 - 17:00',
      [['YK', 'TZ', 'LS'], ['WH', 'DM'], ['NR'], []], daysInMonth, year, month),
    lateOrNightUnit('whh-late', 'Late Shift', '15:00 - 00:00', 'evening',
      [['WH', 'DM', 'MA'], ['SA', 'HN']], daysInMonth, year, month),
    lateOrNightUnit('whh-night', 'Night Shift', '00:00 - 08:00', 'night',
      [['LS', 'BA', 'NR'], ['SK', 'OD']], daysInMonth, year, month),
    onCallUnit('whh-weekend-day', 'Weekend Day', '08:00 - 20:00', 'onCall',
      [['AH', 'YK', 'MQ'], ['KS', 'RM']], daysInMonth, year, month),
    onCallUnit('whh-weekend-night', 'Weekend Night', '20:00 - 08:00', 'onCallNight',
      [['FA', 'SK', 'OD'], ['DM', 'WH']], daysInMonth, year, month),
  ];

  const facilities: Facility[] = [
    { id: 'kamc', name: 'KAMC', accentColorToken: 'facility-kamc', units: kamcUnits },
    { id: 'kasch', name: 'KASCH', accentColorToken: 'facility-kasch', units: kaschUnits },
    { id: 'whh', name: 'WHH', accentColorToken: 'facility-whh', units: whhUnits },
  ];

  const vacations: VacationRow[] = year === 2026 && month === 4
    ? [
        vacationRow('A', [1, 2, 3, 4, 5, 6, 7], 'annual'),
        vacationRow('U', [1, 2, 3, 4, 5, 6, 7], 'annual'),
        vacationRow('G', Array.from({ length: 21 }, (_, index) => index + 1), 'annual'),
        vacationRow('MA', Array.from({ length: 12 }, (_, index) => index + 10), 'annual'),
        vacationRow('NQ', Array.from({ length: 12 }, (_, index) => index + 10), 'annual'),
        vacationRow('P', [], 'annual'),
        vacationRow('YK', [], 'annual'),
        vacationRow('Q', [], 'annual'),
        vacationRow('N', Array.from({ length: 12 }, (_, index) => index + 10), 'annual'),
      ]
    : [
        vacationRow('A', [5, 6, 12, 13, 19, 20, 26, 27], 'annual'),
        vacationRow('FA', [1, 2, 3, 15, 16], 'sick'),
        vacationRow('P', [8, 9, 10, 11, 22, 23], 'annual'),
        vacationRow('NQ', [14, 15, 28, 29, 30], 'emergency'),
        vacationRow('TG', [3, 4, 17, 18, 24, 25], 'annual'),
        vacationRow('I', [7, 21], 'sick'),
        vacationRow('L', [10, 11, 12], 'annual'),
        vacationRow('U', [19, 20, 26, 27], 'emergency'),
        vacationRow('Z', [1, 2, 29, 30, 31].filter((day) => day <= daysInMonth), 'annual'),
        vacationRow('H', [6, 7, 13, 14, 20, 21], 'sick'),
      ];

  const settings: FacilitySettings[] = facilities.map((facility) => ({
    facilityId: facility.id,
    shiftDefinitions: shiftDefinitions(facility.id),
    units: unitDefinitions(facility.id, facility.units),
  }));

  for (const facility of facilities) {
    const definitions = settings.find((entry) => entry.facilityId === facility.id)?.shiftDefinitions ?? [];
    for (const unit of facility.units) {
      for (const shiftRow of unit.rows) {
        const definition = definitions.find((candidate) =>
          candidate.colorKey === shiftRow.colorKey && candidate.timeRange === shiftRow.timeRange,
        ) ?? definitions.find((candidate) => candidate.colorKey === shiftRow.colorKey);
        shiftRow.shiftDefinitionId = definition?.id;
      }
    }
  }

  return {
    departmentId: 'dept-1',
    month,
    year,
    facilities,
    legend: LEGEND,
    vacations,
    holidays: year === 2026 && month === 4
      ? [{ id: 'eid-holiday-2026', label: 'Eid Holiday', labelAr: 'إجازة العيد', startDay: 24, endDay: 28 }]
      : [],
    settings,
    auditLog: [
      {
        id: 'audit-seed-1',
        actorName: 'مشرف الجدولة',
        action: 'assign',
        facilityId: 'kamc',
        unitId: 'kamc-gevct',
        rowId: kamcUnits[0].rows[0].id,
        day: 5,
        oldValue: 'YK',
        newValue: 'AH',
        timestamp: new Date(year, month, 4, 9, 30).toISOString(),
      },
      {
        id: 'audit-seed-2',
        actorName: 'مشرف الجدولة',
        action: 'vacation',
        day: 10,
        oldValue: '',
        newValue: 'MQ annual vacation',
        timestamp: new Date(year, month, 1, 11, 15).toISOString(),
      },
    ],
  };
}

/** Pre-built mock for July 2026 */
export const scheduleMatrixMockJuly2026 = buildMockData(2026, 6);

/** Generate mock for any month */
export function generateScheduleMatrixMock(year: number, month: number): ScheduleMatrixData {
  return buildMockData(year, month);
}
