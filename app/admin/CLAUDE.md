# CLAUDE.md — app/admin/

Scope: everything under `app/admin/**`.

## Rules
1. **Every page in this folder requires an authenticated staff session.** Enforce via `app/admin/layout.tsx`, which must call `requireStaff()` server-side and redirect to `/admin/login` if it fails. Don't rely on client-side redirects alone — that's a UX nicety, not a gate (see root CLAUDE.md rule 3).
2. **Role-gated features check role, not just "is staff."** Anything spec'd as admin-only (deleting a service, editing policies, exporting client data) must additionally check `role === 'admin'`, both in the RLS policy and in the page/route.
3. **Never fetch client PII or medical form data in a Client Component.** Fetch server-side (Server Component or route handler), pass only what the specific view needs down to any `"use client"` component.
4. **Deleting a service with future appointments is blocked**, not silently allowed. The FK (`appointments.service_id references services(id) on delete restrict`) will reject a hard delete at the DB level — surface that as a clear UI message ("This service has N upcoming appointments and can't be deleted. Deactivate it instead."), and offer deactivation (`active = false`) as the actual action.
5. **Calendar and appointment list views must show all seven `appointment_status` values distinctly** (color/badge), matching the palette in `docs/design-tokens.md` — don't invent new ad hoc statuses in the UI layer that don't exist in the DB enum.
6. **Admin override of scheduling rules (double-booking, buffers, advance windows) is a deliberate, explicit action**, not a silent bypass. If you build an override path, it must still call `create_booking`-equivalent logic with an `is_manual = true` flag and a required reason, and it must still write to `audit_log`.
7. **`app/admin/error.tsx` is the error boundary for this entire segment.** Don't add per-page try/catch-and-render-error-UI patterns that duplicate it — let errors bubble to the boundary. Only catch locally when you need to show a partial-failure state alongside content that did load successfully (e.g. one dashboard section failed but others should still render).
8. **Auth checks use `getClaims()`**, not `getUser()` or a raw `getSession()` read — see `lib/supabase/server.ts`'s `getStaffSession()`. `getSession()`'s embedded user object must never be trusted for an authorization decision (it isn't guaranteed re-validated against the Auth server).
