import ExcelJS from 'exceljs';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { UnifiedEmployee } from './unifiedEmployeeRoster';

export interface LateScheduleCalendarDay {
  dayNum: number;
  weekdayName: string;
  isWeekend: boolean;
}

export interface LateScheduleExportEmployee {
  code: string;
  nameEn: string;
  nameAr: string;
  unresolved?: boolean;
}

export interface LateScheduleExportRow {
  id: string;
  title: string;
  location: string;
  timeRange: string;
  hours: number;
  highlightedDays?: number[];
  assignments: Record<number, LateScheduleExportEmployee[]>;
}

export interface LateScheduleExportModel {
  rows: LateScheduleExportRow[];
  roster: UnifiedEmployee[];
}

const EXPORT_COLORS = {
  brand: 'FF0F6B78',
  brandDark: 'FF173952',
  surface: 'FFFFFFFF',
  surfaceMuted: 'FFF1F5F7',
  weekend: 'FFE4EEF1',
  border: 'FFB8C7CD',
  accent: 'FFF9E298',
  unresolved: 'FFFFE4E6',
  text: 'FF101B2D',
  mutedText: 'FF5B6472',
} as const;

function printableEmployeeCode(employee: LateScheduleExportEmployee): string {
  return employee.unresolved ? `${employee.code}?` : employee.code;
}

export function buildLateScheduleExportModel(
  rows: OTShiftRow[],
  roster: UnifiedEmployee[],
): LateScheduleExportModel {
  const employeeById = new Map(roster.map((employee) => [employee.employeeId, employee]));
  return {
    rows: rows.filter((row) => !row.archived).map((row) => ({
      id: row.id,
      title: row.title,
      location: row.location,
      timeRange: row.timeRange,
      hours: row.hours,
      highlightedDays: row.highlightedDays,
      assignments: Object.fromEntries(
        Object.entries(row.assignments).map(([day, assignments]) => [
          Number(day),
          assignments.map((assignment): LateScheduleExportEmployee => {
            if (assignment.kind === 'unresolved') {
              return {
                code: assignment.legacyCode,
                nameEn: 'Unresolved',
                nameAr: 'Unresolved',
                unresolved: true,
              };
            }
            const employee = employeeById.get(assignment.employeeId);
            return {
              code: employee?.code ?? assignment.employeeId,
              nameEn: employee?.fullNameEn || employee?.fullName || assignment.employeeId,
              nameAr: employee?.fullName || employee?.fullNameEn || assignment.employeeId,
              ...(!employee ? { unresolved: true } : {}),
            };
          }),
        ]),
      ),
    })),
    roster: roster.slice(0, 29),
  };
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function border(style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> {
  const edge = { style, color: { argb: EXPORT_COLORS.border } };
  return { top: edge, right: edge, bottom: edge, left: edge };
}

function styleCell(
  cell: ExcelJS.Cell,
  options: {
    fill?: string;
    color?: string;
    bold?: boolean;
    size?: number;
    horizontal?: ExcelJS.Alignment['horizontal'];
    wrap?: boolean;
  } = {},
): void {
  cell.font = {
    name: 'Arial',
    family: 2,
    size: options.size ?? 10,
    bold: options.bold ?? false,
    color: { argb: options.color ?? EXPORT_COLORS.text },
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: options.horizontal ?? 'center',
    wrapText: options.wrap ?? true,
  };
  cell.fill = solidFill(options.fill ?? EXPORT_COLORS.surface);
  cell.border = border();
}

function columnLetter(columnNumber: number): string {
  let value = columnNumber;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthIndex, 1));
}

export function buildLateScheduleWorkbook(
  rows: OTShiftRow[],
  roster: UnifiedEmployee[],
  _currentTitle: string,
  year: number,
  monthIndex: number,
  daysList: LateScheduleCalendarDay[],
  notice = '',
): ExcelJS.Workbook {
  const model = buildLateScheduleExportModel(rows, roster);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT Scan Department - National Guard Hospital';
  workbook.created = new Date(year, monthIndex, 1);

  const lastColumn = 4 + daysList.length;
  const lastColumnLetter = columnLetter(lastColumn);
  const schedule = workbook.addWorksheet('OT Schedule', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 3, topLeftCell: 'E4', showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:3',
      margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
    },
  });
  schedule.properties.defaultRowHeight = 24;
  schedule.mergeCells(`A1:${lastColumnLetter}1`);
  schedule.mergeCells(`A2:${lastColumnLetter}2`);

  const title = schedule.getCell('A1');
  title.value = `OT Schedule — ${monthLabel(year, monthIndex)}`;
  styleCell(title, { fill: EXPORT_COLORS.brand, color: EXPORT_COLORS.surface, bold: true, size: 16 });
  schedule.getRow(1).height = 30;

  const noticeCell = schedule.getCell('A2');
  noticeCell.value = notice;
  styleCell(noticeCell, {
    fill: EXPORT_COLORS.surfaceMuted,
    color: EXPORT_COLORS.mutedText,
    horizontal: 'left',
  });
  schedule.getRow(2).height = notice ? 34 : 10;

  const metadataHeaders = ['Shift', 'Location', 'Time', 'Hours'];
  metadataHeaders.forEach((label, index) => {
    const cell = schedule.getCell(3, index + 1);
    cell.value = label;
    styleCell(cell, { fill: EXPORT_COLORS.brandDark, color: EXPORT_COLORS.surface, bold: true });
  });
  daysList.forEach((day, index) => {
    const cell = schedule.getCell(3, index + 5);
    cell.value = `${day.weekdayName}\n${day.dayNum}`;
    styleCell(cell, {
      fill: day.isWeekend ? EXPORT_COLORS.weekend : EXPORT_COLORS.surfaceMuted,
      bold: true,
      size: 9,
    });
  });
  schedule.getRow(3).height = 34;

  model.rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 4;
    const metadata = [row.title, row.location, row.timeRange, row.hours];
    metadata.forEach((value, index) => {
      const cell = schedule.getCell(excelRow, index + 1);
      cell.value = value;
      styleCell(cell, {
        fill: rowIndex % 2 === 0 ? EXPORT_COLORS.surface : EXPORT_COLORS.surfaceMuted,
        bold: index === 0,
        horizontal: index < 3 ? 'left' : 'center',
      });
    });
    daysList.forEach((day, dayIndex) => {
      const cell = schedule.getCell(excelRow, dayIndex + 5);
      const assignments = row.assignments[day.dayNum] ?? [];
      cell.value = assignments.length > 0
        ? assignments.map(printableEmployeeCode).join('-')
        : null;
      const hasUnresolved = assignments.some((assignment) => assignment.unresolved);
      const fill = hasUnresolved
        ? EXPORT_COLORS.unresolved
        : row.highlightedDays?.includes(day.dayNum)
          ? EXPORT_COLORS.accent
          : day.isWeekend
            ? EXPORT_COLORS.weekend
            : rowIndex % 2 === 0 ? EXPORT_COLORS.surface : EXPORT_COLORS.surfaceMuted;
      styleCell(cell, { fill, bold: assignments.length > 0, size: 9 });
    });
  });

  schedule.getColumn(1).width = 28;
  schedule.getColumn(2).width = 14;
  schedule.getColumn(3).width = 16;
  schedule.getColumn(4).width = 9;
  for (let column = 5; column <= lastColumn; column += 1) schedule.getColumn(column).width = 6;
  schedule.autoFilter = { from: 'A3', to: `${lastColumnLetter}3` };
  schedule.pageSetup.printArea = `A1:${lastColumnLetter}${Math.max(4, model.rows.length + 3)}`;

  const employees = workbook.addWorksheet('Employees', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, printTitlesRow: '1:3' },
  });
  employees.mergeCells('A1:C1');
  employees.getCell('A1').value = 'Employees';
  styleCell(employees.getCell('A1'), { fill: EXPORT_COLORS.brand, color: EXPORT_COLORS.surface, bold: true, size: 16 });
  employees.getRow(1).height = 30;
  ['No.', 'Code', 'Employee name'].forEach((label, index) => {
    const cell = employees.getCell(3, index + 1);
    cell.value = label;
    styleCell(cell, { fill: EXPORT_COLORS.brandDark, color: EXPORT_COLORS.surface, bold: true });
  });
  model.roster.forEach((employee, index) => {
    const excelRow = index + 4;
    [index + 1, employee.code, employee.fullNameEn || employee.fullName].forEach((value, cellIndex) => {
      const cell = employees.getCell(excelRow, cellIndex + 1);
      cell.value = value;
      styleCell(cell, {
        fill: index % 2 === 0 ? EXPORT_COLORS.surface : EXPORT_COLORS.surfaceMuted,
        bold: cellIndex === 1,
        horizontal: cellIndex === 2 ? 'left' : 'center',
      });
    });
  });
  employees.getColumn(1).width = 9;
  employees.getColumn(2).width = 12;
  employees.getColumn(3).width = 34;
  employees.autoFilter = { from: 'A3', to: 'C3' };

  return workbook;
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportLateScheduleExcel(
  rows: OTShiftRow[],
  roster: UnifiedEmployee[],
  currentTitle: string,
  year: number,
  monthIndex: number,
  daysList: LateScheduleCalendarDay[],
  notice = '',
): Promise<void> {
  const workbook = buildLateScheduleWorkbook(rows, roster, currentTitle, year, monthIndex, daysList, notice);
  const buffer = await workbook.xlsx.writeBuffer();
  const monthPart = String(monthIndex + 1).padStart(2, '0');
  downloadBuffer(buffer as ArrayBuffer, `OT_Schedule_${year}-${monthPart}.xlsx`);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildLateSchedulePrintHtml(
  rows: OTShiftRow[],
  roster: UnifiedEmployee[],
  currentTitle: string,
  _year: number,
  daysList: LateScheduleCalendarDay[],
  isRtl: boolean,
  notice = '',
): string {
  const model = buildLateScheduleExportModel(rows, roster);
  const direction = isRtl ? 'rtl' : 'ltr';
  const language = isRtl ? 'ar' : 'en';
  const labels = isRtl
    ? { shift: 'الشفت', location: 'الموقع', time: 'الوقت', hours: 'الساعات', employees: 'دليل الموظفين', code: 'الكود', name: 'الاسم' }
    : { shift: 'Shift', location: 'Location', time: 'Time', hours: 'Hours', employees: 'Employee directory', code: 'Code', name: 'Employee name' };
  const dayHeaders = daysList.map((day) => (
    `<th class="day-column ${day.isWeekend ? 'weekend' : ''}"><span>${escapeHtml(day.weekdayName)}</span><strong>${day.dayNum}</strong></th>`
  )).join('');
  const pages: LateScheduleExportRow[][] = [];
  for (let index = 0; index < model.rows.length; index += 12) pages.push(model.rows.slice(index, index + 12));
  if (pages.length === 0) pages.push([]);

  const schedulePages = pages.map((pageRows, pageIndex) => {
    const body = pageRows.map((row) => {
      const dayCells = daysList.map((day) => {
        const assignments = row.assignments[day.dayNum] ?? [];
        const classes = [
          day.isWeekend ? 'weekend' : '',
          row.highlightedDays?.includes(day.dayNum) ? 'highlighted' : '',
          assignments.some((assignment) => assignment.unresolved) ? 'unresolved' : '',
        ].filter(Boolean).join(' ');
        return `<td class="${classes}">${assignments.map((assignment) => escapeHtml(printableEmployeeCode(assignment))).join('-')}</td>`;
      }).join('');
      return `<tr><th class="metadata-column shift-name">${escapeHtml(row.title)}</th><td class="metadata-column">${escapeHtml(row.location)}</td><td class="metadata-column time" dir="ltr">${escapeHtml(row.timeRange)}</td><td class="metadata-column">${row.hours}</td>${dayCells}</tr>`;
    }).join('');
    return `<main class="schedule-page" data-schedule-page="${pageIndex + 1}">
      <header class="print-header"><div><span class="brand-kicker">CT Scan Department</span><h1>OT Schedule</h1><p>${escapeHtml(currentTitle)}</p></div>${notice ? `<aside>${escapeHtml(notice)}</aside>` : ''}</header>
      <table class="schedule-table" dir="ltr"><thead><tr><th class="metadata-column">${labels.shift}</th><th class="metadata-column">${labels.location}</th><th class="metadata-column">${labels.time}</th><th class="metadata-column">${labels.hours}</th>${dayHeaders}</tr></thead><tbody>${body}</tbody></table>
    </main>`;
  }).join('');

  const employeeEntries = model.roster.map((employee, index) => (
    `<tr data-employee-entry="${index + 1}"><td>${index + 1}</td><td dir="ltr"><strong>${escapeHtml(employee.code)}</strong></td><td>${escapeHtml(isRtl ? employee.fullName : employee.fullNameEn || employee.fullName)}</td></tr>`
  )).join('');

  return `<!doctype html>
<html dir="${direction}" lang="${language}">
<head><meta charset="UTF-8"><title>OT Schedule — ${escapeHtml(currentTitle)}</title><style>
@page{size:A4 landscape;margin:8mm}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#101b2d;font-family:Arial,sans-serif}body{font-size:7px}
.schedule-page{width:100%;break-inside:avoid;page-break-inside:avoid}.schedule-page+.schedule-page{break-before:page;page-break-before:always}
.print-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8mm;margin-bottom:4mm;border-bottom:2px solid #0f6b78;padding:0 0 3mm}.brand-kicker{color:#0f6b78;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.print-header h1{margin:1mm 0 0;color:#173952;font-size:18px}.print-header p{margin:1mm 0 0;color:#5b6472;font-size:9px}.print-header aside{max-width:42%;border-radius:3mm;background:#f1f5f7;padding:2.5mm;color:#5b6472;font-size:8px;white-space:pre-wrap}
table{width:100%;border-collapse:collapse;table-layout:fixed}.schedule-table th,.schedule-table td{height:8mm;border:1px solid #b8c7cd;padding:.7mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere}.schedule-table thead th{background:#173952;color:#fff;font-weight:700}.schedule-table thead .day-column{width:5.8mm;background:#f1f5f7;color:#101b2d}.day-column span{display:block;font-size:5.5px;color:#5b6472}.day-column strong{display:block;margin-top:.4mm;font-size:7px}.schedule-table .metadata-column{width:14mm}.schedule-table .shift-name{width:34mm;text-align:start}.schedule-table .time{width:19mm}.schedule-table td{background:#fff}.schedule-table td.weekend,.schedule-table thead th.weekend{background:#e4eef1;color:#101b2d}.schedule-table td.highlighted{background:#f9e298}.schedule-table td.unresolved{background:#ffe4e6;color:#9f1239;font-weight:700}
.employee-directory{break-before:page;page-break-before:always;padding-top:2mm}.employee-directory h2{margin:0 0 4mm;color:#173952;font-size:16px}.employee-directory table{font-size:9px}.employee-directory th{background:#173952;color:#fff}.employee-directory th,.employee-directory td{border:1px solid #b8c7cd;padding:2mm}.employee-directory tbody tr:nth-child(even){background:#f1f5f7}
</style></head><body>${schedulePages}<section class="employee-directory"><h2>${labels.employees}</h2><table><thead><tr><th>No.</th><th>${labels.code}</th><th>${labels.name}</th></tr></thead><tbody>${employeeEntries}</tbody></table></section></body></html>`;
}

export function exportLateSchedulePdf(
  rows: OTShiftRow[],
  roster: UnifiedEmployee[],
  currentTitle: string,
  year: number,
  daysList: LateScheduleCalendarDay[],
  isRtl: boolean,
  notice = '',
): void {
  const html = buildLateSchedulePrintHtml(rows, roster, currentTitle, year, daysList, isRtl, notice);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = frame.contentDocument || win?.document;
  if (!win || !doc) {
    frame.remove();
    return;
  }
  const cleanup = () => frame.remove();
  win.addEventListener('afterprint', cleanup, { once: true });
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  }, 300);
}
