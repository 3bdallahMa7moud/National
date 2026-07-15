import { getMonthKeysForPeriod, isIsoDateWithinPeriod, type AnalysisPeriod } from '@/lib/analysisPeriod';
import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import { uniqueOperationalShiftVisuals } from '@/lib/occurrenceShiftStyle';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { CoverageCategory } from '@/types/operationalDashboard';
import type { OperationalShiftVisual } from '@/types/operationalSchedule';
import type { ScheduleMatrixData, ShiftColorKey } from '@/types/scheduleMatrix';

export type OperationalShiftVisualsByCategory = Record<CoverageCategory, OperationalShiftVisual[]>;

const DEFAULT_VISUALS: Record<CoverageCategory, OperationalShiftVisual> = {
  day: { colorKey: 'morning' },
  late: { colorKey: 'evening' },
  night: { colorKey: 'night' },
  onCall: { colorKey: 'onCall' },
  ot: { colorKey: 'overtime' },
};

function emptyVisuals(): OperationalShiftVisualsByCategory {
  return { day: [], late: [], night: [], onCall: [], ot: [] };
}

function categoryFromColor(colorKey: ShiftColorKey): CoverageCategory | null {
  if (colorKey === 'morning') return 'day';
  if (colorKey === 'evening') return 'late';
  if (colorKey === 'night') return 'night';
  if (colorKey === 'onCall' || colorKey === 'onCallNight') return 'onCall';
  if (colorKey === 'overtime') return 'ot';
  return null;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function rowContributesInPeriod(
  matrix: ScheduleMatrixData,
  row: ScheduleMatrixData['facilities'][number]['units'][number]['rows'][number],
  period: AnalysisPeriod,
): boolean {
  return Object.entries(row.cellsByDay).some(([dayText, assignments]) =>
    isIsoDateWithinPeriod(isoDate(matrix.year, matrix.month, Number(dayText)), period)
    && assignments.some((assignment) => assignment.status !== 'draft'),
  );
}

function otRowContributesInPeriod(
  year: number,
  month: number,
  row: OTShiftRow,
  period: AnalysisPeriod,
): boolean {
  return Object.entries(row.assignments).some(([dayText, assignments]) =>
    isIsoDateWithinPeriod(isoDate(year, month, Number(dayText)), period)
    && assignments.length > 0,
  );
}

export function defaultOperationalShiftVisual(category: CoverageCategory): OperationalShiftVisual {
  return DEFAULT_VISUALS[category];
}

export function collectPublishedShiftVisualsForPeriod(
  matricesByMonth: Record<string, ScheduleMatrixData>,
  otRowsByMonth: Record<string, OTShiftRow[]>,
  period: AnalysisPeriod,
): OperationalShiftVisualsByCategory {
  const result = emptyVisuals();

  for (const key of getMonthKeysForPeriod(period)) {
    const matrix = matricesByMonth[key];
    if (matrix) {
      for (const facility of matrix.facilities) {
        const settings = matrix.settings.find((entry) => entry.facilityId === facility.id);
        for (const unit of facility.units) {
          const archivedInSettings = settings?.units.find((entry) => entry.id === unit.id)?.archived === true;
          if (unit.archived || archivedInSettings || unit.blockType === 'vacation') continue;
          for (const row of filterActiveScheduleRows(matrix, facility.id, unit.rows)) {
            const category = categoryFromColor(row.colorKey);
            if (!category || row.blockType === 'vacation' || !rowContributesInPeriod(matrix, row, period)) continue;
            result[category].push({
              colorKey: row.colorKey,
              backgroundColor: row.backgroundColor,
              textColor: row.textColor,
            });
          }
        }
      }
    }

    const [yearText, monthText] = key.split('-');
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    for (const row of otRowsByMonth[key] ?? []) {
      if (row.archived || !otRowContributesInPeriod(year, month, row, period)) continue;
      result.ot.push({
        colorKey: 'overtime',
        backgroundColor: row.backgroundColor,
        textColor: row.textColor,
      });
    }
  }

  for (const category of Object.keys(result) as CoverageCategory[]) {
    result[category] = uniqueOperationalShiftVisuals(result[category]);
  }

  return result;
}
