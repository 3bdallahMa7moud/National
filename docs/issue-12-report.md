# Issue 12 — Verified Dead Code and Controlled Module Decomposition

## Scope and method

This pass was limited to Issue 12. The existing modified and untracked working
tree was treated as user-owned.

Reachability was checked from `src/main.tsx` with a TypeScript-syntax import
graph that follows static imports, re-exports, and literal dynamic imports.
Test reachability was calculated separately from every `*.test.ts(x)` file and
`src/test/setup.ts`. The result was cross-checked against:

- all route declarations and lazy imports in `src/app/routes.tsx`;
- package scripts, Vite, Vitest, TypeScript, Playwright, and ESLint config;
- E2E files;
- public asset strings in source, HTML, CSS, export code, and tests;
- service-worker registration and filename references;
- `rg` reference searches, ESLint, TypeScript's unused-symbol flags, the
  TypeScript type-check, and the Vite production graph.

No dedicated unused-file package such as Knip is installed. No dependency was
added just for the audit; the compiler-backed graph, TypeScript unused-symbol
check, and ESLint were used instead.

## Reachability inventory

The post-change source graph contains 251 TS/TSX/JS/JSX declaration modules:
177 production-active modules, 55 test-only modules, 18 disconnected modules
retained for a scope or product decision, and `src/vite-env.d.ts`.

### Production-active modules (177)

| Responsibility | Count |
| --- | ---: |
| `app` | 3 |
| `components/common` | 12 |
| `components/schedule` | 13 |
| `components/ui` | 7 |
| `data` | 2 |
| `features/auth` | 7 |
| `features/calendar-sync` | 1 |
| `features/dashboard` | 8 |
| `features/departments` | 1 |
| `features/employee-justification` | 1 |
| `features/employees` | 6 |
| `features/late-schedule` | 9 |
| `features/notifications` | 1 |
| `features/reports` | 4 |
| `features/schedule` | 18 |
| `features/shift-requests` | 4 |
| `hooks` | 7 |
| `i18n` | 5 |
| `layouts` | 3 |
| `lib` | 29 |
| `main.tsx` | 1 |
| `mocks` | 6 |
| `stores` | 12 |
| `types` | 17 |

The active route declarations are unchanged:

`/`, `/login`, `/forgot-password`, `/403`, `admin/dashboard`,
`admin/schedule`, `admin/late-schedule`, `admin/employees`,
`admin/departments`, `admin/reports`, `admin/audit-log`,
`admin/shift-requests`, `admin/employee-justification`,
`employee/dashboard`, `schedule/me`, `schedule/department`,
`late-schedule`, `calendar-sync`, `shift-requests`, `notifications`,
`profile`, and `*`.

The duplicate `/` declaration is intentional in the current router structure
(landing redirect and guarded layout).

### Test-only modules (55)

The 49 `*.test.ts(x)` modules are test roots. These six non-test modules are
reachable only from tests/test setup and were retained:

- `src/features/schedule/DepartmentScheduleDesktop.tsx`
- `src/features/schedule/DepartmentScheduleMobile.tsx`
- `src/features/schedule/EmployeeScheduleMonth.tsx`
- `src/features/schedule/EmployeeScheduleWeek.tsx`
- `src/test/axe.ts`
- `src/test/setup.ts`

The four schedule renderers need a later test-ownership decision before
removal because current tests intentionally import them even though the
production routes use the newer published schedule surface.

### Verified legacy modules removed

All 15 modules under `src/features/schedule-management/` formed one closed
import island. Nothing outside that directory imported its page, components,
hooks, types, constants, or mock generator. No route, lazy import, test,
package script, or public asset referenced the feature.

### Other verified unreachable files removed

- Comment-only app placeholders:
  `src/app/config.ts`, `src/app/providers.tsx`, `src/app/router.tsx`
- Comment-only placeholders:
  `src/components/common/ToastProvider.tsx`,
  `src/features/reports/AdminDashboardPage.tsx`,
  `src/mocks/browser.ts`, `src/mocks/handlers.ts`
- Unregistered, comment-only service worker:
  `public/firebase-messaging-sw.js`
- Unreferenced old exporter:
  `src/lib/justificationHtmlDocxExport.ts`
- Unreferenced scaffold/media assets:
  `src/assets/hero.webp`, `src/assets/react.svg`, `src/assets/vite.svg`,
  `public/icons.svg`

The HTML DOCX exporter had no importer and referenced a package that is not in
the manifest. The active justification flow uses
`src/lib/justificationDocxExport.ts`.

The remaining public assets are all accounted for:

- `favicon.svg` and `theme-bootstrap.js`: referenced by `index.html`
- `ct-logo.png` and `mngha-logo.png`: referenced by justification/export UI
- responsive Saudi hospital images: referenced by active login and password
  recovery UI (and by the retained registration page)
- `robots.txt`: covered by the internal-indexing test and deployment policy

### Dependencies removed

`framer-motion` and `date-fns` were imported only by the removed legacy
schedule-management feature. They were removed from `package.json`,
`package-lock.json`, and the installed dependency tree. The obsolete
`framer-motion` manual chunk declaration was also removed.

### Disconnected files retained by explicit scope boundary

These files have no active or test importer, but Issue 12 was instructed not to
remove API/socket infrastructure that overlaps Issue 7:

- `src/lib/axios.ts`
- `src/lib/socket.ts`
- `src/hooks/useSocket.ts`

### Uncertain files requiring manual confirmation

These modules are disconnected in the current repository, but this pass did
not delete them because their intended product ownership is unclear or current
working-tree changes suggest an in-progress transition:

- Modified, unrouted registration surface:
  `src/features/auth/RegisterPage.tsx`
- Suspected older schedule slice:
  `src/components/common/BulkEditPanel.tsx`,
  `src/components/common/ShiftBadge.tsx`,
  `src/features/schedule/CellEditModal.tsx`,
  `src/features/schedule/ScheduleCalendar.tsx`,
  `src/hooks/useSchedule.ts`,
  `src/i18n/helpers.ts`,
  `src/stores/scheduleStore.ts`
- Standalone presentational/hooks with no consumer:
  `src/components/common/AuditLogRow.tsx`,
  `src/components/common/EmptyState.tsx`,
  `src/components/common/LoadingSkeleton.tsx`,
  `src/components/common/StatCard.tsx`,
  `src/features/late-schedule/LateScheduleStats.tsx`,
  `src/features/schedule/AssignmentPopover.tsx`,
  `src/hooks/useAuth.ts`

`src/features/shift-requests/ShiftRequestsPage.tsx` was specifically retained:
its default page is not routed, but its `ShiftRequestCreateModal` named export
is consumed by three active pages. Deleting the file would break active
behavior and public exports.

## Controlled decomposition

### Selected module

`src/stores/scheduleMatrixStore.ts` was selected because it was the largest
active module (2,302 lines) and owns fragile schedule draft, publish,
persistence, migration, rollback, copy/paste, and version behavior. It also had
the strongest existing characterization coverage among the oversized
candidates.

Before the split, a characterization test was added and passed for the storage
contract: persisted drafts omit empty cells, audit entries, and roster data,
then reload with complete day cells and the official roster restored.

### New boundaries

- `src/stores/scheduleMatrixPersistence.ts` (269 lines): browser-storage keys,
  v1/v2-to-v3 reads, status normalization, sparse serialization, hydration,
  monthly persistence, and storage failure signaling.
- `src/stores/scheduleMatrixMonthOperations.ts` (154 lines): cloning, clearing,
  structure-only reset, assignment counting, cross-month paste/clamping,
  deleted-month shells, recovery-version creation, and month-key generation.
- `src/stores/scheduleMatrixStore.ts` (2,001 lines): unchanged Zustand facade,
  UI state, schedule mutations, conflict orchestration, audit orchestration,
  and rollback subscription.

The store still exports the same existing API: its three storage keys,
`EmployeeIdentityUpdateResult`, `useScheduleMatrixStore`, and the existing
re-exported schedule types. All pre-existing active module export surfaces
compare equal before and after. The two new modules are internal additions.

## Validation

| Check | Result |
| --- | --- |
| Removed-file/import reference search | Pass; no references remain |
| Compiler-backed reachability check | Pass; 177 active, 55 test-only, 18 deliberately retained disconnected modules |
| Active route comparison | Pass; all route declarations unchanged |
| Existing exported API comparison | Pass; no existing active module export added, removed, or renamed |
| Characterization tests | Pass; 23/23 schedule matrix store tests |
| Full test suite | Pass; 49 files, 201 tests |
| Targeted ESLint on changed store files | Pass |
| Full ESLint | Baseline failure unchanged: unused `totalHours` in `LateSchedulePage.tsx` |
| TypeScript type-check | Baseline failure unchanged: two incomplete `AuthUser` fixtures in `notificationNavigation.test.ts` |
| TypeScript unused-symbol check | Existing diagnostics only: stale React imports/test parameters, `totalHours`, `lang`, plus the two fixture type errors |
| `npm run build` | Stops at the same two pre-existing fixture type errors |
| Direct Vite production bundle | Pass; 2,519 modules transformed |
| Installed dependency tree | Pass; no missing or extraneous top-level packages |
| Removed dependency check | Pass; `framer-motion` and `date-fns` absent |

## Files changed by Issue 12

- Added:
  `src/stores/scheduleMatrixPersistence.ts`,
  `src/stores/scheduleMatrixMonthOperations.ts`,
  `docs/issue-12-report.md`
- Modified:
  `src/stores/scheduleMatrixStore.ts`,
  `src/stores/scheduleMatrixStore.test.ts`,
  `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`
- Removed:
  the 15-file `src/features/schedule-management/` tree and the 13 other files
  listed in the dead-file inventory above

## Recommended next target

The next controlled decomposition target should be
`src/features/shift-requests/components/ShiftRequestCreateWizard.tsx`
(1,562 lines). A future pass should first characterize step transitions,
permission combinations, initial-assignment behavior, and submit results, then
extract a wizard state hook and responsibility-specific step components while
preserving `ShiftRequestCreateWizard` and its props. It was not refactored in
this pass.
