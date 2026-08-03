# CT Scan Scheduling

CT Scan Scheduling is a bilingual CT department operations app covering employee administration, monthly scheduling, overtime planning, shift-request workflows, notifications, audit history, reports, and calendar feed sync.

The repository is now a full-stack TypeScript project:

- `Vite + React` frontend in `src/`
- `Express + Prisma` backend in `server/src/`
- `SQLite` for local development and automated verification
- `express-session` with in-memory sessions for local development/testing and Prisma session persistence in production

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/` | React UI, routes, Zustand client state, UI tests |
| `server/src/` | Express app, auth/session middleware, route handlers, business logic |
| `prisma/` | Prisma schema, migrations, development seed data |
| `server/test/` | Backend integration tests using an in-process Express injector |
| `e2e/` | Playwright browser journeys |

Key backend route groups:

- `/api/auth`
- `/api/auth/signup/options`
- `/api/bootstrap`
- `/api/profile`
- `/api/departments`
- `/api/employees`
- `/api/schedule`
- `/api/overtime`
- `/api/shift-requests`
- `/api/notifications`
- `/api/audit`
- `/api/calendar-sync`

## Completed Backend Work

- Session login, logout, and session restore
- Public employee sign-up with email OTP verification, resend cooldowns, and unverified-login blocking
- Forgot-password request, verify, and reset flow with email-backed OTP delivery
- Department and employee CRUD integration
- Employee access-profile updates
- Admin-created employee onboarding through password-setup email delivery
- Server-authoritative schedule persistence and sync
- Server-authoritative overtime persistence and sync
- Shift-request lifecycle with state transitions and approval application
- Notification persistence, unread handling, and read mutations
- Audit logging for employee, schedule, overtime, shift-request, and calendar-token mutations
- Calendar feed token issuance, rotation, and ICS feed access
- Backend integration tests for auth, authorization, employees, departments, scheduling, overtime, shift requests, notifications, and calendar feeds

The frontend keeps Zustand for UI state and caching, but scheduling, overtime, notifications, and shift-request mutations now sync against the backend instead of using browser storage as the source of truth.

## Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default local values:

```dotenv
DATABASE_URL="file:./app.db"
HOST="127.0.0.1"
SESSION_SECRET="development-session-secret-change-me"
APP_ORIGIN="http://127.0.0.1:5173"
ENABLE_DEV_PASSWORD_RESET_CODES=true
ENABLE_DEV_SIGNUP_OTP_CODES=false
SIGNUP_OTP_EXPIRY_MINUTES=10
SIGNUP_OTP_MAX_ATTEMPTS=5
SIGNUP_OTP_RESEND_COOLDOWN_SECONDS=60
EMAIL_PROVIDER="console"
EMAIL_FROM="no-reply@hospital.local"
RESEND_API_KEY=""
VITE_API_URL="http://127.0.0.1:3000/api"
```

Notes:

- `VITE_API_URL` is public client configuration.
- In `npm run dev`, the frontend uses a same-origin Vite `/api` proxy to the backend. `VITE_API_URL` is still used for production builds, preview, and E2E.
- Local development is pinned to `127.0.0.1` to avoid `localhost` loopback resolution differences between browser, Vite proxy, and the backend.
- The backend dev and dist start commands load `.env` explicitly, so the server and frontend use the same local database and origin settings.
- `SESSION_SECRET` must be replaced outside local development.
- `ENABLE_DEV_PASSWORD_RESET_CODES=true` is for development/testing only.
- `ENABLE_DEV_SIGNUP_OTP_CODES=true` is for development/testing only and exposes the current sign-up OTP in API responses and the register UI.
- `EMAIL_PROVIDER="console"` is acceptable only for local development. Production should use `EMAIL_PROVIDER="resend"` with `RESEND_API_KEY` configured so sign-up OTP, password-reset, and employee password-setup emails are actually delivered.

## Setup

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Development

Run both frontend and backend together:

```bash
npm run dev:all
```

Or run them separately:

Backend:

```bash
npm run dev:server
```

Frontend:

```bash
npm run dev
```

If port `5173` is already in use, run:

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:3000`

## Test And Verification Commands

Frontend/unit:

```bash
npm test
```

Backend integration:

```bash
npm run test:server
```

Type-check, lint, build:

```bash
npm run lint
npm run typecheck
npm run build
```

Prisma validation:

```bash
npx prisma format --check
npx prisma validate
```

End-to-end:

```bash
npm run test:e2e
```

`npm run test:e2e` does the following:

1. builds the frontend against `http://127.0.0.1:3100/api`
2. resets and seeds `prisma/prisma-e2e.db`
3. starts the compiled backend on `http://127.0.0.1:3100`
4. starts the built frontend preview on `http://127.0.0.1:4174`
5. runs Playwright against `http://127.0.0.1:4174`

If Playwright browsers are not installed yet, run:

```bash
npx playwright install chromium
```

## Seed Accounts

Development seed accounts:

- `EMP-001` / `123456` - super admin
- `EMP-002` / `123456` - employee
- `EMP-003` / `123456` - admin

These development accounts are seeded as already email-verified and must not be reused in any shared or production environment.

## Known Limitations

- Local development and automated verification use SQLite. Production deployment should use a managed relational database with proper backup and operations controls.
- Real sign-up OTP, password-reset, and employee password-setup delivery in production requires a configured email provider. The default local `console` provider intentionally avoids sending email and should not be used outside development.
- Playwright needs a local Chromium installation from `npx playwright install chromium` before `npm run test:e2e` can run.
- `npm audit` still reports unresolved high-severity advisories in `react-router-dom` and a dev-only `brace-expansion` path under `eslint`. These need upstream-compatible dependency remediation before the repository can be called fully release-ready.
