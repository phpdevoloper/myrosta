-- ============================================================================
-- Myrosta — STAGING setup for the multi-org isolation test  (17 Aug 2026)
-- Paste the WHOLE file into the staging project's SQL Editor and Run once.
-- Idempotent: safe to re-run. NEVER run this on the production project.
--
-- Builds: base schema (SUPABASE.md) + hardening + multi-org migration
--         (MYROSTA-MULTIORG-BUILD.md Phase 1) + two test orgs.
-- ============================================================================

-- ---------- 1. base tables + baseline grants ----------
create table if not exists org_state ( org text primary key, data jsonb, updated timestamptz default now() );
create table if not exists roster_members ( email text primary key, role text default 'staff', name text, phone text );
alter table org_state enable row level security;
alter table roster_members enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.org_state to authenticated;
grant select, insert, update, delete on public.roster_members to authenticated;
revoke delete on public.org_state from authenticated;   -- council hardening: nobody's browser may delete a roster

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

-- ---------- 8. TEST FIXTURES: two orgs, two users, one shared user ----------
-- Replace the three emails with real addresses you can receive OTP codes on
-- (e.g. your Gmail + a plus-alias: you+a@gmail.com / you+b@gmail.com / you+ab@gmail.com).
insert into org_state(org,data,updated) values
  ('test-orgA', '{"marker":"ORG-A-SECRET"}'::jsonb, now()),
  ('test-orgB', '{"marker":"ORG-B-SECRET"}'::jsonb, now())
on conflict (org) do nothing;

insert into roster_members(org,email,role,name) values
  ('test-orgA','USERA@EXAMPLE.COM','admin','User A'),
  ('test-orgB','USERB@EXAMPLE.COM','admin','User B'),
  ('test-orgA','USERAB@EXAMPLE.COM','staff','User AB'),   -- in BOTH orgs → exercises the picker
  ('test-orgB','USERAB@EXAMPLE.COM','staff','User AB')
on conflict (org,email) do update set role=excluded.role, name=excluded.name;

insert into orgs(org,label,hospital) values
  ('test-orgA','Consultants','Test Hospital'),
  ('test-orgB','Nurses','Test Hospital')
on conflict (org) do update set label=excluded.label, hospital=excluded.hospital;

-- sanity: should list 2 orgs and 4 memberships
select org, count(*) as members from roster_members group by org order by org;
