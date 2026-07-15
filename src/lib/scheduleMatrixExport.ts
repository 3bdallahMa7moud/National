// ============================================================
// scheduleMatrixExport — PDF / Excel matching admin ScheduleMatrix
// ============================================================
// Same layout as the admin grid:
// [Facility band] | [UnitShiftLabel 3-line cell] | Day 1 … Day 31
// Vacations band at the bottom; legend on a separate PDF page.

import ExcelJS from 'exceljs';
import { resolveScheduleMatrixLocale } from '@/lib/scheduleMatrixLocale';
import { SHIFT_COLOR_PALETTE } from '@/lib/shiftColorPalette';
import { filterActiveScheduleRows } from '@/lib/scheduleMatrixArchive';
import type {
  Assignment,
  Facility,
  ScheduleMatrixData,
  ShiftColorKey,
  ShiftRow,
  VacationRow,
} from '@/types/scheduleMatrix';

export interface ScheduleMatrixExportLabels {
  title: string;
  unitShiftCol: string;
  vacationsBand: string;
  legendTitle: string;
  weekdayNames: string[];
  vacationTypes: Record<string, string>;
  vacationMark: string;
}

export interface ScheduleMatrixExportOptions {
  facilityFilter?: string;
  dir?: 'rtl' | 'ltr';
  monthName: string;
  year: number;
}

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FACILITY_COLORS: Record<string, string> = {
  'facility-kamc': '#101B2D',
  'facility-kasch': '#0B7285',
  'facility-whh': '#453653',
};

const CHIP_COLORS = Object.fromEntries(
  Object.entries(SHIFT_COLOR_PALETTE).map(([key, value]) => [
    key,
    { bg: value.light.background, text: value.light.text },
  ]),
) as Record<ShiftColorKey, { bg: string; text: string }>;

const BORDER_COLOR = '#D1D5DB';
const WEEKEND_TINT = '#F8FAFC';
const INK = '#101B2D';
const TEAL = '#0B7285';
const SLATE = '#64748B';
const CORAL = '#E2572B';
const PRINTABLE_WIDTH_PX = 1240;
const FACILITY_COL_W = 40;
const LABEL_COL_W = 190;

interface MatrixExportLayout {
  dayCell: number;
  headerRow: number;
  px: (value: number) => number;
  fs: (value: number) => number;
}

function buildMatrixExportLayout(daysInMonth: number): MatrixExportLayout {
  const dayCell = Math.max(28, Math.floor((PRINTABLE_WIDTH_PX - FACILITY_COL_W - LABEL_COL_W) / daysInMonth));
  const scale = dayCell / 56;
  const px = (value: number) => Math.max(1, Math.round(value * scale));
  const fs = (value: number) => Math.max(7, Math.round(value * scale));
  return { dayCell, headerRow: px(50), px, fs };
}

function getEnglishExportLabels(month: number, year: number): ScheduleMatrixExportLabels {
  const monthName = EN_MONTHS[month] || '';
  return {
    title: `Shift schedule for ${monthName} ${year} - King Abdulaziz Medical City`,
    unitShiftCol: 'Unit / Shift',
    vacationsBand: 'Vacations',
    legendTitle: 'Legend',
    weekdayNames: EN_WEEKDAYS,
    vacationTypes: { annual: 'Annual', sick: 'Sick', emergency: 'Emergency' },
    vacationMark: 'Vacation',
  };
}

function prepareEnglishExportData(data: ScheduleMatrixData): ScheduleMatrixData {
  return resolveScheduleMatrixLocale(data, 'en');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function filterMatrixForExport(
  data: ScheduleMatrixData,
  facilityFilter?: string,
): ScheduleMatrixData {
  const cloned = JSON.parse(JSON.stringify(data)) as ScheduleMatrixData;
  if (facilityFilter) {
    cloned.facilities = cloned.facilities.filter((f) => f.id === facilityFilter);
  }
  cloned.facilities.forEach((f) => {
    f.units = f.units
      .filter((u) => !u.archived)
      .map((u) => {
        const rows = filterActiveScheduleRows(cloned, f.id, u.rows);
        return rows === u.rows ? u : { ...u, rows };
      });
  });
  return cloned;
}

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay();
  return dow === 5 || dow === 6;
}

function holidayForDay(data: ScheduleMatrixData, day: number) {
  return data.holidays.find((holiday) => day >= holiday.startDay && day <= holiday.endDay);
}

function facilityColor(token: string): string {
  return FACILITY_COLORS[token] || '#374151';
}

function unitShiftLabelLines(row: ShiftRow, unitName: string) {
  return {
    primary: row.rowLabel || unitName,
    shift: row.shiftLabel,
    time: `${row.weekendOnly ? 'Fri/Sat · ' : ''}${row.timeRange}`,
  };
}

function formatCellCodes(assigns: Assignment[]): string {
  if (!assigns.length) return '';
  return assigns.map((a) => a.employeeCode).join('\n');
}

function rowChipStyle(row: Pick<ShiftRow, 'colorKey' | 'backgroundColor' | 'textColor'>) {
  const base = CHIP_COLORS[row.colorKey];
  return {
    bg: row.backgroundColor || base.bg,
    text: row.textColor || base.text,
  };
}

function renderLabelCellHtml(row: ShiftRow, unitName: string, layout: MatrixExportLayout): string {
  const { primary, shift, time } = unitShiftLabelLines(row, unitName);
  const bg = row.isOverflowRow ? '#F1F5F9' : '#F8FAFC';
  const { px, fs } = layout;
  return `<td style="border:1px solid ${BORDER_COLOR};background:${bg};padding:${px(6)}px ${px(10)}px;vertical-align:middle;width:${LABEL_COL_W}px;min-width:${LABEL_COL_W}px;">
    <div style="font-weight:700;font-size:${fs(12)}px;color:${INK};line-height:1.25;">${escapeHtml(primary)}</div>
    <div style="font-weight:600;font-size:${fs(11)}px;color:${TEAL};line-height:1.25;margin-top:${px(3)}px;">${escapeHtml(shift)}</div>
    <div style="font-weight:500;font-size:${fs(10)}px;color:${SLATE};line-height:1.25;margin-top:${px(2)}px;">${escapeHtml(time)}</div>
  </td>`;
}

function renderChipsHtml(assigns: Assignment[], row: ShiftRow, layout: MatrixExportLayout): string {
  if (!assigns.length) return '';
  const { px, fs } = layout;
  const rowChip = rowChipStyle(row);
  return assigns
    .map((a) => {
      return `<span style="display:block;margin:1px auto;padding:${px(2)}px ${px(6)}px;border-radius:${px(4)}px;border:1px solid ${BORDER_COLOR};background:${rowChip.bg};color:${rowChip.text};font-weight:700;font-size:${fs(10)}px;line-height:1.3;width:fit-content;min-width:${px(28)}px;text-align:center;">${escapeHtml(a.employeeCode)}</span>`;
    })
    .join('');
}

function renderDayCellHtml(
  row: ShiftRow,
  year: number,
  month: number,
  day: number,
  layout: MatrixExportLayout,
  holiday: boolean,
): string {
  const wknd = isWeekendDay(year, month, day);
  const emptyWeekdayOnCall = row.weekendOnly && !wknd;
  const bg = holiday ? '#FEF3C7' : wknd ? WEEKEND_TINT : '#FFFFFF';
  const assigns = row.cellsByDay[day] || [];
  const content = emptyWeekdayOnCall ? '' : renderChipsHtml(assigns, row, layout);
  const { dayCell, px } = layout;
  return `<td style="border:1px solid ${BORDER_COLOR};background:${bg};text-align:center;vertical-align:middle;padding:${px(2)}px;min-width:${dayCell}px;width:${dayCell}px;height:${dayCell}px;">${content}</td>`;
}

function renderVacationLabelHtml(vac: VacationRow, layout: MatrixExportLayout): string {
  const { px, fs } = layout;
  return `<td style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;padding:${px(6)}px ${px(10)}px;vertical-align:middle;width:${LABEL_COL_W}px;">
    <div style="font-weight:700;font-size:${fs(11)}px;color:${INK};">${escapeHtml(vac.fullName)}</div>
    <div style="font-weight:600;font-size:${fs(10)}px;color:${SLATE};margin-top:${px(2)}px;">${escapeHtml(vac.employeeCode)}</div>
  </td>`;
}

function renderVacationDayHtml(
  vac: VacationRow,
  year: number,
  month: number,
  day: number,
  layout: MatrixExportLayout,
  holiday: boolean,
): string {
  const wknd = isWeekendDay(year, month, day);
  const bg = holiday ? '#FEF3C7' : wknd ? WEEKEND_TINT : '#FFFFFF';
  const chip = CHIP_COLORS.vacation;
  const { dayCell, px, fs } = layout;
  const mark = vac.daysOff.includes(day)
    ? `<span style="display:inline-block;padding:${px(2)}px ${px(6)}px;border-radius:${px(4)}px;border:1px solid ${BORDER_COLOR};background:${chip.bg};color:${chip.text};font-weight:700;font-size:${fs(11)}px;">X</span>`
    : '';
  return `<td style="border:1px solid ${BORDER_COLOR};background:${bg};text-align:center;vertical-align:middle;min-width:${dayCell}px;width:${dayCell}px;height:${dayCell}px;">${mark}</td>`;
}

function facilityRowCount(facility: Facility): number {
  return facility.units.reduce((acc, u) => acc + u.rows.length, 0) || 1;
}

function renderFacilityBandCellHtml(
  facility: Facility,
  rowSpan: number,
  layout: MatrixExportLayout,
): string {
  const facColor = facilityColor(facility.accentColorToken);
  const { px, fs } = layout;
  return `<td rowspan="${rowSpan}" style="border:1px solid ${BORDER_COLOR};background:${facColor};color:#fff;text-align:center;vertical-align:middle;font-weight:700;font-size:${fs(11)}px;writing-mode:vertical-lr;transform:rotate(180deg);letter-spacing:0.08em;text-transform:uppercase;width:${FACILITY_COL_W}px;min-width:${FACILITY_COL_W}px;padding:${px(4)}px;">${escapeHtml(facility.name)}</td>`;
}

function renderVacationBandCellHtml(rowSpan: number, label: string, layout: MatrixExportLayout): string {
  const { px, fs } = layout;
  return `<td rowspan="${rowSpan}" style="border:1px solid ${BORDER_COLOR};background:#E2E8F0;color:#1E293B;text-align:center;vertical-align:middle;font-weight:700;font-size:${fs(10)}px;writing-mode:vertical-lr;transform:rotate(180deg);width:${FACILITY_COL_W}px;min-width:${FACILITY_COL_W}px;padding:${px(4)}px;">${escapeHtml(label)}</td>`;
}

function buildAdminMatrixTable(
  data: ScheduleMatrixData,
  labels: ScheduleMatrixExportLabels,
  year: number,
  month: number,
): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const layout = buildMatrixExportLayout(daysInMonth);
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;
  const { dayCell, headerRow, px, fs } = layout;

  let html = `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:${fs(10)}px;table-layout:fixed;">`;

  html += '<thead>';
  if (data.holidays.length > 0) {
    html += '<tr class="holiday-row">';
    html += `<th colspan="2" style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;"></th>`;
    for (let day = 1; day <= daysInMonth;) {
      const holiday = holidayForDay(data, day);
      if (holiday && holiday.startDay === day) {
        const span = Math.min(daysInMonth, holiday.endDay) - holiday.startDay + 1;
        html += `<th colspan="${span}" style="border:1px solid #D6A522;background:#FCD34D;color:#78350F;text-align:center;font-size:${fs(9)}px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;height:${px(18)}px;">${escapeHtml(holiday.label)}</th>`;
        day += span;
      } else {
        html += `<th style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;height:${px(18)}px;"></th>`;
        day += 1;
      }
    }
    html += '</tr>';
  }
  html += '<tr>';
  html += `<th style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;width:${FACILITY_COL_W}px;min-width:${FACILITY_COL_W}px;height:${headerRow}px;"></th>`;
  html += `<th style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;width:${LABEL_COL_W}px;min-width:${LABEL_COL_W}px;height:${headerRow}px;text-align:left;padding:${px(6)}px ${px(10)}px;font-size:${fs(10)}px;font-weight:600;color:${SLATE};">${escapeHtml(labels.unitShiftCol)}</th>`;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dow = new Date(year, month, day).getDay();
    const wknd = isWeekendDay(year, month, day);
    const isToday = day === todayDay;
    const holiday = holidayForDay(data, day);
    const weekdayColor = isToday ? TEAL : wknd ? CORAL : SLATE;
    const dayBg = holiday ? '#FEF3C7' : wknd ? WEEKEND_TINT : isToday ? 'rgba(11,114,133,0.08)' : '#FFFFFF';
    const dayNumStyle = isToday
      ? `background:${TEAL};color:#fff;width:${px(20)}px;height:${px(20)}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;`
      : `color:${INK};`;

    html += `<th style="border:1px solid ${BORDER_COLOR};background:${dayBg};min-width:${dayCell}px;width:${dayCell}px;height:${headerRow}px;text-align:center;vertical-align:middle;padding:${px(2)}px;">
      <div style="font-size:${fs(10)}px;font-weight:${wknd ? 600 : 500};color:${weekdayColor};">${EN_WEEKDAYS[dow]}</div>
      <div style="font-size:${fs(12)}px;font-weight:700;margin-top:${px(2)}px;${dayNumStyle}">${day}</div>
    </th>`;
  }
  html += '</tr></thead><tbody>';

  for (const facility of data.facilities) {
    const rowCount = facilityRowCount(facility);
    const facColor = facilityColor(facility.accentColorToken);
    let facilityRowIndex = 0;

    for (const unit of facility.units) {
      for (const row of unit.rows) {
        html += '<tr>';
        if (facilityRowIndex === 0) {
          html += renderFacilityBandCellHtml(facility, rowCount, layout);
        }
        html += renderLabelCellHtml(row, unit.name, layout);

        for (let day = 1; day <= daysInMonth; day += 1) {
          html += renderDayCellHtml(row, year, month, day, layout, !!holidayForDay(data, day));
        }

        html += '</tr>';
        facilityRowIndex += 1;
      }
    }

    if (facility.units.length === 0) {
      html += '<tr>';
      html += `<td style="border:1px solid ${BORDER_COLOR};background:${facColor};color:#fff;text-align:center;vertical-align:middle;font-weight:700;font-size:${fs(11)}px;writing-mode:vertical-lr;transform:rotate(180deg);width:${FACILITY_COL_W}px;">${escapeHtml(facility.name)}</td>`;
      html += `<td style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;padding:${px(6)}px ${px(10)}px;">—</td>`;
      for (let day = 1; day <= daysInMonth; day += 1) {
        html += `<td style="border:1px solid ${BORDER_COLOR};background:${isWeekendDay(year, month, day) ? WEEKEND_TINT : '#fff'};"></td>`;
      }
      html += '</tr>';
    }
  }

  if (data.vacations.length > 0) {
    data.vacations.forEach((vac, idx) => {
      html += '<tr>';
      if (idx === 0) {
        html += renderVacationBandCellHtml(data.vacations.length, labels.vacationsBand, layout);
      }
      html += renderVacationLabelHtml(vac, layout);
      for (let day = 1; day <= daysInMonth; day += 1) {
        html += renderVacationDayHtml(vac, year, month, day, layout, !!holidayForDay(data, day));
      }
      html += '</tr>';
    });
  }

  html += '</tbody></table>';
  return html;
}

function buildLegendPageHtml(data: ScheduleMatrixData, labels: ScheduleMatrixExportLabels): string {
  if (!data.legend.length) return '';

  let html = `<table class="legend-table" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:720px;font-family:Segoe UI,Arial,sans-serif;font-size:11px;border:1px solid ${BORDER_COLOR};">`;
  html += `<caption style="caption-side:top;text-align:left;font-weight:800;font-size:16px;padding:0 0 12px;color:${TEAL};">${escapeHtml(labels.legendTitle)}</caption>`;
  html += '<thead><tr>';
  html += `<th style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;padding:8px 10px;width:48px;text-align:center;">#</th>`;
  html += `<th style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;padding:8px 10px;width:64px;text-align:left;">Code</th>`;
  html += `<th style="border:1px solid ${BORDER_COLOR};background:#F8FAFC;padding:8px 10px;text-align:left;">Name</th>`;
  html += '</tr></thead><tbody>';

  data.legend.forEach((entry, index) => {
    html += '<tr>';
    html += `<td style="border:1px solid ${BORDER_COLOR};padding:6px 10px;text-align:center;color:${SLATE};">${index + 1}</td>`;
    html += `<td style="border:1px solid ${BORDER_COLOR};padding:6px 10px;font-weight:800;color:${INK};">${escapeHtml(entry.code)}</td>`;
    html += `<td style="border:1px solid ${BORDER_COLOR};padding:6px 10px;font-weight:500;color:${INK};">${escapeHtml(entry.fullName)}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

export function buildScheduleMatrixExportHtml(
  data: ScheduleMatrixData,
  labels: ScheduleMatrixExportLabels,
  options: ScheduleMatrixExportOptions,
): string {
  const englishData = prepareEnglishExportData(data);
  const filtered = filterMatrixForExport(englishData, options.facilityFilter);
  const matrixTable = buildAdminMatrixTable(filtered, labels, options.year, filtered.month)
    .replace(/^<table/, '<table class="matrix-table"');
  const legendPage = buildLegendPageHtml(filtered, labels);

  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(labels.title)}</title>
<style>
  @page { size: A3 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; color: ${INK}; background: #fff; direction: ltr; font-family: Segoe UI, Arial, sans-serif; }
  .legend-table {
    width: 100%;
    max-width: none;
    font-size: 8px !important;
  }
  .schedule-page {
    padding: 5mm;
  }
  .export-header {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    text-align: center;
  }
  .export-header img {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .schedule-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    align-items: start;
    gap: 8px;
    zoom: .62;
  }
  .export-title {
    font-size: 15px;
    font-weight: 800;
    padding: 0;
    margin: 0;
    color: ${TEAL};
  }
  .matrix-table {
    width: 100%;
    border-collapse: collapse;
  }
  @media print {
    html, body { width: 100%; height: auto; margin: 0; padding: 0; overflow: hidden; }
    .schedule-page {
      page-break-before: avoid;
      break-before: avoid-page;
      page-break-after: avoid;
      break-after: avoid-page;
    }
    .export-title {
      page-break-after: avoid;
      break-after: avoid-page;
    }
    table { page-break-inside: auto; }
    .matrix-table tbody tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    td, th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
  <section class="schedule-page">
    <header class="export-header">
      <img src="/mngha-logo.png" alt="National Guard Hospital" />
      <div class="export-title">${escapeHtml(labels.title)}</div>
      <img src="/ct-logo.png" alt="CT Department" />
    </header>
    <div class="schedule-layout">
      <div>${matrixTable}</div>
      <aside>${legendPage}</aside>
    </div>
  </section>
</body>
</html>`;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };
}

function hexArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

function styleHeaderCell(cell: ExcelJS.Cell, weekday: string, day: number, wknd: boolean, isToday: boolean) {
  cell.value = `${weekday}\n${day}`;
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = thinBorder();
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hexArgb(wknd ? WEEKEND_TINT : isToday ? 'EBF5F7' : '#FFFFFF') },
  };
  cell.font = { size: 10, bold: true, color: { argb: hexArgb(wknd ? CORAL : isToday ? TEAL : INK) } };
}

function styleLabelCell(cell: ExcelJS.Cell, row: ShiftRow, unitName: string) {
  const { primary, shift, time } = unitShiftLabelLines(row, unitName);
  cell.value = `${primary}\n${shift}\n${time}`;
  cell.alignment = { vertical: 'middle', wrapText: true };
  cell.border = thinBorder();
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hexArgb(row.isOverflowRow ? '#F1F5F9' : '#F8FAFC') },
  };
  cell.font = { size: 10, color: { argb: hexArgb(INK) } };
}

function styleDayCell(
  cell: ExcelJS.Cell,
  assigns: Assignment[],
  row: Pick<ShiftRow, 'colorKey' | 'backgroundColor' | 'textColor'>,
  wknd: boolean,
  empty: boolean,
  holiday: boolean,
) {
  cell.border = thinBorder();
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  if (empty) {
    cell.value = '';
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb(holiday ? '#FEF3C7' : wknd ? WEEKEND_TINT : '#FFFFFF') } };
    return;
  }

  const chip = rowChipStyle(row);
  cell.value = formatCellCodes(assigns);
  cell.font = { bold: true, size: 10, color: { argb: hexArgb(chip.text) } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hexArgb(assigns.length ? chip.bg : holiday ? '#FEF3C7' : wknd ? WEEKEND_TINT : '#FFFFFF') },
  };
}

export async function buildScheduleMatrixWorkbook(
  data: ScheduleMatrixData,
  labels: ScheduleMatrixExportLabels,
  year: number,
  month: number,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const headerRowNumber = data.holidays.length > 0 ? 2 : 1;
  const sheet = wb.addWorksheet('Schedule Matrix', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: headerRowNumber }],
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 28;
  for (let d = 0; d < daysInMonth; d += 1) {
    sheet.getColumn(3 + d).width = 8;
  }

  if (data.holidays.length > 0) {
    const holidayCorner = sheet.getCell(1, 1);
    holidayCorner.border = thinBorder();
    holidayCorner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#F8FAFC') } };
    sheet.mergeCells(1, 1, 1, 2);

    for (let day = 1; day <= daysInMonth;) {
      const holiday = holidayForDay(data, day);
      const column = 2 + day;
      if (holiday && holiday.startDay === day) {
        const endDay = Math.min(daysInMonth, holiday.endDay);
        sheet.mergeCells(1, column, 1, 2 + endDay);
        const cell = sheet.getCell(1, column);
        cell.value = holiday.label;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true, size: 9, color: { argb: hexArgb('#78350F') } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#FCD34D') } };
        cell.border = thinBorder();
        day = endDay + 1;
      } else {
        const cell = sheet.getCell(1, column);
        cell.border = thinBorder();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#F8FAFC') } };
        day += 1;
      }
    }
    sheet.getRow(1).height = 18;
  }

  const cornerA = sheet.getCell(headerRowNumber, 1);
  cornerA.border = thinBorder();
  cornerA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#F8FAFC') } };

  const cornerB = sheet.getCell(headerRowNumber, 2);
  cornerB.value = labels.unitShiftCol;
  cornerB.font = { size: 10, bold: true, color: { argb: hexArgb(SLATE) } };
  cornerB.alignment = { vertical: 'middle' };
  cornerB.border = thinBorder();
  cornerB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#F8FAFC') } };

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dow = new Date(year, month, day).getDay();
    styleHeaderCell(
      sheet.getCell(headerRowNumber, 2 + day),
      EN_WEEKDAYS[dow],
      day,
      isWeekendDay(year, month, day),
      day === todayDay,
    );
  }
  sheet.getRow(headerRowNumber).height = 36;

  let rowNum = headerRowNumber + 1;

  for (const facility of data.facilities) {
    const rowCount = facilityRowCount(facility);
    const startRow = rowNum;
    const facColor = facilityColor(facility.accentColorToken);

    if (rowCount > 0) {
      sheet.mergeCells(startRow, 1, startRow + rowCount - 1, 1);
      const facCell = sheet.getCell(startRow, 1);
      facCell.value = facility.name;
      facCell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      facCell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
      facCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb(facColor) } };
      facCell.border = thinBorder();
    }

    for (const unit of facility.units) {
      for (const row of unit.rows) {
        styleLabelCell(sheet.getCell(rowNum, 2), row, unit.name);
        sheet.getRow(rowNum).height = 42;

        for (let day = 1; day <= daysInMonth; day += 1) {
          const wknd = isWeekendDay(year, month, day);
          const emptyOnCall = row.weekendOnly && !wknd;
          styleDayCell(
            sheet.getCell(rowNum, 2 + day),
            row.cellsByDay[day] || [],
            row,
            wknd,
            emptyOnCall,
            !!holidayForDay(data, day),
          );
        }
        rowNum += 1;
      }
    }
  }

  if (data.vacations.length > 0) {
    const vacStart = rowNum;
    sheet.mergeCells(vacStart, 1, vacStart + data.vacations.length - 1, 1);
    const vacBand = sheet.getCell(vacStart, 1);
    vacBand.value = labels.vacationsBand;
    vacBand.font = { bold: true, size: 9, color: { argb: hexArgb('#1E293B') } };
    vacBand.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
    vacBand.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#E2E8F0') } };
    vacBand.border = thinBorder();

    for (const vac of data.vacations) {
      const labelCell = sheet.getCell(rowNum, 2);
      labelCell.value = `${vac.fullName}\n${vac.employeeCode}`;
      labelCell.alignment = { vertical: 'middle', wrapText: true };
      labelCell.border = thinBorder();
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb('#F8FAFC') } };
      labelCell.font = { size: 10, bold: true, color: { argb: hexArgb(INK) } };
      sheet.getRow(rowNum).height = 42;

      const chip = CHIP_COLORS.vacation;
      for (let day = 1; day <= daysInMonth; day += 1) {
        const wknd = isWeekendDay(year, month, day);
        const cell = sheet.getCell(rowNum, 2 + day);
        cell.border = thinBorder();
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: hexArgb(holidayForDay(data, day) ? '#FEF3C7' : wknd ? WEEKEND_TINT : '#FFFFFF') },
        };
        if (vac.daysOff.includes(day)) {
          cell.value = 'X';
          cell.font = { bold: true, size: 11, color: { argb: hexArgb(chip.text) } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexArgb(chip.bg) } };
        }
      }
      rowNum += 1;
    }
  }

  if (data.legend.length > 0) {
    const legendSheet = wb.addWorksheet('Legend');
    legendSheet.getColumn(1).width = 6;
    legendSheet.getColumn(2).width = 8;
    legendSheet.getColumn(3).width = 30;
    legendSheet.getCell(1, 1).value = labels.legendTitle;
    legendSheet.mergeCells(1, 1, 1, 3);
    legendSheet.getCell(1, 1).font = { bold: true, size: 11 };

    data.legend.forEach((entry, index) => {
      const r = index + 2;
      legendSheet.getCell(r, 1).value = index + 1;
      legendSheet.getCell(r, 2).value = entry.code;
      legendSheet.getCell(r, 2).font = { bold: true };
      legendSheet.getCell(r, 3).value = entry.fullName;
    });
  }

  return wb;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportScheduleMatrixToExcel(
  data: ScheduleMatrixData,
  _labels: ScheduleMatrixExportLabels,
  options: ScheduleMatrixExportOptions,
): void {
  const enLabels = getEnglishExportLabels(data.month, options.year);
  const englishData = prepareEnglishExportData(data);
  const filtered = filterMatrixForExport(englishData, options.facilityFilter);
  const filename = `Schedule_Matrix_${options.year}_${String(data.month + 1).padStart(2, '0')}.xlsx`;

  void buildScheduleMatrixWorkbook(filtered, enLabels, options.year, filtered.month).then((wb) =>
    wb.xlsx.writeBuffer().then((buffer) => downloadBuffer(buffer, filename)),
  );
}

export function printScheduleMatrixPdf(
  data: ScheduleMatrixData,
  _labels: ScheduleMatrixExportLabels,
  options: ScheduleMatrixExportOptions,
): void {
  const A3_LANDSCAPE_W = 1587;
  const enLabels = getEnglishExportLabels(data.month, options.year);
  const englishData = prepareEnglishExportData(data);
  const filtered = filterMatrixForExport(englishData, options.facilityFilter);

  if (filtered.facilities.length === 1) {
    enLabels.title = `${enLabels.title} — ${filtered.facilities[0].name}`;
  }

  const html = buildScheduleMatrixExportHtml(filtered, enLabels, { ...options, dir: 'ltr' });
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A3_LANDSCAPE_W}px;height:auto;border:none;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = frame.contentDocument || win?.document;
  if (!doc || !win) {
    frame.remove();
    return;
  }

  const cleanup = () => {
    win.removeEventListener('afterprint', cleanup);
    frame.remove();
  };

  win.addEventListener('afterprint', cleanup, { once: true });

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      const bodyHeight = doc.body.scrollHeight;
      doc.documentElement.style.height = `${bodyHeight}px`;
      doc.documentElement.style.overflow = 'hidden';
      doc.body.style.height = `${bodyHeight}px`;
      doc.body.style.overflow = 'hidden';
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(triggerPrint, 150);
    });
  });

  window.setTimeout(cleanup, 60_000);
}

export function buildScheduleMatrixExportLabels(
  t: (key: string, options?: Record<string, unknown>) => string,
  monthName: string,
  year: number,
): ScheduleMatrixExportLabels {
  const weekdayList = [0, 1, 2, 3, 4, 5, 6].map((index) => t(`common:calendar.weekdays.${index}`));
  return {
    title: t('schedule:reports.export.title', { month: monthName, year }),
    unitShiftCol: t('schedule:matrix.unitShiftLabel'),
    vacationsBand: t('schedule:matrix.vacationsBand'),
    legendTitle: t('schedule:matrix.legendTitle'),
    weekdayNames: weekdayList,
    vacationTypes: {
      annual: t('schedule:vacationsPanel.types.annual'),
      sick: t('schedule:vacationsPanel.types.sick'),
      emergency: t('schedule:vacationsPanel.types.emergency'),
    },
    vacationMark: t('schedule:matrix.vacation'),
  };
}

export function getEnglishMonthName(month: number): string {
  return EN_MONTHS[month] || '';
}
