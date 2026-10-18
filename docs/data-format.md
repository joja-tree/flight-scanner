# Import, export and fare evidence

Imports are owner-only. Choose a JSON file in Manage, validate/preview, then confirm the same payload. Maximum request size is 300 KB, 100 destinations and 100 observations per file. Export creates compatible batches, each with up to 50 itinerary records (at most 100 observations because the latest failure and prior good fare may both be retained).

Canonical schemas are in `lib/domain.ts`; `data/reference-import.json` is a complete valid example. Do not add fields outside the schema. Amounts use integer PHP centavos (`799352` means PHP 7,993.52), not floating-point pesos.

A bundle contains `version: 1`, `destinations`, and `observations`. A destination has airport code, display name, country, domestic/international kind, candidate/verified direct status, nullable verification timestamp, and official airline source URL. An observed direct route requires a timestamp. Candidate routes must not imply verified nonstop availability.

An observation identifies destination, Thursday/Friday departure in 2027, following-Monday return, UTC observation timestamp, status, nullable quote, nullable indicative base fare, explanatory note, and evidence reference. Only verified observations may contain a quote. Indicative calendar prices never participate in all-in fare rankings. Unavailable and unreleased require explicit evidence; a failed browser search is neither.

A verified quote includes currency PHP, exactly two adults, a confirmed booking-summary flag, total, two flight legs and travel-tax treatment. Legs include 5J/DG flight number, airport pair, local departure/arrival dates and times, per-adult fare and baggage text. The total must equal both leg fares multiplied by two. Return arrival must be Monday. No connection segments are accepted.

Duplicate observation keys within a file are rejected. Re-importing the same timestamp is idempotent. An older observation cannot replace a newer itinerary snapshot. Valid imports preserve the last verified fare when a later check failed. History keys are SHA-256 hashes of itinerary ID and timestamp. Import operations record an audit entry; if connectivity interrupts a batch, re-import the same file safely.

The bundled historical quote is manually verified from the October 2026 session. Its timestamp is rounded to that session and explicitly described as historical. No real-time availability is implied.
