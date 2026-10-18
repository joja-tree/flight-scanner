# Validation status

Validated locally on 18 October 2026. Deployment and collection are separate milestones.

## Passed

- TypeScript checking and Next.js production compilation.
- Nine unit tests: all 105 departure dates, Monday returns including January 2028, money and two-adult validation, direct flights, preserved verified observations, import validation, lease/cooldown policy, and visible booking-summary parsing.
- Six Firestore emulator integration tests: concurrent request deduplication, cooldown, lease recovery and stale-worker fencing, atomic daily budget, cancellation ownership, collection pause/resume, and month/year overlap.
- Firestore rules test: anonymous users, authenticated users, and forged owner claims cannot read or write protected collections directly.
- Browser checks on desktop and a 390px mobile viewport: ranking cards, calendar, destination comparison, Thursday filter, budget empty state, trip details, booking links, refresh dialog, and no horizontal overflow.

The local browser used the explicitly labeled historical reference data. Missing observations displayed as unchecked, never free flights.

## Still required before production collection

- Configure the real Firebase project; test Google sign-in, authorized owner endpoints, and import/export with real project credentials.
- Deploy to the user's Vercel project and verify domain, authentication authorized domains, and free-plan eligibility.
- Build and run the Docker image on the actual server. Run the domestic/international pilot and compare two-adult totals against visible airline summaries.
- Reconcile the complete direct-route registry. The included four-route reference registry is partial; discovery currently exports visible route-menu evidence for owner review.
- Validate live collection selectors and unavailable/unreleased evidence. Ambiguous results currently fail safely; they do not assert sold-out or unreleased inventory.
- Begin a resumable initial scan after pilot approval. No full-year, all-destination scan has been completed.

Public refresh remains disabled until the pilot establishes safe limits. The UI and queue tests do not establish that the airline permits collection from the server.
