-- ============================================================================
-- 0001_init.sql
-- Tattoo / PMU Scheduler — Phase 1 + Phase 2 schema
-- Design notes:
--   * All timestamps are `timestamptz` stored in UTC. Never store naive local time.
--   * Double-booking is prevented at the DB level with an exclusion constraint,
--     not app-layer "check then insert" logic (race-condition safe).
--   * Every admin-facing mutation should route through functions that also
--     write to audit_log — see lib/audit/log.ts on the app side.
--   * RLS is the source of truth for access control. App-layer checks are a
--     UX nicety on top, never the only gate.
-- ============================================================================

-- Postgres's built-in gen_random_uuid() (13+) is used for all primary keys
-- below — no uuid-ossp dependency, which sidesteps a real cross-environment
-- gap: on hosted Supabase, uuid-ossp is pre-installed in a separate
-- `extensions` schema that isn't on every role's search_path, so
-- uuid_generate_v4() can 42883 even though `create extension if not exists`
-- reports it as already present.
create extension if not exists btree_gist; -- needed for the exclusion constraint below

-- ----------------------------------------------------------------------------
-- ENUM-LIKE TYPES (string literal unions on the TS side must match these)
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'staff');

create type appointment_status as enum (
  'requested',
  'confirmed',
  'deposit_pending',
  'form_incomplete',
  'needs_review',
  'completed',
  'cancelled',
  'no_show'
);

create type payment_status as enum (
  'not_required',
  'pending',
  'paid',
  'refunded',
  'waived'
);

create type service_category as enum (
  'initial_session',
  'touch_up',
  'color_boost',
  'consultation',
  'removal_consultation',
  'correction_cover_up_consultation',
  'training_session'
);

create type notification_type as enum (
  'booking_confirmation',
  'deposit_reminder',
  'form_reminder',
  'reminder_48h',
  'reminder_24h',
  'aftercare_followup'
);

create type notification_channel as enum ('email', 'sms');
create type notification_status as enum ('pending', 'sent', 'failed', 'skipped_not_configured');

-- ----------------------------------------------------------------------------
-- USERS (admin/staff — authentication handled by Supabase Auth; this table
-- extends auth.users with app-specific role info)
-- ----------------------------------------------------------------------------
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'staff',
  full_name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CLIENTS (public-facing, not auth-linked — clients book without an account
-- in Phase 1; identified by email+phone, with a signed manage-token for
-- reschedule/cancel links)
-- ----------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check (char_length(phone) between 7 and 20),
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_email_idx on clients (lower(email));
create index clients_phone_idx on clients (phone);

-- Private, admin-only notes about a client (medical history follow-ups, etc.)
create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  author_id uuid not null references app_users(id),
  body text not null check (char_length(body) <= 5000),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- SERVICES
-- ----------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category service_category not null,
  description text not null default '',
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 600),
  price_cents int not null check (price_cents >= 0),
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  min_advance_hours int not null default 24 check (min_advance_hours >= 0),
  max_advance_days int not null default 90 check (max_advance_days > 0),
  requires_prescreening boolean not null default true,
  requires_policy_agreement boolean not null default true,
  aftercare_instructions text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- prevents an admin from deleting a service with future appointments
  -- (soft delete via `active` is enforced at the app layer; hard delete is
  -- blocked below by the FK on appointments using `on delete restrict`)
  constraint deposit_not_exceeding_price check (deposit_cents <= price_cents)
);

-- ----------------------------------------------------------------------------
-- AVAILABILITY (recurring business hours per weekday, per artist/staff)
-- ----------------------------------------------------------------------------
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references app_users(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  constraint valid_range check (end_time > start_time)
);

-- One-off overrides / closures for a specific date
create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references app_users(id) on delete cascade,
  date date not null,
  is_closed boolean not null default true,
  start_time time,
  end_time time,
  note text
);

-- Blocked time (vacations, personal appointments, etc.)
create table blocked_time (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references app_users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint valid_block_range check (ends_at > starts_at)
);

-- ----------------------------------------------------------------------------
-- APPOINTMENTS
-- The exclusion constraint below is what actually prevents double-booking
-- and race conditions — two concurrent inserts for overlapping ranges on the
-- same staff_id will have one rejected by Postgres itself, not app logic.
-- ----------------------------------------------------------------------------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  staff_id uuid not null references app_users(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null, -- includes service duration; buffers tracked separately below
  buffer_starts_at timestamptz not null, -- starts_at minus buffer_before
  buffer_ends_at timestamptz not null,   -- ends_at plus buffer_after
  status appointment_status not null default 'requested',
  payment_status payment_status not null default 'not_required',
  is_manual boolean not null default false, -- true if created directly by admin (bypasses some client-side rules)
  reference_images text[] not null default '{}', -- storage paths, not raw uploads
  client_message text check (char_length(client_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint valid_appt_range check (ends_at > starts_at),
  constraint valid_buffer_range check (buffer_ends_at > buffer_starts_at),
  -- DB-enforced double-booking prevention (only among "live" bookings)
  exclude using gist (
    staff_id with =,
    tstzrange(buffer_starts_at, buffer_ends_at) with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index appointments_staff_time_idx on appointments (staff_id, starts_at);
create index appointments_client_idx on appointments (client_id);
create index appointments_status_idx on appointments (status);

-- Secure, unguessable token for client-facing reschedule/cancel links
create table appointment_manage_tokens (
  token uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- FORMS (pre-screening + any future custom forms) and responses
-- ----------------------------------------------------------------------------
create table forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  is_active boolean not null default true,
  -- schema of fields, kept flexible for admin configurability:
  -- [{ key: "pregnant_or_nursing", label: "...", type: "yes_no"|"text", high_risk_if: true|null }]
  fields jsonb not null,
  created_at timestamptz not null default now()
);

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id),
  appointment_id uuid not null references appointments(id) on delete cascade,
  answers jsonb not null,
  flagged_high_risk boolean not null default false,
  flagged_fields text[] not null default '{}',
  submitted_at timestamptz not null default now()
);
create index form_responses_appointment_idx on form_responses (appointment_id);

-- ----------------------------------------------------------------------------
-- POLICIES + agreement tracking
-- ----------------------------------------------------------------------------
create table policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table policy_agreements (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id),
  appointment_id uuid not null references appointments(id) on delete cascade,
  agreed_at timestamptz not null default now(),
  ip_address text
);

-- ----------------------------------------------------------------------------
-- PAYMENTS / DEPOSITS (Stripe-ready placeholder architecture)
-- ----------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  status payment_status not null default 'pending',
  provider text not null default 'placeholder', -- 'stripe' once integrated
  provider_reference text, -- Stripe payment_intent id, once integrated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS (reminder architecture — placeholder send functions live in
-- lib/notifications on the app side; this table tracks intent + status)
-- ----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  type notification_type not null,
  channel notification_channel not null,
  status notification_status not null default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_scheduled_idx on notifications (scheduled_for) where status = 'pending';

-- ----------------------------------------------------------------------------
-- AUDIT LOG (every admin mutation)
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references app_users(id),
  action text not null, -- e.g. 'service.update', 'appointment.cancel'
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clients_updated before update on clients
  for each row execute function set_updated_at();
create trigger trg_services_updated before update on services
  for each row execute function set_updated_at();
create trigger trg_appointments_updated before update on appointments
  for each row execute function set_updated_at();
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Convention: public/anon role can INSERT appointments + related booking rows
-- (via server-side route using the anon key, itself rate-limited at the app
-- layer) but can only SELECT their own appointment via a manage token, never
-- browse others'. Admins (app_users) can do everything. Staff is scoped
-- narrower — see policies below.
-- ============================================================================

alter table app_users enable row level security;
alter table clients enable row level security;
alter table client_notes enable row level security;
alter table services enable row level security;
alter table availability_rules enable row level security;
alter table availability_overrides enable row level security;
alter table blocked_time enable row level security;
alter table appointments enable row level security;
alter table appointment_manage_tokens enable row level security;
alter table forms enable row level security;
alter table form_responses enable row level security;
alter table policies enable row level security;
alter table policy_agreements enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;

-- Helper: is the current auth.uid() an admin/staff user?
create or replace function is_staff() returns boolean as $$
  select exists (select 1 from app_users where id = auth.uid());
$$ language sql stable security definer;

create or replace function is_admin() returns boolean as $$
  select exists (select 1 from app_users where id = auth.uid() and role = 'admin');
$$ language sql stable security definer;

-- app_users: staff can read all staff records, only admins can write
create policy app_users_select on app_users for select using (is_staff());
create policy app_users_admin_write on app_users for all using (is_admin()) with check (is_admin());

-- services: publicly readable (active only) for booking flow; staff manage
create policy services_public_read on services for select using (active = true or is_staff());
create policy services_staff_write on services for all using (is_staff()) with check (is_staff());

-- availability: publicly readable so the booking UI can compute open slots
create policy availability_rules_public_read on availability_rules for select using (true);
create policy availability_rules_staff_write on availability_rules for all using (is_staff()) with check (is_staff());
create policy availability_overrides_public_read on availability_overrides for select using (true);
create policy availability_overrides_staff_write on availability_overrides for all using (is_staff()) with check (is_staff());
create policy blocked_time_public_read on blocked_time for select using (true);
create policy blocked_time_staff_write on blocked_time for all using (is_staff()) with check (is_staff());

-- clients: no public read access at all (contains PII); only staff
create policy clients_staff_all on clients for all using (is_staff()) with check (is_staff());
-- inserts from the public booking flow happen via a server-side route using
-- the service role key (server-only), never the anon key directly.

create policy client_notes_staff_all on client_notes for all using (is_staff()) with check (is_staff());

-- appointments: staff full access; public has no direct table access —
-- all public reads/writes go through server routes (service role) that
-- enforce manage-token checks in application code.
create policy appointments_staff_all on appointments for all using (is_staff()) with check (is_staff());

create policy manage_tokens_staff_all on appointment_manage_tokens for all using (is_staff()) with check (is_staff());

create policy forms_public_read_active on forms for select using (is_active = true or is_staff());
create policy forms_staff_write on forms for all using (is_staff()) with check (is_staff());

create policy form_responses_staff_all on form_responses for all using (is_staff()) with check (is_staff());

create policy policies_public_read_active on policies for select using (is_active = true or is_staff());
create policy policies_staff_write on policies for all using (is_staff()) with check (is_staff());

create policy policy_agreements_staff_all on policy_agreements for all using (is_staff()) with check (is_staff());

create policy payments_staff_all on payments for all using (is_staff()) with check (is_staff());

create policy notifications_staff_all on notifications for all using (is_staff()) with check (is_staff());

create policy audit_log_staff_read on audit_log for select using (is_staff());
-- audit_log inserts happen only via the server-side service role client,
-- never directly from staff sessions — no write policy is granted here.
