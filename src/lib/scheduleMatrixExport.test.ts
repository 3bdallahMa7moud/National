import { describe, expect, it } from 'vitest';
import { createScheduleMatrixFixture } from '@/test/fixtures/scheduleMatrix';
import {
  buildScheduleMatrixExportHtml,
  type ScheduleMatrixExportLabels,
} from './scheduleMatrixExport';

const labels: ScheduleMatrixExportLabels = {
  title: 'Shift schedule for August 2026 - Specialized Medical Center',
  unitShiftCol: 'Unit / Shift',
  vacationsBand: 'Vacations',
  legendTitle: 'Legend',
  weekdayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  vacationTypes: { annual: 'Annual', sick: 'Sick', emergency: 'Emergency' },
  vacationMark: 'Vacation',
};

describe('schedule matrix PDF export HTML', () => {
  it('keeps the matrix full-width and moves the legend to its own print page', () => {
    const data = createScheduleMatrixFixture(2026, 7);
    const html = buildScheduleMatrixExportHtml(data, labels, {
      monthName: 'August',
      year: 2026,
    });

    expect(html).toContain('<div class="matrix-shell"><table class="matrix-table"');
    expect(html).toContain('<section class="legend-page"><table class="legend-table"');
    expect(html).toContain('page-break-before: always');
    expect(html).toContain('overflow: visible');
    expect(html).not.toContain('grid-template-columns: minmax(0, 1fr) 220px');
    expect(html).not.toContain('overflow: hidden');
  });
});
