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

const LEGEND = [
  { code: 'AH', fullName: 'أحمد العتيبي', fullNameEn: 'Ahmed Al-Otaibi' },
  { code: 'YK', fullName: 'ياسر الخالدي', fullNameEn: 'Yasser Al-Khalidi' },
  { code: 'MQ', fullName: 'محمد القحطاني', fullNameEn: 'Mohammed Al-Qahtani' },
  { code: 'FA', fullName: 'فاطمة الأحمري', fullNameEn: 'Fatima Al-Ahmari' },
  { code: 'NR', fullName: 'نورة الراشد', fullNameEn: 'Noura Al-Rashid' },
  { code: 'SK', fullName: 'سارة الكعبي', fullNameEn: 'Sara Al-Kaabi' },
  { code: 'OD', fullName: 'عمر الدوسري', fullNameEn: 'Omar Al-Dossari' },
  { code: 'KS', fullName: 'خالد الشمري', fullNameEn: 'Khaled Al-Shammari' },
  { code: 'RM', fullName: 'رنا المالكي', fullNameEn: 'Rana Al-Malki' },
  { code: 'HG', fullName: 'هدى الغامدي', fullNameEn: 'Huda Al-Ghamdi' },
  { code: 'TZ', fullName: 'طارق الزهراني', fullNameEn: 'Tariq Al-Zahrani' },
  { code: 'LS', fullName: 'لينا السعيد', fullNameEn: 'Lina Al-Saeed' },
  { code: 'BA', fullName: 'بدر العنزي', fullNameEn: 'Bader Al-Otaibi' },
  { code: 'DM', fullName: 'دلال المطيري', fullNameEn: 'Dalal Al-Mutairi' },
  { code: 'WH', fullName: 'وليد الحربي', fullNameEn: 'Waleed Al-Harbi' },
  { code: 'SA', fullName: 'سالم العبدلي', fullNameEn: 'Salim Al-Abdali' },
  { code: 'MA', fullName: 'مها الشهري', fullNameEn: 'Maha Al-Shehri' },
  { code: 'HN', fullName: 'هاني النجدي', fullNameEn: 'Hani Al-Najdi' },
].map((employee, index) => ({
  employeeId: `emp-m-${index + 1}`,
  ...employee,
}));

const codeToEmployee = new Map(LEGEND.map((employee) => [employee.code, employee]));

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function isSaudiWeekend(year: number, month: number, day: number) {
  const dow = new Date(year, month, day).getDay();
  return dow === 5 || dow === 6;
}

function assignment(code: string): Assignment {
  const employee = codeToEmployee.get(code);
  return {
    employeeId: employee?.employeeId || `emp-${code.toLowerCase()}`,
    employeeCode: code,
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
      row('onCall', unitName, labels[index] || 'احتياطي', unitName, timeRange, index > 1 ? 'overtime' : 'onCall', true,
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
    ranges: [
      {
        id: `vac-${code.toLowerCase()}-${sorted[0] || 1}`,
        employeeId: employee?.employeeId || `emp-${code.toLowerCase()}`,
        startDay: sorted[0] || 1,
        endDay: sorted[sorted.length - 1] || sorted[0] || 1,
        type,
        status: 'published',
      },
    ],
  };
}

function shiftDefinitions(facilityId: string): ShiftDefinition[] {
  return [
    { id: `${facilityId}-morning`, facilityId, label: 'Day Shift', timeRange: '08:00 - 17:00', colorKey: 'morning', effectiveFromDay: 1 },
    { id: `${facilityId}-late`, facilityId, label: 'Late Shift', timeRange: '15:00 - 00:00', colorKey: 'evening', effectiveFromDay: 1 },
    { id: `${facilityId}-night`, facilityId, label: 'Night Shift', timeRange: '22:00 - 08:00', colorKey: 'night', effectiveFromDay: 1 },
    { id: `${facilityId}-oncall-day`, facilityId, label: 'On-Call Day', timeRange: '08:00 - 20:00', colorKey: 'onCall', effectiveFromDay: 1 },
    { id: `${facilityId}-oncall-night`, facilityId, label: 'Night OnCall', timeRange: '20:00 - 08:00', colorKey: 'onCall', effectiveFromDay: 1 },
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
  const rand = seeded(year * 100 + month + 42);
  rowCounter = 0;

  const kamcUnits: Unit[] = [
    equipmentDayUnit('kamc-gevct', 'GE VCT', '08:00 - 17:00',
      [['AH', 'YK', 'MQ'], ['FA', 'NR', 'SK'], ['OD'], ['KS']], daysInMonth, year, month),
    equipmentDayUnit('kamc-gediscovery', 'GE Discovery', '08:00 - 17:00',
      [['RM', 'HG', 'TZ'], ['LS', 'BA'], ['DM'], []], daysInMonth, year, month),
    equipmentDayUnit('kamc-flash', 'SIEMENS Flash', '08:00 - 17:00',
      [['WH', 'SA'], ['MA', 'HN'], ['AH'], []], daysInMonth, year, month),
    equipmentDayUnit('kamc-erct', 'ER CT', '08:00 - 17:00',
      [['MQ', 'KS'], ['YK', 'OD'], ['FA'], ['SK']], daysInMonth, year, month),
    lateOrNightUnit('kamc-late', 'Late Shift', '15:00 - 00:00', 'evening',
      [['FA', 'NR', 'RM'], ['HG', 'TZ', 'LS']], daysInMonth, year, month),
    lateOrNightUnit('kamc-night', 'Night Shift', '22:00 - 08:00', 'night',
      [['SK', 'OD', 'BA'], ['DM', 'WH', 'SA']], daysInMonth, year, month),
    onCallUnit('kamc-in-oncall-day', 'IN-OnCall Day', '08:00 - 20:00',
      [['AH', 'MQ', 'KS'], ['YK', 'OD'], ['BA']], daysInMonth, year, month),
    onCallUnit('kamc-er-oncall-day', 'ER-OnCall Day', '08:00 - 20:00',
      [['FA', 'NR', 'RM'], ['HG', 'TZ']], daysInMonth, year, month),
    onCallUnit('kamc-night-oncall', 'Night OnCall', '20:00 - 08:00',
      [['SK', 'OD', 'BA'], ['DM', 'WH'], ['SA', 'MA'], ['HN']], daysInMonth, year, month),
  ];

  const kaschUnits: Unit[] = [
    equipmentDayUnit('kasch-room1', 'Room 1', '08:00 - 17:00',
      [['AH', 'FA', 'NR'], ['YK', 'MQ'], ['RM'], []], daysInMonth, year, month),
    equipmentDayUnit('kasch-room2', 'Room 2', '08:00 - 17:00',
      [['KS', 'HG', 'TZ'], ['OD', 'SK'], ['LS'], []], daysInMonth, year, month),
    equipmentDayUnit('kasch-room3', 'Room 3', '08:00 - 17:00',
      [['BA', 'DM', 'WH'], ['SA', 'MA'], ['HN'], []], daysInMonth, year, month),
    lateOrNightUnit('kasch-late', 'Late Shift', '15:00 - 00:00', 'evening',
      [['NR', 'RM', 'HG'], ['TZ', 'LS', 'BA']], daysInMonth, year, month),
    lateOrNightUnit('kasch-night', 'Night Shift', '22:00 - 08:00', 'night',
      [['OD', 'SK', 'DM'], ['WH', 'SA', 'MA']], daysInMonth, year, month),
    onCallUnit('kasch-weekend-day', 'Weekend Day', '08:00 - 20:00',
      [['LS', 'DM', 'HN'], ['BA', 'WH']], daysInMonth, year, month),
    onCallUnit('kasch-weekend-night', 'Weekend Night', '20:00 - 08:00',
      [['AH', 'YK', 'MQ'], ['FA', 'SK']], daysInMonth, year, month),
  ];

  const whhUnits: Unit[] = [
    equipmentDayUnit('whh-day', 'Day Shift', '08:00 - 17:00',
      [['YK', 'TZ', 'LS'], ['WH', 'DM'], ['NR'], []], daysInMonth, year, month),
    lateOrNightUnit('whh-late', 'Late Shift', '15:00 - 00:00', 'evening',
      [['WH', 'DM', 'MA'], ['SA', 'HN']], daysInMonth, year, month),
    lateOrNightUnit('whh-night', 'Night Shift', '22:00 - 08:00', 'night',
      [['LS', 'BA', 'NR'], ['SK', 'OD']], daysInMonth, year, month),
    onCallUnit('whh-weekend-day', 'Weekend Day', '08:00 - 20:00',
      [['AH', 'YK', 'MQ'], ['KS', 'RM']], daysInMonth, year, month),
    onCallUnit('whh-weekend-night', 'Weekend Night', '20:00 - 08:00',
      [['FA', 'SK', 'OD'], ['DM', 'WH']], daysInMonth, year, month),
  ];

  const facilities: Facility[] = [
    { id: 'kamc', name: 'KAMC', accentColorToken: 'facility-kamc', units: kamcUnits },
    { id: 'kasch', name: 'KASCH', accentColorToken: 'facility-kasch', units: kaschUnits },
    { id: 'whh', name: 'WHH', accentColorToken: 'facility-whh', units: whhUnits },
  ];

  const vacations: VacationRow[] = [
    vacationRow('AH', [5, 6, 12, 13, 19, 20, 26, 27], 'annual'),
    vacationRow('FA', [1, 2, 3, 15, 16], 'sick'),
    vacationRow('OD', [8, 9, 10, 11, 22, 23], 'annual'),
    vacationRow('NR', [14, 15, 28, 29, 30], 'emergency'),
    vacationRow('TZ', [3, 4, 17, 18, 24, 25], 'annual'),
    vacationRow('LS', [7, 21], 'sick'),
    vacationRow('MQ', [10, 11, 12], 'annual'),
    vacationRow('SK', [19, 20, 26, 27], 'emergency'),
    vacationRow('KS', [1, 2, 29, 30, 31].filter((day) => day <= daysInMonth), 'annual'),
    vacationRow('WH', [6, 7, 13, 14, 20, 21], 'sick'),
  ];

  const settings: FacilitySettings[] = facilities.map((facility) => ({
    facilityId: facility.id,
    shiftDefinitions: shiftDefinitions(facility.id),
    units: unitDefinitions(facility.id, facility.units),
  }));

  return {
    month,
    year,
    facilities,
    legend: LEGEND,
    vacations,
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
