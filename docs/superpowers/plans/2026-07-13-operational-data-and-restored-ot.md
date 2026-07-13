# Operational Data and Restored OT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Excel-replica OT experience with the previous website-native OT design, restore website-native Excel/PDF exports, and introduce one normalized published-schedule projection that later admin and employee views can share.

**Architecture:** Keep `scheduleMatrixStore` and `lateScheduleStore` as the source-of-truth stores. Add pure projection functions that normalize active published Schedule assignments and active OT assignments into dated occurrences without inventing missing months. Rebuild the desktop OT grid and exports from the same export model, while preserving the current mobile seven-day editor and the 0–2 employee assignment rule.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, ExcelJS, Vitest, Testing Library.

## Global Constraints

- Preserve the official 29-person roster and stable employee IDs in `src/data/officialEmployeeRoster.ts`.
- Do not restore `Compact Month` anywhere.
- Exclude archived OT rows and archived Schedule units/definitions from projections, UI, exports, and reports.
- Treat only `matricesByMonth` as published Schedule history; do not generate missing months or use mock schedules as fallback.
- Keep internal `morning` keys for backward compatibility, but all visible English copy must say `Day Shift`.
- Keep the existing seven-day mobile OT interaction and the maximum of two employees per OT cell.
- Use website design tokens in light/dark modes; do not reproduce the Excel worksheet canvas, Calibri-only styling, black worksheet borders, or the right-side worksheet legend.
- All icon-only controls must have accessible names and at least 44×44 px targets.

---

## Task 1: Add a normalized operational schedule projection

**Files:**

- Create: `src/types/operationalSchedule.ts`
- Create: `src/lib/operationalSchedule.ts`
- Create: `src/lib/operationalSchedule.test.ts`
- Read: `src/lib/scheduleMatrixArchive.ts`
- Read: `src/stores/scheduleMatrixStore.ts`
- Read: `src/stores/lateScheduleStore.ts`

- [ ] Write failing tests that prove the projection:

  - emits one occurrence per employee assignment;
  - maps `morning`, `evening`, `night`, `onCall`, `onCallNight`, and OT to stable public categories;
  - includes facility, unit, label, time range, employee identity, source, and OT hours;
  - drops archived rows/units/shift definitions;
  - includes only dates inside the requested inclusive period;
  - marks unresolved OT employee codes without assigning them to another employee;
  - carries Schedule conflict details and marks assignments whose employee has an approved vacation on that date;
  - returns no occurrences for absent month keys.

- [ ] Define the shared contracts exactly:

```ts
export type OperationalShiftCategory =
  | 'day'
  | 'late'
  | 'night'
  | 'onCallDay'
  | 'onCallNight'
  | 'ot';

export interface OperationalPeriod {
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string;   // YYYY-MM-DD, inclusive
}

export interface OperationalOccurrence {
  id: string;
  date: string;
  source: 'schedule' | 'ot';
  employeeId?: string;
  employeeCode: string;
  unresolvedEmployee: boolean;
  category: OperationalShiftCategory;
  label: string;
  facility: string;
  unit: string;
  timeRange: string;
  hours: number;
  rowId: string;
  hasConflict: boolean;
  conflictReason?: string;
  isOnApprovedVacation: boolean;
}
```

- [ ] Implement these pure exports in `src/lib/operationalSchedule.ts`:

```ts
export function collectPublishedOperationalOccurrences(
  period: OperationalPeriod,
  matricesByMonth: Record<string, ScheduleMatrixData>,
  otRowsByMonth: Record<string, OTShiftRow[]>,
  roster: UnifiedEmployee[],
): OperationalOccurrence[];

export function monthKeysInPeriod(period: OperationalPeriod): string[];
```

- [ ] Use local calendar dates, not `toISOString()` on local `Date` objects, to avoid timezone day shifts.
- [ ] Sort deterministically by date, category, facility, unit, row, and employee code.
- [ ] Run `npm test -- src/lib/operationalSchedule.test.ts`; expect all new tests to pass.
- [ ] Commit: `git add src/types/operationalSchedule.ts src/lib/operationalSchedule.ts src/lib/operationalSchedule.test.ts && git commit -m "feat: add published operational schedule projection"`.

---

## Task 2: Lock the website-native OT desktop contract with tests

**Files:**

- Modify: `src/features/late-schedule/LateScheduleDesktopGrid.test.tsx`
- Modify: `src/features/late-schedule/LateSchedulePage.integration.test.tsx`
- Read: `src/features/late-schedule/LateScheduleMobileWeek.test.tsx`

- [ ] Replace Excel-replica assertions with failing assertions for:

  - a surface using `bg-surface`, `border-border`, and normal application typography;
  - a compact sticky metadata column containing shift, location, time, and hours;
  - sticky day headers with weekday and day number;
  - weekend column accents from design tokens rather than `#737373`;
  - employee chips/codes inside cells and a visible unresolved `?` marker;
  - each resolved assignment shows the employee code and a truncated current name;
  - edit controls only for admins;
  - an internal horizontal scroll region plus a visible scroll hint;
  - no `ot-excel-canvas`, Excel title block, or right-side employee legend.

- [ ] Preserve tests proving one and two employees render in the same cell and clicking the cell opens the existing assignment panel without closing after the first selection.
- [ ] Preserve the mobile-week tests unchanged except for shared copy updates.
- [ ] Run `npm test -- src/features/late-schedule/LateScheduleDesktopGrid.test.tsx src/features/late-schedule/LateSchedulePage.integration.test.tsx`; expect failures that identify the current Excel-replica markup.

---

## Task 3: Rebuild the OT desktop grid in the website design system

**Files:**

- Modify: `src/features/late-schedule/LateScheduleDesktopGrid.tsx`
- Modify: `src/features/late-schedule/LateSchedulePage.tsx`
- Modify: `src/features/late-schedule/LateScheduleToolbar.tsx`
- Modify: `src/features/late-schedule/LateScheduleStats.tsx`
- Modify: `src/i18n/locales/en/schedule.json`
- Modify: `src/i18n/locales/ar/schedule.json`

- [ ] Replace the worksheet structure with this hierarchy:

```text
Card surface
├─ sticky header row: Shift details | actual month days
├─ active OT row
│  ├─ shift title, facility, time, hours, edit action
│  └─ day cells containing 0–2 assignment chips
└─ internal-scroll hint
```

- [ ] Keep the component `dir` inherited from the application; keep time and employee codes `dir="ltr"` locally.
- [ ] Render active rows only in the grid. Keep the existing `Active / Archived` admin tabs and Restore flow in `LateSchedulePage`.
- [ ] Keep the notice as the existing application alert above the grid. Remove notice rendering from inside the desktop table.
- [ ] Keep stats collapsible and secondary. The toolbar order is month navigation, search, primary add action, export menu, and stats toggle.
- [ ] Use `min-w-[3.25rem]` day cells, `max-h-[68vh]`, sticky header, and sticky first column; constrain horizontal scrolling to the grid container.
- [ ] Add localized labels for `shiftDetails`, `weekday`, `weekend`, `scrollMoreDays`, `assignedEmployees`, `unresolvedEmployee`, and export-menu copy.
- [ ] Run the Task 2 tests; expect them to pass.
- [ ] Run `npm test -- src/features/late-schedule/LateScheduleMobileWeek.test.tsx src/features/late-schedule/OTAssignmentPanel.test.tsx`; expect the mobile and 0–2 selection behavior to remain green.
- [ ] Commit: `git add src/features/late-schedule/LateScheduleDesktopGrid.tsx src/features/late-schedule/LateScheduleDesktopGrid.test.tsx src/features/late-schedule/LateSchedulePage.tsx src/features/late-schedule/LateSchedulePage.integration.test.tsx src/features/late-schedule/LateScheduleToolbar.tsx src/features/late-schedule/LateScheduleStats.tsx src/i18n/locales/en/schedule.json src/i18n/locales/ar/schedule.json && git commit -m "feat: restore website-native OT schedule"`.

---

## Task 4: Redesign the OT export model and Excel workbook

**Files:**

- Modify: `src/lib/lateScheduleExport.test.ts`
- Modify: `src/lib/lateScheduleExport.ts`

- [ ] Replace the current Excel-coordinate tests with failing workbook-contract tests that require:

  - worksheet 1 named `OT Schedule`;
  - a merged branded title row containing `OT Schedule` and the selected month;
  - a notice row beneath the title when notice text exists;
  - metadata columns `Shift`, `Location`, `Time`, `Hours` followed by only the real days in the month;
  - visible weekday/day headers and website palette fills;
  - frozen top rows and the four metadata columns;
  - landscape orientation, `fitToWidth: 1`, and repeating header rows;
  - active rows only, 0–2 codes per cell, and `?` for unresolved codes;
  - worksheet 2 named `Employees` with exactly the official 29 employees and full uncut names.

- [ ] Replace Excel-source-specific constants with a named website export palette:

```ts
const EXPORT_COLORS = {
  brand: 'FF0F6B78',
  brandDark: 'FF173952',
  surface: 'FFFFFFFF',
  surfaceMuted: 'FFF1F5F7',
  weekend: 'FFE4EEF1',
  border: 'FFB8C7CD',
  accent: 'FFF9E298',
  unresolved: 'FFFFE4E6',
} as const;
```

- [ ] Keep `buildLateScheduleExportModel` as the single roster-resolution layer used by Excel and PDF.
- [ ] Remove source-template helpers such as `referenceRowLabel`, fixed `J6:S7` merges, `AI:AK` roster placement, and Excel worksheet legend colors.
- [ ] Set `sheet.views` to freeze rows through the header and columns through `Hours`; set print titles for the header rows.
- [ ] Ensure February and other short months create only real day columns.
- [ ] Run `npm test -- src/lib/lateScheduleExport.test.ts`; expect workbook tests and ExcelJS serialization round-trip to pass.

---

## Task 5: Redesign OT PDF/print output from the same model

**Files:**

- Modify: `src/lib/lateScheduleExport.test.ts`
- Modify: `src/lib/lateScheduleExport.ts`

- [ ] Add failing HTML assertions for:

  - A4 landscape output with a branded header and explicit period;
  - a compact grid matching the website palette;
  - metadata columns before day columns;
  - row pagination with repeated table headers;
  - the notice in the header area, not a worksheet-style bordered box;
  - a later employee legend section, not a right-side worksheet legend;
  - escaped user-provided labels/notice and visible unresolved markers;
  - no Calibri worksheet canvas, gray Excel title rectangle, or CSS scaling/zoom.

- [ ] Implement deterministic row pagination. Use 12 OT rows per printed page and repeat the title, period, notice, and header on every schedule page.
- [ ] Append one or more employee-directory pages after schedule pages, 29 entries total, using a two-column card table.
- [ ] Keep the current hidden-iframe print mechanism in `exportLateSchedulePdf`; change only the generated document.
- [ ] Run `npm test -- src/lib/lateScheduleExport.test.ts`; expect all export tests to pass.
- [ ] Commit: `git add src/lib/lateScheduleExport.ts src/lib/lateScheduleExport.test.ts && git commit -m "feat: restore website-styled OT exports"`.

---

## Task 6: Verify OT and shared projection integration

**Files:**

- Modify only if tests expose a defect: `src/features/late-schedule/LateSchedulePage.tsx`
- Modify only if tests expose a defect: `src/stores/lateScheduleStore.ts`

- [ ] Run targeted tests:

```powershell
npm test -- src/lib/operationalSchedule.test.ts src/lib/lateScheduleExport.test.ts src/features/late-schedule/LateScheduleDesktopGrid.test.tsx src/features/late-schedule/LateSchedulePage.integration.test.tsx src/features/late-schedule/LateScheduleMobileWeek.test.tsx src/features/late-schedule/OTAssignmentPanel.test.tsx src/stores/lateScheduleStore.test.ts
```

Expected: all listed tests pass.

- [ ] Run `npm run build`; expect TypeScript and Vite to finish successfully.
- [ ] Run `npm run lint -- src/lib/operationalSchedule.ts src/lib/lateScheduleExport.ts src/features/late-schedule`; expect no new lint errors.
- [ ] At 1440 px, verify light/dark and Arabic/English: sticky day header, sticky shift column, internal horizontal scroll, readable employee chips, no page overflow, no Excel replica.
- [ ] At 390 px, verify the seven-day workflow, one/two employee selection, archive visibility rules, and 44×44 px controls.
- [ ] Export July 2026 and February 2026 to Excel/PDF; inspect active-row filtering, real month length, 29-person directory, page readability, and unresolved `?` markers.
- [ ] Commit any verification-only corrections with `git commit -m "fix: complete OT design regression checks"`.
