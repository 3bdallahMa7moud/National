# CT Scan Scheduling

CT Scan Scheduling is a bilingual, frontend-only prototype for managing a CT
department's monthly roster, overtime coverage, employee access, shift
requests, notifications, reports, and operational audit views.

The repository currently runs entirely in the browser with bundled demo data.
It is suitable for development, demonstrations, and usability testing with
synthetic data only. It is **not a production-secure authentication,
authorization, or clinical-data system**.

## Technology stack

- React 18 and TypeScript 5
- Vite 6 with the standard `@vitejs/plugin-react`
- React Router 7 with lazy-loaded feature routes
- Tailwind CSS 3 and shared semantic CSS tokens
- Zustand for application and persisted demo state
- TanStack Query for the application query provider
- i18next and react-i18next for English and Arabic
- React Hook Form and Zod for forms and validation
- DnD Kit, Recharts, Day.js, ExcelJS, and DOCX export utilities
- Vitest, jsdom, Testing Library, axe-core, and Playwright for testing

React Compiler is **not** configured or enabled. The Vite configuration uses
the normal React plugin without a React Compiler Babel plugin or compiler
configuration.

## Prerequisites

- Node.js 20.19 or newer on the Node 20 line, Node.js 22.13 or newer, or
  Node.js 24 or newer
- npm and the repository's committed `package-lock.json`
- Google Chrome for the configured Playwright browser tests

A backend is not required to run the demo. A real backend is required before
the application can handle real accounts or operational data.

## Installation

Install the exact locked dependency versions:

```bash
npm ci
```

No environment file is required for the frontend-only demo. Local environment
files such as `.env.local` are ignored by Git. Do not commit credentials,
tokens, private endpoints, or other secrets.

## Development and validation commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on `http://localhost:5173` with hot reload |
| `npm run typecheck` | Type-check the application and tooling configs with project references |
| `npm run lint` | Run ESLint across the repository |
| `npm test` | Run the complete Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:a11y` | Run accessibility-focused Vitest files |
| `npm run test:coverage` | Run Vitest with V8 text, JSON, HTML, and LCOV coverage reports in `coverage/` |
| `npm run test:e2e` | Run Playwright critical journeys in desktop and mobile Chrome |
| `npm run test:e2e:headed` | Run the same Playwright tests with a visible browser |
| `npm run build` | Type-check and create the production bundle in `dist/` |
| `npm run preview` | Preview the built bundle on `http://localhost:4173` |

Run `npm run build` before `npm run preview`. The Playwright configuration
starts the Vite development server automatically when one is not already
available.

## Project architecture

| Path | Responsibility |
| --- | --- |
| `src/main.tsx` | Browser entry point and resilient i18n/application bootstrap |
| `src/app/` | Top-level providers, route definitions, document titles, and route loading/error behavior |
| `src/features/` | Route-level auth, dashboard, schedule, overtime, employee, request, notification, reporting, and calendar features |
| `src/components/ui/` | Shared UI primitives such as buttons, inputs, cards, modals, and toasts |
| `src/components/common/` | Cross-feature application components |
| `src/components/schedule/` | Reusable schedule-matrix rendering and editing components |
| `src/stores/` | Zustand state, mutations, browser persistence, migrations, and audit coordination |
| `src/mocks/` | Bundled demo accounts, schedules, notifications, departments, login logic, and localization adapters |
| `src/data/` | Seed roster and overtime schedule data |
| `src/i18n/` | Language bootstrap, namespace loading, and English/Arabic JSON resources |
| `src/lib/` | Domain logic, exports, date setup, and optional API/socket integration helpers |
| `src/types/` | Shared domain and application types |
| `src/styles/` and `src/index.css` | Theme, schedule, print, RTL-aware, and global styles |
| `src/test/` and `*.test.ts(x)` | Vitest setup, accessibility helpers, and unit/component tests |
| `e2e/` | Playwright critical user journeys |
| `public/` | Same-origin static assets, indexing policy, and pre-render theme bootstrap |
| `docs/` | Audit, issue, and deployment notes |

`src/app/App.tsx` composes the theme, TanStack Query, toast, error-boundary,
and router providers. `src/app/routes.tsx` is the route authority. Most
feature routes and translation namespaces load on demand.

The current feature stores and mock adapters are the data source for the demo.
The presence of Axios, Socket.IO, or TanStack Query does not mean a production
backend is connected.

## Environment variables

Vite embeds every `VITE_*` value into browser-delivered JavaScript. These
variables are public configuration and must never contain secrets.

| Variable | Default | Current use |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3000/api` | Base URL in the optional Axios helper |
| `VITE_SOCKET_URL` | `http://localhost:3000` | URL in the optional Socket.IO helper, whose connection is disabled until explicitly started |
| `CI` | unset | Tooling-only flag used by Playwright for retries, focused-test enforcement, and development-server reuse |

Example development-only values:

```dotenv
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

Changing these variables alone does not replace mock authentication or
browser-owned application state. Production endpoints must use HTTPS/WSS and
the client integration must be redesigned around server-validated sessions
and authorization.

## English, Arabic, RTL, and dark mode

English is the default language. The language selector persists `en` or `ar`
under the `app-language` browser-storage key. Critical translation namespaces
load before the application mounts; feature namespaces load at their route
boundaries.

Changing the language updates the root document's `lang` and `dir`
attributes. English uses LTR and Arabic uses RTL. The layout and component
styles use logical start/end properties where direction matters, and date
formatting switches between `en-US` and `ar-SA`/Arabic Day.js behavior.

Appearance supports `light`, `dark`, and `system`. The selection is stored
under `theme-preference`; the system option follows
`prefers-color-scheme`. `public/theme-bootstrap.js` applies the resolved theme
before React renders to reduce a light/dark flash. Theme choice and language
choice are independent.

## Demo data and demo accounts

The login page provides public quick-fill buttons for `EMP-001`, `EMP-003`,
and `EMP-002`. Selecting one only fills the form; normal mock-login validation
still runs. The built-in `EMP-001` account is the super-admin seed and
`EMP-002` is an employee seed. The `EMP-003` button is presented as an admin
shortcut, but the effective role always comes from the current browser-stored
directory record, not from the button label.

The default password for every demo account is `123456`. Login also accepts a
matching email address, employee number, or exact localized name. Inactive
employee records cannot sign in.

These credentials are deliberately public synthetic demo values, not real
credentials. Demo behavior is browser-owned:

- mock passwords are stored as plaintext in `localStorage`;
- account, schedule, request, notification, and audit demo state can persist
  in `localStorage`;
- the current mock token and user are stored in `sessionStorage`, with
  compatibility migration from older `localStorage` sessions;
- successful login creates a generated string such as
  `mock-jwt-token-<account-id>`, not a server-issued or signed session;
- clearing the site's browser storage and reloading returns the application
  to its bundled seed state.

Because demo records can be edited and persist between reloads, the current
browser record—not this README—is the authority for what a particular local
demo session displays.

## Frontend-only security limitations

The current mock authentication is **not production-secure**. Route guards,
roles, permissions, passwords, reset flows, schedules, employee records,
notifications, and audit entries are implemented or enforced in client code.
A user with browser access can inspect or alter the JavaScript and stored
state, forge a mock token, change a role, bypass a route guard, or modify
records.

There is no trusted server enforcing authorization on reads or mutations.
There is no secure password storage, server-side password recovery, protected
audit trail, revocable calendar-feed credential, or production session
lifecycle. Do not enter, import, or deploy real patient, employee, credential,
or operational data in this build.

The repository does not register a Firebase Messaging service worker or an
MSW browser worker. Notifications are demo application state; background push
messaging is not enabled.

## Placeholder and worker status

The reachability audit removed the reported comment-only app, toast,
dashboard, MSW, and Firebase worker files after confirming they had no import,
HTML/runtime registration, or deployment dependency. It also removed the
unused Vite/React scaffold assets. No intentionally reserved empty placeholder
file or messaging worker remains.

Some non-empty disconnected or test-only modules were intentionally retained
because they still have test ownership, active named exports, in-progress
working-tree changes, or unresolved product ownership. They are catalogued in
`docs/issue-12-report.md` and must not be deleted without a new reachability
and deployment-reference check. HTML input placeholder attributes and layout
placeholder elements are active UI behavior, not unused placeholder files.

## Production deployment requirements

Before production use:

1. Replace mock login and password recovery with server-validated sessions,
   secure cookie handling, appropriate identity controls, and server-side
   authorization for every read and mutation.
2. Move schedules, employees, permissions, requests, notifications, and audit
   history to authenticated server-owned repositories. Keep only non-sensitive
   view state in browser storage.
3. Issue long, random, per-user, revocable calendar subscription URLs from the
   backend. Never derive access from a predictable employee identifier.
4. Configure HTTPS/WSS integration endpoints and keep all credentials and
   signing keys in server-side deployment secrets, never in `VITE_*` values.
5. Restrict the CSP `connect-src` list to the actual production API and socket
   origins. Validate the existing security headers, direct SPA-route rewrites,
   theme bootstrap, lazy chunks, exports, and external links in staging.
6. Add a real notification delivery design before introducing any service
   worker. Register, scope, cache, update, and revoke it intentionally, and
   include it in deployment and browser tests.
7. Run type-check, lint, the full automated test suite, coverage, E2E journeys,
   a production build, dependency/security review, and staged smoke tests in
   CI before promotion.
8. Add production monitoring, privacy-safe logging, backups, retention rules,
   incident response, and the organizational compliance controls required for
   the data being processed.

`vercel.json` currently provides the Vite build/output settings, SPA fallback,
asset caching, CSP, anti-framing, MIME-sniffing, referrer, and permissions
headers. Those static frontend controls are defense in depth; they do not make
the frontend-only trust model secure.
