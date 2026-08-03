# AGENTS

## Repository Architecture

- `src/`: Vite React application, route-level features, Zustand UI/cache state, Vitest tests
- `server/src/`: Express API, middleware, auth/session handling, business logic, validation
- `server/test/`: backend integration tests using the in-process request injector
- `prisma/`: Prisma schema, migrations, seed data, local SQLite databases
- `e2e/`: Playwright browser journeys

Important integration boundaries:

- `src/lib/backendBootstrap.ts`: hydrates frontend state from `/api/bootstrap`
- `src/lib/backendStateSync.ts`: pushes schedule and overtime store changes back to the backend
- `server/src/lib/shiftRequests.ts`: shift-request lifecycle and schedule/overtime application logic
- `server/src/routes/auth.ts`: login, forgot-password, and public sign-up OTP verification flow
- `server/src/lib/email.ts`: provider-backed transactional email delivery for sign-up OTP, password-reset, and password-setup messages

## Package Manager Commands

Use `npm` only.

Core commands:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev:server
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:server
npm run build
npm run test:e2e
```

## Coding Conventions

- Keep TypeScript strict.
- Preserve the existing UI and route structure unless a bug fix requires otherwise.
- Treat Zustand as UI/cache state, not as the permanent authority for protected business workflows.
- Validate server inputs with Zod.
- Prefer small backend service helpers over route-local business logic duplication.
- Never persist plaintext OTP codes, signup passwords, or other temporary secrets in browser storage.
- Use `apply_patch` for manual file edits.
- Do not commit secrets, credentials, or environment-specific private values.
- Do not expose demo credentials outside development, test, or explicitly enabled demo builds.

## Required Verification Commands

For meaningful backend/frontend changes, run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:server
npm run build
```

For Prisma work, also run:

```bash
npx prisma format --check
npx prisma validate
```

For browser verification when the environment supports listeners:

```bash
npx playwright install chromium
npm run test:e2e
```

## Test Expectations

- Add behavior-focused tests for changed workflows.
- Prefer integration tests for auth, authorization, validation, and persistence.
- Do not add render-only tests with no meaningful assertions.
- Keep backend tests isolated from the development database.
- Keep E2E data isolated in `prisma/prisma-e2e.db`.
- E2E uses `http://127.0.0.1:4174` for the frontend and `http://127.0.0.1:3100` for the backend.

## Directories To Avoid Modifying Without Explicit Need

- `prisma/migrations/`
- `dist/`
- `test-results/`
- `node_modules/`
- `src/features/schedule/`
- `src/stores/scheduleMatrixStore.ts`
- `src/stores/lateScheduleStore.ts`

The schedule and overtime domains are large and highly coupled. Avoid unrelated refactors there.

## Definition Of Done

The repository is done only when:

- backend-authenticated workflows are server-authoritative
- scheduling, overtime, shift requests, notifications, and audit logging work end to end
- critical mock persistence is removed from protected business workflows
- docs match the actual commands and architecture
- lint, type-check, unit tests, backend integration tests, and build pass
- E2E passes locally, or any remaining failure is proven to be environmental rather than repository-side
- unresolved high-severity dependency advisories are either remediated or explicitly accepted outside the repo
