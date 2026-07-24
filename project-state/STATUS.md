# Project State — read this first when picking the project back up

Last updated: 2026-07-24, end of the repo-recovery/testing/CI session.

This folder exists because the repo's history doesn't tell the full story:
the working tree was reconstructed from a shuffled file upload in this
session, and several load-bearing pieces still don't exist. Read this
before assuming anything in CLAUDE.md/README.md is currently true — those
files describe the *intended* system; this file describes what's *actually
built and verified* as of the date above.

## What actually happened this session (short version)

1. Every one of the ~41 uploaded files had a name unrelated to its content
   (not just browser-download duplicates — a full shuffle). Reorganized all
   of them into the structure README.md §2 describes, by reading and
   matching content.
2. Two files were missing entirely (`types/database.types.ts`,
   `docs/typescript-ai-governance.md`) — rebuilt both. The database types
   were derived directly from the SQL migrations (high confidence). The
   governance doc was reconstructed from context clues scattered across the
   codebase (comments referencing specific rule numbers, e.g. rule #23 on
   magic-byte file validation) — it's a plausible reconstruction consistent
   with those clues, **not recovered original text**. Treat its exact
   wording as mine, not the original author's.
3. Also had to rebuild `lib/env.ts`, `lib/logger/logger.ts`,
   `components/ui/StatusBadge.tsx` — referenced everywhere, never uploaded,
   nothing compiled without them.
4. Ran real `tsc`/`eslint`/a real local Supabase stack (Postgres 17 via
   Docker, `supabase` CLI) and fixed every real bug that surfaced — see
   "Bugs found and fixed" below. This is why CLAUDE.md now has rule 11:
   typecheck + lint must both pass, always.
5. Built a real (no-mock) test suite: Vitest against the actual local
   Supabase stack, Playwright E2E against a production build. Both green.
6. Built CI (`.github/workflows/ci.yml`) and security-scan
   (`.github/workflows/security.yml`) GitHub Actions workflows. **Neither
   has actually run on GitHub yet** — they were authored and pushed but not
   watched through a real Actions run. Check the Actions tab after the next
   push and fix anything that only shows up in that environment (different
   from this sandbox — e.g. Docker layer caching, runner resource limits).
7. Linked this repo to the real Supabase project and pushed the corrected
   schema via the CLI (`supabase link` + `supabase db push` — never via the
   MCP migration tools, per explicit direction). Verified via a read-only
   MCP `list_tables` call: **all 17 tables now exist on the real project,
   RLS enabled, 0 rows** (seed data is dev-only, was never meant to go to
   the real project — see "Before real users touch this" below).
8. Committed and pushed everything to `main` on GitHub.

## Real bugs found and fixed (all confirmed via actually running things, not review)

- `eslint.config.mjs` crashed (`Converting circular structure to JSON`)
  under the current `eslint-config-next`, which now ships a native flat
  config array — running it back through `@eslint/eslintrc`'s legacy
  `.extends()` translator broke. Rewrote to import the flat config
  directly.
- `package.json`'s `lint` script called `next lint`, which Next.js 16
  removed entirely. Changed to `eslint .`.
- `next.config.js`'s `serverActions.bodySizeLimit` was at the top level;
  verified against current Next.js docs — it's still required to be under
  `experimental.serverActions` even in this version, despite Server Actions
  themselves being stable since v14. The original comment claiming
  otherwise was wrong.
- **The migrations never granted table privileges to
  `anon`/`authenticated`/`service_role`.** RLS policies restrict which rows
  a role can touch, but Postgres checks table-level GRANTs *first* — every
  query failed with `permission denied` (42501) regardless of RLS
  correctness, even for the secret-key admin client. Added
  `0006_grants.sql`.
- `uuid_generate_v4()` failed with `42883` (does not exist) on the **real
  hosted project** specifically — `uuid-ossp` lives in a separate
  `extensions` schema there, not on the search path, even though `create
  extension if not exists` reports it as already present. Never manifested
  locally (fresh local stacks install it differently). Switched every
  primary key default to Postgres's built-in `gen_random_uuid()` — no
  extension dependency at all, and it's what current Supabase docs
  recommend anyway.
- **`app/admin/login/page.tsx` was nested inside the same layout that
  requires an authenticated session** (`app/admin/layout.tsx`'s
  `requireStaff()`). Visiting `/admin/login` while logged out redirected to
  `/admin/login` — an infinite loop. Fixed by moving every genuinely
  protected route into `app/admin/(protected)/` (a route group — doesn't
  affect URLs) and leaving `login/`, `error.tsx`, and `CLAUDE.md` outside
  it. This was caught by the Playwright E2E suite, not by reading the code.
- `types/database.types.ts` (my reconstruction) was initially missing the
  `Relationships` field `@supabase/postgrest-js`'s `GenericTable` type
  requires — without it every query silently widened to `never`, hiding
  real column names. Fixed, and it turned out to make two `@ts-expect-error`
  suppressions in the dashboard/appointments pages genuinely unnecessary
  (removed them — the join typing now just works).

## Dependency changes made (and what was deliberately *not* touched)

Bumped to current stable, no deprecation warnings: `@supabase/ssr` (0.7→0.12),
`date-fns` (3→4, `date-fns-tz` stayed 3.x — its own latest still declares
peer support for date-fns v4), `zod` (3→4), `@hookform/resolvers` (3→5, to
match zod v4), `@types/node` (→22.x, matching a current LTS Node line),
`supabase` CLI (1→2), `typescript` (→5.9.3, latest 5.x patch).

**Deliberately NOT bumped**, despite `npm outdated` offering a newer major:
- `tailwindcss` 3→4 — v4 is a config-paradigm shift (CSS-first `@theme`
  instead of `tailwind.config.ts`, different PostCSS plugin package). Would
  require rebuilding the design system CLAUDE.md/README describe as already
  built. Don't do this as a side effect of a dependency bump — it's its own
  project.
- `eslint` 9→10 — no verified compatibility path with `eslint-config-next`
  at the time of this session; risk of breaking the flat config setup that
  was *just* fixed.
- `typescript` 5→7 — "7" is Microsoft's native/Go-ported compiler, a very
  different thing from an incremental TS release even if npm tags it
  latest. Not something to opt into via a routine bump.

## What's built and verified working right now

- **Admin auth gate, end to end, for real**: `proxy.ts` (session refresh) +
  `requireStaff()`/`requireStaffApi()` (`lib/supabase/server.ts`) +
  `app/admin/(protected)/layout.tsx`. Verified by Playwright against a
  production build, real Supabase Auth, no mocks — every protected route
  redirects to `/admin/login`, and login itself is reachable.
- **Admin section**: dashboard (real query, today/needs-review/pending
  deposits/incomplete forms sections), appointments list, clients list —
  all real Server Components hitting the real DB. Calendar, availability,
  blocked-time, forms, policies, settings are intentional Phase-1
  placeholders (`components/admin/PlaceholderPage.tsx`), matching
  README's own "Unfinished Placeholders" list — not bugs.
- **`lib/booking-engine/`**: `getAvailableSlots()` (business hours →
  overrides → blocked time → existing appointments+buffers → advance
  window, in that order — verified against real seeded data),
  `evaluateRisk()`, `calculateAge()`/`meetsMinimumAge()`,
  `uploadFacePhoto()`/`getSignedPhotoUrl()` (magic-byte JPEG validation,
  verified against real Supabase Storage).
- **`lib/audit/log.ts`**: `writeAuditLog()`, redaction, and — critically —
  the DB's own append-only trigger, verified to reject UPDATE/DELETE even
  via the secret-key admin client (RLS-bypass ≠ trigger-bypass).
- **DB schema on the real hosted project**: all 17 tables, RLS enabled,
  the double-booking exclusion constraint, the 18+ age CHECK constraint,
  the consent-category CHECK constraints — all verified against a real
  Postgres instance (locally; schema then pushed to the real project
  unchanged).
- **Test suite**: 48 Vitest tests (real local Supabase, no mocks) + 13
  Playwright E2E tests (real production build). Run with `npm run db:start`
  then `npm test` / `npm run test:e2e`.

## What is NOT built — the real gap, not a bug to "fix," a thing to build

These were never part of the upload. They aren't broken; they don't exist:

- **`create_booking()`** — the atomic SQL function root CLAUDE.md rule 2
  calls the mandatory path for every booking write (client upsert +
  appointment + form response + policy agreement + deposit + notification
  seeding, one transaction, SQLSTATE codes P1001–P1004). This is the single
  most important missing piece — there is currently no way to create a
  booking through the documented architecture at all.
- The entire `app/api/**` route layer: booking, availability,
  `auth/login` (the admin login page already posts to this — confirmed via
  E2E that it currently 404s).
- The entire public booking flow: `app/(public)/**` — home, services,
  book, confirmation, reschedule/cancel. None of it exists.
- `lib/validation/schemas.ts` (Zod schemas shared client+server).
- The real `components/booking/BookingFlow.tsx` and `FaceCapture.tsx`
  (live camera capture) — a placeholder component ended up occupying that
  filename in the original shuffled upload; the real ones were never
  uploaded.
- `lib/rate-limit.ts`, `lib/timezone.ts` — referenced in comments/docs
  throughout the codebase, never uploaded.
- `app/api/CLAUDE.md` — the scoped governance doc for the route layer that
  doesn't exist yet.

## Before real users touch this (pre-Vercel-launch)

See `VERCEL_LAUNCH_CHECKLIST.md` for the actionable list. Summary of the
non-obvious items:

- The real Supabase project has zero rows in every table — `seed.sql`
  intentionally never ran against it (dev-only data). You need at least one
  `app_users` admin row and one `availability_rules` row before the public
  booking flow (once built) can show anything bookable — see README's
  "Admin Test Login" section, which still applies.
- Rate limiting (`lib/rate-limit.ts`, once built) is documented in
  README's own "Known Limitations" as in-memory and **not sufficient for
  Vercel's multi-instance model** — this was already a known gap before
  this session, not something introduced here. Needs Upstash Redis/Vercel
  KV before real launch.
- A Supabase **Personal Access Token was pasted in this chat** to
  authenticate the CLI for `supabase link`/`db push`. It was used only in
  shell env vars, never written to a file — confirmed nothing containing it
  was staged before committing. Still, since it was shared in plaintext
  chat, consider rotating it at
  https://supabase.com/dashboard/account/tokens before or shortly after
  launch, as routine hygiene.
- `.github/workflows/ci.yml` and `security.yml` haven't run on real GitHub
  Actions yet — watch the first run after the next push.

## Reference: the real Supabase project

- Project ref: `ituiiuenrmwslhqewchk`
- Name: "lashondradixon@gmail.com's Project"
- Region: us-west-2, Postgres 17.6, status ACTIVE_HEALTHY as of this session
- Linked locally via `supabase link --project-ref ituiiuenrmwslhqewchk`
  (this link state lives in `supabase/.temp/`, which is gitignored — a
  fresh clone/environment needs to re-link before running `db push` again)
- Vercel will need `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` set to this
  **real** project's values (Project Settings → API Keys on
  supabase.com/dashboard) — not the local-dev values `supabase status`
  prints, which only work against the local Docker stack.
