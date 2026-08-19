type ShiftColorKey =
  | 'morning'
  | 'evening'
  | 'night'
  | 'onCall'
  | 'onCallNight'
  | 'overtime';

type ScheduleBlockType = 'equipmentDay' | 'lateOrNight' | 'onCall';

interface SeedShiftDefinition {
  id: string;
  facilityId: string;
  label: string;
  englishName: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  colorKey: ShiftColorKey;
  effectiveFromDay: number;
}

interface SeedUnitDefinition {
  id: string;
  facilityId: string;
  name: string;
}

interface SeedRow {
  id: string;
  shiftDefinitionId?: string;
  blockType: ScheduleBlockType;
  unitLabel: string;
  rowLabel: string;
  shiftLabel: string;
  timeRange: string;
  colorKey: ShiftColorKey;
  weekendOnly: boolean;
  cellsByDay: Record<number, unknown[]>;
}

interface SeedUnit {
  id: string;
  name: string;
  blockType: ScheduleBlockType;
  rows: SeedRow[];
}

interface SeedFacility {
  id: string;
  name: string;
  accentColorToken: 'facility-kamc' | 'facility-kasch' | 'facility-whh';
  units: SeedUnit[];
}

function emptyCells(daysInMonth: number): Record<number, unknown[]> {
  const cells: Record<number, unknown[]> = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells[day] = [];
  }
  return cells;
}

function shiftDefinitions(facilityId: string): SeedShiftDefinition[] {
  return [
    {
      id: `${facilityId}-morning`,
      facilityId,
      label: 'Day Shift',
      englishName: 'Day Shift',
      timeRange: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      colorKey: 'morning',
      effectiveFromDay: 1,
    },
    {
      id: `${facilityId}-late`,
      facilityId,
      label: 'Late Shift',
      englishName: 'Late Shift',
      timeRange: '15:00 - 00:00',
      startTime: '15:00',
      endTime: '00:00',
      colorKey: 'evening',
      effectiveFromDay: 1,
    },
    {
      id: `${facilityId}-night`,
      facilityId,
      label: 'Night Shift',
      englishName: 'Night Shift',
      timeRange: '00:00 - 08:00',
      startTime: '00:00',
      endTime: '08:00',
      colorKey: 'night',
      effectiveFromDay: 1,
    },
    {
      id: `${facilityId}-oncall-day`,
      facilityId,
      label: 'On-Call Day',
      englishName: 'On-Call Day',
      timeRange: '08:00 - 20:00',
      startTime: '08:00',
      endTime: '20:00',
      colorKey: 'onCall',
      effectiveFromDay: 1,
    },
    {
      id: `${facilityId}-oncall-night`,
      facilityId,
      label: 'On-Call Night',
      englishName: 'On-Call Night',
      timeRange: '20:00 - 08:00',
      startTime: '20:00',
      endTime: '08:00',
      colorKey: 'onCallNight',
      effectiveFromDay: 1,
    },
  ];
}

function equipmentDayUnit(id: string, unitName: string, daysInMonth: number): SeedUnit {
  return {
    id,
    name: unitName,
    blockType: 'equipmentDay',
    rows: [
      {
        id: `${id}-row-main`,
        blockType: 'equipmentDay',
        unitLabel: unitName,
        rowLabel: unitName,
        shiftLabel: 'Day Shift',
        timeRange: '08:00 - 17:00',
        colorKey: 'morning',
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
      },
      {
        id: `${id}-row-time`,
        blockType: 'equipmentDay',
        unitLabel: unitName,
        rowLabel: '08:00 - 17:00',
        shiftLabel: 'Day Shift',
        timeRange: '08:00 - 17:00',
        colorKey: 'morning',
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
      },
      {
        id: `${id}-row-scdp`,
        blockType: 'equipmentDay',
        unitLabel: unitName,
        rowLabel: 'SCDP',
        shiftLabel: 'Day Shift',
        timeRange: '08:00 - 17:00',
        colorKey: 'morning',
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
      },
    ],
  };
}

function lateOrNightUnit(
  id: string,
  unitName: string,
  timeRange: string,
  colorKey: 'evening' | 'night',
  daysInMonth: number,
): SeedUnit {
  return {
    id,
    name: unitName,
    blockType: 'lateOrNight',
    rows: [
      {
        id: `${id}-row-main`,
        blockType: 'lateOrNight',
        unitLabel: unitName,
        rowLabel: unitName,
        shiftLabel: unitName,
        timeRange,
        colorKey,
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
      },
      {
        id: `${id}-row-time`,
        blockType: 'lateOrNight',
        unitLabel: unitName,
        rowLabel: timeRange,
        shiftLabel: unitName,
        timeRange,
        colorKey,
        weekendOnly: false,
        cellsByDay: emptyCells(daysInMonth),
      },
    ],
  };
}

function onCallUnit(
  id: string,
  unitName: string,
  timeRange: string,
  colorKey: 'onCall' | 'onCallNight',
  rowLabels: string[],
  daysInMonth: number,
): SeedUnit {
  return {
    id,
    name: unitName,
    blockType: 'onCall',
    rows: rowLabels.map((label, index) => ({
      id: `${id}-row-${index + 1}`,
      blockType: 'onCall',
      unitLabel: unitName,
      rowLabel: label,
      shiftLabel: unitName,
      timeRange,
      colorKey: index > 1 ? 'overtime' : colorKey,
      weekendOnly: true,
      cellsByDay: emptyCells(daysInMonth),
    })),
  };
}

function unitDefinitions(facilityId: string, units: SeedUnit[]): SeedUnitDefinition[] {
  return units.map((unit) => ({
    id: unit.id,
    facilityId,
    name: unit.name,
  }));
}

export function createScheduleSeedTemplate(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const facilities: SeedFacility[] = [
    {
      id: 'kamc',
      name: 'KAMC',
      accentColorToken: 'facility-kamc',
      units: [
        equipmentDayUnit('kamc-gevct', 'GE VCT', daysInMonth),
        equipmentDayUnit('kamc-gediscovery', 'GE Discovery', daysInMonth),
        equipmentDayUnit('kamc-flash', 'SIEMENS Flash', daysInMonth),
        equipmentDayUnit('kamc-erct', 'ER CT', daysInMonth),
        lateOrNightUnit('kamc-late', 'Late Shift', '15:00 - 00:00', 'evening', daysInMonth),
        lateOrNightUnit('kamc-night', 'Night Shift', '00:00 - 08:00', 'night', daysInMonth),
        onCallUnit('kamc-in-oncall-day', 'IN-OnCall Day', '08:00 - 20:00', 'onCall', ['IN-OnCall Day', '08:00 - 20:00', 'Backup'], daysInMonth),
        onCallUnit('kamc-er-oncall-day', 'ER-OnCall Day', '08:00 - 20:00', 'onCall', ['ER-OnCall Day', '08:00 - 20:00', 'Backup'], daysInMonth),
        onCallUnit('kamc-night-oncall', 'Night OnCall', '20:00 - 08:00', 'onCallNight', ['Night OnCall', '20:00 - 08:00', 'Additional Team', 'Reserve'], daysInMonth),
      ],
    },
    {
      id: 'kasch',
      name: 'KASCH',
      accentColorToken: 'facility-kasch',
      units: [
        equipmentDayUnit('kasch-room1', 'Room 1', daysInMonth),
        equipmentDayUnit('kasch-room2', 'Room 2', daysInMonth),
        equipmentDayUnit('kasch-room3', 'Room 3', daysInMonth),
        lateOrNightUnit('kasch-late', 'Late Shift', '15:00 - 00:00', 'evening', daysInMonth),
        lateOrNightUnit('kasch-night', 'Night Shift', '00:00 - 08:00', 'night', daysInMonth),
        onCallUnit('kasch-weekend-day', 'Weekend Day', '08:00 - 20:00', 'onCall', ['Weekend Day', '08:00 - 20:00', 'Backup'], daysInMonth),
        onCallUnit('kasch-weekend-night', 'Weekend Night', '20:00 - 08:00', 'onCallNight', ['Weekend Night', '20:00 - 08:00', 'Backup'], daysInMonth),
      ],
    },
    {
      id: 'whh',
      name: 'WHH',
      accentColorToken: 'facility-whh',
      units: [
        equipmentDayUnit('whh-day', 'Day Shift', daysInMonth),
        lateOrNightUnit('whh-late', 'Late Shift', '15:00 - 00:00', 'evening', daysInMonth),
        lateOrNightUnit('whh-night', 'Night Shift', '00:00 - 08:00', 'night', daysInMonth),
        onCallUnit('whh-weekend-day', 'Weekend Day', '08:00 - 20:00', 'onCall', ['Weekend Day', '08:00 - 20:00', 'Backup'], daysInMonth),
        onCallUnit('whh-weekend-night', 'Weekend Night', '20:00 - 08:00', 'onCallNight', ['Weekend Night', '20:00 - 08:00', 'Backup'], daysInMonth),
      ],
    },
  ];

  const settings = facilities.map((facility) => ({
    facilityId: facility.id,
    shiftDefinitions: shiftDefinitions(facility.id),
    units: unitDefinitions(facility.id, facility.units),
  }));

  for (const facility of facilities) {
    const definitions = settings.find((entry) => entry.facilityId === facility.id)?.shiftDefinitions ?? [];
    for (const unit of facility.units) {
      for (const row of unit.rows) {
        const definition = definitions.find((candidate) =>
          candidate.colorKey === row.colorKey && candidate.timeRange === row.timeRange,
        ) ?? definitions.find((candidate) => candidate.colorKey === row.colorKey);
        row.shiftDefinitionId = definition?.id;
      }
    }
  }

  return {
    departmentId: 'dept-1',
    month,
    year,
    facilities,
    legend: [],
    vacations: [],
    holidays: [],
    settings,
    cellMarkers: {},
    auditLog: [],
  };
}
