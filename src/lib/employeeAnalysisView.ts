import type { EmployeeAnalysisRow } from './employeeAnalysis';

export interface EmployeeAnalysisSummary {
  totalAssignments: number;
  totalDay: number;
  totalLate: number;
  totalNight: number;
  totalOnCall: number;
  totalOTShifts: number;
  totalOTHours: number;
  totalVacationDays: number;
}

export interface EmployeeAnalysisView<T extends EmployeeAnalysisRow> {
  rows: T[];
  chartRows: T[];
  summary: EmployeeAnalysisSummary;
}

export function buildEmployeeAnalysisView<T extends EmployeeAnalysisRow>(
  rows: T[],
  searchQuery: string,
): EmployeeAnalysisView<T> {
  const query = searchQuery.trim().toLocaleLowerCase();
  const filteredRows = rows.filter((row) => {
    if (!query) return true;
    return row.code.toLocaleLowerCase().includes(query)
      || row.fullName.toLocaleLowerCase().includes(query)
      || row.fullNameEn?.toLocaleLowerCase().includes(query);
  });

  const summary = filteredRows.reduce<EmployeeAnalysisSummary>((totals, row) => ({
    totalAssignments: totals.totalAssignments + row.totalScheduledAssignments,
    totalDay: totals.totalDay + row.day,
    totalLate: totals.totalLate + row.late,
    totalNight: totals.totalNight + row.night,
    totalOnCall: totals.totalOnCall + row.onCallDay + row.onCallNight,
    totalOTShifts: totals.totalOTShifts + row.matrixOTShifts + row.otScheduleShifts,
    totalOTHours: totals.totalOTHours + row.otScheduleHours,
    totalVacationDays: totals.totalVacationDays + row.vacationDays,
  }), {
    totalAssignments: 0,
    totalDay: 0,
    totalLate: 0,
    totalNight: 0,
    totalOnCall: 0,
    totalOTShifts: 0,
    totalOTHours: 0,
    totalVacationDays: 0,
  });

  return {
    rows: filteredRows,
    chartRows: filteredRows,
    summary,
  };
}
