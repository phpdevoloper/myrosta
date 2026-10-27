-- Assertions for supabase/prod-booking-rpc.sql, run by tests/sql/run.py on a local Postgres after the stand-ins.
-- Synthetic names only. Every line is PASS/FAIL in t_results.
create temp table t_results (n serial, name text, pass boolean);
create function pg_temp.t(name text, cond boolean) returns void language sql as $$ insert into t_results(name, pass) values (name, coalesce(cond, false)); $$;
create function pg_temp.call(ops jsonb) returns jsonb language sql as $$ select public.roster_commit('test-org', 'c1', ops); $$;
create function pg_temp.first(ops jsonb) returns jsonb language sql as $$ select (public.roster_commit('test-org', 'c1', ops) -> 'results') -> 0; $$;

insert into roster_members(org, email, role, name) values
  ('test-org', 'alex@example.org', 'staff', 'Alex Example'),
  ('test-org', 'sam@example.org', 'admin', 'Sam Example'),
  ('other-org', 'pat@example.org', 'staff', 'Pat Example');
insert into org_state(org, data, updated) values ('other-org', '{"cycles":[]}'::jsonb, now());
insert into org_state(org, data, updated) values ('test-org', $j$
{"staff":[{"id":"s1","name":"Alex Example"},{"id":"s2","name":"Sam Example"},{"id":"s3","name":"Jo Example"},{"id":"s4","name":"Kim Example"},
          {"id":"s5","name":"Lee Example"},{"id":"s6","name":"Max Example"},{"id":"s7","name":"Ash Example"}],
 "zones":[{"id":"z1","name":"Resus","am":true,"pm":true}],
 "staffing":{"amMin":4,"amMax":4,"pmMin":4,"pmMax":4},
 "leave":[{"id":"L1","staffId":"s4","status":"approved","code":"AL","from":"2026-11-25","to":"2026-11-26"}],
 "audit":[{"id":"a0","ts":1,"actor":"admin","action":"seed","detail":"seed"}],
 "cycles":[{"id":"c0","cycle":{"start":"2026-09-28","weeks":8},"assign":{},"status":"published","archived":true},
           {"id":"c1","cycle":{"start":"2026-11-23","weeks":8},"status":"open","archived":false,
            "settings":{"staffing":{"amMin":4,"amMax":4,"pmMin":4,"pmMax":4},
                        "zones":[{"id":"z1","name":"Resus","am":true,"pm":true},{"id":"z2","name":"Acute","am":true,"pm":true},
                                 {"id":"z3","name":"Fast track","am":true,"pm":true},{"id":"z4","name":"Paeds","am":true,"pm":true},
                                 {"id":"z5","name":"Short stay","am":true,"pm":false},{"id":"z6","name":"Clinic","am":false,"pm":false}],
                        "shiftTypes":[{"id":"AM","label":"AM","fills":["AM"]},{"id":"PM","label":"PM","fills":["PM"]},{"id":"FULL","label":"Full day","fills":["AM","PM"]}]},
            "roles":{"s1":{"in":true},"s2":{"in":true},"s3":{"in":true},"s4":{"in":true},"s5":{"in":true},"s6":{"in":false},"s7":{"in":true}},
            "assign":{"s5|2026-11-24":{"kind":"clinical","period":"AM","zone":"z1","fixed":true}}}]}
$j$::jsonb, now());

-- the seed inserts pinged org_events through the trigger (two documents, two pings)
select pg_temp.t('ping: an ordinary write to org_state pings org_events', (select n from org_events where org = 'test-org') = 1);

-- ---- as Alex, a staff member of test-org ----
select set_config('request.jwt.claims', '{"email":"alex@example.org"}', false);

select pg_temp.t('smoke: an empty call answers ok with no results', (select r ->> 'ok' = 'true' and (r ->> 'n')::int = 0 and jsonb_array_length(r -> 'results') = 0 from pg_temp.call('[]'::jsonb) r));

do $$ declare m text; begin
  begin perform public.roster_commit('other-org', 'c1', '[]'::jsonb); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.t('refuse: not a member of that group raises', m = 'Not a member of this group');
  begin perform public.roster_commit('test-org', 'c9', '[]'::jsonb); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.t('refuse: an unknown cycle raises', m = 'That cycle is gone — reload the app');
  begin perform public.roster_commit('test-org', 'c0', '[]'::jsonb); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.t('refuse: an archived cycle raises', m = 'This cycle is archived');
  begin perform public.roster_commit('test-org', 'c1', '{"op":"book"}'::jsonb); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.t('refuse: ops must be an array', m = 'ops must be an array');
  begin perform public.roster_commit('test-org', 'c1', (select jsonb_agg(jsonb_build_object('op', 'book')) from generate_series(1, 61))); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.t('refuse: more than 60 ops raises', m = 'Too many changes in one go');
end $$;

-- a first booking
create temp table t_before as select updated, (select n from org_events where org = 'test-org') as pings from org_state where org = 'test-org';
create temp table t_r1 as select pg_temp.first('[{"op":"book","sid":"s1","day":"2026-11-24","period":"AM","zone":"z2"}]'::jsonb) as r;
select pg_temp.t('book: Alex books Tue 24 Nov AM in Acute', (select r ->> 'ok' = 'true' and r ->> 'key' = 's1|2026-11-24' and r -> 'val' = '{"kind":"clinical","period":"AM","zone":"z2"}'::jsonb from t_r1));
select pg_temp.t('book: the key is in the document, on the right cycle', (select data -> 'cycles' -> 1 -> 'assign' -> 's1|2026-11-24' = '{"kind":"clinical","period":"AM","zone":"z2"}'::jsonb and data -> 'cycles' -> 0 -> 'assign' = '{}'::jsonb from org_state where org = 'test-org'));
select pg_temp.t('book: the audit row is first in the log, with the names', (select data -> 'audit' -> 0 ->> 'action' = 'selfroster.book' and data -> 'audit' -> 0 ->> 'actor' = 's1' and data -> 'audit' -> 0 ->> 'detail' = 'Alex Example 2026-11-24 AM Acute' and data -> 'audit' -> 1 ->> 'id' = 'a0' from org_state where org = 'test-org'));
select pg_temp.t('book: the audit row in the answer is the one in the document', (select r -> 'audit' = (select data -> 'audit' -> 0 from org_state where org = 'test-org') from t_r1));
select pg_temp.t('book: one event row, with the key, the value and the audit row', (select count(*) = 1 from roster_events e, t_r1 where e.org = 'test-org' and e.cycle = 'c1' and e.key = 's1|2026-11-24' and e.val = t_r1.r -> 'val' and e.audit = t_r1.r -> 'audit' and e.seq = (t_r1.r ->> 'seq')::bigint));
select pg_temp.t('book: updated moved forward', (select s.updated > b.updated from org_state s, t_before b where s.org = 'test-org'));
select pg_temp.t('book: the function''s own write does not ping org_events', (select n from org_events where org = 'test-org') = (select pings from t_before));

-- refusals, each in the app's own words
select pg_temp.t('refuse: a second shift the same day', (select r ->> 'ok' = 'false' and r ->> 'reason' = 'You already have a shift that day.' from pg_temp.first('[{"op":"book","sid":"s1","day":"2026-11-24","period":"PM","zone":"z3"}]'::jsonb) r));
select pg_temp.t('refuse: the zone a colleague just took', (select r ->> 'reason' = 'That zone was just taken — pick another.' from pg_temp.first('[{"op":"book","sid":"s2","day":"2026-11-24","period":"AM","zone":"z2"}]'::jsonb) r));
select pg_temp.t('refuse: the zone a fixed shift holds', (select r ->> 'reason' = 'That zone was just taken — pick another.' from pg_temp.first('[{"op":"book","sid":"s2","day":"2026-11-24","period":"AM","zone":"z1"}]'::jsonb) r));
select pg_temp.t('refuse: a zone not open in that half', (select r ->> 'reason' = 'That zone isn''t open in the AM.' from pg_temp.first('[{"op":"book","sid":"s2","day":"2026-11-24","period":"AM","zone":"z6"}]'::jsonb) r));
select pg_temp.t('refuse: a zone that does not exist', (select r ->> 'reason' = 'That zone is gone — reload the app.' from pg_temp.first('[{"op":"book","sid":"s2","day":"2026-11-24","period":"AM","zone":"z9"}]'::jsonb) r));
select pg_temp.t('book: the other half of a taken zone is free', (select r ->> 'ok' = 'true' from pg_temp.first('[{"op":"book","sid":"s2","day":"2026-11-24","period":"PM","zone":"z2"}]'::jsonb) r));
select pg_temp.t('refuse: a whole-day shift where one half is taken names the half', (select r ->> 'reason' = 'The AM half of that zone is taken — a whole-day shift needs both.' from pg_temp.first('[{"op":"book","sid":"s3","day":"2026-11-24","period":"AM","zone":"z2","type":"FULL"}]'::jsonb) r));
select pg_temp.t('book: a whole-day shift in a free zone, typed, labelled in the audit', (select r ->> 'ok' = 'true' and r -> 'val' ->> 'type' = 'FULL' and r -> 'audit' ->> 'detail' = 'Jo Example 2026-11-24 Full day Fast track' from pg_temp.first('[{"op":"book","sid":"s3","day":"2026-11-24","period":"AM","zone":"z3","type":"FULL"}]'::jsonb) r));
select pg_temp.t('refuse: the whole-day shift now holds its zone in the PM too', (select r ->> 'reason' = 'That zone was just taken — pick another.' from pg_temp.first('[{"op":"book","sid":"s7","day":"2026-11-24","period":"PM","zone":"z3"}]'::jsonb) r));
select pg_temp.t('refuse: someone not on this cycle''s roster', (select r ->> 'reason' = 'You are not on this cycle''s roster.' from pg_temp.first('[{"op":"book","sid":"s6","day":"2026-11-24","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('refuse: someone not on the staff list', (select r ->> 'reason' = 'That person is not on the staff list' from pg_temp.first('[{"op":"book","sid":"s99","day":"2026-11-24","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('refuse: a day outside the cycle', (select r ->> 'reason' = 'That day is outside this cycle.' from pg_temp.first('[{"op":"book","sid":"s7","day":"2026-11-22","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('refuse: the day after the cycle''s last', (select r ->> 'reason' = 'That day is outside this cycle.' from pg_temp.first('[{"op":"book","sid":"s7","day":"2027-01-18","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('book: the cycle''s last day is inside it', (select r ->> 'ok' = 'true' from pg_temp.first('[{"op":"book","sid":"s7","day":"2027-01-17","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('refuse: a day that is not a date', (select r ->> 'reason' = 'That day is not a date' from pg_temp.first('[{"op":"book","sid":"s7","day":"24/11/2026","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('refuse: approved leave that day', (select r ->> 'reason' = 'You''re on leave that day.' from pg_temp.first('[{"op":"book","sid":"s4","day":"2026-11-25","period":"AM","zone":"z2"}]'::jsonb) r));
select pg_temp.t('refuse: an unknown op', (select r ->> 'reason' = 'Unknown change' from pg_temp.first('[{"op":"swap","sid":"s4","day":"2026-11-25"}]'::jsonb) r));

-- the cap: AM on 24 Nov holds Lee (z1, fixed), Alex (z2), Jo (z3, whole day) — Kim takes the fourth, Ash is refused by the cap, not by a zone
select pg_temp.t('book: the fourth AM slot', (select r ->> 'ok' = 'true' from pg_temp.first('[{"op":"book","sid":"s4","day":"2026-11-24","period":"AM","zone":"z4"}]'::jsonb) r));
select pg_temp.t('refuse: the AM is full at its maximum even with a fifth zone open', (select r ->> 'reason' = 'AM is full (4 of 4).' from pg_temp.first('[{"op":"book","sid":"s7","day":"2026-11-24","period":"AM","zone":"z5"}]'::jsonb) r));
select pg_temp.t('book: the PM still has room (Sam z2, Jo z3 so far)', (select r ->> 'ok' = 'true' from pg_temp.first('[{"op":"book","sid":"s7","day":"2026-11-24","period":"PM","zone":"z4"}]'::jsonb) r));

-- own hours travel with the booking
select pg_temp.t('book: typed hours are stored and logged', (select r -> 'val' -> 'hours' = '{"start":"09:30","end":"15:00"}'::jsonb and r -> 'audit' ->> 'detail' = 'Alex Example 2026-11-26 AM Acute 09:30–15:00' from pg_temp.first('[{"op":"book","sid":"s1","day":"2026-11-26","period":"AM","zone":"z2","hours":{"start":"09:30","end":"15:00"}}]'::jsonb) r));

-- unbook
create temp table t_r2 as select pg_temp.first('[{"op":"unbook","sid":"s1","day":"2026-11-26"}]'::jsonb) as r;
select pg_temp.t('unbook: removes the key, logs it, and the event carries no value', (select r ->> 'ok' = 'true' and jsonb_typeof(r -> 'val') = 'null' and r -> 'audit' ->> 'action' = 'selfroster.unbook' and r -> 'audit' ->> 'detail' = 'Alex Example 2026-11-26' from t_r2)
  and not (select data -> 'cycles' -> 1 -> 'assign' ? 's1|2026-11-26' from org_state where org = 'test-org')
  and (select val is null from roster_events where seq = (select (r ->> 'seq')::bigint from t_r2)));
select pg_temp.t('refuse: nothing to remove', (select r ->> 'reason' = 'Nothing to remove that day.' from pg_temp.first('[{"op":"unbook","sid":"s1","day":"2026-11-26"}]'::jsonb) r));
select pg_temp.t('refuse: a fixed shift, for a staff member', (select r ->> 'reason' = 'Fixed shift — ask your admin to change it.' from pg_temp.first('[{"op":"unbook","sid":"s5","day":"2026-11-24"}]'::jsonb) r));

-- a batch: judged in order, partial success kept
create temp table t_r3 as select pg_temp.call('[{"op":"book","sid":"s1","day":"2026-11-27","period":"PM","zone":"z1"},{"op":"book","sid":"s2","day":"2026-11-27","period":"PM","zone":"z1"},{"op":"unbook","sid":"s1","day":"2026-11-27"},{"op":"book","sid":"s2","day":"2026-11-27","period":"PM","zone":"z1"}]'::jsonb) as r;
select pg_temp.t('batch: four ops, the second refused by the first, the fourth allowed by the third', (select (r ->> 'n')::int = 3 and r -> 'results' -> 0 ->> 'ok' = 'true' and r -> 'results' -> 1 ->> 'reason' = 'That zone was just taken — pick another.' and r -> 'results' -> 2 ->> 'ok' = 'true' and r -> 'results' -> 3 ->> 'ok' = 'true' and (r -> 'results' -> 3 ->> 'i')::int = 3 from t_r3));
select pg_temp.t('batch: the document shows the end state and the log the three steps, newest first', (select data -> 'cycles' -> 1 -> 'assign' -> 's2|2026-11-27' ->> 'zone' = 'z1' and not (data -> 'cycles' -> 1 -> 'assign' ? 's1|2026-11-27') and data -> 'audit' -> 0 ->> 'actor' = 's2' and data -> 'audit' -> 1 ->> 'action' = 'selfroster.unbook' and data -> 'audit' -> 2 ->> 'actor' = 's1' from org_state where org = 'test-org'));
select pg_temp.t('batch: three event rows for the three applied ops', (select count(*) = 3 from roster_events where key in ('s1|2026-11-27', 's2|2026-11-27')));

-- marks and the calendar token through the same call (16 Oct 2026)
select pg_temp.t('mark: a CST day on the person''s own day', (select r ->> 'ok' = 'true' and r -> 'val' = '{"kind":"cst"}'::jsonb and r -> 'audit' ->> 'action' = 'selfroster.cst' from pg_temp.first('[{"op":"mark","sid":"s7","day":"2026-12-02","kind":"cst"}]'::jsonb) r));
select pg_temp.t('mark: an unavailable mark, logged as such', (select r ->> 'ok' = 'true' and r -> 'val' = '{"kind":"leave","code":"UA"}'::jsonb and r -> 'audit' ->> 'action' = 'selfroster.ua' and r -> 'audit' ->> 'detail' = 'Ash Example 2026-12-03 UA' from pg_temp.first('[{"op":"mark","sid":"s7","day":"2026-12-03","kind":"leave","code":"UA"}]'::jsonb) r));
select pg_temp.t('mark: a mark replaces the person''s own booked shift, never a fixed one', (select r ->> 'ok' = 'true' from pg_temp.first('[{"op":"mark","sid":"s2","day":"2026-11-24","kind":"cst"}]'::jsonb) r) and (select r ->> 'reason' = 'Fixed shift — ask your admin to change it.' from pg_temp.first('[{"op":"mark","sid":"s5","day":"2026-11-24","kind":"cst"}]'::jsonb) r));
select pg_temp.t('mark: a bad kind or code is refused', (select r ->> 'reason' = 'Unknown mark.' from pg_temp.first('[{"op":"mark","sid":"s7","day":"2026-12-04","kind":"party"}]'::jsonb) r) and (select r ->> 'reason' = 'Unknown leave code.' from pg_temp.first('[{"op":"mark","sid":"s7","day":"2026-12-04","kind":"leave","code":"x y"}]'::jsonb) r));
create temp table t_r4 as select pg_temp.first('[{"op":"unbook","sid":"s7","day":"2026-12-02"}]'::jsonb) as r;   -- the check reads the document in a statement of its own: one statement sees one snapshot
select pg_temp.t('unbook: removes a CST day or a mark too, logged as marked off', (select r ->> 'ok' = 'true' and r -> 'audit' ->> 'action' = 'selfroster.off' from t_r4) and not (select data -> 'cycles' -> 1 -> 'assign' ? 's7|2026-12-02' from org_state where org = 'test-org'));
create temp table t_ics as select pg_temp.first('[{"op":"ics","sid":"s7","token":"0123456789abcdef0123456789abcdef0123"}]'::jsonb) as r;
select pg_temp.t('ics: the first token is minted into the person''s staff row, with no event row', (select r ->> 'ok' = 'true' and r -> 'val' ->> 'token' = '0123456789abcdef0123456789abcdef0123' from t_ics) and (select s ->> 'icsToken' from org_state, jsonb_array_elements(data -> 'staff') s where org = 'test-org' and s ->> 'id' = 's7') = '0123456789abcdef0123456789abcdef0123' and (select count(*) = 0 from roster_events where org = 'test-org' and key like 'ics%'));
select pg_temp.t('ics: a second mint hands back the first token and writes nothing', (select r -> 'val' ->> 'token' = '0123456789abcdef0123456789abcdef0123' from pg_temp.first('[{"op":"ics","sid":"s7","token":"ffffffffffffffffffffffffffffffffffff"}]'::jsonb) r));
select pg_temp.t('ics: a malformed token is refused', (select r ->> 'reason' = 'Bad token.' from pg_temp.first('[{"op":"ics","sid":"s7","token":"nope"}]'::jsonb) r));
select pg_temp.t('audit: the document keeps at most 400 lines', (select jsonb_array_length(data -> 'audit') <= 400 from org_state where org = 'test-org'));
select pg_temp.t('timeout: signed-in calls may queue for 20 s', (select setconfig::text like '%statement_timeout=20s%' from pg_db_role_setting rs join pg_roles r on r.oid = rs.setrole where r.rolname = 'authenticated'));

-- ---- as Sam, an admin member ----
select set_config('request.jwt.claims', '{"email":"sam@example.org"}', false);
select pg_temp.t('unbook: an admin member may remove a fixed shift', (select r ->> 'ok' = 'true' from pg_temp.first('[{"op":"unbook","sid":"s5","day":"2026-11-24"}]'::jsonb) r));

-- ---- row-level security on the event log: Pat (other-org only) sees none of test-org's events ----
select set_config('request.jwt.claims', '{"email":"pat@example.org"}', false);
set role authenticated;
create temp table t_rls as select org, count(*) as c from roster_events group by org;
reset role;
select pg_temp.t('rls: a member of another group reads none of these events', (select count(*) = 0 from t_rls where org = 'test-org'));
select set_config('request.jwt.claims', '{"email":"alex@example.org"}', false);
set role authenticated;
create temp table t_rls2 as select org, count(*) as c from roster_events group by org;
reset role;
select pg_temp.t('rls: a member reads their own group''s events', (select c > 0 from t_rls2 where org = 'test-org'));
do $$ declare m text; begin
  set role authenticated;
  begin insert into roster_events(org, cycle, key) values ('test-org', 'c1', 'x|y'); m := 'inserted'; exception when others then m := sqlstate; end;
  reset role;
  perform pg_temp.t('rls: a member cannot write the event log directly', m = '42501');
end $$;

-- ---- realtime and the trigger ----
select pg_temp.t('realtime: the publication carries roster_events and org_events, not org_state', (select array_agg(tablename::text order by tablename) = array['org_events', 'roster_events'] from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'));
update org_state set updated = now() where org = 'test-org';
select pg_temp.t('ping: a whole-document save pings org_events again', (select n from org_events where org = 'test-org') = 2);
select pg_temp.t('marker: every whole-document write leaves a marker row in the event stream, and the function''s own writes do not', (select count(*) from roster_events where org = 'test-org' and key = '') = 2 and (select count(*) from roster_events where org = 'test-org' and key = '' and seq > (select max(seq) from roster_events where org = 'test-org' and key <> '')) = 1);
select pg_temp.t('rls: every table in public carries row-level security', (select count(*) = 0 from public.tables_without_rls()));
select pg_temp.t('grants: the server key may read the group registry', has_table_privilege('service_role', 'public.orgs', 'select') and has_table_privilege('service_role', 'public.hospitals', 'select'));
select pg_temp.t('fills: a typed shift fills what its type says, an untyped one its own half', public.roster_fills('[{"id":"FULL","fills":["AM","PM"]}]'::jsonb, '{"period":"AM","type":"FULL"}'::jsonb) = array['AM','PM'] and public.roster_fills('[{"id":"FULL","fills":["AM","PM"]}]'::jsonb, '{"period":"PM"}'::jsonb) = array['PM'] and public.roster_fills(null, '{"period":"AM","type":"FULL"}'::jsonb) = array['AM']);
select pg_temp.t('truthy: javascript rules', public.roster_truthy('true') and not public.roster_truthy('false') and public.roster_truthy('1') and not public.roster_truthy('0') and public.roster_truthy('"x"') and not public.roster_truthy('""') and not public.roster_truthy('null') and not public.roster_truthy(null) and public.roster_truthy('{}'));
