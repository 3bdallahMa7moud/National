# Vacation Identity Editing and Brush Selection Design

## Goal

Allow an administrator to edit an employee's display name and abbreviation from Vacation Management while keeping that identity consistent across the schedule, legend, vacations, conflicts, and exports. Make Brush Assignment explicitly support selecting either one employee or two employees for a cell, while preventing a third assignment.

## Scope

- Add an identity-edit action to Vacation Management for the selected employee and each active-vacation row.
- Edit the employee name and abbreviation/code through one form.
- Apply the update system-wide to the employee legend, vacation rows, and every schedule assignment that stores the employee code.
- Preserve the stable `employeeId`; only the name and code change.
- Reject empty names, empty codes, and codes already used by another employee. Codes are trimmed and normalized to uppercase.
- Keep changes in the existing frontend draft/undo model and add an audit entry.
- Make Brush selection state show `0/2`, `1/2`, or `2/2` employees selected.
- Allow a brush containing one or two employees. Clicking a cell adds the selected employees without exceeding two total assignments.
- If a cell already contains one employee, only one new employee can be added. If the cell is full, show the existing full-cell warning and do not partially apply an invalid selection.
- Selecting a third brush employee is blocked with the existing maximum-selection warning.

## Architecture

### Employee identity update

The schedule matrix store remains the single source of truth. It gains an `updateEmployeeIdentity(employeeId, fullName, code)` mutation returning a success or validation result. The mutation clones the current matrix, updates the matching legend entry, all matching vacation rows, and each assignment with the same `employeeId`, then records undo and audit information.

Vacation Management receives the mutation as a callback. An inline editor opens for the chosen employee, prefilled with the current name and code. Validation feedback is shown beside the fields, and Save is disabled until both values are valid and changed.

Exports need no separate mutation because they already consume the current matrix data; they will automatically receive the synchronized values.

### Brush Assignment

The store continues to hold `brushEmployeeCodes: string[]` with a maximum length of two. The toolbar and legend expose the selection count and selected codes. Cell application uses a small pure merge helper that:

1. starts with the cell's current assignments;
2. adds selected brush employees that are not already present;
3. rejects the entire operation if the result would exceed two assignments;
4. returns assignments without a color override so the target shift row owns the color.

This avoids silent partial assignment when two employees are selected but the cell has only one remaining slot.

## User Interface

- Vacation Management adds an Edit identity button using a labeled icon and a minimum 44px touch target.
- The edit form contains `Employee name` and `Abbreviation` fields, Save, and Cancel.
- Successful save closes the form and shows a success toast. Duplicate or empty input stays open with a clear error.
- Brush mode shows a persistent selection summary such as `Selected 1/2: A` or `Selected 2/2: A + L`.
- Employee legend entries remain toggle buttons: click once to select, click again to remove.
- When two employees are selected, unselected legend entries are disabled or clearly marked unavailable until one selection is removed.

## Data and Validation Rules

- `employeeId` is immutable.
- `fullName` is trimmed and must contain at least one non-whitespace character.
- `code` is trimmed, uppercased, must contain at least one character, and must be unique case-insensitively.
- Existing assignments are located by `employeeId`; their `employeeCode` is replaced with the normalized code.
- Vacation rows matching `employeeId` receive both the new `fullName` and `employeeCode`.
- A cell may contain zero, one, or two unique employee assignments, never more.

## Error Handling

- Empty name: show `Employee name is required`.
- Empty abbreviation: show `Abbreviation is required`.
- Duplicate abbreviation: show `This abbreviation is already used by another employee`.
- Full brush cell: preserve the cell unchanged and show the full-cell warning.
- Third brush selection: preserve the two selected employees and show the maximum-selection warning.

All messages are provided in Arabic and English.

## Testing

- Store test: identity update changes legend, vacations, and assignments while preserving `employeeId`.
- Store test: duplicate and empty values are rejected without changing data.
- Vacation panel test: editor opens with current values, validation is visible, and a valid save sends normalized values.
- Brush merge test: one selected employee is added to an empty cell.
- Brush merge test: two selected employees are added to an empty cell.
- Brush merge test: a two-employee brush is rejected against a cell with one existing employee, with no partial write.
- Brush selection test: a third employee remains blocked.
- Regression: full test suite, production build, and targeted lint.

## Acceptance Criteria

- Editing a name or abbreviation from Vacation Management updates every schedule view and export that references that employee.
- No duplicate or blank abbreviation can be saved.
- Brush Assignment accepts one or two selected employees.
- A cell never contains more than two employees and never receives only part of an invalid two-person brush operation.
- The selection count and capacity are understandable in Arabic and English.
