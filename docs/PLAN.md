# Frontend-Only Project Audit and Remediation Plan

## 1. Executive Summary

The application is a substantial React 18, TypeScript, Vite, Tailwind, Zustand, React Query, and Vitest SPA. The production build and 137 automated tests pass, but the project is **not production-ready**.

It is suitable only as a prototype using synthetic data. Authentication, authorization, passwords, schedules, employee records, notifications, and audit data are controlled entirely in the browser. No frontend-only change can make that model secure for real hospital data.

| Severity | Findings |
| --- | ---: |
| Critical | 1 |
| High | 3 |
| Medium | 11 |
| Low | 3 |
| Suggestion | 1 |
| **Total** | **19** |

Top risks:

1. Any visitor can forge authentication and administrative access.
2. Conditional React hooks can cause render-order crashes.
3. The calendar subscription URL is predictable and lacks a revocable secret.
4. Production dependencies contain one high and four moderate vulnerabilities.
5. Missing Tailwind tokens silently remove intended warning, border, background, and dark-mode styles.

Strengths:

- Strict application TypeScript compilation and the production build pass.
- All 29 test files and 137 tests pass.
- Routes are lazy-loaded and heavy Excel exports are already loaded on demand.
- Stores have unusually good persistence-failure, migration, transaction, and rollback tests.
- RTL, dark mode, logical CSS properties, reduced-motion support, error boundaries, and mobile-specific schedule views are present.
- No active `dangerouslySetInnerHTML`, `eval`, or obvious unescaped print-export XSS sink was found.

No tracked or source files were modified. The 28 existing working-tree changes were present before the audit and remain unchanged. Build execution regenerated ignored `dist/` artifacts; temporary logs remained under ignored `tmp/`.

## 2. Command Results

| Check | Result | Main errors |
| --- | --- | --- |
| TypeScript | Pass through `npm run build` | Application config passes; tooling configs are not included in the root TS reference graph. |
| ESLint | **Fail** | 70 errors, 2 warnings. Includes conditional hooks, `any`, unused imports, and missing effect dependencies. |
| Production build | Pass | 2,503 modules; 41.23 s. Warnings for modules imported both statically and dynamically. |
| Tests | Pass | 29 files, 137 tests. Error-boundary tests emit expected stack traces to stderr. |
| Full dependency audit | **Fail** | 6 vulnerable packages: 2 high, 4 moderate. |
| Production-only audit | **Fail** | 5 vulnerable packages: 1 high, 4 moderate. |
| Installed dependency tree | Pass | `npm ls --depth=0` found no missing or extraneous top-level packages. |
| Unused dependency command | Not configured | Static inspection found unused or effectively unused candidates. |
| Formatting check | Not configured | No formatting script or formatter configuration. |
| Coverage | Not configured | No coverage thresholds or report script. |
| E2E/accessibility browser checks | Not tested | The browser-control skill found no available browser; viewport, keyboard, console, and visual checks could not be run. |

Important build sizes:

- Initial application: 250.60 kB JS / 77.91 kB gzip.
- Initial icons chunk: 53.43 kB / 11.51 kB gzip.
- CSS: 123.93 kB / 20.36 kB gzip.
- Employee justification route: 418.41 kB / 115.79 kB gzip.
- Charts: 539.51 kB / 153.67 kB gzip.
- ExcelJS: 939.80 kB / 271.12 kB gzip, loaded on demand.
- Complete generated deployment: 6.61 MiB.

## 3. Issues

### 1. Browser storage is the authentication and authorization boundary

- **Severity:** Critical
- **Category:** Security / Architecture
- **File and line:** [authStore.ts](/D:/National/frontend/src/stores/authStore.ts:80), [mockData.ts](/D:/National/frontend/src/mocks/mockData.ts:65), [mockPasswordStore.ts](/D:/National/frontend/src/mocks/mockPasswordStore.ts:21), [RouteGuard.tsx](/D:/National/frontend/src/features/auth/RouteGuard.tsx:17), [ForgotPasswordPage.tsx](/D:/National/frontend/src/features/auth/ForgotPasswordPage.tsx:130)
- **Problem:** Authentication accepts any stored token, user roles and permissions come from editable browser data, passwords are stored in plaintext, all accounts default to `123456`, and the reset OTP is generated and displayed by the same client.
- **Evidence:** `isAuthenticated` checks only token presence; login returns `mock-jwt-token-*`; the login page publishes administrative credentials; the reset page displays `generatedOtp`.
- **Impact:** A visitor can impersonate employees, elevate privileges, reset passwords, alter schedules, and modify audit records. Real employee and scheduling data cannot safely use this model.
- **Recommended fix:** Implement server-validated sessions, authorization on every mutation/read, server-side password recovery, and server-owned audit records. Use secure cookies rather than client-readable bearer tokens. If the product must remain frontend-only, restrict it to synthetic demo data and label it explicitly as non-production.
- **Affected files:** Authentication, route guards, all persisted stores, mocks, employee/schedule administration.
- **Fix risk:** High; requires a real service boundary and data migration.
- **Priority:** P0, deployment blocker.

### 2. Active components call hooks conditionally

- **Severity:** High
- **Category:** React correctness
- **File and line:** [EmployeeJustificationPage.tsx](/D:/National/frontend/src/features/employee-justification/EmployeeJustificationPage.tsx:245), [ShiftRequestCreateWizard.tsx](/D:/National/frontend/src/features/shift-requests/components/ShiftRequestCreateWizard.tsx:190)
- **Problem:** Both components return before later `useEffect`, `useCallback`, or `useMemo` calls.
- **Evidence:** ESLint reports nine conditional-hook errors in the justification page and one in the request wizard.
- **Impact:** Changes in authentication or props can produce “Rendered more/fewer hooks than expected” crashes.
- **Recommended fix:** Put the guard in a wrapper component or move every hook above the return. Add tests that render without a user and then provide/remove one.
- **Affected files:** The two files above and their tests.
- **Fix risk:** Low to medium.
- **Priority:** P0.

### 3. Calendar subscription URLs are predictable and lack a revocable secret

- **Severity:** High
- **Category:** Security / Privacy / Functionality
- **File and line:** [CalendarSyncPage.tsx](/D:/National/frontend/src/features/calendar-sync/CalendarSyncPage.tsx:10)
- **Problem:** The feed URL contains only a predictable employee ID and fixed department path.
- **Evidence:** `https://hospital.sa/.../${user.id}/ct-department.ics` is shown and copied without an unguessable token or server request.
- **Impact:** If the endpoint serves data, employee schedules may be enumerable. If it requires ordinary authentication, Google/Apple/Outlook subscriptions cannot consume it and the feature is nonfunctional.
- **Recommended fix:** Request a long, random, per-user, revocable subscription URL from an authenticated backend. Support rotation and revocation, and never derive feed access from an employee ID.
- **Affected files:** Calendar page/card and the future calendar-feed API.
- **Fix risk:** Medium to high.
- **Priority:** P0.

### 4. Production dependency vulnerabilities remain open

- **Severity:** High
- **Category:** Dependency security
- **File and line:** [package.json](/D:/National/frontend/package.json:26), [package.json](/D:/National/frontend/package.json:34), [package.json](/D:/National/frontend/package.json:54)
- **Problem:** The production audit reports vulnerable `brace-expansion`, `react-router`, `react-router-dom`, `uuid`, and `exceljs`. Full audit additionally reports vulnerable PostCSS.
- **Evidence:** Production audit: one high and four moderate vulnerabilities. Installed React Router DOM is 6.30.4, within the reported open-redirect/XSS advisory range.
- **Impact:** Denial of service in dependency tooling/export paths and potentially unsafe navigation handling.
- **Recommended fix:** Upgrade React Router and PostCSS to patched versions; update or override vulnerable brace-expansion parents; evaluate a compatible UUID override or ExcelJS replacement. Do not blindly accept npm’s suggested ExcelJS downgrade without export regression tests.
- **Affected files:** Package manifest, lockfile, routing tests, export tests.
- **Fix risk:** Medium.
- **Priority:** P0/P1.

### 5. The lint release gate fails

- **Severity:** Medium
- **Category:** Code quality / Release process
- **File and line:** [package.json](/D:/National/frontend/package.json:9), [routes.tsx](/D:/National/frontend/src/app/routes.tsx:24), [AdminShiftRequestsPage.tsx](/D:/National/frontend/src/features/shift-requests/AdminShiftRequestsPage.tsx:199)
- **Problem:** ESLint reports 70 errors and 2 warnings.
- **Evidence:** Besides conditional hooks, results include unused imports/state, eleven explicit `any` usages, and two missing memo dependencies.
- **Impact:** Defects are hidden among accumulated warnings, and CI cannot use lint as a reliable release gate.
- **Recommended fix:** Fix hook errors first, then dependency warnings, `any`, and dead symbols. Require zero ESLint errors in CI.
- **Affected files:** Approximately two dozen active and test files.
- **Fix risk:** Low to medium.
- **Priority:** P1.

### 6. Undefined Tailwind utilities silently remove intended styling

- **Severity:** Medium
- **Category:** UI / Styling / Dark mode
- **File and line:** [tailwind.config.js](/D:/National/frontend/tailwind.config.js:1), [ShiftRequestCreateWizard.tsx](/D:/National/frontend/src/features/shift-requests/components/ShiftRequestCreateWizard.tsx:292), [ScheduleSettingsPanel.tsx](/D:/National/frontend/src/features/schedule/ScheduleSettingsPanel.tsx:416)
- **Problem:** Active pages use `bg-surface-card`, `bg-surface-hover`, `border-border-subtle`, `border-border-strong`, `text-error`, `bg-error`, and undefined success shades. `h-8.5` and `mt-7.5` are also unsupported.
- **Evidence:** The generated CSS contains zero matching rules for these utilities.
- **Impact:** Conflict warnings, card backgrounds, borders, hover states, control heights, and dark-mode separation are silently lost.
- **Recommended fix:** Standardize the token vocabulary: alias `error` to `danger`, define card/hover/subtle/strong tokens for both themes, add required success shades or replace them with existing ones, and convert unsupported spacing to arbitrary values such as `h-[2.125rem]`.
- **Affected files:** Shift-request wizard/pages, employee pages, justification page, and schedule settings.
- **Fix risk:** Medium because the visual impact is broad.
- **Priority:** P1.

### 7. The API and socket layers are disconnected and inconsistent

- **Severity:** Medium
- **Category:** API integration
- **File and line:** [axios.ts](/D:/National/frontend/src/lib/axios.ts:10), [authStore.ts](/D:/National/frontend/src/stores/authStore.ts:47), [socket.ts](/D:/National/frontend/src/lib/socket.ts:3), [useSocket.ts](/D:/National/frontend/src/hooks/useSocket.ts:4)
- **Problem:** Axios reads a token from `localStorage`, while authentication migrates it to `sessionStorage`. Axios, socket helpers, and `useSocket` have no active consumers.
- **Evidence:** Static import search found no API calls or socket-hook usage.
- **Impact:** Turning on the existing client would send unauthenticated requests, while production UI continues to use mocks and browser storage.
- **Recommended fix:** Introduce one typed service adapter for session, schedules, employees, notifications, and calendar feeds. Read credentials through the auth/session abstraction. Remove unused clients if the application remains a demo.
- **Affected files:** API/socket helpers, auth store, feature stores and hooks.
- **Fix risk:** High for a production migration.
- **Priority:** P1.

### 8. Application boot loads every translation namespace and has no failure UI

- **Severity:** Medium
- **Category:** Performance / Resilience
- **File and line:** [main.tsx](/D:/National/frontend/src/main.tsx:7), [i18n/index.ts](/D:/National/frontend/src/i18n/index.ts:46)
- **Problem:** Rendering waits for all 14 namespaces for the selected language. A rejected import prevents React and the error boundary from mounting.
- **Evidence:** `Promise.all(NAMESPACES.map(...))` completes before `createRoot`.
- **Impact:** Fourteen module requests precede the login screen, and a chunk/network failure produces a blank page.
- **Recommended fix:** Bootstrap only `common`, `auth`, `forms`, and `errors`; load feature namespaces at their route boundary. Mount an accessible startup state and show a retryable error when initialization fails.
- **Affected files:** Entry point, i18n loader, route wrappers.
- **Fix risk:** Medium.
- **Priority:** P1.

### 9. Dialogs, popovers, and notification rows are not fully keyboard accessible

- **Severity:** Medium
- **Category:** Accessibility
- **File and line:** [Modal.tsx](/D:/National/frontend/src/components/ui/Modal.tsx:33), [NotificationCenter.tsx](/D:/National/frontend/src/components/common/NotificationCenter.tsx:57), [NotificationsPage.tsx](/D:/National/frontend/src/features/notifications/NotificationsPage.tsx:73)
- **Problem:** Modal focus is initialized and restored but not trapped. Notification rows are clickable `div` elements without keyboard semantics, and popovers lack complete menu/focus behavior.
- **Evidence:** Tab wrapping is absent; notification activation exists only in `onClick`.
- **Impact:** Keyboard and assistive-technology users can escape dialogs or cannot open notifications.
- **Recommended fix:** Add a tested focus trap and inert background behavior to the modal primitive. Render notifications as semantic lists with separate primary-action and delete buttons. Add Escape handling, focus return, and `aria-controls`/`aria-expanded` to popovers.
- **Affected files:** Modal, notification center/page, topbar menus, related tests.
- **Fix risk:** Medium.
- **Priority:** P1.

### 10. Form semantics, touch targets, and light-mode contrast need accessibility remediation

- **Severity:** Medium
- **Category:** Accessibility / UX
- **File and line:** [Input.tsx](/D:/National/frontend/src/components/ui/Input.tsx:24), [ForgotPasswordPage.tsx](/D:/National/frontend/src/features/auth/ForgotPasswordPage.tsx:486), [EmployeeJustificationPage.tsx](/D:/National/frontend/src/features/employee-justification/EmployeeJustificationPage.tsx:1210), [schedule-tokens.css](/D:/National/frontend/src/styles/schedule-tokens.css:13)
- **Problem:** Errors and hints are not connected with `aria-describedby`; invalid fields lack `aria-invalid`; six OTP inputs have no accessible names; multiple icon-only buttons lack labels and are about 20–22 px. Light `text-muted` is 3.82:1, danger 3.73:1, and warning 2.15:1 on white.
- **Evidence:** `text-text-muted` appears 83 times, including 10–12 px content.
- **Impact:** Screen-reader context is incomplete, touch controls are difficult to activate, and normal-size text can fail WCAG AA.
- **Recommended fix:** Generate stable input/error IDs, connect descriptions, label OTP digits through a fieldset/legend, name icon buttons, use at least 44 px touch targets for mobile controls, and use verified ≥4.5:1 tokens for small text.
- **Affected files:** Shared input and button primitives, auth recovery, justification editor, status badges and token CSS.
- **Fix risk:** Medium.
- **Priority:** P1/P2.

### 11. Feature routes ship avoidable image and export weight

- **Severity:** Medium
- **Category:** Performance
- **File and line:** [LoginPage.tsx](/D:/National/frontend/src/features/auth/LoginPage.tsx:64), [EmployeeJustificationPage.tsx](/D:/National/frontend/src/features/employee-justification/EmployeeJustificationPage.tsx:35), [saudi-hospital.webp](/D:/National/frontend/public/saudi-hospital.webp)
- **Problem:** The `.webp` hero is actually an 894,817-byte JPEG and is byte-identical to `saudi-hospital.png`. Two 1080×1080 logos consume 985,620 and 807,498 bytes but display at 68 px. DOCX code is statically imported into the 418 kB justification route.
- **Evidence:** File magic identifies both hospital assets as JPEG. Build reports 115.79 kB gzip for the justification route before its images.
- **Impact:** Slow login and justification loading, especially on mobile or hospital networks.
- **Recommended fix:** Produce real responsive WebP/AVIF hero assets, optimize logos to SVG or appropriately sized compressed images, remove the duplicate, and dynamically import DOCX generation only when export is requested.
- **Affected files:** Public assets, auth pages, justification page/export.
- **Fix risk:** Low to medium.
- **Priority:** P2.

### 12. Parallel legacy implementations and oversized modules increase change risk

- **Severity:** Medium
- **Category:** Architecture / Maintainability
- **File and line:** [ScheduleManagementPage.tsx](/D:/National/frontend/src/features/schedule-management/ScheduleManagementPage.tsx:20), [routes.tsx](/D:/National/frontend/src/app/routes.tsx:24), [scheduleMatrixStore.ts](/D:/National/frontend/src/stores/scheduleMatrixStore.ts:1), [ShiftRequestCreateWizard.tsx](/D:/National/frontend/src/features/shift-requests/components/ShiftRequestCreateWizard.tsx:65)
- **Problem:** An unreferenced parallel `schedule-management` feature remains beside the active schedule implementation. Register, old shift-request, placeholder app, mock-worker, API, and socket files are unreachable or unused. Major files range from 1,199 to 2,302 lines.
- **Evidence:** The old shift-request page is lazy-declared but never routed; the legacy schedule feature has no external consumer.
- **Impact:** Dependency scans and lint include abandoned code, ownership is unclear, and large modules make hooks, persistence, and UI behavior hard to change safely.
- **Recommended fix:** Remove verified unreachable implementations and placeholder files. Split the justification page, request wizard, and schedule store into domain selectors/reducers, persistence adapters, step components, and rendering components while keeping a stable public facade.
- **Affected files:** Legacy schedule-management folder, app placeholders, shift requests, justification, schedule store.
- **Fix risk:** Medium.
- **Priority:** P2.

### 13. Tests do not cover the highest-risk user flows

- **Severity:** Medium
- **Category:** Testing
- **File and line:** [package.json](/D:/National/frontend/package.json:10), [RouteGuard.test.tsx](/D:/National/frontend/src/features/auth/RouteGuard.test.tsx:1)
- **Problem:** Store/domain coverage is strong, but there are no E2E tests, coverage metrics, or focused tests for login, password recovery, calendar sync, notifications, justification, route chunk failures, responsive layouts, or accessibility.
- **Evidence:** 29 test files cover 215 non-test TS/TSX files; the conditional-hook violations were not caught.
- **Impact:** Critical flows can regress while the 137-test suite stays green.
- **Recommended fix:** Add coverage reporting, component tests for the missing flows, axe-based accessibility checks, and browser E2E tests for admin and employee journeys in both languages and representative viewports.
- **Affected files:** Test configuration and critical feature tests.
- **Fix risk:** Low.
- **Priority:** P2.

### 14. Deployment hardening is incomplete

- **Severity:** Medium
- **Category:** Security / Deployment
- **File and line:** [vercel.json](/D:/National/frontend/vercel.json:13), [Sidebar.tsx](/D:/National/frontend/src/layouts/Sidebar.tsx:35)
- **Problem:** Deployment defines only asset caching. It lacks CSP, `X-Content-Type-Options`, `Referrer-Policy`, framing restrictions, and `Permissions-Policy`. CT Gate links use plain HTTP.
- **Evidence:** The external links correctly use `noopener noreferrer`, but transport remains insecure.
- **Impact:** Reduced defense against injected content, clickjacking, referrer leakage, and network tampering.
- **Recommended fix:** Add a CSP compatible with Vite chunks and the required API/font origins, `frame-ancestors`, `nosniff`, strict referrer policy, and permissions policy. Move the inline theme bootstrap to a CSP-compatible external script or hash it. Replace the external link with verified HTTPS or remove it.
- **Affected files:** Vercel configuration, index bootstrap, sidebar/dashboard links.
- **Fix risk:** Medium because CSP can break resources if introduced without validation.
- **Priority:** P1.

### 15. Authenticated users are sent back to login from the site root

- **Severity:** Medium
- **Category:** Routing / Functionality
- **File and line:** [routes.tsx](/D:/National/frontend/src/app/routes.tsx:42), [LoginPage.tsx](/D:/National/frontend/src/features/auth/LoginPage.tsx:24)
- **Problem:** `/` always redirects to `/login`, and the login page does not redirect an existing session.
- **Evidence:** The root route uses a static `Navigate`.
- **Impact:** Bookmarks and base-domain navigation show login even when the session is still active.
- **Recommended fix:** Add an authenticated landing redirect that selects the admin or employee dashboard, and redirect authenticated visitors away from login.
- **Affected files:** Routes, login page, route tests.
- **Fix risk:** Low.
- **Priority:** P1.

### 16. Type-check and quality configuration leave tooling files unchecked

- **Severity:** Low
- **Category:** TypeScript / Tooling
- **File and line:** [tsconfig.json](/D:/National/frontend/tsconfig.json:3), [tsconfig.node.json](/D:/National/frontend/tsconfig.node.json:22), [tsconfig.app.json](/D:/National/frontend/tsconfig.app.json:14)
- **Problem:** The root references only the application config. The node config includes only Vite, not Vitest, and `@types/node` is not direct. Application unused checks are disabled, and ESLint is not type-aware.
- **Evidence:** `tsc -b` can pass without checking either build/test config.
- **Impact:** Configuration errors and unsafe typed patterns can escape the build gate.
- **Recommended fix:** Reference the node config, include both Vite and Vitest configs, declare Node types directly, add an explicit `typecheck` script, and enable type-aware ESLint after cleaning current findings.
- **Affected files:** TypeScript, ESLint, and package configurations.
- **Fix risk:** Low.
- **Priority:** P2.

### 17. Metadata does not match an internal authenticated application

- **Severity:** Low
- **Category:** SEO / Privacy / Accessibility
- **File and line:** [index.html](/D:/National/frontend/index.html:6)
- **Problem:** Every route shares one title and description. There is no robots policy, canonical policy, or route-specific title.
- **Evidence:** Public assets contain neither `robots.txt` nor a sitemap.
- **Impact:** Public login/recovery URLs may be indexed, and browser/history titles do not identify the active screen.
- **Recommended fix:** For this internal system, use `noindex, nofollow, noarchive`, disallow crawling in `robots.txt`, and set route-specific document titles. A sitemap and Open Graph metadata are unnecessary unless a separate public marketing surface is introduced.
- **Affected files:** HTML shell, route metadata helper, public robots file.
- **Fix risk:** Low.
- **Priority:** P3.

### 18. Hospital logo SVG IDs collide across component instances

- **Severity:** Low
- **Category:** UI / Accessibility
- **File and line:** [HospitalLogo.tsx](/D:/National/frontend/src/components/common/HospitalLogo.tsx:52), [LoginPage.tsx](/D:/National/frontend/src/features/auth/LoginPage.tsx:76)
- **Problem:** Every logo instance defines `shieldGrad`, `crossGrad`, and other fixed document IDs. Login renders white and colored logo instances together.
- **Evidence:** SVG fragment IDs are document-scoped.
- **Impact:** A logo can resolve another instance’s gradient and display incorrect colors.
- **Recommended fix:** Suffix every definition/reference with `useId`, and mark the SVG decorative when adjacent text provides the accessible name.
- **Affected files:** Hospital logo and auth layouts.
- **Fix risk:** Low.
- **Priority:** P3.

### 19. Repository documentation and placeholders do not describe the actual system

- **Severity:** Suggestion
- **Category:** Documentation / Project structure
- **File and line:** [README.md](/D:/National/frontend/README.md:1), [providers.tsx](/D:/National/frontend/src/app/providers.tsx:1), [firebase-messaging-sw.js](/D:/National/frontend/public/firebase-messaging-sw.js:1)
- **Problem:** README is still the Vite template and incorrectly claims React Compiler is enabled. Several no-op placeholder modules and an unused Firebase worker remain.
- **Impact:** New maintainers receive incorrect setup and architecture guidance.
- **Recommended fix:** Document architecture, scripts, environment variables, demo accounts, security limitations, test strategy, and deployment. Delete placeholders and unused public files after reachability verification.
- **Affected files:** README, placeholder modules, unused worker.
- **Fix risk:** Low.
- **Priority:** P3.

## 4. Root Causes

- **Prototype trust boundary:** Browser storage and mock data evolved into operational features without introducing a server authority.
- **Incomplete migrations:** Active and legacy schedule/request implementations coexist; imports, dependencies, and placeholders were not removed.
- **Design-token drift:** Components adopted a new semantic vocabulary without updating Tailwind and CSS tokens.
- **Monolithic feature growth:** Complex workflow, rendering, persistence, and export responsibilities live in single components/stores.
- **Incomplete quality gates:** Unit tests are strong for domain stores, but lint, coverage, browser E2E, accessibility, bundle budgets, and dependency audits are not enforced.
- **No asset pipeline:** Images are copied under misleading extensions and export libraries are not consistently isolated behind dynamic imports.

## 5. Required Interface Changes

For a production frontend, introduce these service boundaries:

- `AuthService`: sign in, sign out, restore session, current user, request reset, confirm reset.
- `CalendarFeedService`: create, rotate, and revoke an opaque subscription URL.
- Typed repositories for schedules, employees, requests, notifications, and audits; UI stores hold view state and cached server data rather than acting as the source of truth.
- Central typed runtime configuration for API and socket endpoints.
- A single documented semantic design-token contract shared by Tailwind and CSS variables.

## 6. Fix Plan

### Phase 1: Critical and security issues

- Replace mock authentication, password recovery, client authorization, and browser-owned sensitive records.
- Replace predictable calendar URLs with server-issued revocable feeds.
- Upgrade vulnerable dependencies and validate routing/export behavior.
- Add deployment security headers and HTTPS-only external links.
- **Validation:** authorization integration tests, privilege-escalation tests, feed enumeration tests, `npm audit --omit=dev`, CSP smoke tests.

### Phase 2: Stability and runtime issues

- Correct conditional hooks first.
- Restore missing Tailwind utilities and intended warning states.
- Add authenticated root/login redirects.
- Add boot failure handling and route-level translation loading.
- Consolidate API/session access.
- **Validation:** lint, build, auth-state transition tests, route tests, forced translation-chunk failure, generated-CSS assertions.

### Phase 3: TypeScript and code quality

- Remove verified dead features and unused dependencies.
- Split monolithic workflows and stores while preserving their public facades.
- Reference tooling TS configs, add type-aware linting, formatting checks, and a configured unused-code check such as Knip.
- Replace remaining `any` casts with the existing locale and roster types.
- **Validation:** typecheck, lint, unit tests, unused-code check, clean dependency tree.

### Phase 4: Performance, responsive design, accessibility, and UX

- Optimize and correctly encode images; lazy-load DOCX generation.
- Fix dialog focus, notification semantics, field descriptions, OTP labels, touch targets, contrast, and SVG IDs.
- Perform browser QA at 320, 375, 768, 1024, 1440, and 1920 px in English/Arabic and light/dark modes.
- **Validation:** bundle report, file-magic verification, Lighthouse, axe, keyboard-only traversal, overflow screenshots.

### Phase 5: Testing and production readiness

- Add coverage and E2E scripts to `package.json`.
- Cover login/recovery, admin scheduling, employee schedule, requests, calendar feed, notifications, justification export, storage failure, and route-chunk failure.
- Add CI gates for lint, typecheck, tests, coverage, production build, dependency audit, and bundle budgets.
- Add production error monitoring without logging credentials, schedules, or employee PII.
- **Validation:** clean CI from a fresh install and staged deployment smoke tests.

## 7. Quick Wins

- Move the two early returns so hook ordering is unconditional.
- Define or replace missing Tailwind semantic utilities and unsupported spacing classes.
- Add authenticated root/login redirects.
- Change CT Gate links to verified HTTPS.
- Add `aria-label` to icon-only controls and connect input errors with `aria-describedby`.
- Dynamically import the DOCX exporter.
- Re-encode the fake WebP and resize the two logos.
- Remove the unused `ShiftRequestsPage` lazy declaration.
- Add the missing TS project reference and a standalone typecheck script.

## 8. Production Readiness Checklist

- [ ] Authentication and authorization are server-enforced.
- [ ] No plaintext passwords, fake tokens, or client-generated reset OTPs remain.
- [ ] Sensitive employee and schedule records are no longer browser-authoritative.
- [ ] Calendar subscription URLs are opaque and revocable.
- [ ] Lint reports zero errors.
- [ ] TypeScript checks application, Vite, and Vitest configs.
- [ ] All production dependency vulnerabilities are resolved or formally accepted.
- [ ] Missing Tailwind utilities are eliminated.
- [ ] Build, unit, integration, accessibility, and E2E checks pass.
- [ ] Critical flows have coverage and browser tests.
- [ ] Modal, popover, form, notification, and touch interactions pass keyboard/axe checks.
- [ ] Light and dark tokens meet contrast requirements.
- [ ] English and Arabic layouts pass all target viewports without overflow.
- [ ] Images are correctly encoded and sized.
- [ ] Export libraries are loaded only when requested.
- [ ] CSP and deployment security headers are active.
- [ ] Internal routes use `noindex`.
- [ ] Production error monitoring and privacy-safe logging are configured.
- [ ] README and environment documentation describe the actual application.
- [ ] A clean install produces a clean CI run and staged smoke test.

| # | Issue | Severity | File | Recommended fix | Priority |
| - | ----- | -------- | ---- | --------------- | -------- |
| 1 | Browser-owned authentication and authorization | Critical | `authStore.ts` | Replace with server sessions and authorization | P0 |
| 2 | Conditional hooks | High | Justification page, request wizard | Make hook order unconditional | P0 |
| 3 | Predictable calendar feed | High | `CalendarSyncPage.tsx` | Server-issued revocable URL | P0 |
| 4 | Vulnerable dependencies | High | `package.json`, lockfile | Upgrade/override with regression tests | P0/P1 |
| 5 | Lint gate fails | Medium | Multiple | Resolve 70 errors and enforce CI | P1 |
| 6 | Missing Tailwind utilities | Medium | Theme and active features | Standardize tokens and regenerate CSS | P1 |
| 7 | Disconnected API/socket layer | Medium | `lib/axios.ts`, `lib/socket.ts` | Introduce one typed service adapter | P1 |
| 8 | Blocking i18n startup | Medium | `main.tsx`, `i18n/index.ts` | Load critical namespaces and show boot errors | P1 |
| 9 | Keyboard-inaccessible dialogs/notifications | Medium | Modal and notification components | Focus trap and semantic controls | P1 |
| 10 | Form, touch, and contrast failures | Medium | Shared inputs and token CSS | Add relationships, labels, sizing, contrast | P1/P2 |
| 11 | Heavy/mislabeled assets and export code | Medium | Public images, justification route | Optimize assets and lazy-load DOCX | P2 |
| 12 | Dead parallel architecture and monoliths | Medium | Legacy schedule, large stores/pages | Remove dead code and split responsibilities | P2 |
| 13 | Missing critical-flow/E2E coverage | Medium | Test configuration | Add coverage, axe, and browser E2E | P2 |
| 14 | Deployment hardening missing | Medium | `vercel.json`, external links | Add CSP/security headers and HTTPS | P1 |
| 15 | Root redirects sessions to login | Medium | `routes.tsx` | Role-aware authenticated redirect | P1 |
| 16 | Tooling configs not fully type-checked | Low | TS/ESLint config | Add references and type-aware checks | P2 |
| 17 | Internal-app metadata/indexing mismatch | Low | `index.html`, public | Add noindex and route titles | P3 |
| 18 | SVG gradient ID collisions | Low | `HospitalLogo.tsx` | Generate per-instance IDs | P3 |
| 19 | Stale docs and placeholders | Suggestion | README/placeholders | Replace template docs and remove no-op files | P3 |
