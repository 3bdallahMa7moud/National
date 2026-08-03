import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeeCombobox } from './EmployeeCombobox';

afterEach(cleanup);

describe('EmployeeCombobox assignment availability', () => {
  it('marks vacation employees and prevents selecting them', () => {
    const onChange = vi.fn();
    render(
      <EmployeeCombobox
        label="Primary"
        legend={[{ employeeId: 'emp-1', code: 'EMP1', fullName: 'Employee One' }]}
        value={null}
        onChange={onChange}
        onValidate={() => ({
          ok: false,
          conflict: {
            day: 15,
            type: 'vacation',
            reason: 'Employee has an approved vacation on this day',
          },
        })}
      />,
    );

    fireEvent.click(screen.getByPlaceholderText('Search by code or name...'));

    const vacationBadge = screen.getByText('Vacation');
    const employeeButton = vacationBadge.closest('button');
    expect(employeeButton).toBeDisabled();
    fireEvent.click(employeeButton!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows selecting an employee with a shift conflict', () => {
    const onChange = vi.fn();
    render(
      <EmployeeCombobox
        label="Primary"
        legend={[{ employeeId: 'emp-2', code: 'EMP2', fullName: 'Employee Two' }]}
        value={null}
        onChange={onChange}
        onValidate={() => ({
          ok: false,
          conflict: {
            day: 15,
            type: 'timeOverlap',
            reason: 'Employee already has an overlapping shift',
          },
        })}
      />,
    );

    fireEvent.click(screen.getByPlaceholderText('Search by code or name...'));
    const employeeButton = screen.getByRole('button', { name: /EMP2/ });
    expect(employeeButton).toBeEnabled();
    fireEvent.click(employeeButton);
    expect(onChange).toHaveBeenCalledWith('EMP2');
  });
});
