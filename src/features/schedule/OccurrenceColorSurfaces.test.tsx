import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EmployeeNextShiftCard from '@/features/dashboard/EmployeeNextShiftCard';
import EmployeeWeekAgenda from '@/features/dashboard/EmployeeWeekAgenda';
import EmployeeProfileOverview from '@/features/employees/EmployeeProfileOverview';
import type { DepartmentScheduleView, EmployeeScheduleView } from '@/types/employeeScheduleView';
import type { OperationalOccurrence } from '@/types/operationalSchedule';
import DepartmentScheduleDesktop from './DepartmentScheduleDesktop';
import DepartmentScheduleMobile from './DepartmentScheduleMobile';
import EmployeeScheduleMonth from './EmployeeScheduleMonth';
import EmployeeScheduleWeek from './EmployeeScheduleWeek';

const occurrence: OperationalOccurrence = {
  id: 'custom-color-occurrence',
  date: '2026-07-01',
  source: 'schedule',
  employeeId: 'employee-1',
  employeeCode: 'E1',
  employeeName: 'Employee One',
  unresolvedEmployee: false,
  category: 'day',
  colorKey: 'morning',
  backgroundColor: '#7C3AED',
  textColor: '#FFFFFF',
  label: 'Day Shift',
  facility: 'KAMC',
  unit: 'GE VCT',
  timeRange: '08:00 - 17:00',
  hours: 9,
  rowId: 'row-1',
  hasConflict: false,
  isOnApprovedVacation: false,
};

const employeeView: EmployeeScheduleView = {
  employeeId: 'employee-1',
  period: { startDate: '2026-07-01', endDate: '2026-07-01' },
  availability: 'available',
  nextShift: occurrence,
  occurrences: [occurrence],
  days: [{ date: occurrence.date, occurrences: [occurrence] }],
  totals: { day: 1, late: 0, night: 0, onCallDay: 0, onCallNight: 0, ot: 0, otHours: 0 },
  notices: [],
};

const departmentView: DepartmentScheduleView = {
  period: employeeView.period,
  availability: 'available',
  occurrences: [occurrence],
  facilities: ['KAMC'],
  days: [{ date: occurrence.date, groups: [{ category: 'day', occurrences: [occurrence] }] }],
};

function expectCustomColor(container: HTMLElement) {
  const colored = container.querySelector<HTMLElement>(`[data-occurrence-color="${occurrence.id}"]`);
  expect(colored).toHaveStyle({ backgroundColor: '#7C3AED', color: '#FFFFFF' });
}

afterEach(cleanup);

describe('operational color surfaces', () => {
  it('colors employee week and month assignments from the occurrence', () => {
    let result = render(<EmployeeScheduleWeek days={employeeView.days} locale="en-US" onSelect={() => undefined} />);
    expectCustomColor(result.container);
    cleanup();

    result = render(<EmployeeScheduleMonth days={employeeView.days} locale="en-US" onSelect={() => undefined} />);
    expectCustomColor(result.container);
  });

  it('colors department desktop and mobile assignments from the occurrence', () => {
    let result = render(<DepartmentScheduleDesktop view={departmentView} locale="en-US" />);
    expectCustomColor(result.container);
    cleanup();

    result = render(<DepartmentScheduleMobile view={departmentView} locale="en-US" />);
    expectCustomColor(result.container);
  });

  it('colors dashboard and profile next-shift surfaces from the occurrence', () => {
    let result = render(<EmployeeNextShiftCard occurrence={occurrence} locale="en-US" />);
    expectCustomColor(result.container);
    cleanup();

    result = render(<EmployeeWeekAgenda days={employeeView.days} locale="en-US" />);
    expectCustomColor(result.container);
    cleanup();

    result = render(
      <MemoryRouter>
        <EmployeeProfileOverview month={employeeView} week={employeeView} />
      </MemoryRouter>,
    );
    expectCustomColor(result.container);
  });
});
