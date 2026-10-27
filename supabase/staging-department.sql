-- ============================================================================
-- STAGING copy of prod-department.sql with fixtures: 'test-orgC' under a second hospital,
-- administered by User B, so the probes can prove one hospital never sees another.
-- ============================================================================
insert into orgs(org,label,hospital) values ('test-orgC','Consultants','Other Hospital')
  on conflict (org) do update set label=excluded.label, hospital=excluded.hospital;
insert into org_state(org,data,updated) values ('test-orgC','{}'::jsonb, now()) on conflict do nothing;
insert into roster_members(org,email,role,name) values ('test-orgC','USERB@EXAMPLE.COM','admin','User B')
  on conflict (org,email) do update set role='admin';

-- ============================================================================
-- Myrosta — department groups (S0–S2): hospitals as ids, add-a-group, the department board
-- Target: the LIVE project (myrosta.com.au). Idempotent: safe to run twice.
-- Order: deploy the app build first (it runs unchanged on the old schema: my_orgs() without the
-- fifth column simply leaves nothing to publish and nothing to switch), THEN run this file, THEN
-- re-run supabase/isolation-test.html (v4) as two users — before any group is created in the app.
-- Spec: docs/superpowers/specs/2026-09-16-department-groups-s0-s2-design.md §2
-- ============================================================================

-- ---------- 1. hospitals are ids, not free text ----------
create table if not exists hospitals ( id text primary key, name text not null, created timestamptz default now() );
alter table hospitals enable row level security;
revoke all on public.hospitals from anon;
grant select on public.hospitals to authenticated;
alter table orgs add column if not exists hospital_id text references hospitals(id);
drop policy if exists "hospitals read own" on hospitals;
create policy "hospitals read own" on hospitals for select to authenticated
  using ( exists (select 1 from orgs o where o.hospital_id = hospitals.id and public.is_member(o.org)) );

create or replace function public.slug_of(p text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p,'')),'[^a-z0-9]+','-','g')); $$;

-- backfill: one hospital per distinct free-text name already in orgs; the id is the slug of the name
insert into hospitals(id,name)
  select distinct public.slug_of(hospital), trim(hospital) from orgs
   where coalesce(trim(hospital),'')<>'' and public.slug_of(hospital)<>''
  on conflict (id) do nothing;
update orgs set hospital_id = public.slug_of(hospital)
  where hospital_id is null and coalesce(trim(hospital),'')<>'' and public.slug_of(hospital)<>'';

-- ---------- 2. my_orgs() gains the hospital id (fifth column; the first four are unchanged) ----------
drop function if exists public.my_orgs();
create or replace function public.my_orgs() returns table(org text, role text, label text, hospital text, hospital_id text)
  language sql security definer set search_path=public as $$
  select m.org, m.role, o.label, o.hospital, o.hospital_id from roster_members m left join orgs o on o.org=m.org
   where lower(m.email) = lower(auth.jwt()->>'email')
      or (nullif(auth.jwt()->>'phone','') is not null and m.phone = auth.jwt()->>'phone'); $$;
grant execute on function public.my_orgs() to authenticated;

-- ---------- 3. add a staff group: an admin of a sibling group makes one under the same hospital ----------
create or replace function public.create_group(p_sibling_org text, p_label text, p_noun text, p_admin2_email text default null)
returns text language plpgsql security definer set search_path=public as $$
declare v_h text; v_label text; v_base text; v_org text; v_n int := 1; v_email text; v_phone text; v_name text;
begin
  if not public.is_admin_member(p_sibling_org) then raise exception 'Only an admin of a group in this hospital can add a group'; end if;
  select hospital_id into v_h from orgs where org = p_sibling_org;
  if v_h is null then raise exception 'That group is not under a hospital yet'; end if;
  v_label := left(trim(coalesce(p_label,'')), 40);
  if v_label = '' or public.slug_of(v_label) = '' then raise exception 'A group needs a name'; end if;
  v_base := v_h || '-' || public.slug_of(v_label); v_org := v_base;
  while exists (select 1 from orgs where org = v_org) loop v_n := v_n + 1; v_org := v_base || '-' || v_n; end loop;
  insert into orgs(org,label,hospital,hospital_id) select v_org, v_label, h.name, v_h from hospitals h where h.id = v_h;
  insert into org_state(org,data,updated) values (v_org,'{}'::jsonb,now()) on conflict (org) do nothing;
  select m.email, m.phone, m.name into v_email, v_phone, v_name from roster_members m where m.org = p_sibling_org
    and ( lower(m.email) = lower(auth.jwt()->>'email') or (nullif(auth.jwt()->>'phone','') is not null and m.phone = auth.jwt()->>'phone') ) limit 1;
  insert into roster_members(org,email,role,name,phone) values (v_org, v_email, 'admin', v_name, v_phone)
    on conflict (org,email) do update set role='admin', phone=coalesce(excluded.phone, roster_members.phone);
  if coalesce(trim(p_admin2_email),'') <> '' then
    insert into roster_members(org,email,role,name) values (v_org, lower(trim(p_admin2_email)), 'admin', 'Admin')
      on conflict (org,email) do update set role='admin';
  end if;
  return v_org;
end $$;
revoke all on function public.create_group(text,text,text,text) from public;
grant execute on function public.create_group(text,text,text,text) to authenticated;

-- ---------- 4. the department board: one row per (hospital, group), written only by that group ----------
create table if not exists board_slice (
  hospital_id text not null references hospitals(id) on delete cascade,
  org         text not null references orgs(org) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated     timestamptz not null default now(),
  primary key (hospital_id, org),
  constraint board_slice_size check (octet_length(data::text) <= 131072) );
alter table board_slice enable row level security;
revoke all on public.board_slice from anon;
grant select, insert, update on public.board_slice to authenticated;
revoke delete on public.board_slice from authenticated;   -- a group leaves the board by publishing an empty digest, never by deleting

create or replace function public.board_slice_stamp() returns trigger language plpgsql as $$
begin new.updated := now(); return new; end $$;   -- the server's clock, never the client's
drop trigger if exists board_slice_stamp on board_slice;
create trigger board_slice_stamp before insert or update on board_slice for each row execute function public.board_slice_stamp();

drop policy if exists "board read" on board_slice;
create policy "board read" on board_slice for select to authenticated
  using ( exists (select 1 from orgs o where o.hospital_id = board_slice.hospital_id and public.is_member(o.org)) );
drop policy if exists "board write" on board_slice;
create policy "board write" on board_slice for all to authenticated
  using ( public.is_member(org) and exists (select 1 from orgs o where o.org = board_slice.org and o.hospital_id = board_slice.hospital_id) )
  with check ( public.is_member(org) and exists (select 1 from orgs o where o.org = board_slice.org and o.hospital_id = board_slice.hospital_id) );

-- ---------- 5. reading: the caller's own membership names the hospital; labels come from the registry ----------
create or replace function public.hospital_groups(p_org text) returns table(org text, label text)
  language sql security definer set search_path=public as $$
  select o.org, coalesce(o.label,o.org) from orgs o
   where public.is_member(p_org) and o.hospital_id is not null
     and o.hospital_id = (select hospital_id from orgs where org = p_org)
   order by coalesce(o.label,o.org); $$;
grant execute on function public.hospital_groups(text) to authenticated;

create or replace function public.board_for_org(p_org text)
  returns table(org text, label text, hospital_id text, hospital text, data jsonb, updated timestamptz)
  language sql security definer set search_path=public as $$
  select b.org, coalesce(o.label,o.org), b.hospital_id, o.hospital, b.data, b.updated
    from board_slice b join orgs o on o.org = b.org
   where public.is_member(p_org)
     and b.hospital_id = (select hospital_id from orgs where org = p_org)
   order by coalesce(o.label,o.org); $$;
grant execute on function public.board_for_org(text) to authenticated;

-- ---------- 6. for the isolation page: every table in public must carry row-level security ----------
create or replace function public.tables_without_rls() returns setof text
  language sql security definer set search_path=public as $$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1; $$;
grant execute on function public.tables_without_rls() to authenticated;

-- ---------- 7. verification — read these before you walk away ----------
-- a) every org now points at a hospital id (expect no rows with a name but no id):
select org, label, hospital, hospital_id from orgs order by hospital_id, label;
-- b) the registry:
select * from hospitals order by id;
-- c) nothing in public without RLS (expect zero rows):
select * from public.tables_without_rls();
-- d) one hospital id must group only orgs that really share a department (two tenants whose names slug alike would merge here — fix the names and re-run before going on):
select hospital_id, count(*) as groups, string_agg(org, ', ' order by org) as orgs from orgs group by 1 order by 1;

-- ============================================================================
-- STAGING-ONLY fixture (after everything above, so hospitals and the backfill exist): a board_slice row for
-- test-orgC's hospital ('Other Hospital' backfills to 'other-hospital'), so the "same hospital only" probes
-- in supabase/isolation-test.html v4 have a foreign row to fail on.
-- ============================================================================
insert into board_slice(hospital_id,org,data) values ('other-hospital','test-orgC','{"v":1,"noun":"probe","days":{}}'::jsonb) on conflict (hospital_id,org) do nothing;
