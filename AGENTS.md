# Cebu Flight Finder

Next.js App Router website on Vercel; Firebase Auth/Firestore; separate Dockerized Playwright worker. No n8n or paid cloud worker. Public refresh is disabled until the actual-host pilot is approved.

## Commands

- `npm ci` — install locked dependencies (Node.js 22+).
- `npm run dev` — local website at 127.0.0.1:3000.
- `npm run typecheck`, `npm test`, `npm run build` — core checks.
- `npm run test:rules`, `npm run test:integration` — isolated Firestore emulator tests; Java 21 required.
- `npm run worker:pilot -- worker/pilot.example.json` — real airline pilot, requiring Chromium and network access. Do not run full scans before reviewing actual-host evidence.

## Navigation and invariants

- Read [architecture](docs/architecture.md) for endpoints, authorization, queue leases and fare semantics before backend changes.
- Read [deployment](docs/deployment.md) for Firebase/Vercel configuration and free-tier boundaries.
- Read [worker operations](docs/worker.md) before collector changes or deployment; [data format](docs/data-format.md) before imports/schema changes.
- Prices are integer centavos. Only booking-summary-verified two-adult totals enter price rankings. Never turn failures or missing data into zero prices, sold-out claims or unreleased claims.
- `lib/domain.ts` is authoritative for schemas and 2027 Thursday/Friday-to-Monday dates. Preserve January 2028 returns.
- All browser database access is denied by rules. Server endpoints derive owner status from `OWNER_UID`; never trust client roles.
- Queue writes must preserve transaction reads-before-writes, lease-token/cursor fencing, daily attempt reservation and previous good observations.
- Never commit credentials, `.env` files, screenshots from private sessions, node_modules or worker artifacts. The bundled historical reference is labeled and is not fresh data.
- Inspect the installed Next.js guide under `node_modules/next/dist/docs/` for framework-specific changes; generated agent rules are disabled to keep this file authoritative.
