-- ============================================================================
-- Myrosta — PRODUCTION multi-org migration
-- Target: the LIVE project  skpdqqhwrqgxsxawniho  (myrosta.com.au)
--
-- READ FIRST — this is the real one. Preconditions, in order:
--   1. The pilot cycle has ENDED and conversion is agreed. Never mid-cycle.
--   2. A fresh database backup exists (Supabase → Database → Backups) and you know how to restore it.
--   3. The NEW app build is already deployed (it runs unchanged on the old schema — `_legacyDb`),
--      AND the four edge functions have already been redeployed. App → functions → THIS SQL.
--   4. supabase/rollback-multiorg.sql is open in a second SQL Editor tab, ready to paste.
--   5. You are in the PRODUCTION project — check the name in the top-left before running.
--
-- Idempotent: safe to run twice. It does NOT touch org_state row contents — only keys,
-- policies and helper functions — so no roster data moves.
-- Existing data keeps working: every roster_members row defaults to org 'ed-default',
-- which is CLOUD.org in the app.
--
-- AFTER running: unset the ORG env var on notify-rounds and notify-shifts, and MYROSTA_ORG on ics
-- (see MYROSTA-MULTIORG-BUILD.md Phase 3b) — otherwise new organisations are silently skipped.
-- Then re-run supabase/isolation-test.html against production before adding a second organisation.
-- ============================================================================

-- ---------- 0. safety: baseline grants + the council delete-hardening (idempotent, re-asserted) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.org_state to authenticated;
grant select, insert, update, delete on public.roster_members to authenticated;
revoke delete on public.org_state from authenticated;   -- a member's browser must never delete a roster

-- ---------- 2. MULTI-ORG: scope membership to an org ----------
alter table roster_members add column if not exists org text not null default 'ed-default';
alter table roster_members drop constraint if exists roster_members_pkey;
alter table roster_members add primary key (org, email);

-- ---------- 3. org-scoped membership checks ----------
create or replace function public.is_member(p_org text) returns boolean
  language sql security definer set search_path=public as $$
  select exists (select 1 from roster_members m where m.org = p_org
    and ( lower(m.email) = lower(auth.jwt()->>'email')
       or (nullif(auth.jwt()->>'phone','') is not null and m.phone = auth.jwt()->>'phone') )); $$;

create or replace function public.is_admin_member(p_org text) returns boolean
  language sql security definer set search_path=public as $$
  select exists (select 1 from roster_members m where m.org = p_org and m.role='admin'
    and ( lower(m.email) = lower(auth.jwt()->>'email')
       or (nullif(auth.jwt()->>'phone','') is not null and m.phone = auth.jwt()->>'phone') )); $$;

-- ---------- 4. THE ISOLATION RULE: a member touches ONLY their own org's rows ----------
drop policy if exists "members all" on org_state;
create policy "members all" on org_state for all to authenticated
  using ( public.is_member(org) ) with check ( public.is_member(org) );

drop policy if exists "list read" on roster_members;
create policy "list read" on roster_members for select to authenticated
  using ( public.is_member(org) );
drop policy if exists "admins manage" on roster_members;
create policy "admins manage" on roster_members for all to authenticated
  using ( public.is_admin_member(org) ) with check ( public.is_admin_member(org) );

-- ---------- 5. which orgs does the signed-in user belong to? (drives the picker) ----------
-- (the 4-column my_orgs() lives in §5b below — a 2-column version here would break re-runs with 42P13)

-- ---------- 5b. HOSPITAL UMBRELLA: an org registry (label + hospital) — drives the grouped picker ----------
create table if not exists orgs ( org text primary key, label text, hospital text, created timestamptz default now() );
alter table orgs enable row level security;
grant select on public.orgs to authenticated;
drop policy if exists "orgs read own" on orgs;
create policy "orgs read own" on orgs for select to authenticated using ( public.is_member(org) );

-- my_orgs() now also returns the label + hospital (left join: orgs without a registry row still work)
drop function if exists public.my_orgs();
create or replace function public.my_orgs() returns table(org text, role text, label text, hospital text)
  language sql security definer set search_path=public as $$
  select m.org, m.role, o.label, o.hospital from roster_members m left join orgs o on o.org=m.org
   where lower(m.email) = lower(auth.jwt()->>'email')
      or (nullif(auth.jwt()->>'phone','') is not null and m.phone = auth.jwt()->>'phone'); $$;
grant execute on function public.my_orgs() to authenticated;

-- ---------- 6. drop the old global-scope helpers (no policy references them now) ----------
drop function if exists public.is_member();
drop function if exists public.is_admin_member();

-- ---------- 7. realtime ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='org_state') then
    alter publication supabase_realtime add table org_state;
  end if;
end $$;

-- ---------- 8. register the existing organisation in the umbrella (edit the two labels) ----------
insert into orgs(org,label,hospital) values ('ed-default','Consultants','Werribee Mercy ED')
  on conflict (org) do update set label=excluded.label, hospital=excluded.hospital;

-- ---------- 9. verification — read these three results before you walk away ----------
-- a) every existing member kept a home:
select org, count(*) as members from roster_members group by org order by org;
-- b) the picker function exists and has the right shape. NOTE: the SQL editor runs with no
--    signed-in user (auth.jwt() is null), so ZERO ROWS HERE IS CORRECT AND EXPECTED — verify
--    real memberships from the app or isolation-test.html, not from this editor.
select * from my_orgs();
-- c) the old global helpers are gone (expect zero rows):
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_member','is_admin_member')
   and pg_get_function_identity_arguments(p.oid)='';
