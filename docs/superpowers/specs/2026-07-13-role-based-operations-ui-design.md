# Role-Based Operations UI Design

## Goal

Create one coherent scheduling experience for administrators and employees while restoring the earlier product-styled OT Schedule and its earlier export presentation.

The work covers five connected areas:

1. the administrator operational dashboard;
2. OT Schedule and its Excel/PDF exports;
3. Audit Log;
4. role-aware profiles;
5. the employee home, personal schedule, and department schedule.

The implementation must preserve the approved 29-person operational roster, stable employee IDs, one-or-two-person OT assignments, archive/restore behavior, Schedule and OT analysis integration, Arabic/English support, and light/dark themes.

## Product Decisions

- The administrator dashboard becomes a daily operational command center rather than a long generic report.
- The dashboard starts with today's coverage cards. A separate large critical-alert banner is not added.
- Today's assignments are grouped by shift type instead of rendered as one long list.
- General totals are visually secondary to today's operational state.
- Employees land on a concise employee dashboard after login.
- OT Schedule returns to the earlier website-native editor and earlier website-native exports. The Excel-form replica layout is removed from the UI and exports.
- Schedule Management remains unchanged as the administrator editor for the standard schedule.
- All operational views derive from the same 29-person roster and the same published Schedule/OT data. No page generates independent staffing totals.
- Account identities remain separate from the operational roster, but employee accounts carry a stable `scheduleEmployeeId` reference when they need schedule access.
- Archived units, shift definitions, OT rows, and unpublished Schedule drafts are excluded from dashboards, employee schedules, exports, and analysis.
- The implementation does not reintroduce Compact Month.

## Shared Information Architecture

### Administrator routes

- `/admin/dashboard`: operational command center.
- `/admin/schedule`: standard Schedule Management editor.
- `/admin/late-schedule`: restored OT editor.
- `/admin/audit-log`: searchable operational history.
- `/profile`: role-aware administrator profile when the signed-in user is an administrator.

### Employee routes

- `/employee/dashboard`: new employee landing page.
- `/schedule/me`: full personal schedule.
- `/schedule/department`: read-only department schedule.
- `/late-schedule`: read-only OT view for non-admin users, with the current employee emphasized when assigned.
- `/profile`: role-aware employee profile.

After authentication, administrators go to `/admin/dashboard` and employees go to `/employee/dashboard`.

## Shared Data Model and Selectors

The UI uses pure selectors rather than page-owned calculations:

- `buildOperationalSnapshot(date, matrix, otRows, roster)` produces today's coverage, assignment groups, schedule gaps, conflicts, approved absences, and secondary totals.
- `buildEmployeeScheduleView(employeeId, period, matrixMonths, otMonths)` produces the employee's combined standard and OT schedule.
- `buildDepartmentScheduleView(period, matrixMonths, otMonths)` produces the department read-only view and self-highlight metadata.
- `filterAuditEntries(filters, entries)` produces the Audit Log summary and visible results.

The selectors consume:

- published `scheduleMatrixStore.matricesByMonth` snapshots;
- `lateScheduleStore.rowsByMonth` active OT rows;
- the centralized 29-person employee roster;
- the signed-in account's `scheduleEmployeeId`;
- the existing operational audit entries.

No selector invents missing months or staffing targets. Standard schedule coverage treats an active row for the selected day as an expected slot; an empty cell is an uncovered row. OT cards report scheduled employees and hours, but do not claim an OT shortage without an explicit OT requirement.

## Administrator Dashboard

### Header

The header shows the selected operational date, department name, last publication state, and two primary actions:

- `Open Schedule`;
- `Review OT`.

The date defaults to today and may be changed without navigating away.

### Today's coverage cards

Five cards appear in the first content row:

- Day Shift;
- Late Shift;
- Night Shift;
- On-call;
- OT.

Each standard-shift card shows:

- assigned employee count;
- uncovered active rows;
- conflict count;
- approved absence count relevant to that shift;
- status text such as `Covered`, `Needs attention`, or `No published data`.

The OT card shows assigned employee count, scheduled OT rows, and total OT hours. Selecting a card filters the grouped daily schedule below.

### Grouped daily schedule

Today's schedule is presented as collapsible groups ordered Day, Late, Night, On-call, and OT. Each group header shows its employee count and issue count.

Expanded items show:

- employee code and name;
- facility/unit or OT location;
- time;
- conflict or absence state when applicable;
- a direct administrator action.

On desktop, the group content may use a compact table. On mobile, the same content becomes stacked cards. The page never renders the complete month grid.

### Contextual actions

Actions are attached to the state that needs attention:

- an uncovered standard row opens Schedule Management with the date and shift filter applied;
- a conflict opens the relevant Schedule cell;
- an OT item opens the OT row and day;
- `View all` opens the full editor instead of expanding the dashboard indefinitely.

### Recent activity and secondary metrics

The page shows the five newest relevant audit entries with action, actor, target, and relative time, followed by a `View Audit Log` link.

General metrics such as total active employees, total published assignments, vacation days, and available months appear below the operational sections in smaller cards. They do not compete with today's coverage.

## Restored OT Schedule

### Website-native desktop editor

The desktop OT editor returns to the earlier product design:

- one compact toolbar containing month navigation, search, statistics toggle, Excel, PDF, and `Add OT Shift`;
- collapsible statistics using the website's card system;
- a monthly grid inside its own horizontal scroll container;
- sticky day headers and a sticky shift-details column;
- title, location, time, and hours visible in the shift column;
- employee code and truncated name in assigned cells;
- a clear scroll hint for additional days;
- row edit, archive, Active/Archived tabs, and Restore for administrators.

The Excel-form replica title block, exact source-cell geometry, right-side spreadsheet legend, and black worksheet canvas are removed from the website UI.

### Mobile

Mobile keeps the seven-day workflow:

- previous/next week controls;
- day selection;
- shift cards containing location, time, hours, and assigned employees;
- the same one-or-two-person assignment panel for administrators;
- no page-level horizontal scrolling.

### Restored website-native Excel export

Excel returns to the earlier export model:

- one `OT Schedule` worksheet with a branded title, month, and current notice;
- fixed metadata columns for shift, location, time, and hours;
- only the real calendar days for the selected month;
- frozen metadata columns and day header;
- the website shift colors rather than exact OT FORM cell coordinates;
- a separate `Employees` worksheet containing the approved 29-person roster;
- landscape printing and fit-to-width without forcing unreadably small text.

### Restored website-native PDF export

PDF uses the same export model as Excel:

- landscape title and period;
- current notice;
- compact shift grid using website colors;
- page breaks by row when more rows are added;
- employee legend on a following section/page when required;
- unresolved legacy codes visibly marked with `?`.

Both exports contain only active rows, use stable employee identities, and match the visible selected month.

## Audit Log

### Summary and filters

Small summary cards show the result counts for Create, Update, Archive/Delete, and Restore. They are derived from the active filtered period.

The filter bar supports:

- date range;
- actor;
- action type;
- affected module: Schedule, OT, Employees/Profile, or Settings;
- free-text search.

Filters are responsive and collapse into a filter drawer on mobile.

### Activity list and details

Entries are shown as a readable chronological activity list with action badge, actor, target, module, and timestamp. Selecting an entry opens a details drawer containing:

- the complete description;
- previous and new values when present;
- employee/row/unit identifiers;
- actor and exact timestamp;
- a contextual link to the affected page when the target still exists.

Archive and Restore use separate visible labels. Empty filters show a specific no-results state with a reset action.

## Role-Aware Profile

### Shared profile shell

Both roles use one profile shell with:

- identity, role, department, operational employee code when applicable, and account status;
- contact details;
- localized dates;
- security and password controls;
- accessible labeled icon actions with 44px minimum touch targets.

### Administrator profile

The administrator profile prioritizes:

- account and contact information;
- recent administrative activity from Audit Log;
- security controls;
- last sign-in and account status when the data exists.

Schedule statistics are not shown for an administrator without a `scheduleEmployeeId`.

### Employee profile

The employee profile adds:

- next shift;
- seven-day schedule summary;
- shift-type totals for the active month;
- links to `My Schedule` and `Department Schedule`;
- assigned OT hours for the active month.

The profile does not duplicate the complete personal calendar; it provides a summary and links to the dedicated schedule pages.

## Employee Dashboard and Schedules

### Employee landing page

The employee dashboard contains:

1. a prominent next-shift card with date, time, facility/unit, shift name, and countdown/status;
2. a seven-day agenda combining published standard assignments and active OT assignments;
3. important notices such as a changed shift, approved vacation, conflict, or unresolved schedule identity;
4. clear links to `My Schedule` and `Department Schedule`;
5. a small monthly summary of Day, Late, Night, On-call, and OT assignments.

If the account has no `scheduleEmployeeId`, the page displays a clear account-linking state and does not guess an employee from name or email.

### My Schedule

The personal schedule supports week and month views. It shows only the current employee's published standard and active OT assignments, using the shared shift palette and names.

Selecting an assignment opens read-only details containing location, time, source (`Schedule` or `OT`), and status. Empty periods show a useful empty state rather than a blank calendar.

### Department Schedule

The department schedule is read-only for employees. It supports week/month navigation and filters for facility and shift type. The current employee is visually emphasized without hiding coworkers.

On desktop it uses a compact schedule table/calendar. On mobile it uses day selection and grouped shift cards. Employee users cannot access editing, archive, restore, publishing, or export controls from this view.

## Visual System

- Reuse the current design tokens, typography, cards, buttons, modals, spacing scale, and sidebar shell.
- Use the centralized shift palette for Day, Late, Night, On-call Day, On-call Night, OT, and Vacation.
- Never rely on color alone; pair color with shift name, icon, or status text.
- Keep focus rings visible, touch targets at least 44×44px, and page-level horizontal overflow disabled.
- Support Arabic RTL and English LTR. Schedule codes, times, and official facility abbreviations remain directionally isolated LTR.
- Verify light/dark themes at 390, 768, 1024, and 1440px.

## Loading, Empty, Error, and Permission States

- Loading uses the existing skeleton components sized to the final content.
- Missing published Schedule data is distinct from an empty day.
- Missing employee-account linkage has a dedicated explanation and administrator contact action.
- Corrupt OT persistence keeps the existing recoverable warning behavior.
- A failed deep link falls back to the destination page with its nearest valid filter.
- Admin-only controls are not rendered for employee accounts; route guards remain the final client-side UI boundary.

## Testing and Acceptance Criteria

- OT desktop and its Excel/PDF exports no longer use the exact OT FORM replica layout.
- OT still supports zero, one, or two employees, archive/restore, search, mobile week navigation, stable IDs, and 29 employees.
- Dashboard coverage cards, grouped daily schedule, quick actions, recent activity, and secondary metrics use the same published data.
- Selecting a dashboard coverage card filters the daily groups; contextual links open the relevant Schedule or OT state.
- Audit Log filters and summary cards use the same filtered entries; the details drawer shows before/after values.
- Administrator and employee profiles render only role-appropriate sections.
- Employee login lands on `/employee/dashboard`.
- Employee dashboard, personal schedule, department schedule, profile, Schedule Management, OT, and Employee Analysis agree on employee identity and assignment totals.
- Archived or unpublished items never appear in operational summaries or employee views.
- Arabic/English, light/dark, keyboard navigation, 200% zoom, and 390/768/1024/1440px layouts are tested.
- The full test suite, targeted lint, production build, and same-viewport visual comparison are completed before handoff.

## Delivery Order

1. shared operational and employee schedule selectors;
2. restored OT UI and exports;
3. administrator dashboard;
4. Audit Log;
5. role-aware profile;
6. employee dashboard and schedule pages;
7. integration, accessibility, visual QA, and exports verification.
