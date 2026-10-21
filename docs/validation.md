# Validation status

Date-pair implementation checks (21 October 2026, Asia/Manila):

- TypeScript and production Next.js build passed.
- 11 domain/parser tests passed: legacy weekend generation, exact pairs, distinct return-date keys, two-adult evidence, top-five unique destinations, exclusions, budget filtering and missing prices.
- 9 isolated Firestore emulator integration tests passed: duplicate batches, owner authorization, global leases, stale-worker fencing, atomic daily budgets, cancellation, block/resume, exclusions/Undo, fresh reuse, legacy migration and distinct unreleased returns.
- Firestore rules test passed: browser clients, including forged owner claims, cannot directly alter fares or jobs.
- Local browser loaded actual migrated Firebase fares; removal/Undo and pagination worked. Mobile viewport checked for horizontal overflow.
- Production migration cancelled 60 legacy jobs and moved 10 fare snapshots to keys including both dates; historical observations retained. Existing collection pause retained.

## Live pilot

The attached-Chrome pilot passed on 22 October 2026 (Asia/Manila). All three visible booking-summary screenshots were reviewed for two adults, exact dates, direct flight details and fare-only totals:

| Destination | 2027 dates | Total for two adults |
| --- | --- | --- |
| Bacolod | March 5–9 (Tuesday return) | PHP 7,993.52 |
| Boracay (Caticlan) | March 4–8 | PHP 8,573.04 |
| Hong Kong | March 5–8 | PHP 32,059.22 |

Observations were imported into Firestore and collection was unpaused. No new search batch was queued. Hong Kong travel-tax treatment remains unknown. These are timestamped observations, not current-price guarantees. The server's headless access and complete route coverage remain unverified; continue using selected batches in the validated attached Chrome profile.
