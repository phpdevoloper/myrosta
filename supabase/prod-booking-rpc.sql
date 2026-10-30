-- ============================================================================
-- Myrosta — book through the database (14 Oct 2026; 16 Oct a.m.: the ping writes a marker into the event stream; 16 Oct p.m.: mark / unmark / calendar token through the same call, the audit log capped in the document, a 20 s statement limit for signed-in calls — paste the whole file again)
-- Target: the LIVE project  skpdqqhwrqgxsxawniho  (myrosta.com.au). Idempotent: safe to run twice.
--
-- ORDER MATTERS: deploy the app build FIRST (it runs unchanged on the old schema: it probes for
-- roster_events and, finding none, books the old way), THEN run this file in the SQL editor,
-- THEN open the app and check the About row under More reads "bookings go straight to the database".
-- Spec: docs/superpowers/specs/2026-10-14-book-through-the-database-design.md
-- Incident: docs/operations/INCIDENT-2026-10-14-booking-storm.md
--
-- What this does, in one breath: a tap on the phone becomes ONE call to roster_commit(), which locks
-- the group's row, checks the shift against the roster as it is at that instant (the zone, the half's
-- cap, the person's day, their leave), writes the one key, logs it, and tells every phone through a
-- 300-byte event row — instead of 36 phones uploading the whole 0.6 MB document at once and losing.
-- ============================================================================

-- ---------- 1. the event log: one row per booking or removal made through roster_commit ----------
create table if not exists roster_events (
  seq    bigserial primary key,
  org    text not null,
  ts     timestamptz not null default clock_timestamp(),
  cycle  text not null,
  key    text not null,          -- "staffId|YYYY-MM-DD"
  val    jsonb,                  -- the shift as stored in cycle.assign, or null for a removal
  audit  jsonb );                -- the audit row that went into the document with it
create index if not exists roster_events_org_seq on roster_events(org, seq);
alter table roster_events enable row level security;
revoke all on public.roster_events from anon;
grant select on public.roster_events to authenticated;
revoke insert, update, delete on public.roster_events from authenticated;   -- only roster_commit writes here
drop policy if exists "events read own" on roster_events;
create policy "events read own" on roster_events for select to authenticated using ( public.is_member(org) );

-- ---------- 2. the whole-document ping: "something other than a booking changed, fetch once" ----------
create table if not exists org_events ( org text primary key, ts timestamptz not null default clock_timestamp(), n bigint not null default 0 );
alter table org_events enable row level security;
revoke all on public.org_events from anon;
grant select on public.org_events to authenticated;
drop policy if exists "pings read own" on org_events;
create policy "pings read own" on org_events for select to authenticated using ( public.is_member(org) );

create or replace function public.org_state_ping() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(current_setting('myrosta.rpc', true), '') = '1' then return null; end if;   -- roster_commit's own writes travel as events, not pings
  insert into org_events(org, ts, n) values (new.org, clock_timestamp(), 1)
    on conflict (org) do update set ts = excluded.ts, n = org_events.n + 1;
  insert into roster_events(org, cycle, key, val, audit) values (new.org, '', '', null, null);   -- a marker in the event stream (16 Oct 2026): the document changed here, so a phone catching up treats every earlier event as history and fetches the document
  return null;
end $$;
drop trigger if exists org_state_ping on org_state;
create trigger org_state_ping after insert or update on org_state for each row execute function public.org_state_ping();

-- ---------- 3. helpers: JavaScript truthiness, and which halves a shift fills (the app's fillsOf) ----------
create or replace function public.roster_truthy(j jsonb) returns boolean language sql immutable as $$
  select case when j is null then false
              when jsonb_typeof(j) = 'boolean' then j::boolean
              when jsonb_typeof(j) = 'number'  then (j #>> '{}')::numeric <> 0
              when jsonb_typeof(j) = 'string'  then (j #>> '{}') <> ''
              when jsonb_typeof(j) = 'null'    then false
              else true end; $$;

create or replace function public.roster_fills(p_types jsonb, p_sh jsonb) returns text[] language sql immutable as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(t -> 'fills'))
       from jsonb_array_elements(case when jsonb_typeof(p_types) = 'array' and jsonb_array_length(p_types) > 0 then p_types else '[]'::jsonb end) t
      where t ->> 'id' = p_sh ->> 'type' and jsonb_typeof(t -> 'fills') = 'array' and jsonb_array_length(t -> 'fills') > 0
      limit 1),
    array[coalesce(p_sh ->> 'period', '')]); $$;   -- a type the cycle knows fills what it says; anything else fills its own half

-- ---------- 4. the booking call ----------
-- p_ops: [{op:"book", sid, day, period, zone, type?, hours?}, {op:"unbook", sid, day}, {op:"mark", sid, day, kind:"cst"|"leave", code?}, {op:"ics", sid, token}] — up to 60, judged in order.
-- unbook removes the person's own entry for the day whatever its kind (a shift, a CST day, an unavailable mark), never a fixed shift unless the caller is an admin.
-- Returns {ok:true, n, updated, results:[{i, ok, op, key, val, audit, seq, ts} | {i, ok:false, op, key, reason}]}.
-- Raises (whole call rolled back) when the caller is not a member, the cycle is unknown or archived, or ops is malformed.
create or replace function public.roster_commit(p_org text, p_cycle text, p_ops jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_doc jsonb; v_ci int; v_cyc jsonb; v_assign jsonb; v_staff jsonb; v_zones jsonb; v_staffing jsonb; v_types jsonb; v_roles jsonb; v_leave jsonb;
  v_start date; v_days int; v_admin boolean; v_ts timestamptz := clock_timestamp(); v_ms bigint;
  v_results jsonb := '[]'::jsonb; v_newaudit jsonb := '[]'::jsonb; v_n int := 0; v_k int := 0;
  op jsonb; i bigint; v_kind text; v_sid text; v_day text; v_key text; v_period text; v_zone text; v_type text; v_hours jsonb;
  v_fills text[]; fl text[]; f text; v_val jsonb; v_cur jsonb; v_z jsonb; v_reason text; v_name text; v_label text; v_aud jsonb;
  v_seq bigint; v_ets timestamptz; v_in boolean; v_am int; v_pm int; v_max int; v_zn int; v_cap int; v_cnt int; r record;
begin
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then raise exception 'ops must be an array'; end if;
  if jsonb_array_length(p_ops) > 60 then raise exception 'Too many changes in one go'; end if;
  if not public.is_member(p_org) then raise exception 'Not a member of this group'; end if;
  v_admin := public.is_admin_member(p_org);
  select data into v_doc from org_state where org = p_org for update;   -- writers queue here, in order: nobody races
  if v_doc is null then raise exception 'No roster for this group'; end if;
  select (c.ord - 1)::int, c.value into v_ci, v_cyc
    from jsonb_array_elements(case when jsonb_typeof(v_doc -> 'cycles') = 'array' then v_doc -> 'cycles' else '[]'::jsonb end) with ordinality as c(value, ord)
   where c.value ->> 'id' = p_cycle limit 1;
  if v_cyc is null then raise exception 'That cycle is gone — reload the app'; end if;
  if public.roster_truthy(v_cyc -> 'archived') then raise exception 'This cycle is archived'; end if;
  v_assign := case when jsonb_typeof(v_cyc -> 'assign') = 'object' then v_cyc -> 'assign' else '{}'::jsonb end;
  v_staff := case when jsonb_typeof(v_doc -> 'staff') = 'array' then v_doc -> 'staff' else '[]'::jsonb end;
  v_zones := coalesce(v_cyc -> 'settings' -> 'zones', v_doc -> 'zones', '[]'::jsonb);
  if jsonb_typeof(v_zones) <> 'array' then v_zones := '[]'::jsonb; end if;
  v_staffing := coalesce(v_cyc -> 'settings' -> 'staffing', v_doc -> 'staffing', '{}'::jsonb);
  v_types := v_cyc -> 'settings' -> 'shiftTypes';
  v_roles := v_cyc -> 'roles';
  v_leave := case when jsonb_typeof(v_doc -> 'leave') = 'array' then v_doc -> 'leave' else '[]'::jsonb end;
  begin v_start := (v_cyc -> 'cycle' ->> 'start')::date; exception when others then v_start := null; end;
  v_days := coalesce(round(nullif(v_cyc -> 'cycle' ->> 'weeks', '')::numeric)::int, 8) * 7;
  v_ms := (extract(epoch from v_ts) * 1000)::bigint;
  perform set_config('myrosta.rpc', '1', true);   -- the ping trigger stays quiet for this transaction

  for op, i in select c.value, c.ord from jsonb_array_elements(p_ops) with ordinality as c(value, ord) loop
    v_reason := null; v_val := null; v_aud := null; v_seq := null; v_ets := null; v_z := null; v_label := null;
    v_kind := op ->> 'op'; v_sid := op ->> 'sid'; v_day := op ->> 'day'; v_key := coalesce(v_sid, '') || '|' || coalesce(v_day, '');
    select s ->> 'name' into v_name from jsonb_array_elements(v_staff) s where s ->> 'id' = v_sid limit 1;
    if v_kind is null or v_kind not in ('book', 'unbook', 'mark', 'ics') then v_reason := 'Unknown change';
    elsif v_sid is null or v_name is null then v_reason := 'That person is not on the staff list';
    elsif v_kind <> 'ics' and (v_day is null or v_day !~ '^\d{4}-\d{2}-\d{2}$') then v_reason := 'That day is not a date';
    end if;

    if v_reason is null and v_kind = 'book' then
      v_period := op ->> 'period'; v_zone := op ->> 'zone'; v_type := nullif(op ->> 'type', ''); v_hours := op -> 'hours';
      v_in := case when v_roles is null or jsonb_typeof(v_roles) <> 'object' then true
                   when v_roles -> v_sid is null then false
                   else coalesce(nullif(v_roles -> v_sid ->> 'in', '')::boolean, true) end;
      if v_start is null or v_day::date < v_start or v_day::date >= v_start + v_days then v_reason := 'That day is outside this cycle.';
      elsif not v_in then v_reason := 'You are not on this cycle''s roster.';
      elsif v_period is null or v_period = '' then v_reason := 'No half given.';
      elsif v_assign ? v_key then v_reason := case when v_assign -> v_key ->> 'kind' = 'leave' then 'You''re on leave that day.' else 'You already have a shift that day.' end;
      elsif exists (select 1 from jsonb_array_elements(v_leave) L where L ->> 'staffId' = v_sid and L ->> 'status' = 'approved' and L ->> 'from' <= v_day and L ->> 'to' >= v_day) then v_reason := 'You''re on leave that day.';
      else
        select z into v_z from jsonb_array_elements(v_zones) z where z ->> 'id' = v_zone limit 1;
        if v_z is null then v_reason := 'That zone is gone — reload the app.';
        else
          v_fills := public.roster_fills(v_types, jsonb_build_object('kind', 'clinical', 'period', v_period, 'type', v_type));
          foreach f in array v_fills loop
            if not public.roster_truthy(case when f = 'AM' then v_z -> 'am' else v_z -> 'pm' end) then v_reason := 'That zone isn''t open in the ' || f || '.'; exit; end if;
          end loop;
        end if;
      end if;
      if v_reason is null then   -- everyone else's clinical shifts that day: the zone, and the count per half
        v_am := 0; v_pm := 0;
        for r in select e.key, e.value from jsonb_each(v_assign) e where e.key like '%|' || v_day and e.key <> v_key and e.value ->> 'kind' = 'clinical' loop
          fl := public.roster_fills(v_types, r.value);
          if r.value ->> 'zone' = v_zone and fl && v_fills then
            v_reason := case when array_length(v_fills, 1) > 1
              then 'The ' || (select x from unnest(v_fills) x where x = any(fl) limit 1) || ' half of that zone is taken — a whole-day shift needs both.'
              else 'That zone was just taken — pick another.' end;
            exit;
          end if;
          if 'AM' = any(fl) then v_am := v_am + 1; end if;
          v_pm := v_pm + (select count(*) from unnest(fl) x where x <> 'AM')::int;
        end loop;
      end if;
      if v_reason is null then   -- each half it fills must be under that half's cap: min(maximum, zones open in that half)
        foreach f in array v_fills loop
          v_max := coalesce(round(nullif(v_staffing ->> (case when f = 'AM' then 'amMax' else 'pmMax' end), '')::numeric)::int, 99);
          select count(*) into v_zn from jsonb_array_elements(v_zones) z where public.roster_truthy(case when f = 'AM' then z -> 'am' else z -> 'pm' end);
          v_cap := least(v_max, v_zn); v_cnt := case when f = 'AM' then v_am else v_pm end;
          if v_cnt >= v_cap then v_reason := f || ' is full (' || v_cnt || ' of ' || v_cap || ').'; exit; end if;
        end loop;
      end if;
      if v_reason is null then
        v_val := jsonb_build_object('kind', 'clinical', 'period', v_period, 'zone', v_zone);
        if v_type is not null then v_val := v_val || jsonb_build_object('type', v_type); end if;
        if v_hours is not null and jsonb_typeof(v_hours) = 'object' and coalesce(v_hours ->> 'start', '') <> '' and coalesce(v_hours ->> 'end', '') <> '' then
          v_val := v_val || jsonb_build_object('hours', jsonb_build_object('start', v_hours ->> 'start', 'end', v_hours ->> 'end')); end if;
        v_assign := jsonb_set(v_assign, array[v_key], v_val, true);
        if v_type is not null then
          select t ->> 'label' into v_label from jsonb_array_elements(case when jsonb_typeof(v_types) = 'array' then v_types else '[]'::jsonb end) t where t ->> 'id' = v_type limit 1; end if;
        v_k := v_k + 1;
        v_aud := jsonb_build_object('id', 'a' || v_ms || 'r' || v_k || substr(md5(random()::text), 1, 3), 'ts', v_ms, 'actor', v_sid, 'action', 'selfroster.book',
          'detail', v_name || ' ' || v_day || ' ' || coalesce(v_label, v_type, v_period) || ' ' || coalesce(v_z ->> 'name', '')
                    || case when v_val ? 'hours' then ' ' || (v_val -> 'hours' ->> 'start') || '–' || (v_val -> 'hours' ->> 'end') else '' end);
      end if;

    elsif v_reason is null and v_kind = 'unbook' then
      v_cur := v_assign -> v_key;
      if v_cur is null then v_reason := 'Nothing to remove that day.';
      elsif public.roster_truthy(v_cur -> 'fixed') and not v_admin then v_reason := 'Fixed shift — ask your admin to change it.';
      else
        v_assign := v_assign - v_key; v_k := v_k + 1;
        v_aud := jsonb_build_object('id', 'a' || v_ms || 'r' || v_k || substr(md5(random()::text), 1, 3), 'ts', v_ms, 'actor', v_sid,
          'action', case when coalesce(v_cur ->> 'kind', '') = 'clinical' then 'selfroster.unbook' else 'selfroster.off' end, 'detail', v_name || ' ' || v_day);
      end if;

    elsif v_reason is null and v_kind = 'mark' then   -- a CST day or an unavailable mark on the person's own day (16 Oct 2026: these used to save the whole roster from the phone)
      v_period := op ->> 'kind'; v_zone := nullif(op ->> 'code', '');
      v_in := case when v_roles is null or jsonb_typeof(v_roles) <> 'object' then true when v_roles -> v_sid is null then false else coalesce(nullif(v_roles -> v_sid ->> 'in', '')::boolean, true) end;
      v_cur := v_assign -> v_key;
      if v_start is null or v_day::date < v_start or v_day::date >= v_start + v_days then v_reason := 'That day is outside this cycle.';
      elsif not v_in then v_reason := 'You are not on this cycle''s roster.';
      elsif v_period not in ('cst', 'leave') then v_reason := 'Unknown mark.';
      elsif v_period = 'leave' and (v_zone is null or v_zone !~ '^[A-Z]{1,12}$') then v_reason := 'Unknown leave code.';
      elsif v_cur is not null and public.roster_truthy(v_cur -> 'fixed') and not v_admin then v_reason := 'Fixed shift — ask your admin to change it.';
      else
        v_val := case when v_period = 'cst' then jsonb_build_object('kind', 'cst') else jsonb_build_object('kind', 'leave', 'code', v_zone) end;
        v_assign := jsonb_set(v_assign, array[v_key], v_val, true); v_k := v_k + 1;
        v_aud := jsonb_build_object('id', 'a' || v_ms || 'r' || v_k || substr(md5(random()::text), 1, 3), 'ts', v_ms, 'actor', v_sid,
          'action', case when v_period = 'cst' then 'selfroster.cst' when v_zone = 'UA' then 'selfroster.ua' else 'selfroster.leave' end, 'detail', v_name || ' ' || v_day || case when v_period = 'leave' then ' ' || v_zone else '' end);
      end if;

    elsif v_reason is null and v_kind = 'ics' then   -- the personal calendar token, minted once: the first to arrive stands, and the answer carries whichever it is
      v_zone := nullif(op ->> 'token', '');
      select (ord - 1)::int, s ->> 'icsToken' into v_zn, v_label from jsonb_array_elements(v_staff) with ordinality as x(s, ord) where s ->> 'id' = v_sid limit 1;
      if v_zone is null or v_zone !~ '^[0-9a-f]{24,64}$' then v_reason := 'Bad token.';
      elsif coalesce(v_label, '') <> '' then v_val := jsonb_build_object('token', v_label);   -- already minted: hand it back, write nothing
      else v_doc := jsonb_set(v_doc, array['staff', v_zn::text, 'icsToken'], to_jsonb(v_zone), true); v_val := jsonb_build_object('token', v_zone); v_n := v_n + 1; end if;
      if v_reason is null then v_results := v_results || jsonb_build_object('i', i - 1, 'ok', true, 'op', v_kind, 'val', v_val); continue; end if;
    end if;

    if v_reason is null then
      insert into roster_events(org, cycle, key, val, audit) values (p_org, p_cycle, v_key, v_val, v_aud) returning seq, ts into v_seq, v_ets;
      v_newaudit := jsonb_build_array(v_aud) || v_newaudit;   -- newest first, as the app's log is kept
      v_n := v_n + 1;
      v_results := v_results || jsonb_build_object('i', i - 1, 'ok', true, 'op', v_kind, 'key', v_key, 'val', v_val, 'audit', v_aud, 'seq', v_seq, 'ts', v_ets);
    else
      v_results := v_results || jsonb_build_object('i', i - 1, 'ok', false, 'op', v_kind, 'key', v_key, 'reason', v_reason);
    end if;
  end loop;

  if v_n > 0 then
    v_doc := jsonb_set(v_doc, array['cycles', v_ci::text, 'assign'], v_assign, true);
    v_doc := jsonb_set(v_doc, '{audit}', jsonb_path_query_array(v_newaudit || (case when jsonb_typeof(v_doc -> 'audit') = 'array' then v_doc -> 'audit' else '[]'::jsonb end), '$[0 to 399]'), true);   -- the document keeps the newest 400 lines; every booking is in roster_events for good
    update org_state set data = v_doc, updated = v_ts where org = p_org;   -- a stale whole-document save now fails its swap and merges, as it should
  end if;
  return jsonb_build_object('ok', true, 'n', v_n, 'updated', v_ts, 'results', v_results);
end $$;
revoke all on function public.roster_commit(text, text, jsonb) from public;
grant execute on function public.roster_commit(text, text, jsonb) to authenticated;

-- ---------- 4b. room to queue: a tap that waits behind others must wait, not die at the 8 s default (16 Oct 2026) ----------
alter role authenticated set statement_timeout = '20s';
notify pgrst, 'reload config';

-- ---------- 5. realtime: the event rows and the ping travel; the 0.6 MB document no longer does ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'org_state') then
      alter publication supabase_realtime drop table org_state; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'roster_events') then
      alter publication supabase_realtime add table roster_events; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'org_events') then
      alter publication supabase_realtime add table org_events; end if;
  end if;
end $$;

-- ---------- 6. side fix: the reminder and calendar functions read the group registry with the server key ----------
-- (the API log of 14 Oct showed "permission denied for table orgs" from them, every minute)
grant select on public.orgs to service_role;
grant select on public.hospitals to service_role;

-- ---------- 7. verification — read these before you walk away ----------
-- a) the function exists and the call works for YOU (the editor has no signed-in user, so this one raises
--    'Not a member of this group' — that is the function answering; the app's About row is the real check):
select p.proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('roster_commit', 'roster_fills', 'roster_truthy', 'org_state_ping') order by 1;
-- b) realtime carries the two small tables and not the document (expect roster_events and org_events, no org_state):
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1;
-- c) the trigger is on:
select tgname, tgenabled from pg_trigger where tgrelid = 'public.org_state'::regclass and not tgisinternal;
-- d) nothing in public without RLS (expect zero rows):
select * from public.tables_without_rls();
