# Tattoo / PMU / Brow Scheduler — Phase 1

Mobile-first appointment scheduler. Next.js (App Router) on Vercel + Supabase (Postgres, Auth). Built to `/PROJECT_SPEC.md` and governed by `/CLAUDE.md` (and the scoped CLAUDE.md files in `app/api/`, `app/admin/`, `lib/booking-engine/`).

## 0. Revision Notes (read this first)
This build went through a correction pass after the initial scaffold. If you're comparing against an earlier copy:
- **Supabase**: updated to current `publishable`/`secret` key naming (with legacy `anon`/`service_role` fallback), `getClaims()` for identity verification (not `getUser()`), and `proxy.ts` replacing the deprecated `middleware.ts` (Next.js 16 rename). Bumped `next`, `react`, `@supabase/ssr`, `@supabase/supabase-js` accordingly.
- **Logging**: no raw `console.*` calls anywhere except `lib/logger/logger.ts` (enforced by ESLint's `no-console` rule). Operational logging and the compliance audit trail are two deliberately separate systems — see CLAUDE.md's Compliance section.
- **Compliance controls**: `audit_log` is now DB-enforced append-only, captures actor/role/category/severity/IP/user-agent, and redacts PII/PHI-adjacent fields before insert. **This is not a HIPAA-covered app** (a tattoo/PMU studio isn't a healthcare provider) — the controls are a defensive floor, not a compliance claim; see CLAUDE.md for the exact wording to keep using.
- **Error boundaries**: `app/(public)/error.tsx`, `app/admin/error.tsx`, `app/global-error.tsx` added.
- **Rate limiting**: extended to the availability endpoint and a new server-side login route (`app/api/auth/login`) — the login page no longer calls Supabase Auth directly from the browser, since that path bypassed rate limiting and audit logging entirely.
- **Booking error handling**: the SQL function now raises distinct SQLSTATE codes (`P1001`/`P1002`/`P1003`, plus Postgres's own `23P01`) instead of encoding error type in the exception message text — the API route matches on `rpcError.code`, not string matching, which is the more robust pattern for anything meant to run in production.
- **Design**: the visual system was rebuilt to avoid generic "AI-luxury-SaaS" defaults (italic serif headline, pill buttons, drop-shadow cards). See "Design System" below.

## Design System
Palette is fixed by the brand brief (teal/silver/charcoal); the design effort went into typography, layout, and a genuine signature element instead:
- **Type**: Bodoni Moda (display, set upright — not italic) + Work Sans (body) + IBM Plex Mono (data: prices, times, confirmation codes, eyebrow labels).
- **Signature element — "the line"**: a single continuous hairline stroke used three ways: a static section divider (`.line-spine`), a literal step-progress track through the booking flow (`.step-track`/`.step-node`), and the perforated edge of the appointment "ticket" card (`.ticket`) on the confirmation page. It's a direct reference to the single-needle line work the studio itself does, not a decorative flourish.
- **Deliberately avoided**: pill/rounded-full buttons, drop-shadow-driven card hierarchy, stark white surfaces (cards use `#FBFBFA`, not `#FFFFFF`), and italic serif headlines — all common "generic AI SaaS" tells.
- Tokens live in `tailwind.config.ts` and `app/globals.css` — extend those rather than hand-rolling one-off styles in a page.


## Intake, Consent & Photo Capture
Added after the initial build, per studio direction:
- **Hard 18+ age gate** — not a soft flag like other pre-screening risk answers. Enforced twice independently: a DB CHECK constraint on `clients.date_of_birth` and an explicit check inside `create_booking()` (SQLSTATE `P1004`). This studio does not serve minors, with or without guardian consent.
- **Four consent categories**: `studio_policy`, `medical_consent`, and `photo_release` are mandatory (DB-enforced via CHECK constraints — see `policies.category`/`required`); `marketing_consent` is the only optional one, and is a genuinely separate opt-in from the mandatory photo release, never bundled together.
- **Medical history is presented together with the consent step** (studio direction) — the medical pre-screening form is still its own data-model entity (`forms.category = 'medical_prescreening'`), just shown alongside the consent checkboxes in the booking UI rather than as a separate screen.
- **Previous-ink questionnaire** is a standalone form category (`ink_history`), separate from medical screening, and never triggers a risk flag on its own.
- **Face photo**: captured live via the browser camera only — `components/booking/FaceCapture.tsx` has no file-upload fallback by design, and applies no filter or processing to the raw frame. `captured_at` is set by the server clock at upload time, never client input. Retained indefinitely (studio direction — audit record + optional portfolio use), stored in a private Supabase Storage bucket (`client-photos`) with no public read access — every view goes through a server-generated signed URL.
- **Known limitation, documented not hidden**: "live camera only" is enforced at the point of capture in the browser (no `<input type="file">` exists in the component), not re-derivable server-side from the JPEG bytes themselves — a sufficiently motivated user could intercept the request and substitute a different JPEG. Server-side validation (`lib/booking-engine/photo.ts`) checks magic bytes (real JPEG signature, not just a claimed Content-Type) and enforces the storage bucket's 5MB/JPEG-only policy, which is the practical ceiling of what's server-verifiable for this control.



### Prerequisites
- Node 18+
- A Supabase project (free tier is fine to start)
- Vercel account for deployment (optional for local dev)

### Steps
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create a Supabase project** at supabase.com, then copy your project URL, anon key, and service role key.
3. **Set environment variables**
   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   ```
4. **Run migrations** (via Supabase CLI, linked to your project)
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
5. **Seed example data**
   ```bash
   npx supabase db execute -f supabase/seed.sql
   ```
6. **Create your admin login** — see "Admin Test Login" below.
7. **Generate real database types** (replaces the hand-written placeholder in `types/database.types.ts`)
   ```bash
   npm run supabase:types
   ```
8. **Run locally**
   ```bash
   npm run dev
   ```
9. **Deploy** — push to a Git repo, import into Vercel, set the same environment variables in the Vercel project settings.

### Admin Test Login
Supabase Auth users aren't created via SQL directly. To create your first admin:
1. In the Supabase dashboard → Authentication → Users → "Add user", create a user with an email/password (e.g. `admin@yourstudio.com`).
2. Copy that user's UUID.
3. Run in the SQL editor:
   ```sql
   insert into app_users (id, role, full_name)
   values ('<paste-uuid-here>', 'admin', 'Studio Owner');
   ```
4. Also insert availability rules for that staff_id (see the commented block at the bottom of `supabase/seed.sql`) — without at least one `availability_rules` row, the public booking flow will correctly show "no availability configured" rather than any bookable slots.
5. Sign in at `/admin/login`.

## 2. File Structure
```
app/
  (public)/            client-facing pages: home, services, book, confirmation
  admin/                admin dashboard + management pages (auth-gated)
  api/                  route handlers: booking, availability
lib/
  supabase/             server/browser/admin Supabase clients
  booking-engine/       availability computation, risk flagging
  validation/            Zod schemas shared by client forms + server routes
  notifications/         placeholder email/SMS senders
  audit/                 audit log writer
  rate-limit.ts
supabase/
  migrations/            schema, RLS, atomic booking function
  seed.sql
types/database.types.ts  hand-written types (regenerate after real deploy)
CLAUDE.md                 root AI governance
app/api/CLAUDE.md         API route rules
app/admin/CLAUDE.md       admin section rules
lib/booking-engine/CLAUDE.md   booking logic rules
docs/typescript-ai-governance.md   general TS mistake/correction reference
```

## 3. Database Schema
See `supabase/migrations/0001_init.sql` (tables, RLS) and `0002_booking_function.sql` (atomic booking creation). Key design choices:
- **Double-booking prevention is a Postgres exclusion constraint** on `appointments` (staff + time range), not app logic — race-condition safe by construction.
- **`create_booking()`** wraps client upsert, appointment insert, form response, policy agreement, deposit, and notification seeding in one transaction.
- **Services can't be hard-deleted with future appointments** (`on delete restrict` FK) — must be deactivated instead.
- All timestamps are `timestamptz` (UTC).

## 4. Completed Features (Phase 1 + partial Phase 2)
- Service listing (public) with price/duration/deposit display
- Full booking flow: date/time selection → client details → pre-screening form → policy agreement → review → submit
- Real-time availability computation respecting business hours, overrides, blocked time, existing appointments + buffers, and advance-booking windows
- Atomic, race-condition-safe booking creation with DB-level double-booking rejection
- Risk flagging on pre-screening answers → `needs_review` status (booking still succeeds)
- Booking confirmation page (idempotent/refresh-safe, read-only)
- Admin auth (Supabase Auth + server-enforced session gate on all `/admin/*` routes)
- Admin dashboard: today's sessions, needs-review, pending deposits, incomplete forms
- Admin appointments list, clients list, services list (read views)
- Rate limiting on the public booking endpoint
- Audit log table + writer utility (wired into the booking function; ready for admin CRUD routes)
- Notification/payment placeholder architecture (rows seeded on booking, real sending deferred to Phase 3)
- Full RLS policy set on every table

## 5. Unfinished Placeholders (by design — see phase discipline in CLAUDE.md)
- **Admin CRUD UI** for services, availability rules, blocked time, forms, and policies — currently read-only views or direct-Supabase-Studio editing. The schema and validation schemas (`lib/validation/schemas.ts`) already support these; only the forms/routes need building.
- **Calendar view** (day/week/month) — placeholder page; appointment data is already queryable.
- **Reschedule/cancel flow** (`/manage/[token]`) — the `appointment_manage_tokens` table and token issuance on booking exist; the page itself isn't built yet.
- **Reference image upload** — `appointments.reference_images` column and Supabase Storage are ready to wire up; upload UI isn't built.
- **Real email/SMS sending** — `lib/notifications/send.ts` has typed placeholder functions that log intent and mark notifications `skipped_not_configured` until Resend/SendGrid/Twilio keys are set.
- **Stripe payments** — `payments` table and status enum are ready; no Stripe integration yet.
- **Client data export** — not built.
- **Admin manual appointment creation + admin override of scheduling rules** — not built; `is_manual` column exists on `appointments` for this.
- **Studio timezone setting** — currently hardcoded in `app/api/availability/route.ts` (`STUDIO_TZ_OFFSET_MINUTES`); no settings UI yet.

## 6. Known Limitations
- **Rate limiting is in-memory**, per serverless instance — not sufficient alone for production abuse prevention on Vercel's multi-instance model. Replace with Upstash Redis/Vercel KV before real launch.
- **Single-artist assumption in the booking UI** — the schema supports multiple `staff_id`s, but `app/(public)/book/[serviceId]/page.tsx` currently just picks the first staff row. Multi-artist selection UI is a Phase 4 (SaaS) concern.
- **`types/database.types.ts` is hand-written**, not generated — regenerate with `npm run supabase:types` after your first real migration to catch any drift.
- No automated test suite yet (see Test Checklist below for manual verification done during this build).

## 7. Test Checklist Results
Verified by design/code review against the schema and API logic (this environment has no live Supabase project or network access to run an end-to-end suite — treat these as "addressed in code" and re-verify against your live project before launch):

| Adversarial case | Status | How it's handled |
|---|---|---|
| Double booking attempts | ✅ | DB exclusion constraint on `appointments`; `SLOT_UNAVAILABLE` mapped to a friendly 409 |
| Booking outside hours | ✅ | `getAvailableSlots()` only returns slots inside `availability_rules`/overrides |
| Booking during blocked time | ✅ | `blocked_time` rows excluded from computed slots |
| Booking with incomplete form | ✅ | Server re-checks `requires_prescreening` regardless of client payload |
| Booking with risky medical answers | ✅ | `evaluateRisk()` runs server-side; sets `needs_review`, never blocks |
| Rescheduling into unavailable slot | ⏳ | Not built yet (reschedule flow is a placeholder) — `create_booking`-style exclusion constraint would apply once implemented |
| Canceling after cancellation window | ⏳ | Not built yet — placeholder |
| Invalid email/phone | ✅ | Zod schema validation client + server |
| Empty required fields | ✅ | Zod `.min(1)` + `safeParse` server-side rejection |
| Timezone mismatch | ✅ | All storage/comparison in UTC; local conversion only at render/slot-generation boundary |
| Admin deleting a service with future appointments | ✅ | FK `on delete restrict` blocks it at the DB level |
| Payment marked paid without appointment | ✅ | Payments only created inside `create_booking()`'s single transaction, tied to an appointment |
| Client refreshing confirmation page multiple times | ✅ | Confirmation page is read-only (no mutation on GET) |
| Client using browser back button during booking | ⚠️ | Booking state lives in React state (lost on back/refresh); no partial booking is ever written to the DB (nothing persists until final submit), so this is safe but not resumable — documented, not a data-integrity risk |
| Two users selecting the same time | ✅ | Exclusion constraint resolves this at the DB layer regardless of UI timing |
| Very long names/messages | ✅ | Zod `.max()` on every text field, mirrored in DB `check` constraints |
| File upload abuse | ⏳ | Not built yet (no upload UI in Phase 1) — governance doc (`docs/typescript-ai-governance.md` #23) specifies the required approach for when it's built |
| Unauthorized admin access | ✅ | Server-enforced `requireStaff()`/RLS combination, not client-side only |
| Missing environment variables | ✅ | `getEnv()` helpers throw clear errors naming the missing variable, rather than failing silently |

Legend: ✅ addressed in this build · ⏳ scoped but not yet implemented (documented above) · ⚠️ handled safely but with a UX limitation noted
