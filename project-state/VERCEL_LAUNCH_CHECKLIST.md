# Vercel Launch Checklist

Tracker, not prose — check items off as they're done. Grouped by what
blocks what. See `STATUS.md` for the full context behind each item.

## Blocks everything: the booking write path doesn't exist yet

- [ ] Write `supabase/migrations/0002_booking_function.sql` —
      `create_booking()`: atomic transaction wrapping client upsert,
      appointment insert, form response, policy agreement, deposit,
      notification seeding. Root CLAUDE.md rule 2 requires this be the
      *only* path booking writes go through — no sequential inserts from a
      route handler.
      - [ ] Raises distinct SQLSTATEs per README §0's documented pattern
            (`P1001`/`P1002`/`P1003` for booking-logic failures,
            `P1004` for the under-18 gate, plus Postgres's own `23P01` for
            the exclusion-constraint race) — match on `error.code` in the
            API route, never on message text (see
            `docs/typescript-ai-governance.md` rule 14).
      - [ ] Test it the same way the rest of this session's suite was
            built: real inserts against the real local Postgres stack, not
            mocks. Add to `tests/integration/`.
- [ ] `lib/validation/schemas.ts` — Zod schemas for booking form input,
      shared by client-side forms and the server route (per
      `docs/typescript-ai-governance.md` rule 19: `safeParse`, not
      `parse`, at this boundary).
- [ ] `app/api/book/route.ts` (or wherever the spec lands it) — calls
      `create_booking()`, never raw sequential inserts.
- [ ] `app/api/auth/login/route.ts` — the admin login page
      (`app/admin/login/page.tsx`) already posts here; currently 404s
      (confirmed by `tests/e2e/admin-auth-gate.spec.ts`). Once built,
      replace that E2E test's "surfaces a failure" assertion with a real
      success-path login test.
- [ ] `app/api/availability/route.ts` — wraps
      `lib/booking-engine/availability.ts`'s `getAvailableSlots()`, which
      already exists and is tested.

## Blocks a real user ever seeing the site

- [ ] The public booking flow: `app/(public)/**` — home, services, book,
      confirmation, reschedule/cancel. None of this exists yet.
- [ ] `components/booking/BookingFlow.tsx` and `FaceCapture.tsx` (real
      live-camera capture, no file input — see root CLAUDE.md's
      Intake/Consent/Photo section for the non-negotiable constraints).
- [ ] `app/(public)/error.tsx`, `app/global-error.tsx` — root CLAUDE.md
      rule 9 requires these; only `app/admin/error.tsx` exists so far.

## Blocks production-safe operation (not blocking a *demo*, blocking *real users*)

- [ ] `lib/rate-limit.ts` — doesn't exist. README's own "Known
      Limitations" already flags that an in-memory approach won't work on
      Vercel's multi-instance model regardless — build it against
      Upstash Redis or Vercel KV from the start rather than building the
      in-memory version first.
- [ ] `lib/timezone.ts` — referenced throughout comments, never built.
      `lib/booking-engine/availability.ts` currently does its own inline
      UTC/offset math (`localTimeToUtc()`) without it — fine for now, but
      the studio-timezone-setting placeholder in
      `app/admin/(protected)/settings/page.tsx` references this gap.
- [ ] Seed the real Supabase project (`ituiiuenrmwslhqewchk`) with at
      least one `app_users` admin row and one `availability_rules` row —
      it currently has zero rows in every table by design (`seed.sql`
      never ran against it). See README's "Admin Test Login" section.
- [ ] Set real environment variables in the Vercel project settings:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
      `SUPABASE_SECRET_KEY` — pull these from
      supabase.com/dashboard/project/ituiiuenrmwslhqewchk/settings/api,
      **not** the local-dev values `supabase status` prints.
- [ ] Rotate the Supabase Personal Access Token pasted in this session's
      chat (supabase.com/dashboard/account/tokens) — routine hygiene, not
      an active leak (confirmed never written to a committed file).

## Before merging future changes

- [ ] Watch `.github/workflows/ci.yml` and `security.yml` actually run on
      GitHub Actions at least once — they were authored and pushed this
      session but never observed running in that environment. Fix
      anything that only shows up there (Docker behavior, runner limits,
      timing).
- [ ] `npm run typecheck` and `npm run lint` must both exit 0 — this is
      now CLAUDE.md rule 11, not optional.
- [ ] `npm run db:start && npm test && npm run test:e2e` before trusting
      any change to booking logic, auth, or the schema.

## Nice-to-have, not blocking

- [ ] Regenerate `types/database.types.ts` via `npm run supabase:types`
      once `create_booking()` and any other Phase-2 schema work lands —
      the current version is hand-written (accurately, from the SQL) but
      README's own convention is to regenerate after real migrations to
      catch drift.
- [ ] `docs/typescript-ai-governance.md` was reconstructed from context
      clues this session, not recovered verbatim — read through it once
      and adjust anything that doesn't match how you actually want AI
      agents to work in this repo going forward. Don't renumber rules if
      you edit it (other files cite rule #23 by number).
