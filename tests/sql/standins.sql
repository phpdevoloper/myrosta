-- Supabase stand-ins for the local SQL tests: what the live project already has and this file pretends to be.
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb); $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
create table if not exists roster_members ( org text not null default 'ed-default', email text not null, role text, name text, phone text, primary key (org, email) );
create table if not exists org_state ( org text primary key, data jsonb, updated timestamptz default now() );
create table if not exists orgs ( org text primary key, label text, hospital text, hospital_id text, created timestamptz default now() );
create table if not exists hospitals ( id text primary key, name text not null, created timestamptz default now() );
alter table roster_members enable row level security; alter table org_state enable row level security;
alter table orgs enable row level security; alter table hospitals enable row level security;
grant select, insert, update on public.org_state to authenticated;
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
drop policy if exists "members all" on org_state;
create policy "members all" on org_state for all to authenticated using ( public.is_member(org) ) with check ( public.is_member(org) );
create or replace function public.tables_without_rls() returns setof text
  language sql security definer set search_path=public as $$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1; $$;
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime for table org_state; end if;
end $$;
