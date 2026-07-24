-- ============================================================================
-- 0003_audit_compliance.sql
-- Hardens audit_log for SOC 2 / HIPAA-aligned controls:
--   * append-only (no update, no delete — even for admins, even via RLS)
--   * captures actor, action, entity, IP, user agent, category, severity
--   * before/after snapshots are redacted at the application layer
--     (lib/audit/log.ts) before they ever reach this table — the DB layer
--     enforces immutability, the app layer enforces "don't write PHI/PII
--     into the snapshot in the first place"
-- ============================================================================

create type audit_category as enum (
  'data_access',
  'data_modification',
  'authentication',
  'financial',
  'admin_action'
);

create type audit_severity as enum ('info', 'warning', 'critical');

alter table audit_log
  add column if not exists category audit_category not null default 'admin_action',
  add column if not exists severity audit_severity not null default 'info',
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists actor_role user_role;

alter table audit_log alter column category drop default;
alter table audit_log alter column severity drop default;

create index if not exists audit_log_category_idx on audit_log (category);
create index if not exists audit_log_created_at_idx on audit_log (created_at);

-- ----------------------------------------------------------------------------
-- IMMUTABILITY: audit logs cannot be edited or deleted by anyone, including
-- admins, through any normal path. This is a standard SOC 2 CC7.2 / logging
-- integrity control. If a correction is ever needed, the correct pattern is
-- an offsetting new entry (action = 'audit_log.correction'), never an
-- UPDATE/DELETE on the original row.
-- ----------------------------------------------------------------------------
create or replace function reject_audit_log_mutation() returns trigger as $$
begin
  raise exception 'audit_log rows are immutable — insert a correcting entry instead of updating or deleting row %', old.id;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_log_no_update on audit_log;
create trigger trg_audit_log_no_update
  before update on audit_log
  for each row execute function reject_audit_log_mutation();

drop trigger if exists trg_audit_log_no_delete on audit_log;
create trigger trg_audit_log_no_delete
  before delete on audit_log
  for each row execute function reject_audit_log_mutation();

-- Belt-and-suspenders: revoke UPDATE/DELETE grants outright so even a
-- future RLS policy mistake (e.g. an overly broad "staff can manage
-- audit_log" policy) can't violate immutability — the triggers above are
-- the primary control, this is defense in depth.
revoke update, delete on audit_log from authenticated, anon;

comment on table audit_log is
  'Append-only compliance log (SOC 2 CC7.2-aligned). No UPDATE or DELETE is permitted on this table by design — see trg_audit_log_no_update/delete. before/after snapshots must be pre-redacted by lib/audit/log.ts before insert; this table should never receive raw PHI/PII-bearing free-text fields.';
