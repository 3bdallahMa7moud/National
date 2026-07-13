import ExcelJS from 'exceljs';
import type { EmployeeAnalysisRow } from './employeeAnalysis';
import type { AnalysisCoverage, AnalysisPeriod } from './analysisPeriod';

export interface EmployeeWorkloadRow extends EmployeeAnalysisRow {
  id: string;
  name: string;
  code: string;
  department: string;
  morning: number;
  evening: number;
  night: number;
  weekend: number;
  oncall: number;
  overtimeHours: number;
  otShifts: number;
  vacationDays: number;
  totalShifts: number;
  workloadStatus: 'balanced' | 'high' | 'under';
}

export interface EmployeeAnalysisExportContext {
  period: AnalysisPeriod;
  coverage: AnalysisCoverage;
  isRtl: boolean;
}

export function buildEmployeeAnalysisExportRows(rows: EmployeeWorkloadRow[]): Array<Array<string | number>> {
  return rows.map((row) => [
    row.name,
    row.code,
    row.day,
    row.late,
    row.night,
    row.onCallDay,
    row.onCallNight,
    row.matrixOTShifts,
    row.otScheduleShifts,
    row.otScheduleHours,
    row.vacationDays,
    row.totalScheduledAssignments,
    row.source,
  ]);
}

function coverageText(context: EmployeeAnalysisExportContext): string {
  const { availableMonths, requiredMonths } = context.coverage;
  return context.isRtl
    ? `${availableMonths}/${requiredMonths} أشهر متاحة`
    : `${availableMonths}/${requiredMonths} available months`;
}

export function buildEmployeeAnalysisExportFilename(
  period: AnalysisPeriod,
  extension: 'xlsx' | 'pdf',
): string {
  return `Employee_Analytics_${period.granularity}_${period.startDate}_to_${period.endDate}.${extension}`;
}

export function buildEmployeeAnalysisWorkbook(
  rows: EmployeeWorkloadRow[],
  context: EmployeeAnalysisExportContext,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT Scan Department — National Hospital';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Employee Workload Analysis', {
    views: [{ activeCell: 'A4', rightToLeft: context.isRtl }],
  });

  worksheet.mergeCells('A1:M1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `CT SCAN DEPARTMENT — Employee Analytics & Workload (${context.period.label})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells('A2:M2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `${coverageText(context)} · ${context.period.startDate} — ${context.period.endDate}`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 22;

  const headers = [
    'Employee Name',
    'Abbreviation',
    'Day',
    'Late',
    'Night',
    'On-call Day',
    'On-call Night',
    'Matrix OT',
    'OT Schedule Shifts',
    'OT Hours',
    'Vacation Days',
    'Total Assignments',
    'Source',
  ];
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F766E' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  buildEmployeeAnalysisExportRows(rows).forEach((values) => {
    const row = worksheet.addRow(values);
    row.height = 24;
    row.eachCell((cell, columnIndex) => {
      cell.font = { name: 'Calibri', size: 11, bold: columnIndex === 1 || columnIndex === 2 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnIndex === 1 ? 'left' : 'center',
      };
    });
  });

  worksheet.getColumn(1).width = 28;
  worksheet.getColumn(2).width = 12;
  for (let column = 3; column <= 13; column += 1) {
    worksheet.getColumn(column).width = column === 13 ? 14 : 15;
  }
  worksheet.pageSetup = {
    ...worksheet.pageSetup,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:3',
  };

  return workbook;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportEmployeeAnalysisExcel(
  rows: EmployeeWorkloadRow[],
  context: EmployeeAnalysisExportContext,
): Promise<void> {
  const workbook = buildEmployeeAnalysisWorkbook(rows, context);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, buildEmployeeAnalysisExportFilename(context.period, 'xlsx'));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildEmployeeAnalysisPdfHtml(
  rows: EmployeeWorkloadRow[],
  context: EmployeeAnalysisExportContext,
): string {
  const dir = context.isRtl ? 'rtl' : 'ltr';
  const title = context.isRtl ? 'تحليل الموظفين وتوزيع الأحمال' : 'Employee Analytics & Workload';
  const suggestedFilename = buildEmployeeAnalysisExportFilename(context.period, 'pdf').replace(/\.pdf$/, '');
  const headers = context.isRtl
    ? ['الموظف', 'الاختصار', 'الشفت النهاري', 'المتأخر', 'الليلي', 'استدعاء نهاري', 'استدعاء ليلي', 'OT في الجدول', 'شفتات جدول OT', 'ساعات OT', 'أيام الإجازة', 'إجمالي التعيينات', 'المصدر']
    : ['Employee', 'Abbreviation', 'Day', 'Late', 'Night', 'On-call Day', 'On-call Night', 'Matrix OT', 'OT Schedule Shifts', 'OT Hours', 'Vacation Days', 'Total Assignments', 'Source'];

  return `<!DOCTYPE html>
    <html dir="${dir}" lang="${context.isRtl ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(suggestedFilename)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: Arial, "Noto Sans Arabic", sans-serif; color: #1e293b; margin: 0; font-size: 9px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
          h1 { margin: 0 0 4px; font-size: 16px; color: #0f172a; }
          .coverage { color: #475569; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 3px; text-align: center; overflow-wrap: anywhere; }
          th { background: #0d9488; color: white; font-weight: 700; }
          td:first-child { text-align: start; font-weight: 700; }
          tbody tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CT SCAN DEPARTMENT — ${escapeHtml(title)} (${escapeHtml(context.period.label)})</h1>
          <div class="coverage">${escapeHtml(coverageText(context))} · ${context.period.startDate} — ${context.period.endDate}</div>
        </div>
        <table>
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>
              <td>${escapeHtml(row.name)}</td>
              <td><strong>${escapeHtml(row.code)}</strong></td>
              <td>${row.day}</td>
              <td>${row.late}</td>
              <td>${row.night}</td>
              <td>${row.onCallDay}</td>
              <td>${row.onCallNight}</td>
              <td>${row.matrixOTShifts}</td>
              <td>${row.otScheduleShifts}</td>
              <td>${row.otScheduleHours}</td>
              <td>${row.vacationDays}</td>
              <td><strong>${row.totalScheduledAssignments}</strong></td>
              <td>${escapeHtml(row.source)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>`;
}

export function exportEmployeeAnalysisPdf(
  rows: EmployeeWorkloadRow[],
  context: EmployeeAnalysisExportContext,
): void {
  const html = buildEmployeeAnalysisPdfHtml(rows, context);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:auto;border:none;visibility:hidden;';
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
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  }, 300);
}
