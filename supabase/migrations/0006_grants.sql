-- ============================================================================
-- 0006_grants.sql
-- Fixes a real gap surfaced by tests/integration/*.test.ts running against a
-- genuine local Postgres 17 instance: none of the earlier migrations ever
-- GRANTed table privileges to anon/authenticated/service_role. RLS policies
-- (0001_init.sql, 0004_consent_photo_intake.sql) restrict which ROWS a role
-- can see/touch, but Postgres checks table-level GRANTs first — without
-- them, every query from anon/authenticated/service_role fails with
-- "permission denied for table X" (SQLSTATE 42501) before RLS is ever
-- evaluated, regardless of policy correctness. Hosted Supabase projects get
-- this bootstrapped automatically at project-provisioning time; a
-- CLI-managed local/self-hosted stack applying only this repo's own
-- migrations does not, so it has to be explicit here.
--
-- This does not weaken anything: RLS is still the row-level gate for anon/
-- authenticated (root CLAUDE.md rule 3). service_role already has
-- BYPASSRLS as a role attribute — these grants are what let it act on
-- these tables at all, not what lets it skip RLS (that's a separate,
-- already-existing role property).
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

-- Covers any table added by a future migration without needing another
-- grants migration, as long as it's created by the same role that runs
-- `supabase db push`/migrations (the convention this project already
-- follows for every other migration).
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
