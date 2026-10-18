# Browser worker setup and pilot

The worker is source-complete but must pass the actual server pilot before production use. Requirements: an always-on Docker-capable server, outbound HTTPS, persistent disk, and enough memory for Chromium. Start planning with 2 CPU cores and 4 GB RAM; measure actual usage rather than treating this as a guarantee. No public inbound port is opened.

## Local collector development

```sh
npm ci
npx playwright install chromium
npm run worker:discover
npm run worker:pilot -- worker/pilot.example.json
```

Discovery writes raw visible destination-menu evidence to `worker/artifacts/discovery.json`. Review names/countries and airport codes, convert to candidate destinations using [the import format](data-format.md), and import through the owner UI. Menus may include connecting destinations: only observed direct flights justify `directStatus: "verified"`. A complete official route registry has not been captured yet; never assert complete discovery from the sample four routes.

The pilot runs three examples (two domestic and one international candidate), writing a JSON import bundle and booking-summary screenshots. Update test dates if outside the booking window, and preserve Thursday/Friday-to-Monday rules. Check the screenshots against returned JSON: both adults, direct flights, dates, flight numbers, all-in totals, baggage, tax treatment and absence of unrequested extras. International overnight flights and locale variations need explicit adapter validation. The adapter accepts explicit +1-day outbound arrivals, excludes return arrivals after Monday, and treats ambiguous empty pages as failures.

## Deploy on the actual server

```sh
cp worker/.env.example worker/.env
mkdir -p secrets
# Place the dedicated service credential at secrets/firebase-worker.json privately.
docker compose build worker
docker compose run --rm worker npm run worker:pilot -- worker/pilot.example.json
```

Set the Firebase project ID in `worker/.env`. The compose service mounts the credential read-only and keeps screenshots in a named volume. Ensure the mounted key is readable by the container's `pwuser` without exposing it to unrelated users. The image and Playwright package are pinned to matching 1.56.1 versions; update both together.

Review the pilot artifacts before setting `PILOT_APPROVED=true`. A successful process exit alone does not establish route completeness or prove every airline layout works. Then:

```sh
docker compose up -d worker
docker compose logs --tail 100 worker
```

No browser credentials, CAPTCHA service, proxy rotation or payment automation is included. If the airline blocks your server, keep collection paused and investigate access normally. A datacenter IP may behave differently from your local Chrome session.

## Recovery and maintenance

- Worker idle polling defaults to five minutes, with a minimum of one minute. Searches are sequential, with at least 15 seconds between ordinary searches by default.
- Each itinerary gets at most one immediate retry, subject to the shared daily attempt limit. Three consecutive failures or one access challenge pauses the queue.
- Owner UI shows the blocker. Resolve it, redeploy any adapter correction, rerun the pilot, then use Resume. Cancelling a running job finishes the current attempt before stopping further searches.
- Expired leases are automatically reclaimed. A completed final observation is recognized after a crash without rerunning the whole job.
- Screenshots are retained locally for seven days and pruned by the worker. Docker log rotation is configured. Firestore history retention is explicit, not paid TTL: export observations before deleting older history through your own maintenance process. Current itinerary snapshots remain separate.
- Keep the worker's daily limit aligned with the documented configuration. Reaching it requeues the job for a later day; it never enables billing.

## Pilot failures

A timeout waiting for “2 Adults” does not establish whether the server is blocked. Failed searches save `failure_*.json` and, when possible, a matching PNG in the artifact directory before closing the browser. JSON records the navigation status, page title, URL without query parameters, bounded visible text and the original error. Cookies and browser storage are not captured. Inspect this evidence before changing selectors or retrying; collection remains unapproved until booking-summary validation passes.
