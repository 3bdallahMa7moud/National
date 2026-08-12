import type { LegendEmployee, ScheduleMatrixData } from '@/types/scheduleMatrix';

export function createEmptyScheduleMatrix(
  year: number,
  month: number,
  departmentId = 'dept-1',
  legend: LegendEmployee[] = [],
): ScheduleMatrixData {
  return {
    departmentId,
    month,
    year,
    facilities: [],
    legend: legend.map((employee) => ({ ...employee })),
    vacations: [],
    holidays: [],
    settings: [],
    auditLog: [],
    cellMarkers: {},
  };
}
