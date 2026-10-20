# Validation status

Date-pair implementation checks (21 October 2026, Asia/Manila):

- TypeScript and production Next.js build passed.
- 11 domain/parser tests passed: legacy weekend generation, exact pairs, distinct return-date keys, two-adult evidence, top-five unique destinations, exclusions, budget filtering and missing prices.
- 9 isolated Firestore emulator integration tests passed: duplicate batches, owner authorization, global leases, stale-worker fencing, atomic daily budgets, cancellation, block/resume, exclusions/Undo, fresh reuse, legacy migration and distinct unreleased returns.
- Firestore rules test passed: browser clients, including forged owner claims, cannot directly alter fares or jobs.
- Local browser loaded actual migrated Firebase fares; removal/Undo and pagination worked. Mobile viewport checked for horizontal overflow.
- Production migration cancelled 60 legacy jobs and moved 10 fare snapshots to keys including both dates; historical observations retained. Existing collection pause retained.

## Remaining external validation

The dedicated Chrome endpoint was unavailable during this run, so the changed collector has not yet passed a domestic/international pilot with a non-Monday return. Previous Monday-return pilot observations remain valid historical evidence only. No new automated fare is claimed from this implementation session. Stop any old continuous worker before unpausing collection.
