# Local browser worker

The supported operational flow is one on-demand search batch in a dedicated, manually launched Chrome profile. The Mac must stay awake. The headless server previously encountered airline access blocks; do not claim it supports working live refresh.

## Setup and use

Install locked dependencies with `npm ci` (Node 22+). Keep `worker/.env` private and ignored:

```dotenv
FIREBASE_PROJECT_ID=your-project
GOOGLE_APPLICATION_CREDENTIALS=/absolute/private/path/service-account.json
BROWSER_MODE=attached-chrome
PILOT_APPROVED=false
DAILY_SEARCH_LIMIT=300
PUBLIC_REFRESH_ENABLED=false
SEARCH_DELAY_MS=15000
```

From the repository directory, launch dedicated Chrome (close any previous instance using this profile first):

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$PWD/worker/artifacts/chrome-profile" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --no-first-run https://www.cebupacificair.com/en-PH/
```

Keep exactly one tab. Never use a personal browser profile or expose port 9222 publicly. Attachment reuses the tab and disconnects without closing Chrome. Browser security is not disabled. An access challenge pauses collection; resolve it normally before retrying.

On the website, compare dates and destinations, then choose **Scan missing / stale** or **Scan again** as owner. Copy the displayed command:

```sh
node --env-file=worker/.env --import tsx worker/main.ts search_BATCH_ID
```

The runner processes only this batch, saves each result and exits. To resume after a restart or daily limit, run the same command. A live lease may require up to three minutes to expire. Reload progress manually on the website. Search configuration and exclusions are restored from My searches. Excluding a destination skips unfinished combinations; Undo restores them. Stop with Ctrl+C; the current browser attempt may finish before exit.

There is no continuous worker or full-year scan. Never run the legacy worker simultaneously. Daily limits count retries, reset at midnight Manila, and never enable billing. Keep the same limit across worker deployments. A configured lower limit remains valid. Public scanning remains disabled.

## Pilot

Pilot cases contain a route, `date` and optional explicit `returnDate`; omitted returns use the following Monday for legacy cases. Include domestic/international routes and at least one non-Monday return when validating date-pair support:

```sh
BROWSER_MODE=attached-chrome npm run worker:pilot -- worker/pilot.example.json
```

The pilot writes a validated import bundle and booking-summary screenshots locally; it does not import automatically. Review both adults, exact dates, flight numbers, direct service, totals, baggage and tax treatment before enabling `PILOT_APPROVED=true`. A successful process exit is not evidence of complete route coverage. The attached-Chrome three-case pilot passed on 22 October 2026 (Asia/Manila): Bacolod March 5–9 (Tuesday return), Boracay March 4–8, and Hong Kong March 5–8, 2027. Two-adult totals and exact dates were checked against each screenshot. This validates these cases, not every destination or unattended server collection. Hong Kong travel-tax treatment remains unknown.

The collector starts from the homepage, selects visible country/airport labels and dates, sets two adults, and validates the resulting URL. It applies Direct flights only, expands Show More with progress checks, chooses eligible flights, selects fare-only and verifies the summary. Unparseable/empty results fail rather than being called unavailable or unreleased. Calendar navigation is bounded; dates outside reach are not automatically classified as unreleased. Do not assume menu destinations are nonstop routes.

Failure artifacts contain bounded visible text, sanitized request URLs, response statuses and screenshots; no cookies or tokens. Keep the entire artifacts/profile directory private. Flight screenshots are retained for seven days by the runner. Export Firestore history before any separate retention cleanup; paid TTL is not enabled.

## Cut over from legacy scans

1. Stop the old continuous worker with Ctrl+C in its Terminal. For a background process, verify its identity before terminating it.
2. Run the migration dry run, then apply:

```sh
node --env-file=worker/.env --import tsx worker/migrate-searches.ts
node --env-file=worker/.env --import tsx worker/migrate-searches.ts --apply
```

Migration requests cancellation of active legacy jobs, refuses fare migration while a live lease exists, and is safe to rerun. It preserves all history and previous verified prices while moving snapshots to keys containing both dates. Existing blocked state stays paused until the cause is resolved. Old clients must reload the new deployment because month/year refresh payloads are no longer accepted.

## Optional Docker

The Docker image remains available for hosts that pass their own pilot, but it cannot attach to Chrome on another machine. Compose has no restart loop. Run a batch explicitly with `docker compose run --rm worker npm run worker -- search_BATCH_ID`, using headless or local host settings appropriate to that host. Do not enable collection on a blocked server.
