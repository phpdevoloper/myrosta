-- ============================================================================
-- Myrosta — multi-org ROLLBACK (production)
-- Paste and run to put the database back to single-org behaviour.
--
-- WHY THIS SHAPE: it deliberately does NOT revert the (org,email) primary key.
-- Reverting to primary key (email) FAILS the moment one person belongs to two
-- organisations — which is precisely the state you are in if you are rolling back —
-- and it would error halfway through. It is also unnecessary: the old app never
-- names `org`, and the column default keeps its writes landing on 'ed-default'.
--
-- ⚠️ WARNING: rollback restores the ORIGINAL GLOBAL membership model — after running it, ANY
-- allow-listed member can read/write EVERY org_state row. Safe with one organisation's data;
-- if a second organisation's rows already exist, delete them (or accept shared visibility)
-- until the migration is re-applied.
--
-- Dropping my_orgs() alone is enough to send the new app back into single-org mode
-- (resolveOrg falls back when the function is missing). The rest restores the old policies.
-- No roster data is touched by either direction.
-- ============================================================================

-- 1. the new app immediately falls back to single-org when this disappears
drop function if exists public.my_orgs();

-- 2. restore the original global-scope helpers
create or replace function public.is_member() returns boolean
  language sql security definer set search_path=public as $$
  select exists(select 1 from roster_members m
    where (lower(m.email)=lower(auth.jwt()->>'email'))
       or (nullif(auth.jwt()->>'phone','') is not null and m.phone=auth.jwt()->>'phone')); $$;

create or replace function public.is_admin_member() returns boolean
  language sql security definer set search_path=public as $$
  select exists(select 1 from roster_members m where m.role='admin'
    and ((lower(m.email)=lower(auth.jwt()->>'email'))
      or (nullif(auth.jwt()->>'phone','') is not null and m.phone=auth.jwt()->>'phone'))); $$;

-- 3. restore the original policies
drop policy if exists "members all" on org_state;
create policy "members all" on org_state for all to authenticated
  using (public.is_member()) with check (public.is_member());
drop policy if exists "list read" on roster_members;
create policy "list read" on roster_members for select to authenticated using (public.is_member());
drop policy if exists "admins manage" on roster_members;
create policy "admins manage" on roster_members for all to authenticated
  using (public.is_admin_member()) with check (public.is_admin_member());

-- 4. drop the org-scoped helpers.
-- The "orgs read own" policy DEPENDS on is_member(text): Postgres refuses to drop a function a
-- policy uses, and the whole script runs in one transaction — so without this drop the entire
-- rollback aborts. Drop the dependent policy first.
drop policy if exists "orgs read own" on orgs;
drop function if exists public.is_member(text);
drop function if exists public.is_admin_member(text);

-- 5. the umbrella registry (orgs table) is read-only extra data; harmless to keep (its policy
--    was dropped in step 4). To remove entirely: drop table if exists orgs;

-- 6. re-assert the delete hardening
revoke delete on public.org_state from authenticated;

-- verify: expect the two no-arg helpers to exist again
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('is_member','is_admin_member') order by 1,2;
