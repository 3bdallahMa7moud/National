import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_EMPLOYEE_ROSTER } from '@/data/officialEmployeeRoster';
import type { UnifiedEmployee } from '@/lib/unifiedEmployeeRoster';
import type { OTShiftRow } from '@/types/lateSchedule';
import PublishedScheduleExportActions from './PublishedScheduleExportActions';

const exportMocks = vi.hoisted(() => ({
  excel: vi.fn(async () => undefined),
  pdf: vi.fn(),
}));

vi.mock('@/lib/lateScheduleExport', () => ({
  exportLateScheduleExcel: exportMocks.excel,
  exportLateSchedulePdf: exportMocks.pdf,
}));

afterEach(() => {
  cleanup();
  exportMocks.excel.mockClear();
  exportMocks.pdf.mockClear();
});

describe('PublishedScheduleExportActions', () => {
  it('exports every projected OT assignment in persisted unit order', async () => {
    const employee = OFFICIAL_EMPLOYEE_ROSTER[0];
    render(
      <PublishedScheduleExportActions
        tab="ot"
        year={2027}
        month={0}
        matrix={null}
        roster={[employee]}
        otTable={{
          units: [{ id: 'unit-first', name: 'First' }, { id: 'unit-second', name: 'Second' }],
          rows: [
            { id: 'row-second', unitId: 'unit-second', title: 'Second', location: 'B', timeRange: '17:00 - 21:00', hours: 4, assignments: { 2: [{ kind: 'employee', employeeId: employee.employeeId }] } },
            { id: 'row-first', unitId: 'unit-first', title: 'First', location: 'A', timeRange: '08:00 - 17:00', hours: 9, assignments: { 1: [{ kind: 'employee', employeeId: employee.employeeId }] } },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => expect(exportMocks.excel).toHaveBeenCalledTimes(1));
    const [rows, roster] = exportMocks.excel.mock.calls[0] as unknown as [OTShiftRow[], UnifiedEmployee[]];
    expect(rows.map((row: { id: string }) => row.id)).toEqual(['row-first', 'row-second']);
    expect(rows[0].assignments[1]).toHaveLength(1);
    expect(roster).toEqual([employee]);
  });

  it('disables both export formats when the selected published table is unavailable', () => {
    render(
      <PublishedScheduleExportActions
        tab="schedule"
        year={2027}
        month={0}
        matrix={null}
        otTable={null}
        roster={[]}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
