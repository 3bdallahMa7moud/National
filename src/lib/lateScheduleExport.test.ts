import { describe, expect, it } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/test/fixtures/officialEmployeeRoster';
import type { OTShiftRow } from '@/types/lateSchedule';
import type { UnifiedEmployee } from './unifiedEmployeeRoster';
import {
  buildLateScheduleExportModel,
  buildLateSchedulePrintHtml,
  buildLateScheduleWorkbook,
} from './lateScheduleExport';

describe('late schedule export colors', () => {
  it('keeps each OT shift background and text color in the model, Excel and print output', () => {
    const employee = OFFICIAL_EMPLOYEE_ROSTER[0];
    const rows: OTShiftRow[] = [{
      id: 'colored-ot-row',
      title: 'Colored OT',
      location: 'KAMC',
      timeRange: '17:00 - 21:00',
      hours: 4,
      backgroundColor: '#123456',
      textColor: '#FEDCBA',
      assignments: { 1: [{ kind: 'employee', employeeId: employee.employeeId }] },
    }];
    const days = [{ dayNum: 1, weekdayName: 'Wed', isWeekend: false }];

    expect(buildLateScheduleExportModel(rows, OFFICIAL_EMPLOYEE_ROSTER).rows[0]).toMatchObject({
      backgroundColor: '#123456',
      textColor: '#FEDCBA',
    });

    const workbook = buildLateScheduleWorkbook(rows, OFFICIAL_EMPLOYEE_ROSTER, 'JULY LATE SHIFT', 2026, 6, days);
    const sheet = workbook.getWorksheet('Late Roster')!;
    expect(sheet.getCell('A4').fill).toMatchObject({ fgColor: { argb: 'FF123456' } });
    expect(sheet.getCell('A4').font.color).toEqual({ argb: 'FFFEDCBA' });
    expect(sheet.getCell('E4').fill).toMatchObject({ fgColor: { argb: 'FF123456' } });
    expect(sheet.getCell('E4').font.color).toEqual({ argb: 'FFFEDCBA' });
    expect(sheet.getCell('E4').value).toBe(`${employee.code} · ${employee.fullNameEn || employee.fullName}`);

    const html = buildLateSchedulePrintHtml(rows, OFFICIAL_EMPLOYEE_ROSTER, 'JULY LATE SHIFT', 2026, 6, days, false);
    expect(html).toContain('style="background:#123456;color:#FEDCBA"');
    expect(html).toContain(employee.code);
    expect(html).toContain(employee.fullNameEn || employee.fullName);
  });

  it('uses employee names in export cells and never falls back to internal ids', () => {
    const rows: OTShiftRow[] = [{
      id: 'missing-roster-row',
      title: 'Missing roster',
      location: 'KAMC',
      timeRange: '17:00 - 21:00',
      hours: 4,
      assignments: { 1: [{ kind: 'employee', employeeId: 'internal-id-123' }] },
    }];

    const model = buildLateScheduleExportModel(rows, []);
    expect(model.rows[0].assignments[1][0]).toMatchObject({
      code: 'N/A',
      nameEn: 'Unknown employee',
      unresolved: true,
    });
  });

  it('preserves OT cell markers and unresolved legacy codes in Excel and PDF output', () => {
    const employee = OFFICIAL_EMPLOYEE_ROSTER[0];
    const rows: OTShiftRow[] = [{
      id: 'marked-ot-row',
      title: 'Marked OT',
      location: 'KAMC',
      timeRange: '17:00 - 21:00',
      hours: 4,
      cellMarkers: { 1: 'purple' },
      assignments: {
        1: [
          { kind: 'employee', employeeId: employee.employeeId },
          { kind: 'unresolved', legacyCode: 'LEG-9' },
        ],
      },
    }];
    const days = [{ dayNum: 1, weekdayName: 'Sat', isWeekend: true }];

    const model = buildLateScheduleExportModel(rows, [employee]);
    expect(model.roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: employee.code }),
      expect.objectContaining({ code: 'LEG-9', unresolved: true }),
    ]));

    const workbook = buildLateScheduleWorkbook(rows, [employee], 'AUGUST LATE SHIFT', 2026, 7, days);
    const schedule = workbook.getWorksheet('Late Roster')!;
    expect(schedule.pageSetup.paperSize).toBe(9);
    expect(schedule.getCell('E4').value).toContain('LEG-9? · Unresolved');
    expect(schedule.getCell('E4').fill).toMatchObject({ fgColor: { argb: 'FFE7D2FA' } });
    expect(schedule.getCell('E4').border.left).toMatchObject({
      style: 'medium',
      color: { argb: 'FF9333EA' },
    });

    const directory = workbook.getWorksheet('Employee Directory')!;
    const legacyRow = directory.getColumn(2).values.findIndex((value) => value === 'LEG-9?');
    expect(legacyRow).toBeGreaterThan(1);
    expect(directory.getCell(legacyRow, 4).value).toBe('Needs review');

    const html = buildLateSchedulePrintHtml(rows, [employee], 'AUGUST LATE SHIFT', 2026, 7, days, false);
    expect(html).toContain('<title>OT_Schedule_2026-08</title>');
    expect(html).toContain('background:#E7D2FA;box-shadow:inset 0 0 0 .7mm #9333EA');
    expect(html).toContain('LEG-9?');
    expect(html).toContain('Needs review');
  });

  it('creates multiple readable worksheets for long months and includes every assigned employee in the legend', () => {
    const roster: UnifiedEmployee[] = Array.from({ length: 31 }, (_, index) => ({
      employeeId: `employee-${index + 1}`,
      code: `E${String(index + 1).padStart(2, '0')}`,
      fullName: `Employee ${index + 1} AR`,
      fullNameEn: `Employee ${index + 1}`,
      origin: 'schedule',
      employeeNumber: `EMP-${String(index + 1).padStart(3, '0')}`,
    }));
    const days = Array.from({ length: 31 }, (_, index) => ({
      dayNum: index + 1,
      weekdayName: 'Mon',
      isWeekend: false,
    }));
    const rows: OTShiftRow[] = [{
      id: 'august-row',
      title: 'August OT',
      location: 'KAMC',
      timeRange: '17:00 - 21:00',
      hours: 4,
      assignments: Object.fromEntries(days.map((day, index) => [
        day.dayNum,
        [{ kind: 'employee', employeeId: roster[index].employeeId }],
      ])),
    }];

    const workbook = buildLateScheduleWorkbook(rows, roster, 'AUGUST LATE SHIFT', 2026, 7, days);
    const scheduleSheets = workbook.worksheets.filter((sheet) => sheet.name.startsWith('Late Roster'));
    expect(scheduleSheets).toHaveLength(4);
    expect(scheduleSheets[0].getCell('E4').value).toBe('E01 · Employee 1');
    expect(scheduleSheets[1].getCell('E4').value).toBe('E11 · Employee 11');
    expect(scheduleSheets[2].getCell('E4').value).toBe('E21 · Employee 21');
    expect(scheduleSheets[3].getCell('E4').value).toBe('E31 · Employee 31');

    const legendSheet = workbook.getWorksheet('Employee Directory')!;
    const legendNames = Array.from({ length: 31 }, (_, index) => legendSheet.getCell(`A${index + 2}`).value);
    const legendCodes = Array.from({ length: 31 }, (_, index) => legendSheet.getCell(`B${index + 2}`).value);
    expect(legendNames).toContain('Employee 31');
    expect(legendCodes).toContain('E31');

    const html = buildLateSchedulePrintHtml(rows, roster, 'AUGUST LATE SHIFT', 2026, 7, days, false);
    expect(html).toContain('Days: 1-10');
    expect(html).toContain('Employee 1');
    expect(html).not.toContain('employee-1');
  });
});
