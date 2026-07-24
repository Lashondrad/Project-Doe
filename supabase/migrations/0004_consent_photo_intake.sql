-- ============================================================================
-- 0004_consent_photo_intake.sql
-- Adds: typed consent categories (medical / photo release / marketing —
-- distinct from general studio policy), a previous-ink questionnaire form
-- category, a hard 18+ age gate, and the client_photos table + storage
-- bucket for in-app-only face photo capture.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CONSENT CATEGORIES
-- Per studio direction: medical history is presented WITH the consent form
-- (one combined step), not as a separate pre-screening step. Photo-capture
-- consent is its own mandatory, distinctly-worded agreement (biometric-
-- adjacent data — a bare-face photo — is more sensitive than a policy
-- acknowledgment and gets its own explicit yes). Marketing/portfolio use is
-- OPTIONAL and must never be bundled into a required checkbox — bundling an
-- optional use into a mandatory consent is exactly the kind of dark pattern
-- this schema is designed to make structurally impossible.
-- ----------------------------------------------------------------------------
create type policy_category as enum (
  'studio_policy',
  'medical_consent',
  'photo_release',
  'marketing_consent'
);

alter table policies
  add column if not exists category policy_category not null default 'studio_policy',
  add column if not exists required boolean not null default true;

alter table policies alter column category drop default;

-- Marketing consent is the ONE category allowed to be optional. Enforce that
-- at the schema level rather than trusting app code to always get this
-- right — a CHECK constraint here is a second, independent guarantee.
alter table policies add constraint marketing_consent_must_be_optional
  check (category <> 'marketing_consent' or required = false);
alter table policies add constraint non_marketing_consent_must_be_required
  check (category = 'marketing_consent' or required = true);

-- A given appointment can now agree to multiple policy categories, so drop
-- any assumption of "one policy per appointment" — policy_agreements was
-- already a one-to-many table, no shape change needed there. Add a helper
-- index for "did this appointment agree to category X" lookups.
create index if not exists policy_agreements_appointment_idx on policy_agreements (appointment_id);

-- ----------------------------------------------------------------------------
-- FORMS: previous-ink questionnaire as its own category, distinct from the
-- medical pre-screening form (which now conceptually lives inside the
-- consent step, per studio direction — no schema split needed there since
-- `forms.fields` is already flexible JSON; the "combined with consent" part
-- is a booking-flow UI decision, not a data-model one).
-- ----------------------------------------------------------------------------
create type form_category as enum ('medical_prescreening', 'ink_history');

alter table forms add column if not exists category form_category not null default 'medical_prescreening';
alter table forms alter column category drop default;

-- ----------------------------------------------------------------------------
-- AGE GATE: hard 18+ requirement, not a soft "flag for review" like the
-- other pre-screening risk answers. date_of_birth already existed on
-- clients but was unused — now required and enforced at insert time by a
-- CHECK constraint (defense in depth alongside the create_booking() function
-- check in 0005_age_gate_function.sql).
-- ----------------------------------------------------------------------------
alter table clients alter column date_of_birth set not null;
alter table clients add constraint clients_must_be_18_or_older
  check (date_of_birth <= (current_date - interval '18 years'));

-- ----------------------------------------------------------------------------
-- CLIENT PHOTOS
-- "No makeup" face photo, captured live in-app (browser camera capture,
-- never a gallery/file upload — enforced at the application layer in
-- components/booking/FaceCapture.tsx and re-validated server-side in
-- app/api/book/route.ts, since client-side restrictions alone are never
-- trustworthy). captured_at is set by the SERVER on upload, not taken from
-- the client's clock — a client-supplied timestamp is not audit-trustworthy.
--
-- Retention: indefinite, per studio direction (audit + optional
-- portfolio/modeling use) — no auto-delete job. consent_agreement_id links
-- back to the specific photo_release policy_agreement that authorized this
-- exact photo; marketing_consent_agreement_id is nullable and only set if
-- the client separately opted into portfolio/marketing use.
-- ----------------------------------------------------------------------------
create type photo_capture_method as enum ('live_camera');
create type photo_purpose as enum ('audit_medical_record', 'portfolio_marketing');

create table client_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  appointment_id uuid not null references appointments(id) on delete restrict,
  storage_path text not null unique,
  capture_method photo_capture_method not null default 'live_camera',
  captured_at timestamptz not null default now(), -- server clock, not client-supplied
  photo_consent_agreement_id uuid not null references policy_agreements(id),
  marketing_consent_agreement_id uuid references policy_agreements(id), -- null unless client opted in
  created_at timestamptz not null default now()
);
create index client_photos_client_idx on client_photos (client_id);
create index client_photos_appointment_idx on client_photos (appointment_id);

comment on table client_photos is
  'Bare-face reference photos, captured in-app via live camera only (no gallery upload — enforced app-side, see components/booking/FaceCapture.tsx). Retained indefinitely per studio policy. photo_consent_agreement_id is mandatory; marketing_consent_agreement_id is only populated when the client separately opted into portfolio/marketing use — never assume consent to one implies consent to the other.';

alter table client_photos enable row level security;
-- No public read/write policy at all — every access to this table goes
-- through the server (service/secret key), which is the correct posture
-- for the most sensitive table in the schema. Staff read via the admin
-- client-side UI still goes through a server route that generates a
-- short-lived signed URL, not a direct client query against this table.
create policy client_photos_staff_read on client_photos for select using (is_staff());
-- No insert/update/delete policy for anon or authenticated — writes only
-- happen via lib/supabase/admin.ts (secret key, bypasses RLS by design).

-- ----------------------------------------------------------------------------
-- STORAGE BUCKET
-- Private bucket — never public. Every read is a short-lived signed URL
-- generated server-side for an authenticated staff session; the client
-- upload itself is proxied through app/api/book (server-side), not a direct
-- browser-to-storage upload, so we can validate file bytes (magic-byte
-- sniffing, not just Content-Type) before anything lands in storage.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Storage RLS: staff can read (for signed URL generation via their own
-- session), nobody else gets any policy at all. Inserts happen exclusively
-- through the secret-key admin client server-side, which bypasses RLS by
-- design — no insert policy is granted here on purpose.
create policy client_photos_storage_staff_read on storage.objects
  for select using (bucket_id = 'client-photos' and is_staff());
