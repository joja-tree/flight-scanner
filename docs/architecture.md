# Architecture and data flow

Next.js on Vercel serves the interface and validated APIs. Firebase Authentication verifies Google identities; Firestore stores routes, observations and search batches. The local attached-Chrome worker runs one specified batch and exits. No scheduler, paid API, Firebase Functions or extra queue service is used.

## Date-based discovery

A search contains one to five explicit departure/return pairs and up to 100 destination codes. Duplicate pairs/codes are normalized. The UI offers all, domestic, international and shortlist selection plus Thursday/Friday-to-Monday shortcuts. Other weekdays and year boundaries are supported. New scans reject past departures; historical results remain browsable.

Rankings take each destination's cheapest verified two-adult round trip across the selected pairs, then display five unique destinations. Ties sort by destination code and dates. Optional budgets filter verified totals. Removed destinations are local to this search and can be restored. The alternate-date view compares selected date pairs, rather than expanding into an entire month.

The route registry may contain connecting destinations. Candidates remain labeled until direct flights are actually observed. Missing data, failed searches, unavailable flights and unreleased dates are distinct. Only verified booking-summary totals enter rankings; older good fares survive later failures. Every price has a timestamp, with a 24-hour stale threshold. Incomplete/stale coverage is labeled “Cheapest verified so far.” There is no price-based pruning.

## APIs and authorization

- `GET /api/destinations`: bounded route registry and completeness flag.
- `GET /api/fares?search=<JSON>&cursor=<offset>`: JSON contains `pairs:[{departure,returnDate}]` and `destinations:[code]`. Reads 50 combinations per page, returning `fares`, `nextCursor`, `total`, and `reference`. Rankings cover loaded pages; the UI explicitly offers loading the rest. Responses cache for 60 seconds.
- `POST /api/refresh`: `{scope:"search",pairs,destinations,force:false}`. Owner-only even if the legacy public-refresh environment flag is set. Returns batch `id`, `created`, and `reused`. Active matching batches deduplicate transactionally, including Scan again requests. Force applies only when creating a new run.
- `GET /api/jobs`: at most 30 recent jobs filtered to accessible search batches; `?id=search_…` fetches one. Lease tokens are never returned. `POST {id}` requests cancellation. `PATCH {id,excluded:[codes]}` persists owner exclusions.
- `GET /api/session`: derives owner identity from server-only `OWNER_UID`; never from client fields.
- Owner import/export and resume endpoints remain available. Resume only after resolving and validating the blocker.

All mutations check exact `APP_ORIGIN`, verified Firebase identity, strict Zod schemas and bounded request sizes. Firestore rules deny direct browser access. Credentials stay on trusted servers. Historical reference mode applies only when server Firebase configuration is absent; it never substitutes data for a failing configured database.

## Batch worker and consistency

A batch ID hashes the owner, normalized date pairs and destinations. It persists exclusions, processed itinerary IDs, force/freshness preference and status. The worker requires the ID explicitly, preventing accidental consumption of unrelated jobs. It reuses results under 24 hours old only when the latest attempt is verified; Scan again bypasses reuse.

One global three-minute lease fences workers; heartbeats run every 30 seconds. Saves check token, running state and unprocessed itinerary ID transactionally, then merge the fare and advance progress. Expired leases permit restart recovery. Cancellation and exclusions take effect between searches; an in-flight result may still be saved. Excluded combinations are not marked processed. Undo can requeue an otherwise completed batch. Cancelled batches require a new request.

Every browser attempt, including the one allowed retry, reserves daily budget atomically. Default and maximum: 300 attempts per Manila day. This is independent of Firestore's Pacific quota reset. Searches wait at least 15 seconds. The runner exits on completion, exhausted budget, cancellation or pause; it never waits overnight or polls indefinitely. An access block or three consecutive failures pauses collection. Existing fares remain visible.

## Price model and compatibility

Integer PHP centavos; exactly two adults; direct 5J/DG flights; matching airports/dates; booking summary must equal twice both per-adult fares. Return arrival must be on the selected return date. Optional extras are excluded and international travel tax can be unknown. The app never books tickets.

Canonical itinerary keys include destination, departure and return date. Legacy departure-only snapshots are read and merged during transition. `worker/migrate-searches.ts` cancels legacy queue entries and migrates snapshots idempotently while retaining observation history. See [worker operations](worker.md) for cutover and pilot limitations.
