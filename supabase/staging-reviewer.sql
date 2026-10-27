-- ============================================================================
-- Myrosta — a READ-ONLY Postgres login for an outside reviewer.  STAGING ONLY.
-- Never run this on the production project: production holds real names and numbers.
--
-- 1. Replace the password below with a long random one (a password manager makes one).
-- 2. Paste the whole file into the STAGING project's SQL editor and Run.
-- 3. Give the reviewer the project's connection string (Project Settings → Database → Connection string,
--    "Session pooler") with the user changed to   reviewer.<project-ref>   and this password.
-- Idempotent: safe to re-run (re-running with a new password changes the password).
-- To revoke later:  drop owned by reviewer; drop role reviewer;
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'reviewer') then
    create role reviewer login nosuperuser nocreatedb nocreaterole noinherit noreplication;
  end if;
end $$;
alter role reviewer password 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';
alter role reviewer set statement_timeout = '30s';

-- read everything in public (tables that arrive later included), write nothing
grant usage on schema public to reviewer;
grant select on all tables in schema public to reviewer;
grant select on all sequences in schema public to reviewer;
alter default privileges in schema public grant select on tables to reviewer;

-- every table is behind row-level security written for signed-in app users; the reviewer gets its own read-only policy on each
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "reviewer reads" on public.%I', t);
    execute format('create policy "reviewer reads" on public.%I for select to reviewer using (true)', t);
  end loop;
end $$;

-- verification (run alone):
-- select rolname, rolcanlogin, rolsuper, rolcreaterole from pg_roles where rolname = 'reviewer';
-- select tablename, policyname from pg_policies where policyname = 'reviewer reads' order by 1;
