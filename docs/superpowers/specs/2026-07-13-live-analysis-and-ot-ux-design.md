# Live Employee Analysis, Brush Selection, and OT Schedule UX Design

## Goal

Fix two-person Brush selection from employee chips, connect Schedule Management and OT Schedule to a live Employee Analysis view, and improve OT Schedule so assignments are faster, safer, and responsive.

## Product Decisions

- Schedule Management remains the editor for standard, night, on-call, vacation, and matrix overtime rows.
- OT Schedule remains the editor for specialty overtime rows.
- Employee Analysis is read-only and derived from both live schedules. It provides drill-through links to the correct editor instead of editing schedule totals directly.
- Employees are joined by stable `employeeId`, not display code. Changing a name or abbreviation therefore updates every downstream view without breaking historical assignment ownership.
- The 30-person CT workbook roster remains the Schedule Management roster. OT-only staff such as code `S` are included in the unified analysis roster without being inserted into the workbook schedule legend.

## Brush Root Cause and Corrected Interaction

The current `handleChipClick` selects an employee only while `brushEmployeeCodes.length === 0`. After the first selection, a chip click falls through to cell assignment behavior. `EmployeeChip` also opens its normal detail popover, which exposes `Edit assignment`. This makes the second selection look unavailable.

In Brush mode:

- clicking an employee chip always toggles that employee in the Brush selection;
- clicking a selected chip removes it;
- clicking an unselected chip adds it until the selection reaches two;
- the employee detail/Edit Assignment popover is suppressed;
- clicking empty cell space applies the current one-person or two-person brush;
- clicking a populated chip never applies the brush to the cell; the surrounding cell remains the application target;
- the existing atomic merge rule remains: no cell can exceed two assignments and an invalid operation writes nothing.

## Shared Data Architecture

### Schedule Management

`scheduleMatrixStore` remains the live source for the currently loaded matrix month. Employee Analysis uses store data when its month matches the report month and falls back to generated reference data for another month.

Schedule counts are keyed by `employeeId` and classified from `row.colorKey`:

- `morning` → Day;
- `evening` → Late;
- `night` → Night;
- `onCall` and `onCallNight` → separate on-call categories;
- `overtime` → matrix overtime;
- vacation days come from `VacationRow.daysOff`.

### OT Schedule

Create a dedicated Zustand store for OT data. It owns:

- current year and month;
- OT shift rows;
- cell assignments as arrays of stable employee IDs, maximum two per cell;
- notice text;
- add, edit, archive/delete row, assign cell, clear cell, and month navigation actions;
- localStorage persistence with a versioned payload.

The store migrates the existing `ngh_late_schedule_data` payload from code strings such as `A-H` to employee IDs. Unknown legacy codes are preserved as explicit unresolved entries and shown as validation warnings rather than silently discarded.

The OT roster is the union of:

- the live Schedule Management legend;
- OT-only seed employees.

If a Schedule Management employee code changes, OT assignments remain intact because they reference `employeeId`; the new code is resolved only when rendering or exporting.

### Employee Analysis

Extract a pure aggregation module that accepts:

- `ScheduleMatrixData`;
- OT rows for the selected month;
- the unified employee roster.

It returns one row per employee with:

- Day, Late, Night;
- On-call Day and On-call Night;
- matrix overtime shifts;
- OT Schedule shifts;
- OT Schedule hours;
- vacation days;
- total scheduled assignments;
- source breakdown (`schedule`, `ot`, or both).

The Reports page must stop generating an independent mock inside its counting function. It subscribes to both stores and recalculates when either schedule changes. Exports consume the same aggregated rows shown on screen.

## OT Schedule UX

### Desktop

- Keep one compact top toolbar containing month navigation, search, export, and the primary `Add OT Shift` action.
- Make statistics collapsible and show the last chosen state during the session.
- Keep day headers and the shift/coverage column sticky inside the table scroll container.
- Add a clear “scroll for more days” edge hint when the month overflows horizontally.
- Replace free-text employee code entry with a searchable assignment panel.
- The panel shows selected employee chips, `0/2`, `1/2`, or `2/2`, conflict/capacity feedback, Save, Clear, and Cancel.
- Unselected employees become disabled at two selections; selected employees remain removable.
- Use the shared roster code/name everywhere, including the legend, highlight behavior, Excel, and PDF.
- Retain row editing and deletion for administrators with explicit labels and confirmation before deletion.

### Mobile

- Hide the wide monthly grid below the desktop breakpoint.
- Show a seven-day week selector with previous/next week controls.
- Selecting a day shows OT shift cards with location, time, hours, and assigned employees.
- Administrators can open the same assignment panel from a shift card.
- No page-level horizontal overflow is allowed at 390px.

### Visual and Accessibility Rules

- Use 44×44px minimum touch targets for icon actions.
- Use visible focus rings and meaningful Arabic/English labels.
- Do not rely on code or color alone; show employee name in assignment and highlight contexts.
- Use one OT accent palette derived from the existing overtime token, with WCAG AA text contrast in light and dark themes.
- Keep statistics and notices visually secondary to the editable schedule.

## Validation and Error Handling

- Maximum two unique employees per OT cell.
- Duplicate selection is ignored, not duplicated.
- Unknown migrated employee codes show an unresolved badge and are excluded from Employee Analysis until mapped.
- An invalid cell update preserves the previous assignments.
- Empty OT shift title, location, time range, or non-positive hours cannot be saved.
- Employee Analysis shows an empty state when both sources contain no assignments for the selected month.
- localStorage parse/migration failure falls back to seeded OT data and records a recoverable warning in the UI.

## Testing

- Brush regression: first and second chip clicks select two employees; `Edit assignment` is not shown in Brush mode; the third is rejected.
- OT migration: legacy code strings resolve to stable IDs and unknown codes remain unresolved.
- OT store: one/two employee assignment succeeds; a third employee is rejected atomically.
- Aggregation: Schedule Management counts and OT counts/hours combine by `employeeId` without double-counting.
- Identity regression: changing an employee abbreviation leaves OT and analysis ownership intact.
- Reports integration: displayed/exported rows use the same aggregation result and update after store mutations.
- OT assignment panel: search, capacity state, Save, Clear, Cancel, keyboard operation, and validation.
- OT mobile: weekly navigation and no page-level overflow at 390px.
- Full test suite, production build, and targeted lint.

## Acceptance Criteria

- A user can select exactly one or two Brush employees by clicking employee chips, without seeing `Edit assignment` in Brush mode.
- Schedule Management and OT Schedule edits update Employee Analysis without reloading independent mock data.
- Employee Analysis clearly separates standard schedule assignments, matrix OT, OT Schedule shifts, and OT hours.
- OT employee assignments use the shared roster and reject invalid or third selections.
- OT Schedule is usable at 390px and desktop widths, in Arabic/English and light/dark themes.
- Excel/PDF exports use the same employee identities and assignment totals as the visible pages.
