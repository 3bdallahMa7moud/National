# Admin Command Center and Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin landing page into an operational command center driven by published Schedule/OT data, and replace the mock Audit Log with a filterable, inspectable history of real scheduling operations.

**Architecture:** Build a pure daily snapshot selector over the shared operational projection from the OT/data plan. Standard Schedule rows produce expected-versus-filled coverage and actionable gaps; OT produces assignments and hours only because no OT target exists. Normalize Schedule and OT audit events into one display contract, then render the dashboard and Audit Log from those contracts without fabricated KPIs.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, React Router, Vitest, Testing Library.

## Global Constraints

- Complete `2026-07-13-operational-data-and-restored-ot.md` Task 1 before this plan.
- Read only published Schedule snapshots and active OT rows. Never fall back to `scheduleMatrixMockJuly2026` or `useMockData().auditLog`.
- A standard row active on the selected day is one expected slot; a cell with no employee is uncovered.
- The OT card reports assignment count and total hours. It must not claim a shortage without an explicit requirement model.
- Archived and unpublished data does not appear; restored active data returns immediately.
- Keep all primary admin actions contextual: the gap/action card links to the exact Schedule or OT module.
- No invented month-over-month percentages, coverage targets, fairness claims, or “real-time” status.
- Arabic/English, RTL/LTR, light/dark, keyboard, loading, empty, and incomplete-data states are first-class.

---

## Task 1: Define and test the daily operational snapshot

**Files:**

- Create: `src/types/operationalDashboard.ts`
- Create: `src/lib/operationalSnapshot.ts`
- Create: `src/lib/operationalSnapshot.test.ts`
- Read: `src/lib/operationalSchedule.ts`
- Read: `src/lib/scheduleMatrixArchive.ts`

- [ ] Write failing tests covering:

  - Day, Late, Night, On-call Day, On-call Night, and OT grouping;
  - expected, assigned, uncovered, and unique employee counts for standard categories;
  - two employees in one standard cell counting as one covered slot and two assignments;
  - OT assignments and hours without expected/uncovered values;
  - group rows retaining facility, unit, time, employee, conflict, and route context;
  - absence of a published month returning `availability: 'missing'`, not zero coverage;
  - archived/unpublished exclusions.

- [ ] Define the exact contracts:

```ts
export type CoverageCategory = 'day' | 'late' | 'night' | 'onCall' | 'ot';

export interface CoverageMetric {
  category: CoverageCategory;
  assignedEmployees: number;
  assignments: number;
  expectedSlots: number | null;
  coveredSlots: number | null;
  uncoveredSlots: number | null;
  hours: number | null;
  scheduledRows: number;
  conflicts: number;
  approvedAbsences: number;
}

export interface OperationalIssue {
  id: string;
  severity: 'critical' | 'warning';
  kind: 'uncovered' | 'conflict' | 'approvedAbsence' | 'unresolvedEmployee';
  label: string;
  count: number;
  href: string;
}

export interface OperationalSnapshot {
  date: string;
  availability: 'available' | 'missing';
  coverage: CoverageMetric[];
  shiftGroups: DailyShiftGroup[];
  issues: OperationalIssue[];
  secondary: {
    activeEmployees: number;
    scheduledEmployees: number;
    standardAssignments: number;
    otAssignments: number;
    otHours: number;
    vacationEmployees: number;
  };
}
```

- [ ] Implement exactly:

```ts
export function buildOperationalSnapshot(
  date: string,
  matrix: ScheduleMatrixData | undefined,
  otRows: OTShiftRow[] | undefined,
  roster: UnifiedEmployee[],
): OperationalSnapshot;
```

- [ ] Collapse `onCall` and `onCallNight` into one dashboard coverage card while preserving the specific subtype in each grouped row.
- [ ] Count `approvedAbsences` per standard category only when an assigned employee is also on an approved vacation that day; do not attach an unassigned vacation to an arbitrary shift.
- [ ] Sort issues by severity then uncovered/conflict/approved-absence/unresolved; sort groups Day, Late, Night, On-call, OT.
- [ ] Run `npm test -- src/lib/operationalSnapshot.test.ts`; expect all tests to pass.
- [ ] Commit: `git add src/types/operationalDashboard.ts src/lib/operationalSnapshot.ts src/lib/operationalSnapshot.test.ts && git commit -m "feat: derive admin operational snapshot"`.

---

## Task 2: Normalize real Schedule and OT audit entries

**Files:**

- Create: `src/types/operationalAudit.ts`
- Create: `src/lib/operationalAudit.ts`
- Create: `src/lib/operationalAudit.test.ts`
- Create: `src/stores/operationalAuditStore.ts`
- Create: `src/stores/operationalAuditStore.test.ts`
- Modify: `src/types/scheduleMatrix.ts`
- Modify: `src/stores/scheduleMatrixStore.ts`
- Modify: `src/stores/scheduleMatrixStore.archive.test.ts`
- Modify: `src/stores/lateScheduleStore.ts`
- Modify: `src/stores/lateScheduleStore.test.ts`

- [ ] Write failing adapter tests for Schedule assign/remove/vacation/publish/settings/restore events and OT add/update/assign/clear/archive/restore/notice events.
- [ ] Define one display model:

```ts
export type OperationalAuditModule =
  | 'schedule'
  | 'ot'
  | 'employees'
  | 'profile'
  | 'settings';
export type OperationalAuditAction =
  | 'create' | 'update' | 'delete' | 'assign' | 'clear' | 'archive' | 'restore'
  | 'publish' | 'discard' | 'vacation' | 'settings' | 'undo';

export interface OperationalAuditEntry {
  id: string;
  actorName: string;
  action: OperationalAuditAction;
  module: OperationalAuditModule;
  entityId: string;
  entityLabel: string;
  timestamp: string;
  before?: string;
  after?: string;
  context: {
    year?: number;
    month?: number;
    facilityId?: string;
    unitId?: string;
    rowId?: string;
    day?: number;
    route: '/admin/schedule' | '/admin/late-schedule' | '/admin/employees' | '/profile';
  };
}
```

- [ ] Implement `useOperationalAuditStore` with persisted `entries`, `record(entryWithoutIdAndTimestamp)`, and `clearForTests()` actions under storage key `ngh_operational_audit_v1`. This store receives OT, profile, and future employee-domain events; Schedule continues to keep its existing month audit history.
- [ ] Add an optional actor name argument to OT mutations while keeping existing callers source-compatible:

```ts
setCellAssignments(rowId, day, employeeIds, unresolvedCodes?, actorName?): OTMutationResult;
archiveRow(id, actorName?): OTMutationResult;
restoreLateShiftRow(id, actorName?): OTMutationResult;
```

Apply the same optional final argument to add/update/clear/notice mutations.

- [ ] Append immutable OT audit entries to `useOperationalAuditStore` only after successful mutations. Store before/after values as compact JSON strings suitable for the details drawer.
- [ ] Extend Schedule `AuditEntry.action` with `archive` and `restore`; make shift-definition/unit archive and restore mutations emit those actions instead of indistinguishable `settings` entries.
- [ ] Implement `buildUnifiedOperationalAudit(scheduleEntries, persistedEntries)` and `filterAuditEntries(filters, entries)` as pure functions. Flatten and de-duplicate Schedule audit entries from the current matrix plus published month snapshots by entry ID.
- [ ] Update `LateSchedulePage.tsx` to pass `user?.name` to mutations.
- [ ] Run `npm test -- src/lib/operationalAudit.test.ts src/stores/operationalAuditStore.test.ts src/stores/lateScheduleStore.test.ts src/stores/scheduleMatrixStore.archive.test.ts`; expect persistence, classification, and mutation-audit tests to pass.
- [ ] Commit: `git add src/types/operationalAudit.ts src/types/scheduleMatrix.ts src/lib/operationalAudit.ts src/lib/operationalAudit.test.ts src/stores/operationalAuditStore.ts src/stores/operationalAuditStore.test.ts src/stores/lateScheduleStore.ts src/stores/lateScheduleStore.test.ts src/stores/scheduleMatrixStore.ts src/stores/scheduleMatrixStore.archive.test.ts src/features/late-schedule/LateSchedulePage.tsx && git commit -m "feat: record unified operational audit events"`.

---

## Task 3: Build command-center presentation components

**Files:**

- Create: `src/features/dashboard/TodayCoverageCards.tsx`
- Create: `src/features/dashboard/TodayShiftGroups.tsx`
- Create: `src/features/dashboard/RecentOperationalActivity.tsx`
- Create: `src/features/dashboard/SecondaryOperationalMetrics.tsx`
- Create: `src/features/dashboard/DashboardPage.test.tsx`

- [ ] Write failing component tests proving:

  - the first operational content is the five-card coverage row, with gaps/conflicts/approved absences shown inside the relevant card rather than a separate alert banner;
  - five cards appear in Day, Late, Night, On-call, OT order;
  - standard cards show `covered / expected` and uncovered state;
  - OT shows assignments and hours only;
  - daily employees are grouped by shift instead of rendered as one long table;
  - an uncovered issue links to `/admin/schedule` and OT activity links to `/admin/late-schedule`;
  - recent activity is capped at five entries and links to `/admin/audit-log`;
  - missing published data renders an explicit state rather than zeroes.

- [ ] Implement all components as presentational components receiving typed props; do not read stores inside them.
- [ ] Make each coverage card selectable. The active card filters the grouped schedule below; selecting it again restores all groups.
- [ ] Use a responsive layout: five coverage cards first in `1/2/3/5` columns by breakpoint, shift groups in the primary column, recent activity in the secondary column, and general KPIs last.
- [ ] For grouped rows, show code/name, facility/unit, time range, source badge, and conflict/unresolved indicator. Cap initial rows per group at six with an accessible “show all” toggle.
- [ ] Use `aria-live="polite"` only on data/status summaries, not the whole dashboard.
- [ ] Run `npm test -- src/features/dashboard/DashboardPage.test.tsx`; expect component tests to pass.

---

## Task 4: Replace the admin dashboard mock implementation

**Files:**

- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/schedule/AdminSchedulePage.tsx`
- Modify: `src/features/late-schedule/LateSchedulePage.tsx`
- Create: `src/features/schedule/AdminSchedulePage.deepLink.test.tsx`
- Modify: `src/features/late-schedule/LateSchedulePage.integration.test.tsx`
- Modify: `src/i18n/locales/en/dashboard.json`
- Modify: `src/i18n/locales/ar/dashboard.json`
- Read: `src/stores/scheduleMatrixStore.ts`
- Read: `src/stores/lateScheduleStore.ts`
- Read: `src/stores/employeeRosterStore.ts`

- [ ] Remove `scheduleMatrixMockJuly2026`, `useMockData`, fake 12% change, and the hard-coded day-1 fallback.
- [ ] Read the selected current date, derive `YYYY-MM`, and select only that key from `matricesByMonth` and `rowsByMonth`.
- [ ] Call `buildOperationalSnapshot` and `buildUnifiedOperationalAudit` in `useMemo`; pass results down to the Task 3 components.
- [ ] Add a date control defaulting to today so the admin can inspect another day without changing Schedule state.
- [ ] Show department, selected date, and the latest real `publish` audit timestamp in the compact header. If no publication event exists, show localized “Publication time unavailable”; never invent it.
- [ ] Build exact contextual links: standard issues use `/admin/schedule?date=YYYY-MM-DD&category=CATEGORY&rowId=ROW&day=DAY`; OT items use `/admin/late-schedule?year=YYYY&month=M&rowId=ROW&day=DAY`.
- [ ] Make `AdminSchedulePage` and `LateSchedulePage` consume valid deep-link parameters once on entry: load the requested month, apply the nearest supported filter/highlight, and open the referenced assignment editor when the row/day still exists. Invalid or archived targets fall back to the destination page with a localized notice.
- [ ] Derive available published-month count directly from `Object.keys(matricesByMonth).length` and pass it to `SecondaryOperationalMetrics`; keep it outside `buildOperationalSnapshot`, which intentionally receives only the selected month.
- [ ] Add translations for coverage labels, gap/conflict states, grouped roster, actions, recent activity, metrics, missing month, unresolved employee, and `Day Shift` copy.
- [ ] Keep the header compact: department/date context, not large decorative welcome content.
- [ ] Run `npm test -- src/features/dashboard/DashboardPage.test.tsx src/lib/operationalSnapshot.test.ts`; expect all tests to pass.
- [ ] Run `npm test -- src/features/schedule/AdminSchedulePage.deepLink.test.tsx src/features/late-schedule/LateSchedulePage.integration.test.tsx`; expect valid targets to open and invalid/archived targets to fall back safely.
- [ ] Commit: `git add src/features/dashboard/DashboardPage.tsx src/features/dashboard/DashboardPage.test.tsx src/features/dashboard/TodayCoverageCards.tsx src/features/dashboard/TodayShiftGroups.tsx src/features/dashboard/RecentOperationalActivity.tsx src/features/dashboard/SecondaryOperationalMetrics.tsx src/features/schedule/AdminSchedulePage.tsx src/features/schedule/AdminSchedulePage.deepLink.test.tsx src/features/late-schedule/LateSchedulePage.tsx src/features/late-schedule/LateSchedulePage.integration.test.tsx src/i18n/locales/en/dashboard.json src/i18n/locales/ar/dashboard.json && git commit -m "feat: build admin operational command center"`.

---

## Task 5: Rebuild the Audit Log page with filters and details

**Files:**

- Create: `src/features/reports/AuditLogFilters.tsx`
- Create: `src/features/reports/AuditEntryDetailsDrawer.tsx`
- Create: `src/features/reports/AuditLogPage.test.tsx`
- Modify: `src/features/reports/AuditLogPage.tsx`
- Modify: `src/i18n/locales/en/reports.json`
- Modify: `src/i18n/locales/ar/reports.json`
- Reuse: `src/components/ui/Modal.tsx`

- [ ] Write failing tests for date range, actor, action, module, and free-text filters; newest-first ordering; reset filters; empty state; summary counts; and opening/closing the details dialog by keyboard.
- [ ] Use this filter contract:

```ts
export interface AuditFilters {
  startDate?: string;
  endDate?: string;
  actor: string;
  action: OperationalAuditAction | 'all';
  module: OperationalAuditModule | 'all';
  search: string;
}
```

- [ ] Replace `useMockData().auditLog` with the unified Schedule/OT audit selector.
- [ ] Render secondary summary cards for Create, Update, Archive/Delete, and Restore, all derived from the active filtered period. Keep total matching count in the page header. Do not label the log “real-time.”
- [ ] Render a chronological list with actor, localized action/module, entity label, timestamp, and a details button.
- [ ] Implement `AuditEntryDetailsDrawer` as a fixed logical-end panel with `role="dialog"`, `aria-modal="true"`, labeled title, Escape close, focus return, backdrop close, and focus containment. It contains before, after, identifiers, date/day context, and a route link to the relevant screen.
- [ ] On mobile, collapse filters into a “Filters” disclosure while keeping active-filter count visible.
- [ ] Run `npm test -- src/features/reports/AuditLogPage.test.tsx src/lib/operationalAudit.test.ts`; expect all tests to pass.
- [ ] Commit: `git add src/features/reports/AuditLogPage.tsx src/features/reports/AuditLogFilters.tsx src/features/reports/AuditEntryDetailsDrawer.tsx src/features/reports/AuditLogPage.test.tsx src/i18n/locales/en/reports.json src/i18n/locales/ar/reports.json && git commit -m "feat: rebuild operational audit log"`.

---

## Task 6: Verify the admin operational experience

**Files:**

- Modify only if verification exposes a defect: files from Tasks 1–5.

- [ ] Run targeted tests:

```powershell
npm test -- src/lib/operationalSchedule.test.ts src/lib/operationalSnapshot.test.ts src/lib/operationalAudit.test.ts src/features/dashboard/DashboardPage.test.tsx src/features/reports/AuditLogPage.test.tsx src/stores/operationalAuditStore.test.ts src/stores/lateScheduleStore.test.ts src/stores/scheduleMatrixStore.archive.test.ts
```

Expected: all listed tests pass.

- [ ] Run `npm run build`; expect TypeScript and Vite to complete successfully.
- [ ] Run targeted ESLint on the created/modified dashboard, report, type, store, and library files; expect no new lint errors.
- [ ] At 1440/1024/768/390 px in Arabic/English and light/dark, verify hierarchy, no page-level horizontal overflow, readable grouped rows, keyboard focus, and 44×44 px actions.
- [ ] Verify a known empty standard cell produces one gap, two employees in one cell do not overstate covered slots, and OT never reports a fabricated shortage.
- [ ] Archive and restore an OT row; confirm dashboard and Audit Log exclude/include it consistently and show the restore event.
- [ ] Publish a Schedule change; confirm the dashboard updates from the published snapshot and Audit Log exposes its details/context link.
- [ ] Commit any final corrections with `git commit -m "fix: complete admin operations verification"`.
