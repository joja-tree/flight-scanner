# Cebu Flight Finder

A personal weekend-trip finder for two adults leaving Cebu on Thursday or Friday and returning Monday. Browse verified fare observations by price, calendar or destination, and request resumable checks from a browser worker on your own server.

**Current state:** the app, authenticated APIs, queue, Firebase rules, import/export and pilot-gated collector are implemented. The full 2027 scan and server-side airline access are not yet verified. Without Firebase configuration, the app opens in an explicitly labeled historical reference mode. It contains no invented flight prices.

## Getting started

Requires Node.js 22+ and npm. Java 21 is needed only for Firestore emulator tests; Docker is needed only for the server worker.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Blank Firebase values show the historical reference interface without requiring cloud credentials. To enable login and saved data, follow [deployment setup](docs/deployment.md). If macOS sandbox file watching fails, use `WATCHPACK_POLLING=true npm run dev -- --webpack`.

## Stack

- Next.js App Router, React and TypeScript on Vercel.
- Tailwind CSS and local shadcn/ui-style Button/Dialog components using Radix primitives.
- Zod for API, import and fare validation.
- Firebase Google Authentication and Firestore, with server-side Admin SDK authorization.
- Dockerized Node.js/Playwright Chromium worker; one active browser, no n8n or paid queue service.

## Configuration

See [.env.example](.env.example) for public Firebase identifiers, server-only credentials, owner UID, production origin and request limits. See [worker/.env.example](worker/.env.example) for worker configuration. Never commit `.env` files or service-account keys.

Public refresh starts disabled. The worker refuses normal collection until `PILOT_APPROVED=true`; follow the [pilot procedure](docs/worker.md) first. Firebase and Vercel must remain on eligible free plans, but public traffic and server resources are not unlimited.

## Project structure

| Directory | Purpose |
| --- | --- |
| `app/`, `components/` | Website and API endpoints |
| `lib/` | Validated domain model, Firebase clients, authorization and queue |
| `worker/` | Browser collector, discovery helper, pilot and Docker image |
| `tests/` | Domain/parser tests and Firestore emulator integration tests |
| `data/` | Historical import example |
| `docs/` | Architecture, deployment, operations and import format |

## Development and validation

```sh
npm run typecheck
npm test
npm run test:rules
npm run test:integration
npm run build
```

The emulator commands use the isolated `demo-cebu-finder` project and do not need production credentials. `npm run start` serves the production build. GitHub Actions runs these checks on pushes and pull requests. See [validation status](docs/validation.md) for executed checks and remaining deployment-dependent validation.

## Features and limits

- All 105 Thursday/Friday departure dates in 2027, with Monday returns including January 2028.
- Price rankings use two-adult totals and preserve older good observations when later searches fail.
- Visible timestamps, stale-fare labels, pagination, partial-route coverage and explicit empty states.
- Google sign-in, controlled month refreshes, owner full-year jobs, cancellation and resumable leases.
- Owner import/export with validation and evidence metadata.
- Airline links open a search; the app never purchases or holds tickets.

The initial route registry is partial. Discovery output requires reconciliation, and the browser adapter needs actual-host validation before full scans. Calendar base fares are never substituted for verified totals. See [architecture](docs/architecture.md) for the precise behavior and current collection limitations.

## Deployment and documentation

Connect the GitHub repository to Vercel, configure Firebase, and deploy the worker to your existing server. Detailed instructions: [deployment](docs/deployment.md), [worker operations](docs/worker.md), [import format](docs/data-format.md). [AGENTS.md](AGENTS.md) contains concise contributor guidance.
