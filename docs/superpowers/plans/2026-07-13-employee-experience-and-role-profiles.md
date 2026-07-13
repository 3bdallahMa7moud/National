# Employee Experience and Role Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give employees a concise landing dashboard, accurate personal and department schedule views backed by published Schedule/OT data, and a role-aware profile while keeping the admin profile operationally focused.

**Architecture:** Explicitly map authenticated accounts to the official operational roster with `scheduleEmployeeId`; never infer identity from name/email. Build pure employee and department view selectors over the normalized operational projection, then reuse those models across the employee dashboard, My Schedule, Department Schedule, and employee profile. Route employees to `/employee/dashboard` after login and expose role-specific navigation.

**Tech Stack:** React 18, TypeScript, Zustand, React Router, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Complete `2026-07-13-operational-data-and-restored-ot.md` Task 1 first.
- Complete `2026-07-13-admin-command-center-and-audit.md` Task 2 before profile audit instrumentation.
- Use `AuthUser.scheduleEmployeeId` for account-to-roster mapping; never guess by display name, email, account code, or array index.
- For the demo employee account, map `emp-2` explicitly to `emp-m-1` (official code `A`, Ahmed) so the experience has a deterministic roster identity.
- If a user has no mapping, show an actionable “schedule profile not linked” state; do not display another employee’s data.
- Use only published Schedule history and active OT rows. Missing months remain missing.
- Employee scheduling pages are read-only.
- Keep My Schedule and Department Schedule separate: personal focus vs department coverage context.
- Keep `morning` only as an internal key; visible English text is `Day Shift` and visible Arabic text is `الشفت النهاري`.
- Do not add Compact Month.
- Support Arabic/English, RTL/LTR, light/dark, 200% zoom, keyboard, empty/loading/missing-data states, and 44×44 px touch targets.

---

## Task 1: Add explicit operational roster identity to authentication

**Files:**

- Modify: `src/types/employee.ts`
- Modify: `src/mocks/types.ts`
- Modify: `src/mocks/sources.ts`
- Modify: `src/mocks/resolveMockData.ts`
- Create: `src/mocks/resolveMockData.auth.test.ts`
- Modify: `src/features/auth/LoginPage.tsx`
- Create or modify: `src/features/auth/LoginPage.test.tsx`

- [ ] Write failing tests proving the employee demo login returns `scheduleEmployeeId: 'emp-m-1'`, the admin has no automatic roster mapping, and login redirects by role.
- [ ] Add the field:

```ts
export interface AuthUser {
  // existing fields
  scheduleEmployeeId?: string;
}
```

Add the same optional field to `MockEmployeeSource` and propagate it in `resolveAuthUser`.

- [ ] Set `scheduleEmployeeId: 'emp-m-1'` only on the `emp-2` demo employee source. Leave admin scheduling identity absent until explicitly configured.
- [ ] Change employee login redirect from `/schedule/me` to `/employee/dashboard`; keep admin redirect `/admin/dashboard`.
- [ ] Run `npm test -- src/mocks/resolveMockData.auth.test.ts src/features/auth/LoginPage.test.tsx`; expect all tests to pass.
- [ ] Commit: `git add src/types/employee.ts src/mocks/types.ts src/mocks/sources.ts src/mocks/resolveMockData.ts src/mocks/resolveMockData.auth.test.ts src/features/auth/LoginPage.tsx src/features/auth/LoginPage.test.tsx && git commit -m "feat: map accounts to operational roster"`.

---

## Task 2: Build employee and department schedule view selectors

**Files:**

- Create: `src/types/employeeScheduleView.ts`
- Create: `src/lib/employeeScheduleView.ts`
- Create: `src/lib/employeeScheduleView.test.ts`
- Reuse: `src/lib/operationalSchedule.ts`

- [ ] Write failing tests for:

  - next shift across standard Schedule and OT;
  - a Sunday–Saturday agenda containing empty days and multiple same-day assignments;
  - month totals by Day/Late/Night/On-call/OT and OT hours;
  - personal filtering by stable employee ID;
  - department grouping by date and shift category;
  - self-highlighting without hiding peers;
  - facility and category filtering;
  - archived row exclusion and available/partial/missing period availability.

- [ ] Define the contracts:

```ts
export interface EmployeeScheduleView {
  employeeId: string;
  period: OperationalPeriod;
  availability: 'available' | 'partial' | 'missing';
  nextShift?: OperationalOccurrence;
  occurrences: OperationalOccurrence[];
  days: Array<{ date: string; occurrences: OperationalOccurrence[] }>;
  totals: Record<OperationalShiftCategory, number> & { otHours: number };
  notices: Array<{
    id: string;
    date: string;
    kind: 'conflict' | 'approvedVacation';
    severity: 'info' | 'warning';
    label: string;
  }>;
}

export interface DepartmentScheduleView {
  period: OperationalPeriod;
  availability: 'available' | 'partial' | 'missing';
  occurrences: OperationalOccurrence[];
  days: Array<{ date: string; groups: DepartmentShiftGroup[] }>;
  facilities: string[];
}
```

- [ ] Implement exactly:

```ts
export function buildEmployeeScheduleView(
  employeeId: string,
  period: OperationalPeriod,
  matrixMonths: Record<string, ScheduleMatrixData>,
  otMonths: Record<string, OTShiftRow[]>,
  roster: UnifiedEmployee[],
  nowDate: string,
): EmployeeScheduleView;

export function buildDepartmentScheduleView(
  period: OperationalPeriod,
  matrixMonths: Record<string, ScheduleMatrixData>,
  otMonths: Record<string, OTShiftRow[]>,
  roster: UnifiedEmployee[],
): DepartmentScheduleView;
```

- [ ] Use Sunday as the first day of the week and Saturday as the last day, matching the approved product decision.
- [ ] Derive personal notices only from real Schedule conflict flags and approved vacation ranges/days. Unresolved OT codes remain visible in the department/OT view because they cannot be safely attributed to a specific employee. Do not fabricate “shift changed” notices without an audit event that identifies the employee.
- [ ] Run `npm test -- src/lib/employeeScheduleView.test.ts`; expect all selector tests to pass.
- [ ] Commit: `git add src/types/employeeScheduleView.ts src/lib/employeeScheduleView.ts src/lib/employeeScheduleView.test.ts && git commit -m "feat: derive employee schedule views"`.

---

## Task 3: Add the employee landing dashboard and navigation

**Files:**

- Create: `src/features/dashboard/EmployeeDashboardPage.tsx`
- Create: `src/features/dashboard/EmployeeDashboardPage.test.tsx`
- Create: `src/features/dashboard/EmployeeNextShiftCard.tsx`
- Create: `src/features/dashboard/EmployeeWeekAgenda.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/layouts/Sidebar.tsx`
- Modify: `src/i18n/locales/en/dashboard.json`
- Modify: `src/i18n/locales/ar/dashboard.json`
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/ar/common.json`

- [ ] Write failing tests proving:

  - `/employee/dashboard` is employee-only;
  - employee navigation begins with Dashboard, then My Schedule and Department Schedule;
  - next shift shows date, countdown context, shift, facility/unit, time, and OT source when applicable;
  - the agenda shows seven days from Sunday to Saturday;
  - links point to `/schedule/me` and `/schedule/department`;
  - month summary shows only computed counts and OT hours;
  - missing mapping and missing published month have different explicit states.

- [ ] Compose the page in this order:

```text
Compact greeting + current date
Next shift card + two primary schedule links
Seven-day agenda
Real conflict/vacation/unresolved notices + current OT notice
Secondary current-month totals
```

- [ ] Derive the dashboard with three calls to `buildEmployeeScheduleView`: current week for the agenda, current month for totals/notices, and today through 90 days for next shift. Missing month keys in the 90-day horizon are skipped, never generated. Do not read `scheduleStore` or mock shifts.
- [ ] Add employee-only route nesting around dashboard, notifications, personal schedule, department schedule, employee OT, calendar sync, and profile. Preserve the shared admin profile route through its own allowed-role path.
- [ ] Make the agenda mobile-first cards. At desktop, render seven equal day columns; never compress a full month into mobile.
- [ ] Run `npm test -- src/features/dashboard/EmployeeDashboardPage.test.tsx`; expect all tests to pass.
- [ ] Commit: `git add src/features/dashboard/EmployeeDashboardPage.tsx src/features/dashboard/EmployeeDashboardPage.test.tsx src/features/dashboard/EmployeeNextShiftCard.tsx src/features/dashboard/EmployeeWeekAgenda.tsx src/app/routes.tsx src/layouts/Sidebar.tsx src/i18n/locales/en/dashboard.json src/i18n/locales/ar/dashboard.json src/i18n/locales/en/common.json src/i18n/locales/ar/common.json && git commit -m "feat: add employee operations dashboard"`.

---

## Task 4: Replace My Schedule with published Schedule plus OT

**Files:**

- Modify: `src/features/schedule/EmployeeSchedulePage.tsx`
- Create: `src/features/schedule/EmployeeSchedulePage.test.tsx`
- Create: `src/features/schedule/EmployeeScheduleWeek.tsx`
- Create: `src/features/schedule/EmployeeScheduleMonth.tsx`
- Modify: `src/i18n/locales/en/schedule.json`
- Modify: `src/i18n/locales/ar/schedule.json`

- [ ] Write failing tests for week/month switching, previous/next period navigation, standard+OT combination, source labels, shift details, stable employee mapping, and explicit missing-data state.
- [ ] Remove `useSchedule`, `ScheduleCalendar`, old `Shift` types, and mock `shiftTypes` from this page.
- [ ] Use `buildEmployeeScheduleView` for the selected week or month. Keep filters read-only and URL-independent in the first implementation.
- [ ] Week view: agenda rows with date, shift category, facility/unit, time, source, and OT hours.
- [ ] Month view: accessible calendar grid on desktop and grouped date cards below 768 px. Days without assignments remain visible but visually quiet.
- [ ] Shift details use the existing `Modal` and `OperationalOccurrence`, not legacy `Shift`.
- [ ] Run `npm test -- src/features/schedule/EmployeeSchedulePage.test.tsx src/lib/employeeScheduleView.test.ts`; expect all tests to pass.
- [ ] Commit: `git add src/features/schedule/EmployeeSchedulePage.tsx src/features/schedule/EmployeeSchedulePage.test.tsx src/features/schedule/EmployeeScheduleWeek.tsx src/features/schedule/EmployeeScheduleMonth.tsx src/i18n/locales/en/schedule.json src/i18n/locales/ar/schedule.json && git commit -m "feat: unify personal schedule with OT"`.

---

## Task 5: Replace Department Schedule with a responsive read-only operational view

**Files:**

- Modify: `src/features/schedule/DepartmentSchedulePage.tsx`
- Create: `src/features/schedule/DepartmentSchedulePage.test.tsx`
- Create: `src/features/schedule/DepartmentScheduleDesktop.tsx`
- Create: `src/features/schedule/DepartmentScheduleMobile.tsx`
- Modify: `src/i18n/locales/en/schedule.json`
- Modify: `src/i18n/locales/ar/schedule.json`

- [ ] Write failing tests for facility filter, shift-category filter, selected period, self-highlight, archived exclusions, OT source badge, and mobile grouped cards.
- [ ] Remove `useSchedule`, mock employees, and the legacy `ScheduleCalendar` matrix from this page.
- [ ] Build the selected period with `buildDepartmentScheduleView`, then filter the result using pure local functions before rendering.
- [ ] Add Week/Month view switching and previous/next period navigation; both modes use the same filtered selector result.
- [ ] Desktop: sticky date/shift headers, employee chips by group, restrained internal horizontal scroll, and a legend that does not clip names.
- [ ] Mobile: date cards grouped Day/Late/Night/On-call/OT with the signed-in employee visually highlighted and announced as “You”/“أنت”.
- [ ] Keep the page read-only; no edit buttons or assignment drawers.
- [ ] Run `npm test -- src/features/schedule/DepartmentSchedulePage.test.tsx`; expect all tests to pass.
- [ ] Commit: `git add src/features/schedule/DepartmentSchedulePage.tsx src/features/schedule/DepartmentSchedulePage.test.tsx src/features/schedule/DepartmentScheduleDesktop.tsx src/features/schedule/DepartmentScheduleMobile.tsx src/i18n/locales/en/schedule.json src/i18n/locales/ar/schedule.json && git commit -m "feat: rebuild department schedule experience"`.

---

## Task 6: Refactor Profile into shared identity plus role-specific operations

**Files:**

- Modify: `src/features/employees/ProfilePage.tsx`
- Create: `src/features/employees/ProfilePage.test.tsx`
- Create: `src/features/employees/ProfileIdentityCard.tsx`
- Create: `src/features/employees/AdminProfileOverview.tsx`
- Create: `src/features/employees/EmployeeProfileOverview.tsx`
- Reuse: `src/stores/operationalAuditStore.ts`
- Modify: `src/i18n/locales/en/employees.json`
- Modify: `src/i18n/locales/ar/employees.json`

- [ ] Write failing tests proving shared account/security controls for both roles, employee schedule summary only for a linked employee, no employee shift statistics for an unmapped admin, and correct My Schedule/Department Schedule links.
- [ ] Extract the existing identity, email edit, and password-change UI into `ProfileIdentityCard`; preserve existing store actions and validation.
- [ ] Remove `useScheduleStore`, `useMockData().shiftTypes`, `mockEmployeesSource` mutation, legacy shift statistics, and unused icon/helper code from `ProfilePage`.
- [ ] `EmployeeProfileOverview` receives `EmployeeScheduleView` and shows next shift, seven-day count, current-month Day/Late/Night/On-call/OT totals, OT hours, and navigation links.
- [ ] `AdminProfileOverview` shows role, department, account status, and links to Dashboard, Audit Log, Schedule, and OT. It renders schedule data only when `scheduleEmployeeId` is explicitly present.
- [ ] Show the administrator’s five latest real profile/Schedule/OT audit entries when present. Do not add a last-sign-in value because the current auth model does not store one.
- [ ] Email changes update only `authStore`; do not mutate imported mock source arrays.
- [ ] After a successful email or password change, record a `profile` audit event in `useOperationalAuditStore`; password events must never store the old or new password value.
- [ ] Add accessible names to avatar/email actions and ensure all icon buttons meet the 44×44 px target.
- [ ] Run `npm test -- src/features/employees/ProfilePage.test.tsx`; expect all tests to pass.
- [ ] Run targeted ESLint for all Profile files; expect the existing Profile lint issues to be eliminated.
- [ ] Commit: `git add src/features/employees/ProfilePage.tsx src/features/employees/ProfilePage.test.tsx src/features/employees/ProfileIdentityCard.tsx src/features/employees/AdminProfileOverview.tsx src/features/employees/EmployeeProfileOverview.tsx src/i18n/locales/en/employees.json src/i18n/locales/ar/employees.json && git commit -m "feat: add role-aware operational profiles"`.

---

## Task 7: Verify the complete employee journey

**Files:**

- Modify only if verification exposes a defect: files from Tasks 1–6.

- [ ] Run targeted tests:

```powershell
npm test -- src/mocks/resolveMockData.auth.test.ts src/features/auth/LoginPage.test.tsx src/lib/operationalSchedule.test.ts src/lib/employeeScheduleView.test.ts src/features/dashboard/EmployeeDashboardPage.test.tsx src/features/schedule/EmployeeSchedulePage.test.tsx src/features/schedule/DepartmentSchedulePage.test.tsx src/features/employees/ProfilePage.test.tsx
```

Expected: all listed tests pass.

- [ ] Run `npm run build`; expect TypeScript and Vite to complete successfully.
- [ ] Run targeted ESLint on auth, route, sidebar, employee dashboard, schedule, profile, type, and selector files; expect no new lint errors.
- [ ] Sign in as employee and verify redirect to `/employee/dashboard`, sidebar order, next shift, seven-day agenda, My Schedule, Department Schedule, OT read-only access, and Profile.
- [ ] At 1440/1024/768/390 px in Arabic/English and light/dark, verify no clipped content, no page-level horizontal overflow, RTL order, visible focus, 200% zoom, and 44×44 px actions.
- [ ] Verify a user without `scheduleEmployeeId` sees the linking state on dashboard, personal schedule, and profile; verify no roster identity is guessed.
- [ ] Verify an archived OT row disappears from employee dashboard/personal/department views and returns after admin restoration.
- [ ] Verify a missing month shows data availability messaging instead of zero totals or invented shifts.
- [ ] Run the full suite with `npm test`; expect all tests to pass.
- [ ] Commit final corrections with `git commit -m "fix: complete employee experience verification"`.
