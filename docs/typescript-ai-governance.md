# TypeScript AI Governance — Mistake/Correction Reference

Referenced by root `CLAUDE.md` ("See `/docs/typescript-ai-governance.md` for TypeScript-specific failure patterns to avoid" and rule 10: "Follow `/docs/typescript-ai-governance.md` for all TypeScript-level patterns... self-check generated code against it before finalizing"). This is not a style guide — it's a list of specific mistakes AI-generated TypeScript tends to make in this codebase's problem domain (booking safety, PII/PHI-adjacent data, compliance logging), paired with the correction actually enforced here. Numbering is stable — other docs reference specific rules by number (e.g. `lib/booking-engine/photo.ts` cites rule #23) — don't renumber when adding new rules; append instead.

## Async & Promise Handling

**1. Don't fire-and-forget a Promise that has a side effect the caller needs to know failed.** An un-awaited `supabase.from(...).insert(...)` inside a route handler can resolve after the response is already sent, silently swallowing the error. Await it, or explicitly `.catch()` and log if the operation is genuinely best-effort (e.g. a notification-row seed that shouldn't block the booking response).

**2. `Promise.all` fails all-or-nothing — don't use it where partial success is acceptable.** `app/admin/dashboard/page.tsx` queries four independent sections in parallel; if one query is meant to degrade gracefully (see rule 18) it shouldn't be able to take the other three down with it. Use `Promise.allSettled` when sections are independent and one failing shouldn't blank the page.

**3. Don't assume `await` inside a `.map()` callback serializes anything.** `arr.map(async (x) => ...)` returns an array of unresolved Promises, not resolved values — a common AI mistake that produces `[Promise, Promise, ...]` silently. Use `Promise.all(arr.map(...))` or a plain `for...of` loop with `await` when order or backpressure matters.

**4. Server Component data fetching is not automatically deduped across siblings** the way `fetch()` with Next's cache is. Two Server Components independently calling `createServerSupabaseClient()` and querying the same table each make their own round trip — acceptable for Phase 1's traffic, but don't assume otherwise when reasoning about query count.

**5. `cookies()` and `headers()` are async in the App Router** (`await cookies()`, `await headers()` — see `lib/supabase/server.ts`). Forgetting the `await` doesn't always fail loudly; it can return a Promise where a `ReadonlyRequestCookies` was expected and fail deep inside `@supabase/ssr` with a confusing stack.

**6. Don't swallow a rejected Promise with a bare `catch {}`.** `lib/supabase/server.ts`'s `setAll` catch is a documented, deliberate exception (writing cookies from a Server Component with no request context to write to — proxy.ts covers the refresh) — every other empty catch should have the same kind of comment explaining why silence is safe, or it isn't safe.

## Type Safety

**7. Never widen a Supabase enum column back to `string` for convenience.** `appointment_status`, `payment_status`, etc. exist as Postgres enums specifically so the type system can catch an invalid status value at compile time (see `types/database.types.ts`'s `Enums` block) — casting to `string` anywhere in the write path defeats that.

**8. `@ts-expect-error` needs a reason comment and a scope note, not a bare suppression.** The join-typing suppressions in `app/admin/dashboard/page.tsx` and `appointments/page.tsx` are annotated "simplified join typing for Phase 1" specifically so a future pass knows it's a known gap (Supabase's generated types don't always infer embedded-resource shapes from `.select("*, clients(full_name)")` without exact `Relationships` metadata) and not an accident.

**9. `noUncheckedIndexedAccess` is on (`tsconfig.json`) — treat every array/object index access as possibly `undefined`,** even when you "know" the array is non-empty. `rules[0].start_time` in `lib/booking-engine/availability.ts` is guarded by the preceding `rules.length === 0` early return; don't drop that guard just because the type error goes away with a non-null assertion instead.

**10. Don't reach for `any` to make a Supabase query result typecheck.** If the generated/hand-written `Database` type doesn't match a query's actual shape, fix the type (or the query), don't cast the result to `any` — that silently defeats every other check downstream of it, including the redaction and audit-log typing that depends on knowing the real shape.

**11. Discriminated unions over boolean-flag soup.** `AvailabilityResult` (`lib/booking-engine/availability.ts`) and `SendResult` (`lib/notifications/send.ts`) are modeled as `{ status: "ok" | "closed" | ... }` unions specifically so a caller can't accidentally read `.slots` on a `"closed"` result — TypeScript narrows on the discriminant. Don't flatten these into `{ ok: boolean; slots?: Slot[]; reason?: string }`.

**12. `Database["public"]["Enums"][...]` is the source of truth for a status/category union — don't hand-roll a parallel string-literal union** that can drift from the DB enum. `components/ui/StatusBadge.tsx` imports `AppointmentStatus` from `types/database.types.ts` rather than declaring its own list of seven strings, so a future enum addition in a migration produces a compile error here instead of a silently-unhandled status.

**13. `Parameters<typeof Component>[0]["prop"]` is a legitimate way to derive a prop type without re-exporting it separately** (used for `StatusBadge`'s status prop in the admin pages) — but only works when the component is a plain function, not wrapped in `React.memo`/`forwardRef` without care. Know which pattern the component actually uses before reaching for this.

## Error Handling

**14. Match on `error.code` (Postgres SQLSTATE / your own custom code), never on `error.message` string content.** README §0 documents this exact correction: `create_booking()` raises distinct SQLSTATEs (`P1001`–`P1004`, plus Postgres's own `23P01` for the exclusion-constraint violation) and the API route matches on `rpcError.code`. Message-string matching breaks the moment wording changes and is not something to reintroduce elsewhere.

**15. A caught error needs to do something other than `console.log(error)`.** No raw `console.*` anywhere except `lib/logger/logger.ts` (ESLint-enforced, root CLAUDE.md rule 8) — route errors go through `logger.error` with structured fields, not a interpolated string containing the error object (which usually stringifies to `[object Object]` or leaks a stack trace into a log aggregator that wasn't meant to receive one).

**16. Don't let a non-critical write failure fail the critical path.** `lib/audit/log.ts`'s `writeAuditLog` logs loudly (`severity: "critical"`-worthy) on an insert failure but does not throw — an audit-log outage must not turn into a 500 for the admin action that triggered it. The inverse mistake (swallowing a failure that *should* block, like the booking insert itself) is just as bad — know which category a given write falls into before deciding.

**17. Every route/segment that can fail needs an error boundary, not an ad hoc try/catch-and-render.** Root CLAUDE.md rule 9 and `app/admin/CLAUDE.md` rule 7 are explicit about this — `app/admin/error.tsx` is the boundary for the whole admin segment; don't duplicate its "something went wrong" UI locally unless you're rendering a genuine partial-failure state (one dashboard section down, others fine).

**18. A partial failure in a multi-query page should degrade a section, not the page.** If `Promise.allSettled` (rule 2) is used because one query might legitimately fail without the others being affected, render that one section's empty/error state rather than letting the whole boundary catch it.

**19. `safeParse`, not `parse`, at a validation boundary you don't control.** Zod's `.parse()` throws — fine for a value you already trust, wrong for the first touch of untrusted client input, where an uncaught throw turns a validation failure into an unhandled 500 instead of the intended 400 with field-level messages.

**20. A `null` return from an auth helper is not an error — it's an expected outcome the caller must branch on.** `getStaffSession()` returns `null` rather than throwing specifically so `requireStaff()` (redirect) and `requireStaffApi()` (401 JSON) can each decide their own response shape (see `lib/supabase/server.ts`'s doc comment) — don't "simplify" this into a thrown exception that forces both call sites into the same handling.

## Data Validation & Trust Boundaries

**21. Client-side validation is UX, never the gate.** Root CLAUDE.md rule 7: anything validated in the browser (age, risk flags, advance-booking windows) must be re-validated server-side. `lib/booking-engine/age.ts`'s `meetsMinimumAge()` is explicitly documented as UX-only — the real gate is the DB CHECK constraint plus `create_booking()`'s own check.

**22. A client-supplied timestamp is not audit-trustworthy.** `captured_at` on `client_photos` and any "when did this happen" field tied to a compliance record must be set by the server clock at the moment of the server-side write, never taken from request body / client `Date.now()` — trivially forgeable via devtools.

**23. Validate uploaded file content by magic bytes, never by trusting the client-supplied `Content-Type` header or file extension.** A client claiming `image/jpeg` proves nothing on its own. `lib/booking-engine/photo.ts`'s `isValidJpeg()` checks the actual JPEG SOI marker bytes (`0xFF 0xD8 0xFF`) before anything is written to storage — this is the required approach for any future upload path (see README's adversarial-testing checklist, "File upload abuse"). Do not relax this to a `Content-Type` check for convenience, and do not skip it because "the UI only allows JPEG" — the UI is not a trust boundary.

**24. A file-type check needs a size ceiling too, and the ceiling needs to match the storage bucket's own limit,** not just live in application code. `MAX_PHOTO_BYTES` in `photo.ts` mirrors the `client-photos` bucket's `file_size_limit` (5MB) set in `0004_consent_photo_intake.sql` — if one changes, the other must.

**25. "No silent fallback" applies to missing configuration, not just missing data.** `lib/booking-engine/CLAUDE.md` rule 5: if `availability_rules` isn't configured for a staff member, return an explicit "not configured" result — never default to "always open" (a booking-safety bug) or "always closed" (an availability bug support will have to chase down).

**26. Required consent categories are enforced by CHECK constraint, not by UI convention alone.** `marketing_consent_must_be_optional` / `non_marketing_consent_must_be_required` in `0004_consent_photo_intake.sql` exist specifically so a future UI change can't silently pre-check or bundle a mandatory consent with an optional one — see root CLAUDE.md's Intake/Consent section. Don't work around a CHECK constraint by routing around it in application code; if the rule needs to change, change the constraint.

**27. A redaction allowlist/denylist needs to be reasoned about from both directions.** `SENSITIVE_KEYS` in `lib/logger/logger.ts` and `SNAPSHOT_REDACT_KEYS` in `lib/audit/log.ts` are deliberately separate lists scoped to what each system actually receives — don't merge them into one shared constant assuming "more redaction is always safer"; the audit snapshot list also needs to redact fields (like `storage_path`) that the operational logger may have legitimate, lower-sensitivity reasons to keep.

## Framework/Platform-Specific Pitfalls

**28. `getClaims()` for authorization checks, `getUser()` only when you need a guaranteed-fresh Auth-server record, never `getSession()`'s embedded user for either.** This distinction shows up in `lib/supabase/server.ts`, `proxy.ts`, and root CLAUDE.md's "Current Standards" — getting it backwards either adds an unnecessary network round-trip on every request (`getUser()` everywhere) or trusts a value that isn't guaranteed re-validated (`getSession()`).

**29. A proxy/middleware auth check is a network boundary, not the authorization system.** `proxy.ts`'s own header comment says this explicitly — every admin Server Component/route still calls `requireStaff()`/`requireStaffApi()` independently, and RLS is the final backstop. Don't remove a page-level auth check on the assumption the proxy already handled it.

**30. All timestamp math happens in UTC; convert to studio-local time only at the display/formatting boundary.** Root CLAUDE.md rule 5 and `lib/booking-engine/CLAUDE.md` rule 3. `localTimeToUtc()` in `availability.ts` takes an explicit `offsetMinutes` parameter rather than reading `Date`'s local-timezone methods, which would silently use the *server's* timezone instead of the studio's.

**31. Don't duplicate slot-computation or risk-flagging logic in a route handler "just for this one case."** `lib/booking-engine/CLAUDE.md` rule 1: if the admin calendar and public booking page need different views of availability, they share `getAvailableSlots()` and layer display differences on top — forking the logic is how the DB constraint and the UI's idea of "available" drift apart.

**32. A Server Action / route handler that mutates state via the secret-key admin client still needs its own authorization check.** The secret key bypasses RLS by design (`lib/supabase/admin.ts`) — that's what makes it dangerous to import from anywhere except `app/api/**` route handlers, Server Actions, and other server-only `lib/` files (never a `"use client"` component, never anything that could end up in a client bundle). Bypassing RLS is not the same as bypassing `requireStaff()`/`requireAdminApi()`.
