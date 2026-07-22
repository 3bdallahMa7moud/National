import { describe, expect, it } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import type { OTShiftRow } from '@/types/lateSchedule';
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

    const html = buildLateSchedulePrintHtml(rows, OFFICIAL_EMPLOYEE_ROSTER, 'JULY LATE SHIFT', 2026, days, false);
    expect(html).toContain('style="background:#123456;color:#FEDCBA"');
    expect(html).toContain(employee.code);
  });
});
