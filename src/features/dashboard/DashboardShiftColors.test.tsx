import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { CoverageMetric, DailyShiftGroup } from '@/types/operationalDashboard';
import TodayCoverageCards from './TodayCoverageCards';
import TodayShiftGroups from './TodayShiftGroups';

const metric: CoverageMetric = {
  category: 'day',
  assignedEmployees: 1,
  assignments: 1,
  expectedSlots: 1,
  coveredSlots: 1,
  uncoveredSlots: 0,
  hours: null,
  scheduledRows: 1,
  conflicts: 0,
  approvedAbsences: 0,
  shiftColors: [{ colorKey: 'morning', backgroundColor: '#7C3AED', textColor: '#FFFFFF' }],
};

const group: DailyShiftGroup = {
  category: 'day',
  assignmentCount: 1,
  issueCount: 0,
  items: [{
    id: 'dashboard-colored-item',
    source: 'schedule',
    category: 'day',
    subcategory: 'day',
    colorKey: 'morning',
    backgroundColor: '#7C3AED',
    textColor: '#FFFFFF',
    employeeId: 'employee-1',
    employeeCode: 'E1',
    employeeName: 'Employee One',
    facility: 'KAMC',
    unit: 'GE VCT',
    label: 'Day Shift',
    timeRange: '08:00 - 17:00',
    hours: 9,
    rowId: 'row-1',
    day: 1,
    uncovered: false,
    unresolvedEmployee: false,
    hasConflict: false,
    isOnApprovedVacation: false,
    href: '/admin/schedule',
  }],
};

describe('dashboard shift colors', () => {
  it('renders the published metric color on coverage cards', () => {
    const { container } = render(
      <TodayCoverageCards
        metrics={[metric]}
        hasPublishedSchedule
        selectedCategory={null}
        onSelect={() => undefined}
      />,
    );
    const accent = container.querySelector<HTMLElement>('[data-coverage-shift-color="day"]');
    expect(accent?.style.background).toContain('124, 58, 237');
  });

  it('renders the published row color while keeping item status separate', () => {
    const { container } = render(
      <MemoryRouter>
        <TodayShiftGroups groups={[group]} selectedCategory={null} />
      </MemoryRouter>,
    );
    const accent = container.querySelector<HTMLElement>('[data-item-shift-color="dashboard-colored-item"]');
    expect(accent).toHaveStyle({ backgroundColor: '#7C3AED' });
  });
});
