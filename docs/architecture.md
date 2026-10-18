# Architecture and data flow

The Next.js app runs on Vercel. Firebase Authentication supplies verified Google ID tokens. Firestore stores the route registry, itinerary observations and scan jobs. A single Dockerized worker runs on an existing server and polls Firestore; no inbound port, n8n, paid data service, Firebase Functions or Redis is required.

## Public website

`GET /api/destinations` returns up to 100 routes and registry completeness. `GET /api/fares?month=3&cursor=...` returns up to 100 itinerary records, ordered by document ID. Both responses are CDN-cacheable for 60 seconds. Ranking, budget and day filters apply to loaded pages only; the UI discloses pagination. Opening a booking link never marks an observation refreshed.

Without Firebase server configuration, these read endpoints serve four historically observed domestic routes and one historical Bacolod quote. This is explicitly labeled reference mode. Configured projects receive their actual database contents, including an empty state; reference data is never silently inserted into production.

## Authentication and authorization

Google registration is open to everyone. `GET /api/session` verifies the ID token (including revocation) and derives owner access from server-only `OWNER_UID`. No browser-supplied role is trusted. All mutations verify the exact `APP_ORIGIN`, bearer token, input shape and size. Firestore rules deny direct browser access to every collection; the Admin SDK is used only in trusted services. Never grant users Admin SDK credentials.

`POST /api/refresh` accepts `{scope:"month",destination:"BCD",month:3}` or owner-only `{scope:"year"}`. Public requests remain disabled until `PUBLIC_REFRESH_ENABLED=true`. `POST /api/jobs` with `{id}` cancels an owned job; owner can cancel any job. `POST /api/resume` is owner-only and should follow actual resolution of a blocker. `GET /api/jobs` returns at most 30 recent jobs, scoped to the caller unless owner.

## Queue and consistency

A route/month has a deterministic job ID. A year job uses month 0. Enqueue transactions reuse active year/month jobs, enforce a user cooldown and bounded pending count, and reserve new work atomically. A year request excludes dates covered by active monthly jobs. Finished jobs can be explicitly refreshed again.

`system/queue` holds a global worker lease. Claims use a random token and a three-minute expiry; heartbeats run every 30 seconds. Transactions guard saves with the job's token, cursor and running state. The same transaction writes the observation, merges the latest fare and advances the cursor. Stale workers cannot commit. Only one global scan runs even if a second worker is accidentally launched. Cancellation occurs between searches.

Each browser attempt reserves one unit in `usage/YYYY-MM-DD` before execution; retries also count. The application budget resets at midnight Asia/Manila. **This is independent of Firestore's quota reset**, which uses Pacific time. Exhausted budgets requeue work; failed processing never resets the counter. Access challenges pause the entire queue immediately. Three consecutive parsing/search failures also pause it. A crash leaves a reclaimable lease and saved cursor.

## Price model

Amounts are integer PHP centavos. A verified quote requires two direct legs operated by 5J/DG, two adults, matching dates/airports and a booking-summary total equal to twice the two per-adult fares. Monday arrival is required. Times are airport-local.

Each itinerary holds `latest` and `lastVerified`; a failed or indicative attempt cannot erase a good historical quote. Historical snapshots also live in `observations`. Writes are idempotent by itinerary and observation timestamp. Imports merge chronologically. Quotes older than 24 hours are labeled for rechecking; this freshness threshold is a display choice, not a price guarantee.

Statuses: verified, indicative, unavailable, unreleased, failed and blocked. Unchecked is represented by no observation. The browser adapter currently conservatively records failures instead of guessing unavailable/unreleased statuses from an empty page; validated owner imports may supply these explicit statuses with evidence.

## Collection limitations

The adapter uses visible rendered flight cards and the booking summary, never private API tokens. It expands bounded flight lists, chooses the lowest parseable direct flight on each leg that returns to Cebu on Monday, selects GO Basic, and confirms two-adult subtotals. It is a pilot-gated integration, not a proven production scraper. Site text/layout changes can require adapter updates. Explicit +1-day outbound arrival labels are supported; return flights arriving after Monday are excluded. Ambiguous date markers must be inspected in the pilot. The route-discovery helper exports visible menu evidence for manual reconciliation of airport codes and route candidates; it does not infer nonstop service or declare the registry complete.

No user passenger names or payment information are collected. The app never completes a booking.
