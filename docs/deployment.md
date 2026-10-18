# GitHub, Vercel and Firebase setup

## 1. Firebase Spark project

Create or select a Firebase project on the Spark plan, register a web app, enable Google under Authentication, and create the default Firestore database. Add your production Vercel hostname and localhost to authorized Authentication domains. Keep billing disabled; this project requires no Functions, Storage, paid TTL deletes or paid backups.

Copy the four Firebase web configuration values into the `NEXT_PUBLIC_FIREBASE_*` variables in `.env.example`. These identify the web app and are public. No private key belongs in a public-prefixed variable.

Create separate service identities for the website and worker. Both require access to Firestore data (for example, the Datastore User role in this dedicated project); the website also needs Firebase Authentication read access to check token revocation. Do not grant project Owner/Editor. Admin SDK credentials bypass Firestore rules, so they must stay on trusted servers. A dedicated project limits their scope; IAM does not provide this app's per-collection browser rules.

For Vercel set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` through its secret environment settings. The private key supports escaped newlines. For the worker use a read-only mounted service-account file or application-default credentials, not frontend configuration. Do not send keys in chat or commit them.

Deploy rules and indexes using the repository-pinned Firebase CLI:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

Sign in to the app once, find your UID in Firebase Authentication, then set `OWNER_UID` on Vercel and redeploy. The owner is configured server-side, not via email parameters or client claims.

## 2. Vercel

Import `joja-tree/flight-scanner` from GitHub. Use the Next.js preset, repository root, Node.js 22+, `npm ci`, and `npm run build`. The app uses no Vercel cron or browser runtime. Set `APP_ORIGIN` to the exact HTTPS production origin, without a trailing slash. Keep previews separate from production credentials or set their own exact origin; unknown origins are rejected.

Keep `PUBLIC_REFRESH_ENABLED=false`. Defaults are 30 browser attempts per Manila day, a 60-minute non-owner refresh cooldown, and 200 pending jobs. Enforce the same `DAILY_SEARCH_LIMIT` in the worker; the worker is the authority for search expenditure. These are conservative work limits, not guarantees of staying under public traffic quotas.

Vercel Hobby is for non-commercial personal use; public sign-in does not itself establish eligibility. Confirm the actual project remains eligible before deploying or monetizing. Do not enable a paid trial as part of setup. Sources checked 18 October 2026: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Firestore free quotas](https://firebase.google.com/docs/firestore/quotas).

## 3. Initial data and server pilot

Use the owner's Manage dialog to validate and import `data/reference-import.json` if you want the historical reference in your database. It is dated October 2026, not a fresh quote. Discover and reconcile additional route candidates before a full-year scan. Follow [worker setup](worker.md) to test the actual server, inspect screenshots and approve collection.

Only after a successful pilot should you set `PILOT_APPROVED=true` on the worker. Public refresh is a separate switch: leave it disabled until usage is measured. Run owner scans first. The owner can queue the full registered route set, inspect progress and cancel jobs. Complete all route reconciliation before describing this as an all-destination scan.

## 4. Free-tier operations

The published Firestore free allowances at verification time are 50,000 reads/day, 20,000 writes/day, 1 GiB storage and 10 GiB outbound/month. Provider limits can change. Vercel and Firebase consoles are the source of truth. The app cannot guarantee unlimited public use for free: authentication, API hits, retries and imports also consume resources. No auto-upgrade code exists.

Use Vercel's available request protections for abusive traffic. Cacheable public endpoints, paginated reads, manual progress reloads and five-minute idle worker polling reduce ordinary load; they are not a substitute for traffic monitoring. At quota errors APIs return an explicit unavailable state. Previously loaded browser results remain until the user changes filters or reloads.

Observe a small batch before increasing any limit. A default 30 attempts/day means a 4,200-itinerary scan takes at least 140 days, excluding retries; a full-year scan is resumable, not instant. Raise the limit only after measuring server and Firestore usage. No payment method or infrastructure upgrade is required by the code.
