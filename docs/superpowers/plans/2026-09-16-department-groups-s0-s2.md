# Department groups S0–S2 (add a group, the digest, Who's on) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin make a staff group from inside the app, let every group publish a small, safe extract of its live roster, show one **Who's on** board across all the hospital's groups from the Day board, and show a scribe's booking sheet which consultants hold the shift being picked.

**Architecture:** One SQL file adds a `hospitals` registry (ids, not free text), a `create_group` function, a `board_slice` table with one row per (hospital, group) under row-level security, and two read functions. In the app, a pure builder `buildDigest(st,cyc,todayISO)` turns a published cycle into the digest from the cycle passed in (never from what is on screen), so every device makes the same bytes; `digestPublish()` writes it only when its fingerprint changed, on its own 30-second timer, after a cloud write lands or a remote change arrives. The Day board gains a *This group · Whole department* switch that renders the hospital's digests a column per group; the day sheet reads the same cache for the sibling groups a scribe's admin chose. Adding a group is one sheet that calls `create_group`, then reloads through the existing `myrosta_org` switch path so no cache can bleed between groups.

**Tech Stack:** Single-file vanilla JS app (`app.html`), tests under JavaScriptCore via `osascript` (`python3 tests/run.py`), Python lints in `tests/run.py`, Supabase (Postgres + RLS) SQL pasted by the owner, a browser page `supabase/isolation-test.html` for the RLS probes.

**Spec:** `docs/superpowers/specs/2026-09-16-department-groups-s0-s2-design.md` (read it first; this plan argues from it). Programme: `docs/superpowers/specs/2026-09-16-staff-group-modules-programme.md`.

## Global Constraints

- Werribee sees no change: one group in its hospital means no department switch, no board row, no checklist row, and the Group card shows "No other staff group … yet". Every existing test passes unchanged.
- Only display name, slot, period, times, on-call, call-ins and an *away* flag ever leave a group. Never emails, mobiles, payroll ids, EFT, quota, requests, notes, tokens, leave codes or reasons. CST days appear nowhere.
- `buildDigest` never calls `active()`, `cset()`, `effShiftTimes()`, `periodTime()`, `perName()` or `CTX()`; it reads the cycle it is given. (`zoneLabel(z,p)` takes the zone object and reads nothing else, so it is safe.)
- The digest has its **own** timer (`_digestTimer`) and hash (`_digestHash`). It never touches `_cloudTimer`, `_savePending`, `_orgUpdated` or `_remoteBase`.
- Only cycles with `status==="published"` and not archived are published (a rolling roster that is live is `published`).
- The Edge Functions (`supabase/functions/*`) are not edited. Nothing calls notify-shifts.
- Every `logAudit` call passes its key as a **string literal first argument**, and every key has an `AUDIT_WORDS` sentence. New keys: `settings.board`, `group.create`.
- Copy: plain words, sentence case, no emoji or arrow glyphs inside buttons, notes or tags (a lint checks this). Every name from another group is rendered through `escapeHTML` and was stripped of `<`, `>` and control characters when built.
- Test dates are relative to today (`iso(addDays(new Date(),n))`). Never hardcode a future date.
- `deploy/demo.html` must equal what `python3 tools/build-demo.py` produces from the current `app.html` (a lint checks this), so run the build before the tests in every task. `deploy/app.html` and `preview.html` are synced in Task 8.
- `tests/oncall-golden.js` must pass unchanged and is **never regenerated** to make a test pass.
- SWIFT's files in `~/Desktop/Myrosta site 2/` hold personal data and never enter the repo.
- Commit on `main`; do not push (the owner pushes from GitHub Desktop).

## Decisions this plan takes where the spec is silent or over-specified

1. **The board renders by template strings escaped through `escapeHTML`**, as every other screen in the app does, not by `createElement`/`textContent`: the test DOM cannot observe an element tree, and the builder already strips markup from names. A test proves a hostile name arrives escaped. The spec's "six raw `nameOf()` sites" no longer exist — the 19 Aug XSS pass removed them (a grep for `${nameOf(` outside `escapeHTML` finds none), so there is nothing to fix.
2. **`board_for_org` and `hospital_groups` return no rows for an org the caller is not in**, rather than raising: the same guarantee, a plain SQL function, and the probe asserts "0 rows".
3. **Group labels come from the registry** (`hospital_groups`, `board_for_org`), never from a digest; the digest carries only the role noun.
4. **A day with nobody on and nobody away is left out of the digest**; the board shows "Nobody rostered." for a group that published but has no entry for that day, and "haven't published to the board" for one with no row.
5. **The board's own column is always the live local roster**, publish switch on or off, so an admin previewing the department view sees their group as it is.
6. **The department view browses yesterday to fourteen days ahead** (`_deptDate`, per device); the digest still carries the whole live cycle so a scribe planning weeks ahead sees the consultants.
7. **The create-group sheet's button reads "Create <name>"** as the name is typed, and "Create the group" before that; server errors are put into plain words by `groupErrText`.
8. **A created group's record already exists** (`create_group` inserts an empty `org_state` row), so the first-load naming runs in both branches of `handleAuth`: after the remote `{}` is normalised, and after a local seed.
9. **The isolation test's own-row probe is non-destructive**: it writes a group's current digest back to itself, and is skipped (never written) for a group that has not published yet.
10. **The board prints in the page's own orientation**, its columns narrowing to fit; a forced landscape `@page` rule would turn every other printout (Fairness, Capacity check) landscape too. The handover sheet is one page for a department of up to five groups.
11. **The release note is dated 16 Sep 2026.** If the release ships on another day, change `2026-09-16` in `WHATS_NEW`, `const BUILD` and the changelog heading together (a lint keeps them equal).

## How to edit `app.html`, `tests/suite.js`, `supabase/isolation-test.html` and the docs

`app.html` is one large file with very long lines, and much of its script writes characters as JavaScript escapes (a backslash, `u`, four hex digits). Tool parameters can silently turn those escapes into the characters themselves, so an exact-match edit then fails, or writes the wrong thing. Make every edit through this helper, and write each such escape as `@U@` followed by the four hex digits (`@U@2019` for a right single quote, `@U@2014` for an em dash, `@U@2013` for an en dash, `@U@00b7` for a middle dot, `@U@2026` for an ellipsis). The helper swaps `@U@` for backslash-u in both the old and the new text, and refuses to write unless each old text occurs exactly once. Some old texts below contain the characters themselves (an em dash, a middle dot, an arrow), because that is how the file writes them on those lines; copy them exactly.

- [ ] **Create the helper once**, in your scratchpad directory (called `$SP` below):

```python
# $SP/rep.py  —  usage: python3 $SP/rep.py <file to edit> <edits file>
import pathlib, sys
BS = chr(92)
target = pathlib.Path(sys.argv[1]); text = [target.read_text(encoding="utf-8")]; n = [0]
def fix(t): return t.replace("@U@", BS + "u")
def rep(old, new, cnt=1):
    old = fix(old); new = fix(new); c = text[0].count(old)
    if c != cnt: sys.exit("expected %d, found %d: %r" % (cnt, c, old[:160]))
    text[0] = text[0].replace(old, new); n[0] += 1
exec(open(sys.argv[2], encoding="utf-8").read())
target.write_text(text[0], encoding="utf-8"); print("replacements:", n[0])
```

An edits file is plain Python calling `rep(old, new)`; both arguments are raw triple-quoted strings. If `rep.py` stops with "expected 1, found 0", nothing was written: re-read that spot of the file and correct the old text; never loosen the count.

**If `python3` or `git` stops with "You have not agreed to the Xcode license agreements"**, follow the memory note `reference-xcode-licence-workaround` (a uv Python 3.12 and GitHub Desktop's git through two wrappers first on `PATH`), or ask the owner to run `sudo xcodebuild -license accept`.

**Running the tests:** always `python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"`. The last line reads `N passed, M failed  (app.html)`; a `HARNESS ERROR:` line means the suite threw before it finished and the count is meaningless.

---

### Task 1: The database file and the isolation test v4

**Files:**
- Create: `supabase/prod-department.sql`, `supabase/staging-department.sql`
- Modify: `supabase/isolation-test.html` (the probe list, before `const fails=`)

**Interfaces:**
- Consumes: `is_member(org)`, `is_admin_member(org)`, the `orgs`, `org_state` and `roster_members` tables from `supabase/prod-multiorg.sql`.
- Produces: table `hospitals(id,name)`; column `orgs.hospital_id`; function `slug_of(text)`; **`my_orgs()` with a fifth column `hospital_id`**; `create_group(p_sibling_org,p_label,p_noun,p_admin2_email) returns text` (the new org id); table `board_slice(hospital_id,org,data,updated)`; `hospital_groups(p_org) returns (org,label)`; `board_for_org(p_org) returns (org,label,hospital_id,hospital,data,updated)`; `tables_without_rls() returns setof text`.

Nothing here can be run on this Mac: there is no Postgres. The owner pastes the file into the Supabase SQL editor (staging first, then production) and runs the isolation page as two users. Your job is a file whose every statement is idempotent and whose shape the app and the probes rely on.

- [ ] **Step 1: Create `supabase/prod-department.sql`:**

```sql
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
```

- [ ] **Step 2: Create `supabase/staging-department.sql`** — the same file with fixtures for the probes: a second hospital, a third org in it, and User B as its admin. Copy `prod-department.sql` and add this block at the very top (before section 1, so the backfill gives the new org its hospital id) and the member rows at the very end:

```sql
-- ============================================================================
-- STAGING copy of prod-department.sql with fixtures: 'test-orgC' under a second hospital,
-- administered by User B, so the probes can prove one hospital never sees another.
-- ============================================================================
insert into orgs(org,label,hospital) values ('test-orgC','Consultants','Other Hospital')
  on conflict (org) do update set label=excluded.label, hospital=excluded.hospital;
insert into org_state(org,data,updated) values ('test-orgC','{}'::jsonb, now()) on conflict do nothing;
insert into roster_members(org,email,role,name) values ('test-orgC','USERB@EXAMPLE.COM','admin','User B')
  on conflict (org,email) do update set role='admin';
```

Then the whole of `prod-department.sql` follows unchanged. (Sections 1–7 are byte-identical between the two files; a reviewer diffs them.)

- [ ] **Step 3: Add the v4 probes to `supabase/isolation-test.html`.** Create `$SP/dg1-iso.py`:

```python
rep(r'''  const fails=results.filter(x=>x===false).length;''', r'''  // --- v4 probes: the department board and add-a-group (supabase/prod-department.sql) ---
  { const bare=window.supabase.createClient($("url").value.trim(),$("key").value.trim(),{auth:{persistSession:false,storageKey:"probe-anon4"}});
    for(const tbl of ["board_slice","hospitals"]){ const r=await bare.from(tbl).select("*").limit(5);
      results.push(row("UNAUTHENTICATED read of "+tbl,"0 rows / denied", (!!r.error)||(r.data&&r.data.length===0), r.error?r.error.message:((r.data||[]).length+" row(s) visible"+((r.data||[]).length?" — RLS MISSING OR DISABLED":"")))); } }
  { const me=myOrgs.find(o=>o.org===own)||{}, hid=me.hospital_id||null;
    if(!hid) row("board probes","—",null,"my_orgs() carries no hospital_id — run prod-department.sql first, then re-run");
    else {
      const cur=await c.from("board_slice").select("data").eq("org",own).maybeSingle();   // NON-DESTRUCTIVE: a group's own digest is written back to itself; a group that never published is left alone
      if(cur.error||!cur.data) row("UPSERT own board_slice row","allow (member)",null,"no board row yet — switch on Publish to the department board in the app, then re-run");
      else { const w=await c.from("board_slice").upsert({hospital_id:hid,org:own,data:cur.data.data},{onConflict:"hospital_id,org"}).select("org");
        results.push(row("UPSERT own board_slice row (no-op write)","allow (member)", !w.error&&(w.data||[]).length===1, w.error?w.error.message:"1 row — digest unchanged")); }
      if(single){ const w2=await c.from("board_slice").upsert({hospital_id:hid,org:other,data:{v:1,noun:"forged",days:{}}},{onConflict:"hospital_id,org"}).select("org");
        results.push(row("UPSERT the other org's board_slice row","denied", !!w2.error||(w2.data||[]).length===0, w2.error?w2.error.message:((w2.data||[]).length+" row(s) — FORGERY ALLOWED"))); }
      else row("UPSERT the other org's board_slice row","denied",null,"user is in both orgs — use User A/B for this probe");
      const b=await c.rpc("board_for_org",{p_org:own}); const brows=b.data||[];
      results.push(row("board_for_org(own) returns only this hospital's rows","same hospital", !b.error&&brows.every(x=>x.hospital_id===hid), b.error?b.error.message:(brows.length+" row(s): "+(brows.map(x=>x.org).join(", ")||"none"))));
      const b2=await c.rpc("board_for_org",{p_org:"test-orgC"}); results.push(row("board_for_org(an org I'm not in)","0 rows", !b2.error&&(b2.data||[]).length===0, b2.error?b2.error.message:((b2.data||[]).length+" row(s)")));
      const hg=await c.rpc("hospital_groups",{p_org:own}); const gs=(hg.data||[]).map(x=>x.org);
      results.push(row("hospital_groups(own) lists my own group","includes own", !hg.error&&gs.includes(own), hg.error?hg.error.message:("groups: "+gs.join(", "))));
      if(single){ const cg=await c.rpc("create_group",{p_sibling_org:other,p_label:"Probe group",p_noun:"probe",p_admin2_email:null});
        results.push(row("create_group via an org I don't admin","denied", !!cg.error, cg.error?cg.error.message:("CREATED "+cg.data+" — a non-admin made a group"))); }
      else row("create_group via an org I don't admin","denied",null,"user is in both orgs — use User A/B for this probe");
      const nr=await c.rpc("tables_without_rls"); const bad=nr.data||[];
      results.push(row("every table in public has row-level security","none without", !nr.error&&bad.length===0, nr.error?nr.error.message:(bad.length?("WITHOUT RLS: "+bad.join(", ")):"all covered"))); } }
  const fails=results.filter(x=>x===false).length;''')
```

- [ ] **Step 4: Apply it, and check the SQL file for the objects the app and the probes rely on.**

```bash
python3 $SP/rep.py supabase/isolation-test.html $SP/dg1-iso.py
python3 - <<'PYEOF'
import pathlib, re
root = pathlib.Path("/Users/ranjithkandavelu/Desktop/Claude/Myrosta")
prod = (root/"supabase"/"prod-department.sql").read_text(encoding="utf-8")
stag = (root/"supabase"/"staging-department.sql").read_text(encoding="utf-8")
need = ["create table if not exists hospitals", "add column if not exists hospital_id", "function public.slug_of", "returns table(org text, role text, label text, hospital text, hospital_id text)",
        "function public.create_group(p_sibling_org text, p_label text, p_noun text, p_admin2_email text default null)", "create table if not exists board_slice", "revoke delete on public.board_slice",
        "trigger board_slice_stamp", 'policy "board read"', 'policy "board write"', "function public.hospital_groups(p_org text)", "function public.board_for_org(p_org text)", "function public.tables_without_rls()"]
missing = [n for n in need if n not in prod]
assert not missing, missing
i = stag.index("-- ---------- 1. hospitals are ids"); assert prod[prod.index("-- ---------- 1. hospitals are ids"):] in stag, "staging body differs from prod"
assert "test-orgC" in stag and "test-orgC" not in prod
print("sql ok:", len(need), "objects; staging body identical to prod")
PYEOF
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, `sql ok: 13 objects; staging body identical to prod`, then `861 passed, 0 failed` (the app is untouched).

- [ ] **Step 5: Commit.**

```bash
git add supabase/prod-department.sql supabase/staging-department.sql supabase/isolation-test.html
git commit -q -m "Department groups: the SQL for hospitals as ids, add-a-group, the board table and its readers, with the isolation page's v4 probes. Not yet run anywhere" && git log --oneline -1
```

---

### Task 2: State and the pure digest builder

**Files:**
- Modify: `app.html` (the org variables and `resolveOrg`, `normalize`, the Day board variables, a new digest section before `function ocMark(`)
- Test: `tests/suite.js` (new `department groups` block)

**Interfaces:**
- Consumes: `datesOf(cycle)`, `iso`, `addDays`, `parseISO`, `zoneLabel(z,p)`, `typeOf(cyc,sh)`, `fillsOf(cyc,sh)`, `typeTime(t)`, `ocWindows(cyc)`, `ocHolder(cyc,isoD,winId)`, `ocTime(w)`, `ciOnDay(cyc,isoD)`.
- Produces:
  - `_orgHospitalId` (string, `""` until `my_orgs()` returns a fifth column); `_setOrgMeta(me)` sets `_orgLabel`, `_orgHospital`, `_orgHospitalId` from one `my_orgs()` row.
  - `S.board = {publish:boolean, show:[orgId]}` seeded by `normalize()`.
  - `dailyScope` (`"group"|"dept"`) and `_deptDate` (per device); `_digestHash`, `_digestTimer`, `_hospGroups`, `_hospGroupsAt`, `_boardCache={rows,fetched}`, `_boardBusy`, `_boardTick` (declared here, used by later tasks).
  - `digestClean(s) → string` (no `<`, `>` or control characters, trimmed, at most 80); `stableJSON(o) → string` (sorted keys); `digestHash(s) → string`; `digestLive(cyc) → boolean`; `digestDays(cyc,todayISO) → [iso]`; `digestNoun(st) → string`.
  - `buildDigest(st,cyc,todayISO) → {v:1, noun, days:{[iso]:{on:[{n,r,p,t,oc?,ci?}], away:[name]}}}`; `buildDigestAll(st,todayISO)` merges every published cycle earliest first and applies `digestTrim` (120 KB cap, drops days from the far end, sets `truncated:true`).

- [ ] **Step 1: Write the failing tests.** Create `$SP/dg2-suite.py`:

```python
rep(r'''  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''', r'''  // ---- department groups: add a staff group in-app, the department digest, Who's on across groups.
  // Spec: docs/superpowers/specs/2026-09-16-department-groups-s0-s2-design.md. Dates are relative to today, as the digest is.
  (function(){
    var keep={S:S,co:cloudOn,as:authState,org:_org,hid:_orgHospitalId,lab:_orgLabel,hosp:_orgHospital,sb:_sb,ra:_realAdmin,st:setTimeout,ct:clearTimeout,toast:toast,hg:_hospGroups,bc:_boardCache,bb:_boardBusy,dh:_digestHash,dt:_digestTimer,dd:_deptDate,ds:dailyScope,dm:dailyMode,dday:dailyDate,mob:isMobile,rl:location.reload,sr:_srSid,dsh:_daySheet,sp:_sheetPeriod,stab:_setupTab};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0);
    var calls=[], said=[], c=null;
    var FULL={id:"full",code:"FULL",label:"Full",start:"10:00",end:"22:00",fills:["AM","PM"],on:true,book:true,builtin:null};
    function fakeSb(){ return { from:function(t){ return { upsert:function(row,opt){ calls.push({t:t,op:"upsert",row:JSON.parse(JSON.stringify(row)),opt:opt||null}); return new Promise(function(){}); } }; },
                              rpc:function(name,args){ calls.push({op:"rpc",name:name,args:JSON.parse(JSON.stringify(args||{}))}); return new Promise(function(){}); } }; }
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""},{id:"z2",name:"Resus",am:true,pm:true,pmLabel:"Resus late"}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1},{id:"s3",name:"Ky Tran",quota:20,eft:1},{id:"s4",name:"Jo Park",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:!!o.archived,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true}},assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"admin",tab:o.tab||"daily",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],branding:{name:"Nurses",roleNoun:"nurse"},board:{publish:!!o.publish,show:o.show||[]}};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; calls.length=0; said.length=0;
      _org="h1-nurses"; _orgHospitalId=(o.hospital===undefined)?"h1":o.hospital; _orgLabel="Nurses"; _orgHospital="Test Hospital"; authState="in"; _realAdmin=(S.viewAs==="admin"); _sb=fakeSb();
      _digestHash=""; _digestTimer=null; _hospGroups=o.groups||null; _boardCache={rows:[],fetched:0}; _boardBusy=false; _deptDate=null; dailyScope="group"; dailyMode="day"; dailyDate=null; _srSid=null; _daySheet=null; _sheetPeriod="AM"; }
    function put(sid,n,period,zone,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z1"}; if(type)v.type=type; c.assign[sid+"|"+D(n)]=v; return v; }
    function bytes(){ return stableJSON(buildDigestAll(S,T0)); }
    function ups(){ return calls.filter(function(x){ return x.op==="upsert"; }); }   // the board writes alone: a render can also ask for the hospital's groups
    var EN=String.fromCharCode(8211), BEL=String.fromCharCode(7);
    cloudOn=function(){ return true; }; toast=function(m){ said.push(String(m)); }; isMobile=function(){ return false; };
    try{
      // ---- state and the pure builder
      T("digest: a fresh group starts with the board off and nothing chosen to show, and the sign-in row names the hospital", (function(){
        state(); delete S.board; normalize(); var seeded=JSON.stringify(S.board)==='{"publish":false,"show":[]}';
        _setOrgMeta({label:"Nurses",hospital:"H",hospital_id:"h9"}); var a=_orgHospitalId==="h9"&&_orgLabel==="Nurses"&&_orgHospital==="H";
        _setOrgMeta({label:"Nurses",hospital:"H"}); var b=_orgHospitalId==="";
        return seeded && a && b && dailyScope==="group"; })());
      T("digest: only a published cycle is published, from yesterday to the end of the cycle", (function(){
        var out=[]; ["draft","open","closed"].forEach(function(st){ state({status:st}); put("s1",2); out.push(Object.keys(buildDigestAll(S,T0).days).length); });
        state({archived:true}); put("s1",2); out.push(Object.keys(buildDigestAll(S,T0).days).length);
        state(); for(var i=-7;i<35;i++)c.assign["s1|"+D(i)]={kind:"clinical",period:"AM",zone:"z1"}; var days=Object.keys(buildDigestAll(S,T0).days).sort();
        return out.join(",")==="0,0,0,0" && days.length===36 && days[0]===D(-1) && days[days.length-1]===D(34) && buildDigestAll(S,T0).v===1 && buildDigestAll(S,T0).noun==="nurse"; })());
      T("digest: an entry carries name, slot, period and times only; a whole-day shift stands in both halves with the evening's own zone name", (function(){
        state(); c.settings.shiftTypes=shiftTypesOf(c).concat([FULL]); put("s1",2); put("s2",2,"AM","z2","full");
        var day=buildDigestAll(S,T0).days[D(2)], on=day.on, keys={}; on.forEach(function(e){ Object.keys(e).forEach(function(k){ keys[k]=1; }); });
        var ava=on.filter(function(e){ return e.n==="Ava Ng"; })[0], sam=on.filter(function(e){ return e.n==="Sam Lee"; });
        return on.length===3 && ava.r==="Triage" && ava.p==="AM" && ava.t==="10:00"+EN+"17:00" && sam.length===2 && sam[0].p==="AM" && sam[0].r==="Resus" && sam[1].p==="PM" && sam[1].r==="Resus late" && sam[0].t==="10:00"+EN+"22:00" &&
               Object.keys(keys).sort().join(",")==="n,p,r,t" && day.away.length===0; })());
      T("digest: on-call rides on the shift it follows, a window taken alone is its own line, and a call-in shows its logged hours", (function(){
        state(); c.settings.oncallWindows=[{id:"wf",label:"Late on-call",start:"22:00",end:"23:00",book:false,from:{zones:["z2"],period:"PM"}},{id:"w1",label:"On call",start:"22:00",end:"01:00",book:true},{id:"w2",label:"Call-in",start:"10:00",end:"22:00",book:true,chosen:true,usual:4}];
        put("s1",3,"PM","z2"); c.oncall={}; c.oncall[D(3)+"|w1"]="s3"; c.callins={}; c.callins[D(3)+"|w2|s4"]={start:"14:00",end:"18:00"};
        var on=buildDigestAll(S,T0).days[D(3)].on, ava=on.filter(function(e){ return e.n==="Ava Ng"; })[0], ky=on.filter(function(e){ return e.n==="Ky Tran"; })[0], jo=on.filter(function(e){ return e.n==="Jo Park"; })[0];
        return on.length===3 && ava.oc===true && ava.p==="PM" && ky.oc===true && ky.p==="" && ky.r==="" && ky.t==="22:00"+EN+"01:00" && jo.ci===true && jo.t==="14:00"+EN+"18:00" && jo.oc===undefined; })());
      T("digest: leave and unavailable mark a person away by name only, and a CST day appears nowhere", (function(){
        state(); S.leave.push({id:"lv1",staffId:"s1",from:D(2),to:D(4),code:"AL",status:"approved",reason:"secret"}); c.assign["s2|"+D(3)]={kind:"leave",code:"UA"}; c.assign["s3|"+D(3)]={kind:"cst"}; put("s4",3);
        var d=buildDigestAll(S,T0), day=d.days[D(3)], b=stableJSON(d);
        return day.away.join(",")==="Ava Ng,Sam Lee" && day.on.length===1 && day.on[0].n==="Jo Park" && b.indexOf("Ky Tran")<0 && b.indexOf("AL")<0 && b.indexOf("secret")<0 && b.indexOf("UA")<0; })());
      T("digest: two devices holding the staff in a different order, or looking at different cycles, produce the same bytes", (function(){
        state(); put("s1",2); put("s3",2,"PM","z2"); put("s2",5); var a=bytes(); S.staff.reverse(); var b=bytes(); S.activeId="nope"; var c2=bytes(); S.activeId="cc";
        return a===b && a===c2 && a.length>50; })());
      T("digest: a hostile name arrives without its markup", (function(){
        state(); S.staff[0].name='<b onload="x">Ava</b>'+BEL; put("s1",2); var b=bytes();
        return b.indexOf("<")<0 && b.indexOf(">")<0 && b.indexOf(BEL)<0 && b.indexOf('b onload=\\"x\\"Ava/b')>=0 && digestClean(null)==="" && digestClean("  a  ")==="a"; })());
      T("digest: a roster too big for the board is cut at the far end, and says so", (function(){
        state(); var big="Consultant with a very long name indeed, the kind that fills a whiteboard by itself"; S.staff=[]; c.roles={};
        for(var i=0;i<40;i++){ var id="p"+i; S.staff.push({id:id,name:big+" "+i,quota:20,eft:1}); c.roles[id]={in:true}; for(var n=-7;n<35;n++){ c.assign[id+"|"+D(n)]={kind:"clinical",period:(n%2?"AM":"PM"),zone:"z1"}; } }
        var d=buildDigestAll(S,T0), keys=Object.keys(d.days).sort();
        return d.truncated===true && stableJSON(d).length<=120*1024 && keys[0]===D(-1) && keys.length>5 && keys.length<36 && keys.every(function(k,i){ return k===D(-1+i); }); })());
      T("digest: someone not on the cycle's roster is neither on nor away, whatever leave they hold", (function(){
        state(); c.roles.s2={in:false}; delete c.roles.s3; put("s1",3);
        S.leave.push({id:"lv2",staffId:"s2",from:D(2),to:D(4),code:"AL",status:"approved"}); S.leave.push({id:"lv3",staffId:"s3",from:D(2),to:D(4),code:"AL",status:"approved"}); S.leave.push({id:"lv4",staffId:"s4",from:D(3),to:D(3),code:"AL",status:"approved"});
        var day=buildDigestAll(S,T0).days[D(3)], b=bytes();
        return day.away.join(",")==="Jo Park" && day.on.length===1 && day.on[0].n==="Ava Ng" && b.indexOf("Sam Lee")<0 && b.indexOf("Ky Tran")<0; })());
      T("digest: two published cycles merge earliest first, and a day is published once", (function(){
        state(); put("s1",2); var c2={id:"c2",cycle:{start:D(0),weeks:6},status:"published",archived:false,settings:c.settings,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true}},assign:{}};
        c2.assign["s2|"+D(2)]={kind:"clinical",period:"PM",zone:"z2"}; c2.assign["s2|"+D(40)]={kind:"clinical",period:"AM",zone:"z1"}; S.cycles.push(c2);
        var d=buildDigestAll(S,T0); return d.days[D(2)].on.length===1 && d.days[D(2)].on[0].n==="Ava Ng" && !!d.days[D(40)] && d.days[D(40)].on[0].n==="Sam Lee" && d.days[D(40)].on.length===1; })());

      // ---- department groups: later tasks add their tests above this line
    } finally { S=keep.S; cloudOn=keep.co; authState=keep.as; _org=keep.org; _orgHospitalId=keep.hid; _orgLabel=keep.lab; _orgHospital=keep.hosp; _sb=keep.sb; _realAdmin=keep.ra; setTimeout=keep.st; clearTimeout=keep.ct; toast=keep.toast; _hospGroups=keep.hg; _boardCache=keep.bc; _boardBusy=keep.bb; _digestHash=keep.dh; _digestTimer=keep.dt; _deptDate=keep.dd; dailyScope=keep.ds; dailyMode=keep.dm; dailyDate=keep.dday; isMobile=keep.mob; location.reload=keep.rl; _srSid=keep.sr; _daySheet=keep.dsh; _sheetPeriod=keep.sp; _setupTab=keep.stab; /* department groups: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg2-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line and `860 passed, 1 failed` — the block's `keep` line reads `_orgHospitalId`, which does not exist yet, so the block throws before its first test and the suite's closing test is not reached.

- [ ] **Step 3: Implement.** Create `$SP/dg2-app.py`:

```python
# the hospital id travels with the sign-in
rep(r'''let _org=CLOUD.org, _orgChoices=[], _orgCount=1, _legacyDb=false, _orgLabel="", _orgHospital="", _orgError="", _tabOrg=null;''',
    r'''let _org=CLOUD.org, _orgChoices=[], _orgCount=1, _legacyDb=false, _orgLabel="", _orgHospital="", _orgHospitalId="", _orgError="", _tabOrg=null;''')
rep(r'''function _isMissingFn(e){''',
    r'''function _setOrgMeta(me){ _orgLabel=me.label||""; _orgHospital=me.hospital||""; _orgHospitalId=me.hospital_id||""; }   // my_orgs()'s fifth column names the hospital; a database without it leaves the id empty, so nothing publishes and no department switch appears
function _isMissingFn(e){''')
rep(r'''{ const me=orgs.find(o=>o.org===_org)||{}; _orgLabel=me.label||""; _orgHospital=me.hospital||""; }''',
    r'''_setOrgMeta(orgs.find(o=>o.org===_org)||{});''')
# the group's two board preferences
rep(r'''  if(!Array.isArray(S.openSwaps))S.openSwaps=[]; if(!Array.isArray(S.swapOffers))S.swapOffers=[];   // Ask everyone: the asks, and the shifts colleagues offer back''',
    r'''  if(!Array.isArray(S.openSwaps))S.openSwaps=[]; if(!Array.isArray(S.swapOffers))S.swapOffers=[];   // Ask everyone: the asks, and the shifts colleagues offer back
  if(!S.board||typeof S.board!=="object")S.board={publish:false,show:[]}; S.board.publish=!!S.board.publish; if(!Array.isArray(S.board.show))S.board.show=[];   // the department board: whether this group publishes to it, and which sibling groups its booking sheet shows''')
# the Day board's per-device scope and day
rep(r'''let gapsOn=false, dailyMode="day", dailyDate=null,''', r'''let gapsOn=false, dailyMode="day", dailyDate=null, dailyScope="group", _deptDate=null,''')
# the digest: built from the cycle it is given, sorted, serialised with sorted keys
rep(r'''function ocMark(cyc,sid,isoD,mini){''',
r'''/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------
   Built from the cycle passed in, never from what is on screen, so every device of the group makes the same bytes; entries are sorted and
   the JSON is written with sorted keys for the same reason. Names, slots, periods and times only: never contacts, pay, requests or reasons. */
let _digestHash="", _digestTimer=null, _hospGroups=null, _hospGroupsAt=0, _boardCache={rows:[],fetched:0}, _boardBusy=false, _boardTick=null;
function digestClean(s){ return String(s==null?"":s).replace(/[<>@U@0000-@U@001f@U@007f]/g,"").trim().slice(0,80); }   // a name can never carry markup into another group's screen
function stableJSON(o){ if(o===null||typeof o!=="object")return JSON.stringify(o); if(Array.isArray(o))return "["+o.map(stableJSON).join(",")+"]"; return "{"+Object.keys(o).sort().map(k=>JSON.stringify(k)+":"+stableJSON(o[k])).join(",")+"}"; }
function digestHash(s){ let h=5381; for(let i=0;i<s.length;i++)h=(((h*33)>>>0)^s.charCodeAt(i))>>>0; return h.toString(16)+":"+s.length; }
function digestLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status==="published"; }   // published rounds, or a rolling roster that is live; never a draft or a round still booking
function digestDays(cyc,todayISO){ const from=iso(addDays(parseISO(todayISO),-1)); return datesOf(cyc.cycle).map(iso).filter(d=>d>=from); }   // yesterday to the end of the cycle
function digestNoun(st){ return digestClean((st.branding&&st.branding.roleNoun)||""); }
function buildDigest(st,cyc,todayISO){
  const zones=(cyc.settings&&cyc.settings.zones)||st.zones||[], zl=(zid,p)=>{ const z=zones.find(x=>x.id===zid); return z?digestClean(zoneLabel(z,p)):""; };
  const names={}; (st.staff||[]).forEach(s=>{ names[s.id]=digestClean(s.name); }); const lv=st.leave||[], days={};
  const ids=Object.keys(names).filter(sid=>{ const r=cyc.roles&&cyc.roles[sid]; return !!r&&r.in!==false; }).sort();   // only people on this cycle's roster: someone not in the cycle is neither on nor away, whatever leave they hold
  digestDays(cyc,todayISO).forEach(d=>{ const on=[], away=[];
    ids.forEach(sid=>{ const a=(cyc.assign||{})[sid+"|"+d], carries=ocWindows(cyc).filter(w=>ocHolder(cyc,d,w.id)===sid);
      if(a&&a.kind==="clinical"){ const t=typeOf(cyc,a), f=fillsOf(cyc,a); f.forEach((p,i)=>{ const e={n:names[sid],r:zl(a.zone,p),p:p,t:t?typeTime(t):""}; if(carries.length&&i===f.length-1)e.oc=true; on.push(e); }); }
      else { if((a&&a.kind==="leave")||lv.some(L=>L.staffId===sid&&L.status==="approved"&&L.from<=d&&L.to>=d))away.push(names[sid]);
        carries.forEach(w=>{ on.push({n:names[sid],r:"",p:"",t:ocTime(w),oc:true}); }); } });   // a CST day is neither on nor away
    ciOnDay(cyc,d).forEach(x=>{ if(names[x.sid]!=null)on.push({n:names[x.sid],r:"",p:"",t:ocTime(x.w),ci:true}); });
    const key=e=>(e.p||"")+"|"+(e.r||"")+"|"+(e.n||"")+"|"+(e.t||""); on.sort((x,y)=>key(x)<key(y)?-1:(key(x)>key(y)?1:0)); away.sort();
    if(on.length||away.length)days[d]={on:on,away:away}; });
  return {v:1,noun:digestNoun(st),days:days}; }
function buildDigestAll(st,todayISO){ const days={};   // every published cycle, earliest first; a day appears once
  (st.cycles||[]).filter(digestLive).sort((a,b)=>a.cycle.start<b.cycle.start?-1:(a.cycle.start>b.cycle.start?1:0)).forEach(c=>{ const d=buildDigest(st,c,todayISO).days; Object.keys(d).forEach(k=>{ if(!(k in days))days[k]=d[k]; }); });
  return digestTrim({v:1,noun:digestNoun(st),days:days}); }
function digestTrim(out){ const cap=120*1024, keys=Object.keys(out.days).sort();   // too big for the board: drop days from the far end, and say so
  while(keys.length&&stableJSON(out).length>cap){ delete out.days[keys.pop()]; out.truncated=true; } return out; }
function ocMark(cyc,sid,isoD,mini){''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/dg2-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 6`, then `871 passed, 0 failed` and no lint line.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js
git commit -q -m "Department groups: the hospital id travels with the sign-in, a group carries its board preferences, and buildDigest turns a published cycle into the digest from the cycle it is given: names, slots, periods and times, on-call and call-ins, away by name, sorted and capped" && git log --oneline -1
```

---

### Task 3: Publishing — the digest leaves the group only when its bytes changed

**Files:**
- Modify: `app.html` (the digest section from Task 2, `_syncedOk`, the realtime handler's tail, `AUDIT_WORDS`)
- Test: `tests/suite.js` (the `department groups` block)

**Interfaces:**
- Consumes: Task 2's builder and state; `_sb` (the Supabase client), `cloudOn()`, `authState`, `save()`, `logAudit`, `toastSaved`, `render`.
- Produces:
  - `digestOn() → boolean` (cloud on, signed in, hospital known, `S.board.publish`).
  - `digestSchedule() → boolean` — clears and re-arms `_digestTimer` (30 000 ms → `digestPublish`); false and no timer when `digestOn()` is false. Called from `_syncedOk()` (every landed cloud write, which `setCycleStatus`'s `save()` reaches) and from the realtime handler after a remote change is applied.
  - `digestPublish(force) → Promise|null` — builds `buildDigestAll(S, today)` when the switch is on, or `{v:1,noun,days:{}}` when off and `force`; skips when the hash equals `_digestHash` unless `force`; upserts `{hospital_id,org,data}` into `board_slice` with `{onConflict:"hospital_id,org"}` **before any await**; resets `_digestHash` on an error so the next trigger retries.
  - `setBoardPublish(on)` — writes `S.board.publish`, audits `settings.board`, saves, `digestPublish(true)`, toasts, renders.

- [ ] **Step 1: Write the failing tests.** Create `$SP/dg3-suite.py`:

```python
rep(r'''      // ---- department groups: later tasks add their tests above this line''', r'''      // ---- publishing
      T("publish: the switch on writes the digest once, and the same roster again writes nothing", (function(){
        state({publish:true}); put("s1",2); digestPublish(); var one=ups().length===1&&ups()[0].t==="board_slice", row=ups()[0].row;
        digestPublish(); var still=ups().length===1; put("s2",3); digestPublish();
        return one && row.hospital_id==="h1" && row.org==="h1-nurses" && row.data.v===1 && row.data.noun==="nurse" && !!row.data.days[D(2)] && !("updated" in row) && ups()[0].opt.onConflict==="hospital_id,org" && still && ups().length===2; })());
      T("publish: nothing leaves the group when the switch is off, the cloud is off, the hospital is unknown, or nobody is signed in", (function(){
        state(); put("s1",2); digestPublish(); var off=ups().length===0;
        state({publish:true}); cloudOn=function(){ return false; }; digestPublish(); var nocloud=ups().length===0; cloudOn=function(){ return true; };
        state({publish:true,hospital:""}); digestPublish(); var nohosp=ups().length===0;
        state({publish:true}); authState="login"; digestPublish(); var noauth=ups().length===0; authState="in";
        return off && nocloud && nohosp && noauth && digestOn()===true; })());
      T("publish: switching the board off writes an empty digest at once, and switching it on writes the full one", (function(){
        state({publish:true}); put("s1",2); setBoardPublish(false); var empty=ups().length===1&&JSON.stringify(ups()[0].row.data.days)==="{}"&&S.board.publish===false;
        setBoardPublish(true); var full=ups().length===2&&!!ups()[1].row.data.days[D(2)]&&S.board.publish===true;
        return empty && full && S.audit.filter(function(a){ return a.action==="settings.board"; }).length===2 && said.length===2; })());
      T("publish: the digest waits on its own 30-second timer, never the roster's", (function(){
        state({publish:true}); var got=null; setTimeout=function(fn,ms){ got={fn:fn,ms:ms}; return 7; }; clearTimeout=function(){}; _cloudTimer="keep";
        var armed=digestSchedule(); var own=got&&got.fn===digestPublish&&got.ms===30000&&_digestTimer===7&&_cloudTimer==="keep";
        state(); got=null; var idle=digestSchedule(); var none=got===null&&_digestTimer===null; _cloudTimer=null;
        return armed===true && own && idle===false && none; })());
      T("publish: a landed cloud write queues a publish", (function(){
        state({publish:true}); var got=null; setTimeout=function(fn,ms){ got={fn:fn,ms:ms}; return 8; }; clearTimeout=function(){}; _savePending=false; _syncFlash=null;
        _syncedOk(); return got!==null&&got.fn===digestPublish&&got.ms===30000; })());

      // ---- department groups: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg3-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line and `870 passed, 1 failed` (the first new test calls `digestPublish`, which does not exist yet, and the block stops there).

- [ ] **Step 3: Implement.** Create `$SP/dg3-app.py`:

```python
rep(r'''function ocMark(cyc,sid,isoD,mini){''',
r'''/* ---------- publishing: after a cloud write lands, or a remote change arrives, the digest is rebuilt on its own timer and written only when its bytes changed ---------- */
function digestOn(){ return cloudOn()&&authState==="in"&&!!_orgHospitalId&&!!(S.board&&S.board.publish); }
function digestSchedule(){ clearTimeout(_digestTimer); _digestTimer=null; if(!digestOn())return false; _digestTimer=setTimeout(digestPublish,30000); return true; }   // its own timer: never _cloudTimer, never _savePending
function digestPublish(force){   // everything a stub can observe happens before the first await
  if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in")return null;
  const on=!!(S.board&&S.board.publish); if(!on&&!force)return null;
  const data=on?buildDigestAll(S,iso(new Date())):{v:1,noun:digestNoun(S),days:{}};   // switched off: an empty digest is how a group leaves the board, since delete is revoked
  const h=digestHash(stableJSON(data)); if(h===_digestHash&&!force)return null; _digestHash=h;
  let p=null; try{ p=_sb.from("board_slice").upsert({hospital_id:_orgHospitalId,org:_org,data:data},{onConflict:"hospital_id,org"}); }catch(e){ _digestHash=""; return null; }   // updated is stamped by the server
  return Promise.resolve(p).then(r=>{ if(r&&r.error){ _digestHash=""; console.warn("board",r.error.message||r.error); } return r; }).catch(e=>{ _digestHash=""; console.warn("board",e); }); }
function setBoardPublish(on){ if(!S.board)S.board={publish:false,show:[]}; S.board.publish=!!on; logAudit("settings.board",(on?"publishing to":"left")+" the department board","admin"); save(); digestPublish(true); toastSaved("group"); render(); }
function ocMark(cyc,sid,isoD,mini){''')
# a landed cloud write, and a remote change, both queue a publish
rep(r'''if(was||_syncFlash)syncFlash("saved",1200); }   // cloud write landed''',
    r'''if(was||_syncFlash)syncFlash("saved",1200); digestSchedule(); }   // cloud write landed''')
rep(r'''      bgRender(); } }).subscribe(); }catch(e){ console.error("subscribe",e); } }''',
    r'''      digestSchedule(); bgRender(); } }).subscribe(); }catch(e){ console.error("subscribe",e); } }''')
# the audit sentence
rep(r'''"settings.preset":"Chose a group preset",''', r'''"settings.preset":"Chose a group preset","settings.board":"Changed the department board settings",''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/dg3-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 4`, then `876 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js
git commit -q -m "Department groups: a group that publishes writes its digest to the board only when the bytes changed, thirty seconds after a cloud write lands or a remote change arrives, on its own timer; switching the board off writes an empty digest" && git log --oneline -1
```

---

### Task 4: The hospital's groups, the board cache, the Group card switches and the checklist row

**Files:**
- Modify: `app.html` (the digest section, `brandingCardHTML`, `setupChecklist`, the `setup` wire block)
- Test: `tests/suite.js` (the `department groups` block)

**Interfaces:**
- Consumes: Tasks 2–3; `_sb.rpc`, `bgRender`, `escapeHTML`, `viewSetup`/`_setupTab`, `setupChecklist`.
- Produces:
  - `groupsFetch(force) → Promise|null` — `rpc("hospital_groups",{p_org:_org})` at most every 10 minutes unless forced; fills `_hospGroups=[{org,label}]` and `bgRender()`s.
  - `hospGroups() → [{org,label}]`, `siblingGroups()` (without ours), `deptOn() → boolean` (cloud on, hospital known, two or more groups).
  - `boardFetch(force) → Promise|null` — `rpc("board_for_org",{p_org:_org})` at most every 60 s unless forced, never while one is in flight; fills `_boardCache={rows:boardRowsFrom(data),fetched}`.
  - `boardRowsFrom(list) → [{org,label,data,updated}]` — pure: drops our own row, cleans labels, keeps `data` only when it is an object.
  - `setBoardShow(orgId,on)` — edits `S.board.show`, audits `settings.board`, saves, fetches the board when switching on.
  - `deptCardHTML()` — the *Department board* section of the Group card: `#boardPublish` checkbox and `.boardShow[data-org]` checkboxes (or "No other staff group … yet").
  - Checklist row `key:"board"` ("Publish to the department board"), shown only when `deptOn()`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/dg4-suite.py`:

```python
rep(r'''      // ---- department groups: later tasks add their tests above this line''', r'''      // ---- the hospital's groups and the board cache
      T("groups: the hospital's groups and the board are asked for by this group's own id, and our own row never comes from the cache", (function(){
        state(); groupsFetch(true); var g=calls[0]&&calls[0].op==="rpc"&&calls[0].name==="hospital_groups"&&calls[0].args.p_org==="h1-nurses";
        boardFetch(true); var b=calls[1]&&calls[1].name==="board_for_org"&&calls[1].args.p_org==="h1-nurses"; var busy=boardFetch(true)===null&&calls.length===2;
        state({hospital:""}); var none=groupsFetch(true)===null&&boardFetch(true)===null&&calls.length===0;
        state(); var rows=boardRowsFrom([{org:"h1-nurses",label:"Nurses",data:{v:1},updated:"x"},{org:"h1-consultants",label:"<b>C</b>",data:"bad",updated:null},null]);
        var own=rows.length===1&&rows[0].org==="h1-consultants"&&rows[0].label==="bC/b"&&rows[0].data===null&&rows[0].updated===null;
        return g && b && busy && none && own; })());
      T("groups: the department needs two groups, and only then does Get started ask to publish", (function(){
        state({groups:[{org:"h1-nurses",label:"Nurses"}]}); var one=deptOn()===false&&!setupChecklist().some(function(r){ return r.key==="board"; });
        state({groups:[{org:"h1-nurses",label:"Nurses"},{org:"h1-consultants",label:"Consultants"}]}); var rows=setupChecklist().filter(function(r){ return r.key==="board"; });
        var two=deptOn()===true&&rows.length===1&&rows[0].done===false&&rows[0].anchor==="brandCard";
        S.board.publish=true; var done=setupChecklist().filter(function(r){ return r.key==="board"; })[0].done===true;
        return one && two && done && siblingGroups().length===1 && siblingGroups()[0].org==="h1-consultants"; })());
      T("groups: the Group card offers the publish switch and the sibling groups to show, and each choice is saved and audited", (function(){
        state({groups:[{org:"h1-nurses",label:"Nurses"},{org:"h1-consultants",label:"Consultants"},{org:"h1-scribes",label:"Scribes"}]}); S.tab="setup"; _setupTab="group"; var h=viewSetup();
        var card=h.indexOf('id="boardPublish"')>=0&&h.indexOf('class="boardShow" data-org="h1-consultants"')>=0&&h.indexOf('data-org="h1-scribes"')>=0&&h.indexOf('data-org="h1-nurses"')<0&&h.indexOf("Never contacts, pay or leave reasons")>=0;
        setBoardShow("h1-consultants",true); var on=S.board.show.join(",")==="h1-consultants"&&calls.some(function(x){ return x.op==="rpc"&&x.name==="board_for_org"; });
        setBoardShow("h1-consultants",false); var off=S.board.show.length===0&&S.audit.filter(function(a){ return a.action==="settings.board"; }).length===2;
        state({hospital:""}); _setupTab="group"; var bare=viewSetup().indexOf('id="boardPublish"')<0;
        state({groups:[{org:"h1-nurses",label:"Nurses"}]}); _setupTab="group"; var alone=viewSetup().indexOf("No other staff group at Test Hospital yet")>=0;
        return card && on && off && bare && alone; })());

      // ---- department groups: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg4-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line and `875 passed, 1 failed` (the first new test calls `groupsFetch`, which does not exist yet).

- [ ] **Step 3: Implement.** Create `$SP/dg4-app.py`:

```python
rep(r'''function ocMark(cyc,sid,isoD,mini){''',
r'''/* ---------- the hospital's groups and the board rows: read once, cached on this device ---------- */
function groupsFetch(force){ if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in")return null; if(!force&&_hospGroups&&Date.now()-_hospGroupsAt<600000)return null; _hospGroupsAt=Date.now();
  let p=null; try{ p=_sb.rpc("hospital_groups",{p_org:_org}); }catch(e){ return null; }
  return Promise.resolve(p).then(r=>{ if(r&&!r.error&&Array.isArray(r.data)){ _hospGroups=r.data.map(g=>({org:String(g.org),label:digestClean(g.label||g.org)})); bgRender(); } }).catch(()=>{}); }
function hospGroups(){ return _hospGroups||[]; }
function siblingGroups(){ return hospGroups().filter(g=>g.org!==_org); }
function deptOn(){ return cloudOn()&&!!_orgHospitalId&&hospGroups().length>=2; }   // the department view needs a second group
function boardFetch(force){ if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in"||_boardBusy)return null; if(!force&&_boardCache.fetched&&Date.now()-_boardCache.fetched<60000)return null; _boardBusy=true;
  let p=null; try{ p=_sb.rpc("board_for_org",{p_org:_org}); }catch(e){ _boardBusy=false; return null; }
  return Promise.resolve(p).then(r=>{ _boardBusy=false; if(r&&!r.error&&Array.isArray(r.data)){ _boardCache={rows:boardRowsFrom(r.data),fetched:Date.now()}; bgRender(); } }).catch(()=>{ _boardBusy=false; }); }
function boardRowsFrom(list){ return (list||[]).filter(x=>x&&x.org!==_org).map(x=>({org:String(x.org),label:digestClean(x.label||x.org),data:(x.data&&typeof x.data==="object")?x.data:null,updated:x.updated||null})); }   // our own column is always the live roster, never a cached copy
function setBoardShow(orgId,on){ if(!S.board)S.board={publish:false,show:[]}; const i=S.board.show.indexOf(orgId); if(on&&i<0)S.board.show.push(orgId); if(!on&&i>=0)S.board.show.splice(i,1);
  logAudit("settings.board","booking sheet "+(on?"shows ":"hides ")+orgId,"admin"); save(); if(on)boardFetch(true); toastSaved("group"); render(); }
function deptCardHTML(){ if(!cloudOn()||!_orgHospitalId)return ""; const b=S.board||{publish:false,show:[]}, sibs=siblingGroups(), where=escapeHTML(_orgHospital||"this hospital");
  return `<div class="sub" style="margin-top:10px"><b>Department board</b></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="boardPublish" ${b.publish?"checked":""}> Publish to the department board <span class="muted small">@U@2014 shares names, slots and times with the other groups at ${where}. Never contacts, pay or leave reasons.</span></label>
    ${sibs.length?`<div class="muted small" style="margin-top:4px">Show on the booking sheet and the Day board:</div><div style="display:flex;flex-wrap:wrap">${sibs.map(g=>`<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" class="boardShow" data-org="${escapeHTML(g.org)}" ${b.show.indexOf(g.org)>=0?"checked":""}> ${escapeHTML(g.label)}</label>`).join("")}</div>`:`<div class="muted small" style="margin-top:4px">No other staff group at ${where} yet.</div>`}`; }
function ocMark(cyc,sid,isoD,mini){''')
# the Group card carries the section, above the group id
rep(r'''    <div class="muted small" style="margin-top:6px">Group id <b>${escapeHTML(_org)}</b>''',
    r'''    ${deptCardHTML()}
    <div class="muted small" style="margin-top:6px">Group id <b>${escapeHTML(_org)}</b>''')
# Get started asks to publish once there is someone to publish to
rep(r'''  if(cloudOn())rows.push({key:"allowlist",''',
    r'''  if(deptOn())rows.push({key:"board",n:"+",q:"Publish to the department board",done:!!(S.board&&S.board.publish),anchor:"brandCard",detail:(S.board&&S.board.publish)?"On @U@2014 the other groups see who's on":"Names, slots and times only; never contacts, pay or reasons"});
  if(cloudOn())rows.push({key:"allowlist",''')
# the switches are wired where the card is drawn
rep(r'''  if(S.tab==="setup"){
    renderZoneList();''',
    r'''  if(S.tab==="setup"){
    renderZoneList(); groupsFetch();
    const bpb=document.getElementById("boardPublish"); if(bpb)bpb.onchange=()=>{ setBoardPublish(bpb.checked); };
    document.querySelectorAll(".boardShow").forEach(cb=>cb.onchange=()=>{ setBoardShow(cb.dataset.org,cb.checked); });''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/dg4-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 4`, then `879 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js
git commit -q -m "Department groups: the hospital's groups and the board rows are read by this group's own id and cached on the device; the Group card gains Publish to the department board and the sibling groups to show; Get started asks to publish once there is a second group" && git log --oneline -1
```

---

### Task 5: Who's on — the Day board's Whole department view

**Files:**
- Modify: `app.html` (the stylesheet before `@media print{` and inside it, `viewDaily`, the digest section, the `daily` wire block)
- Test: `tests/suite.js` (the `department groups` block)

**Interfaces:**
- Consumes: Tasks 2–4; `viewDaily`, `dailyScope`, `_deptDate`, `_boardCache`, `hospGroups`, `deptOn`, `printHeadHTML`, `printFootHTML`, `phBadge`, `fmtISO`, `ic`, `isMobile`.
- Produces:
  - `scopeSegHTML()` — the *This group · Whole department* segmented control (`data-dscope`), empty unless `deptOn()`.
  - `deptDates() → {min,max}` (yesterday … today+14); `agoText(ts)`; `onNowAt(t,nowMin) → boolean`; `countLine(n,noun)`.
  - `deptColumns(d,today) → [{org,label,data,updated,own}]` — one per registry group: ours from `buildDigestAll(S,today)`, others from `_boardCache`, missing ones with `data:null`.
  - `deptColHTML(c,d,today,nowMin)` and `deptBoardHTML()` — the card `#deptCard` with its own nav (`#bPrev`, `#bDate`, `#bNext`, `#bRefresh`, `#bPrint`), a `.deptgrid` of `.deptcol` columns (a `<details>` per group on phones), `printHeadHTML`/`printFootHTML`.
  - `_boardTick` — a one-minute interval armed by the `daily` wire block while the department view is open (`boardFetch(true)`), cleared when the tab or scope changes.
  - CSS: `.deptgrid`, `.deptcol`, `.depthead`, `.listrow.onnow`, and `body.print-dept` in the print rules.

- [ ] **Step 1: Write the failing tests.** Create `$SP/dg5-suite.py`:

```python
rep(r'''      // ---- department groups: later tasks add their tests above this line''', r'''      // ---- Who's on: the Day board's department view
      function groups3(){ return [{org:"h1-consultants",label:"Consultants"},{org:"h1-nurses",label:"Nurses"},{org:"h1-scribes",label:"Scribes"}]; }
      function cacheRows(){ var days={}; days[T0]={on:[{n:"Dr Lee",r:"Resus",p:"AM",t:"10:00"+EN+"17:00"},{n:"Dr Kim",r:"Acute",p:"PM",t:"17:00"+EN+"22:00"}],away:["Dr Tan"]}; days[D(2)]={on:[{n:"Dr Lee",r:"Resus",p:"AM",t:"10:00"+EN+"17:00"},{n:"Dr Kim",r:"Acute",p:"PM",t:"17:00"+EN+"22:00"}],away:[]};
        return [{org:"h1-consultants",label:"Consultants",data:{v:1,noun:"consultant",days:days},updated:new Date(Date.now()-5*60000).toISOString()},{org:"h1-nurses",label:"Nurses",data:{v:1,noun:"nurse",days:{}},updated:new Date().toISOString()}]; }
      T("board: the Day board offers Whole department only when there are two groups", (function(){
        state({groups:[{org:"h1-nurses",label:"Nurses"}]}); var one=viewDaily().indexOf("data-dscope")<0;
        state({groups:groups3()}); var h=viewDaily(); return one && h.indexOf('data-dscope="dept"')>=0 && h.indexOf('data-dscope="group"')>=0 && h.indexOf('id="deptCard"')<0; })());
      T("board: the department view shows a column per group: ours live, a published one with its time, an unpublished one saying so", (function(){
        state({groups:groups3()}); _boardCache={rows:cacheRows(),fetched:Date.now()}; put("s1",0); dailyScope="dept"; var h=viewDaily();
        var cols=(h.match(/class="deptcol"/g)||[]).length;
        return h.indexOf('id="deptCard"')>=0 && cols===3 && h.indexOf("Consultants")>=0 && h.indexOf("Dr Lee")>=0 && h.indexOf("Resus")>=0 && h.indexOf("Updated 5 min ago")>=0 && h.indexOf("Dr Tan")>=0 &&
               h.indexOf("Scribes haven't published to the board.")>=0 && h.indexOf("Ava Ng")>=0 && h.indexOf("This group, live")>=0 && h.indexOf("1 nurse")>=0 && h.indexOf("2 consultants")>=0 && _deptDate===T0; })());
      T("board: our own column is the live roster even when the cache holds a stale copy of it", (function(){
        state({groups:groups3()}); var rows=cacheRows(); var stale={}; stale[T0]={on:[{n:"Stale Name",r:"Triage",p:"AM",t:"10:00"+EN+"17:00"}],away:[]}; rows.push({org:"h1-nurses",label:"Nurses",data:{v:1,noun:"nurse",days:stale},updated:new Date().toISOString()});
        _boardCache={rows:rows,fetched:Date.now()}; put("s2",0); dailyScope="dept"; var h=viewDaily();
        return h.indexOf("Sam Lee")>=0 && h.indexOf("Stale Name")<0 && (h.match(/class="deptcol"/g)||[]).length===3; })());
      T("board: names arrive as text: a name carrying markup is shown, not run", (function(){
        state({groups:groups3()}); var rows=cacheRows(); rows[0].data.days[T0].on[0].n='<img src=x onerror=alert(1)>'; rows[0].data.days[T0].away[0]='<b>x</b>'; _boardCache={rows:rows,fetched:Date.now()}; dailyScope="dept"; var h=viewDaily();
        return h.indexOf("&lt;img src=x onerror=alert(1)&gt;")>=0 && h.indexOf("<img src=x")<0 && h.indexOf("&lt;b&gt;x&lt;/b&gt;")>=0; })());
      T("board: the day is bounded to yesterday through fourteen days ahead, and on now follows the clock", (function(){
        state({groups:groups3()}); dailyScope="dept"; _deptDate=D(20); viewDaily(); var reset=_deptDate===T0; _deptDate=D(-1); var h=viewDaily(); var yday=_deptDate===D(-1)&&h.indexOf('min="'+D(-1)+'"')>=0&&h.indexOf('max="'+D(14)+'"')>=0;
        return reset && yday && onNowAt("10:00"+EN+"17:00",11*60)===true && onNowAt("10:00"+EN+"17:00",17*60)===false && onNowAt("22:00"+EN+"01:00",23*60)===true && onNowAt("bad",0)===false && agoText(Date.now())==="just now" && agoText(Date.now()-125*60000)==="2 h ago"; })());
      T("board: on a phone each group is a card that opens on tap, and the sheet can be printed on its own", (function(){
        state({groups:groups3()}); _boardCache={rows:cacheRows(),fetched:Date.now()}; dailyScope="dept"; isMobile=function(){ return true; }; var m=viewDaily(); isMobile=function(){ return false; }; var d=viewDaily();
        return (m.match(/<details class="deptcol">/g)||[]).length===3 && m.indexOf("<summary>")>=0 && d.indexOf("<details")<0 && d.indexOf('class="depthead"')>=0 && d.indexOf('class="printhead"')>=0 && d.indexOf('id="bPrint"')>=0 && d.indexOf('id="bRefresh"')>=0; })());

      // ---- department groups: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg5-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then six `FAIL  board: …` lines and `879 passed, 6 failed` (every new test reads what the department view does not draw yet; none throws, because each falls at its first check).

- [ ] **Step 3: Implement.** Create `$SP/dg5-app.py`:

```python
# the styles: a grid of group columns, a card per group on phones, the row that is on now, and printing the board alone
rep(r'''  @media print{
    body.print-cap #app>*:not(#capCard){display:none !important} body.print-eq #app>*:not(#eqCard){display:none !important}''',
    r'''  .deptgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:12px}
  .deptcol{border:1px solid var(--line2);border-radius:12px;padding:10px 12px} .deptcol summary{cursor:pointer;list-style:none} .deptcol summary::-webkit-details-marker{display:none} .depthead,.deptcol summary{display:flex;flex-direction:column;gap:2px}
  .listrow.onnow{background:var(--accent-bg);border-radius:8px}
  @media print{
    body.print-cap #app>*:not(#capCard){display:none !important} body.print-eq #app>*:not(#eqCard){display:none !important} body.print-dept #app>*:not(#deptCard){display:none !important} body.print-dept .deptcol{break-inside:avoid}''')
# the Day board: the department view when chosen, and the switch on the group view
rep(r'''function viewDaily(){
  const ds=cycleDates();''',
    r'''function viewDaily(){
  if(dailyScope==="dept"&&deptOn())return deptBoardHTML();
  const ds=cycleDates();''')
rep(r'''<div class="seg"><button class="${dailyMode==="day"?"on":""}" data-dm="day">Day</button>''',
    r'''${scopeSegHTML()}<div class="seg"><button class="${dailyMode==="day"?"on":""}" data-dm="day">Day</button>''')
# the department view
rep(r'''function ocMark(cyc,sid,isoD,mini){''',
r'''/* ---------- Who's on: the Day board across every group in the hospital, a column per group from the digests ---------- */
function scopeSegHTML(){ if(!deptOn())return ""; return `<div class="seg" role="group" aria-label="Which roster"><button class="${dailyScope==="dept"?"":"on"}" data-dscope="group">This group</button><button class="${dailyScope==="dept"?"on":""}" data-dscope="dept">Whole department</button></div>`; }
function deptDates(){ const t=parseISO(iso(new Date())); return {min:iso(addDays(t,-1)),max:iso(addDays(t,14))}; }   // the board is a day sheet: yesterday to a fortnight ahead
function agoText(ts){ const m=Math.max(0,Math.round((Date.now()-ts)/60000)); return m<1?"just now":(m<60?(m+" min ago"):(Math.round(m/60)+" h ago")); }
function onNowAt(t,nowMin){ const m=/^(\d\d):(\d\d)\D+(\d\d):(\d\d)$/.exec(String(t||"")); if(!m)return false; const st=+m[1]*60+ +m[2]; let en=+m[3]*60+ +m[4]; if(en<=st)en+=1440; return nowMin>=st&&nowMin<en; }
function countLine(n,noun){ const r=noun||""; if(!r)return n+(n===1?" person":" people"); return n+" "+(n===1?r:(/s$/.test(r)?r:r+"s")); }
function deptColumns(d,today){ const cache={}; _boardCache.rows.forEach(r=>{ cache[r.org]=r; });   // one column per registry group: ours live, the others from the cache, a missing one says so
  return hospGroups().map(g=>{ if(g.org===_org)return {org:g.org,label:g.label,data:buildDigestAll(S,today),updated:null,own:true};
    const r=cache[g.org]; return {org:g.org,label:g.label,data:r?r.data:null,updated:r?r.updated:null,own:false}; }); }
function deptColHTML(c,d,today,nowMin){
  const day=(c.data&&c.data.days&&c.data.days[d])||null, on=(day&&Array.isArray(day.on))?day.on:[], away=(day&&Array.isArray(day.away))?day.away:[];
  const when=c.own?"This group, live":(!c.data?"Not published yet":(c.updated?("Updated "+agoText(Date.parse(c.updated))):"Published"));
  const now=e=>d===today&&onNowAt(e.t,nowMin), noun=digestClean((c.data&&c.data.noun)||""), line=countLine(on.length,noun)+((d===today&&on.length)?(" @U@00b7 "+on.filter(now).length+" on now"):"");
  const sec=(p,label,cls)=>{ const es=on.filter(e=>(e.p||"")===p); if(!es.length)return "";
    return `<h3 style="margin:10px 0 4px;font-size:var(--fs-md)">${escapeHTML(label)}</h3>`+es.map(e=>`<div class="listrow${now(e)?" onnow":""}"><span class="tag lg ${cls}" style="min-width:62px;text-align:center">${escapeHTML(e.r||(e.ci?"Called in":"On call"))}</span><span class="grow">${escapeHTML(e.n||"")}</span><span class="muted small">${escapeHTML(e.t||"")}</span></div>`).join(""); };
  const body=!c.data?`<div class="muted small">${escapeHTML(c.label)} haven't published to the board.</div>`
    :((on.length?(sec("AM","AM","am")+sec("","On call and call-ins","oc")+sec("PM","PM","pm")):`<div class="muted small">Nobody rostered.</div>`)
      +(away.length?`<h3 style="margin:10px 0 4px;font-size:var(--fs-md)">Away</h3><div>${away.map(n=>`<span class="tag lg leave" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(String(n))}</span>`).join("")}</div>`:""));
  const head=`<b>${escapeHTML(c.label)}</b><span class="rowsub">${escapeHTML(line)} @U@00b7 ${escapeHTML(when)}</span>`;
  return isMobile()?`<details class="deptcol"><summary>${head}</summary>${body}</details>`:`<div class="deptcol"><div class="depthead">${head}</div>${body}</div>`; }
function deptBoardHTML(){ const today=iso(new Date()), lim=deptDates(); if(!_deptDate||_deptDate<lim.min||_deptDate>lim.max)_deptDate=today; const d=_deptDate, dt=new Date(), nowMin=dt.getHours()*60+dt.getMinutes();
  const nav=`<div class="row" style="align-items:center;margin-top:4px"><button class="btn sm" id="bPrev" aria-label="Previous day">${ic("chevL")}</button><input type="date" id="bDate" value="${d}" min="${lim.min}" max="${lim.max}" aria-label="Day"><button class="btn sm" id="bNext" aria-label="Next day">${ic("chevR")}</button>${phBadge(d)}<span class="grow"></span>${scopeSegHTML()}<button class="btn sm" id="bRefresh">Refresh</button><button class="btn sm" id="bPrint">${ic("print")} Print</button></div>`;
  const cols=deptColumns(d,today).map(c=>deptColHTML(c,d,today,nowMin)).join("");
  return `<div class="card" id="deptCard">${printHeadHTML("Who's on @U@00b7 "+fmtISO(d))}<h2>Who's on today</h2>
    <div class="sub">${escapeHTML(_orgHospital||"The department")} @U@00b7 ${escapeHTML(parseISO(d).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}))}${_boardCache.fetched?` @U@00b7 <span class="scronly">board read ${escapeHTML(agoText(_boardCache.fetched))}</span>`:""}</div>${nav}
    <div class="deptgrid">${cols}</div>${printFootHTML("Names, slots and times as each group published them. Contacts, pay and leave reasons never leave a group.")}</div>`; }
function ocMark(cyc,sid,isoD,mini){''')
# the controls are wired where the Day board is drawn
rep(r'''  if(S.tab==="daily"){
    const ds=cycleDates();''',
    r'''  if(S.tab==="daily"){
    const ds=cycleDates(); groupsFetch(); if(dailyScope==="dept")boardFetch();
    clearInterval(_boardTick); _boardTick=null; if(dailyScope==="dept"&&deptOn())_boardTick=setInterval(()=>{ if(S.tab==="daily"&&dailyScope==="dept"){ boardFetch(true); } else { clearInterval(_boardTick); _boardTick=null; } },60000);   // the board re-reads itself every minute while it is open, and stops when the view is left
    document.querySelectorAll("[data-dscope]").forEach(b=>b.onclick=()=>{ dailyScope=b.dataset.dscope; if(dailyScope==="dept")boardFetch(true); render(); });
    const bd=document.getElementById("bDate"); if(bd)bd.onchange=e=>{ _deptDate=e.target.value; render(); };
    const lim=deptDates(), bpv=document.getElementById("bPrev"), bnx=document.getElementById("bNext");
    if(bpv)bpv.onclick=()=>{ const nd=iso(addDays(parseISO(_deptDate||iso(new Date())),-1)); if(nd>=lim.min)_deptDate=nd; render(); };
    if(bnx)bnx.onclick=()=>{ const nd=iso(addDays(parseISO(_deptDate||iso(new Date())),1)); if(nd<=lim.max)_deptDate=nd; render(); };
    const brf=document.getElementById("bRefresh"); if(brf)brf.onclick=()=>{ groupsFetch(true); boardFetch(true); toast("Reading the board@U@2026"); };
    const bpr=document.getElementById("bPrint"); if(bpr)bpr.onclick=()=>{ document.body.classList.add("print-dept"); window.print(); setTimeout(()=>document.body.classList.remove("print-dept"),1200); };''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/dg5-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 5`, then `885 passed, 0 failed` and no CSS lint line (the two tokens the styles use, `--line2` and `--accent-bg`, already exist).

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js
git commit -q -m "Department groups: the Day board can show the whole department: a column per staff group from the digests, ours live, today or any day in the next fortnight, a card per group on phones, printable on its own" && git log --oneline -1
```

---

### Task 6: The scribes' sheet — sibling groups on the booking sheet and the group's own Day board

**Files:**
- Modify: `app.html` (the digest section, `daySheetHTML`, `viewDaily`'s group view, `openDaySheet`)
- Test: `tests/suite.js` (the `department groups` block)

**Interfaces:**
- Consumes: Tasks 2–5; `S.board.show`, `hospGroups`, `deptOn`, `_boardCache`, `boardFetch`, `daySheetHTML`, `_sheetPeriod`, `openDaySheet`.
- Produces: `sibLinesHTML(isoD,p) → html` — one muted line per chosen sibling group: "Consultants on: Dr Lee · Resus, Dr Kim", "nobody yet", or "Consultants haven't published to the board."; empty when nothing is chosen or `deptOn()` is false. No `data-` attribute, so nothing to wire.

- [ ] **Step 1: Write the failing tests.** Create `$SP/dg6-suite.py`:

```python
rep(r'''      // ---- department groups: later tasks add their tests above this line''', r'''      // ---- the scribes' sheet
      T("sheet: a scribe's day sheet names the colleagues of a chosen group on that half, read-only, from the board", (function(){
        state({groups:groups3(),show:["h1-consultants"],viewAs:"s1"}); _boardCache={rows:cacheRows(),fetched:Date.now()}; var am=daySheetHTML(D(2)); _sheetPeriod="PM"; var pm=daySheetHTML(D(2)); _sheetPeriod="AM";
        var line=sibLinesHTML(D(2),"AM");
        return am.indexOf("Consultants on: Dr Lee @U@00b7 Resus")>=0 && am.indexOf("Dr Kim")<0 && pm.indexOf("Consultants on: Dr Kim @U@00b7 Acute")>=0 && line.indexOf("data-")<0 && line.indexOf("<button")<0 && sibLinesHTML(D(5),"AM").indexOf("nobody yet")>=0; })());
      T("sheet: nothing is shown when no group is chosen, when the department is off, or when the chosen group hasn't published", (function(){
        state({groups:groups3(),viewAs:"s1"}); _boardCache={rows:cacheRows(),fetched:Date.now()}; var none=daySheetHTML(D(2)).indexOf("Consultants on")<0&&sibLinesHTML(D(2),"AM")==="";
        state({groups:groups3(),show:["h1-scribes"],viewAs:"s1"}); _boardCache={rows:cacheRows(),fetched:Date.now()}; var unpub=daySheetHTML(D(2)).indexOf("Scribes haven't published to the board.")>=0;
        state({groups:[{org:"h1-nurses",label:"Nurses"}],show:["h1-consultants"],viewAs:"s1"}); var off=sibLinesHTML(D(2),"AM")==="";
        return none && unpub && off; })());
      T("sheet: the group's own Day board carries the same line under each half, and opening a sheet reads the board", (function(){
        state({groups:groups3(),show:["h1-consultants"]}); _boardCache={rows:cacheRows(),fetched:Date.now()}; dailyDate=D(2); var h=viewDaily();
        _boardCache={rows:[],fetched:0}; calls.length=0; openDaySheet(D(2)); var read=calls.some(function(x){ return x.op==="rpc"&&x.name==="board_for_org"; });
        return h.indexOf("Consultants on: Dr Lee @U@00b7 Resus")>=0 && h.indexOf("Consultants on: Dr Kim @U@00b7 Acute")>=0 && read; })());

      // ---- department groups: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg6-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line and `884 passed, 1 failed` (the first new test calls `sibLinesHTML`, which does not exist yet).

- [ ] **Step 3: Implement.** Create `$SP/dg6-app.py`:

```python
rep(r'''function ocMark(cyc,sid,isoD,mini){''',
r'''function sibLinesHTML(isoD,p){   // the other groups a sheet shows: who holds that half, read-only, from the board; nothing to book, nothing to wire
  const shows=(S.board&&S.board.show)||[]; if(!shows.length||!deptOn())return "";
  return shows.map(orgId=>{ const g=hospGroups().find(x=>x.org===orgId); if(!g)return ""; const row=_boardCache.rows.find(x=>x.org===orgId), label=escapeHTML(g.label);
    if(!row||!row.data)return `<div class="muted small">${label} haven't published to the board.</div>`;
    const day=row.data.days&&row.data.days[isoD], es=((day&&day.on)||[]).filter(e=>(e.p||"")===p);
    return `<div class="muted small">${label} on: ${es.length?es.map(e=>escapeHTML(e.n||"")+(e.r?" @U@00b7 "+escapeHTML(e.r):"")).join(", "):"nobody yet"}</div>`; }).join(""); }
function ocMark(cyc,sid,isoD,mini){''')
# the booking sheet: under the cover line of each half being picked
rep(r'''const cover=`<div class="muted small">${covLine}</div>''',
    r'''const sib=tfills.map(f=>sibLinesHTML(isoD,f)).join(""); const cover=`<div class="muted small">${covLine}</div>''')
rep(r'''body=_ty?`${seg}${cover}<div class="zchips">''', r'''body=_ty?`${seg}${cover}${sib}<div class="zchips">''')
# the group's own Day board, under each half
rep(r'''${board("AM")}''', r'''${board("AM")}${sibLinesHTML(dailyDate,"AM")}''')
rep(r'''${board("PM")}''', r'''${board("PM")}${sibLinesHTML(dailyDate,"PM")}''')
# opening a sheet reads the board when there is something to show
rep(r'''_daySheet=isoD; _ciForm=null;''', r'''_daySheet=isoD; _ciForm=null; if(((S.board&&S.board.show)||[]).length)boardFetch();''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/dg6-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 6`, then `888 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js
git commit -q -m "Department groups: a scribe's booking sheet and the group's own Day board name the people of a chosen sibling group on each half, read-only, from the board" && git log --oneline -1
```

---

### Task 7: Add a staff group in-app

**Files:**
- Modify: `app.html` (the desktop account popover markup, `render()`'s popover rows, the global wiring next to `switchOrgBtn` and `sheetSwitch`, `moreSheetHTML`, `handleAuth`, `AUDIT_WORDS`, a new section before `function ocMark(`)
- Modify: `MYROSTA-GROUP-SETUP.md` (Part A and two rows of Part D)
- Test: `tests/suite.js` (the `department groups` block)

**Interfaces:**
- Consumes: `_sb.rpc`, `openDialog`, `closeModal`, `closeAcct`, `groupIsFresh`, `groupName`, `escapeHTML`, `localStorage`, `location.reload`, `_realAdmin`, `_orgHospitalId`.
- Produces:
  - `canAddGroup() → boolean` (cloud on, signed in, a real admin, hospital known).
  - `addGroupHTML(err) → html` (`#ovlAg`, `#agName`, `#agNoun` with datalist `#agRoles`, `#agAdmin2`, `#agCreate`, `#agCancel`); `openAddGroup(err,vals)`; `wireAddGroup()`.
  - `groupCheck(name,noun,admin2) → {ok:false,reason} | {ok:true,name,noun,admin2}`; `createGroup(name,noun,admin2) → {ok,reason?}` — calls `rpc("create_group",{p_sibling_org,p_label,p_noun,p_admin2_email})` before any await; `groupErrText(e)`; `groupCreated(orgId,name,noun)` — writes `myrosta_org` and `myrosta_newgroup`, then `location.reload()`.
  - `groupFirstLoad() → boolean` — on the first load of the group this device just made: names it, sets the role noun, audits `group.create`; runs in both branches of `handleAuth`.
  - The row **Add a staff group**: `#addGroupBtn` in the desktop popover, `#sheetAddGroup` in the More sheet, both only when `canAddGroup()`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/dg7-suite.py`:

```python
rep(r'''      // ---- department groups: later tasks add their tests above this line''', r'''      // ---- add a staff group
      T("add a group: the sheet refuses a missing name, a bad second email, and anyone who isn't an admin of a group under a hospital", (function(){
        state(); var noname=groupCheck("  ","nurse","").reason==="A group needs a name.", bad=groupCheck("Scribes","scribe","not-an-email").reason==="That second admin's email doesn't look right.";
        var ok=groupCheck(" Scribes ","Scribe","V@X.ORG"); var good=ok.ok===true&&ok.name==="Scribes"&&ok.noun==="scribe"&&ok.admin2==="v@x.org";
        _realAdmin=false; var staff=groupCheck("Scribes","scribe","").reason==="Only an admin can add a group."; _realAdmin=true;
        state({hospital:""}); var nohosp=/hospital/.test(groupCheck("Scribes","scribe","").reason)&&canAddGroup()===false;
        return noname && bad && good && staff && nohosp; })());
      T("add a group: creating calls the database with this group as the sibling, and the reload lands in the new group", (function(){
        state(); var r=createGroup("Scribes","scribe","v@x.org"); var call=calls[0];
        var asked=r.ok===true&&call&&call.op==="rpc"&&call.name==="create_group"&&call.args.p_sibling_org==="h1-nurses"&&call.args.p_label==="Scribes"&&call.args.p_noun==="scribe"&&call.args.p_admin2_email==="v@x.org";
        var r2=createGroup("Scribes","scribe",""); var nul=calls[1].args.p_admin2_email===null;
        var reloads=0; location.reload=function(){ reloads++; }; groupCreated("h1-scribes","Scribes","scribe"); var m=JSON.parse(localStorage.getItem("myrosta_newgroup")||"null");
        var landed=localStorage.getItem("myrosta_org")==="h1-scribes"&&m&&m.org==="h1-scribes"&&m.name==="Scribes"&&m.noun==="scribe"&&reloads===1;
        localStorage.removeItem("myrosta_newgroup"); localStorage.removeItem("myrosta_org");
        return asked && nul && landed && groupErrText({message:"Only an admin of a group in this hospital can add a group"})==="Only an admin can add a group." && groupErrText(null).indexOf("try again")>0; })());
      T("add a group: the new group's first load takes its name and what its people are called, once, and never over an existing group", (function(){
        state(); _org="h1-scribes"; S.staff=[]; S.branding={}; c.answered={}; localStorage.setItem("myrosta_newgroup",JSON.stringify({org:"h1-scribes",name:"Scribes",noun:"scribe",ts:1}));
        var first=groupFirstLoad()===true&&S.branding.name==="Scribes"&&S.branding.roleNoun==="scribe"&&S.audit.some(function(a){ return a.action==="group.create"; })&&localStorage.getItem("myrosta_newgroup")===null;
        var again=groupFirstLoad()===false;
        localStorage.setItem("myrosta_newgroup",JSON.stringify({org:"h1-scribes",name:"Other",noun:"x",ts:1})); S.staff=[{id:"s1",name:"Ava Ng",quota:20,eft:1}]; var kept=groupFirstLoad()===false&&S.branding.name==="Scribes"&&localStorage.getItem("myrosta_newgroup")===null;
        localStorage.setItem("myrosta_newgroup",JSON.stringify({org:"someone-else",name:"Other",noun:"x",ts:1})); S.staff=[]; var other=groupFirstLoad()===false&&S.branding.name==="Scribes"; localStorage.removeItem("myrosta_newgroup");
        return first && again && kept && other; })());
      T("add a group: the row shows only to a signed-in admin of a group under a hospital, and the sheet has its fields", (function(){
        state(); var adm=moreSheetHTML().indexOf('id="sheetAddGroup"')>=0; S.viewAs="s1"; _realAdmin=false; var staff=moreSheetHTML().indexOf('id="sheetAddGroup"')<0; _realAdmin=true; S.viewAs="admin";
        state({hospital:""}); var nohosp=moreSheetHTML().indexOf('id="sheetAddGroup"')<0;
        var h=addGroupHTML("A group needs a name."); return adm && staff && nohosp && ['id="agName"','id="agNoun"','id="agAdmin2"','id="agCreate"','id="agCancel"','list="agRoles"','A group needs a name.'].every(function(s){ return h.indexOf(s)>=0; }) && addGroupHTML("").indexOf('class="note"')<0; })());

      // ---- department groups: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg7-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line and `887 passed, 1 failed` (the first new test calls `groupCheck`, which does not exist yet).

- [ ] **Step 3: Implement.** Create `$SP/dg7-app.py`:

```python
rep(r'''function ocMark(cyc,sid,isoD,mini){''',
r'''/* ---------- add a staff group in-app: one database function makes the registry row, the empty record and the admins; the new group opens on a reload ---------- */
const GROUP_NOUNS=["consultant","doctor","junior doctor","registrar","intern","nurse","midwife","scribe","clerk","paramedic","pharmacist","radiographer","technician","staff member"];
function canAddGroup(){ return cloudOn()&&authState==="in"&&_realAdmin&&!!_orgHospitalId; }
function addGroupHTML(err){ return `<div class="overlay" id="ovlAg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="agT"><h3 id="agT">Add a staff group</h3>
    <div class="sub">A new roster at ${escapeHTML(_orgHospital||"this hospital")}, beside ${escapeHTML(groupName()||"this group")}. You become its admin. It starts empty; the next screen asks what kind of group it is.</div>
    <label class="field" style="display:block;margin-top:10px"><span class="lbl">Group name</span><input id="agName" maxlength="40" placeholder="e.g. Nurses" style="width:100%"></label>
    <label class="field" style="display:block;margin-top:8px"><span class="lbl">What are its people called? <span class="muted">(singular)</span></span><input id="agNoun" list="agRoles" maxlength="30" placeholder="nurse" style="width:100%"><datalist id="agRoles">${GROUP_NOUNS.map(r=>`<option value="${r}">`).join("")}</datalist></label>
    <label class="field" style="display:block;margin-top:8px"><span class="lbl">Second admin's email <span class="muted">(optional)</span></span><input id="agAdmin2" type="email" placeholder="name@hospital.org.au" style="width:100%"></label>
    ${err?`<div class="note" style="margin-top:8px">${escapeHTML(err)}</div>`:""}
    <div class="flexbtns" style="margin-top:12px"><button class="btn primary" id="agCreate">Create the group</button><button class="btn" id="agCancel">Cancel</button></div></div></div>`; }
function openAddGroup(err,vals){ openDialog(addGroupHTML(err),{focus:"#agName"}); const v=vals||{}; ["agName","agNoun","agAdmin2"].forEach(id=>{ const el=document.getElementById(id); if(el&&v[id]!=null)el.value=v[id]; }); wireAddGroup(); }
function wireAddGroup(){ const nm=document.getElementById("agName"), cr=document.getElementById("agCreate"), cc=document.getElementById("agCancel"), ov=document.getElementById("ovlAg");
  const vals=()=>({agName:(document.getElementById("agName")||{}).value||"",agNoun:(document.getElementById("agNoun")||{}).value||"",agAdmin2:(document.getElementById("agAdmin2")||{}).value||""});
  if(nm&&cr)nm.oninput=()=>{ cr.textContent="Create "+(nm.value.trim()||"the group"); };
  if(cc)cc.onclick=closeModal; if(ov)ov.onclick=e=>{ if(e&&e.target===ov)closeModal(); };
  if(cr)cr.onclick=()=>{ const v=vals(), r=createGroup(v.agName,v.agNoun,v.agAdmin2); if(!r.ok)openAddGroup(r.reason,v); else { cr.disabled=true; cr.textContent="Creating@U@2026"; } }; }
function groupCheck(name,noun,admin2){ const n=String(name||"").trim().slice(0,40), r=String(noun||"").trim().toLowerCase().slice(0,30), a=String(admin2||"").trim().toLowerCase();
  if(!canAddGroup())return {ok:false,reason:_realAdmin?"This group isn't under a hospital yet @U@2014 ask Myrosta support.":"Only an admin can add a group."};
  if(!n)return {ok:false,reason:"A group needs a name."};
  if(a&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))return {ok:false,reason:"That second admin's email doesn't look right."};
  return {ok:true,name:n,noun:r,admin2:a}; }
function createGroup(name,noun,admin2){ const c=groupCheck(name,noun,admin2); if(!c.ok)return c; if(!_sb)return {ok:false,reason:"Couldn't reach the server @U@2014 try again."};
  let p=null; try{ p=_sb.rpc("create_group",{p_sibling_org:_org,p_label:c.name,p_noun:c.noun,p_admin2_email:c.admin2||null}); }catch(e){ return {ok:false,reason:"Couldn't reach the server @U@2014 try again."}; }
  Promise.resolve(p).then(r=>{ if(!r||r.error||!r.data){ openAddGroup(groupErrText(r&&r.error),{agName:c.name,agNoun:c.noun,agAdmin2:c.admin2}); return; } groupCreated(String(r.data),c.name,c.noun); }).catch(()=>openAddGroup("Couldn't reach the server @U@2014 try again.",{agName:c.name,agNoun:c.noun,agAdmin2:c.admin2}));
  return {ok:true,name:c.name}; }
function groupErrText(e){ const m=String((e&&e.message)||""); if(/admin/i.test(m))return "Only an admin can add a group."; if(/needs a name/i.test(m))return "A group needs a name."; if(/hospital/i.test(m))return "This group isn't under a hospital yet @U@2014 ask Myrosta support."; return "Couldn't reach the server @U@2014 try again."; }
function groupCreated(orgId,name,noun){ try{ localStorage.setItem("myrosta_org",orgId); localStorage.setItem("myrosta_newgroup",JSON.stringify({org:orgId,name:name,noun:noun,ts:Date.now()})); }catch(e){} location.reload(); }   // the reload is the existing switch path: no cache can bleed between groups
function groupFirstLoad(){ let m=null; try{ m=JSON.parse(localStorage.getItem("myrosta_newgroup")||"null"); }catch(e){} if(!m||m.org!==_org)return false;   // the group this device just made, on its first load only
  try{ localStorage.removeItem("myrosta_newgroup"); }catch(e){} if(!groupIsFresh())return false;
  if(!S.branding)S.branding={}; if(m.name)S.branding.name=String(m.name).slice(0,40); if(m.noun)S.branding.roleNoun=String(m.noun).slice(0,30);
  logAudit("group.create",(m.name||"")+(m.noun?" @U@00b7 staff = "+m.noun:""),"admin"); return true; }
function ocMark(cyc,sid,isoD,mini){''')
# the row in the desktop popover and in the More sheet
rep(r'''      <button class="sheetrow" id="switchOrgBtn" style="display:none"><svg viewBox="0 0 24 24" class="tic" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg> Switch roster</button>''',
    r'''      <button class="sheetrow" id="switchOrgBtn" style="display:none"><svg viewBox="0 0 24 24" class="tic" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg> Switch roster</button>
      <button class="sheetrow" id="addGroupBtn" style="display:none"><svg viewBox="0 0 24 24" class="tic" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add a staff group</button>''')
rep(r'''  document.getElementById("switchOrgBtn").style.display=(cloudOn()&&authState==="in"&&_orgCount>1)?"":"none";''',
    r'''  document.getElementById("switchOrgBtn").style.display=(cloudOn()&&authState==="in"&&_orgCount>1)?"":"none";
  document.getElementById("addGroupBtn").style.display=canAddGroup()?"":"none";''')
rep(r'''  const so=document.getElementById("switchOrgBtn");if(so)so.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };''',
    r'''  const so=document.getElementById("switchOrgBtn");if(so)so.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };
  const agb=document.getElementById("addGroupBtn");if(agb)agb.onclick=()=>{ closeAcct(); openAddGroup(); };''')
rep(r'''  if(cloudOn()&&authState==="in"&&_orgCount>1) acct.push(`<button class="sheetrow" id="sheetSwitch">Switch roster ${ic("swap")}</button>`);''',
    r'''  if(cloudOn()&&authState==="in"&&_orgCount>1) acct.push(`<button class="sheetrow" id="sheetSwitch">Switch roster ${ic("swap")}</button>`);
  if(canAddGroup()) acct.push(`<button class="sheetrow" id="sheetAddGroup">Add a staff group</button>`);''')
rep(r'''  const sw=document.getElementById("sheetSwitch"); if(sw)sw.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };''',
    r'''  const sw=document.getElementById("sheetSwitch"); if(sw)sw.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };
  const sag=document.getElementById("sheetAddGroup"); if(sag)sag.onclick=()=>{ _moreOpen=false; render(); openAddGroup(); };''')
# the first load of a group this device just made: after the empty record is normalised, or after a local seed
rep(r'''      try{normalize();}catch(e){ S=defaultState(); } if(!_hadPriv){ try{await cloudSave();}catch(_){} } } else { load(); await cloudSave(); } cloudState="connected";''',
    r'''      try{normalize();}catch(e){ S=defaultState(); } if(groupFirstLoad()){ try{await cloudSave();}catch(_){} } if(!_hadPriv){ try{await cloudSave();}catch(_){} } } else { load(); groupFirstLoad(); await cloudSave(); } cloudState="connected";''')
# the audit sentence
rep(r'''"settings.board":"Changed the department board settings",''', r'''"settings.board":"Changed the department board settings","group.create":"Created the staff group",''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/dg7-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 8`, then `892 passed, 0 failed`.

- [ ] **Step 5: Rewrite the runbook's Part A.** Create `$SP/dg7-runbook.py` (it edits `MYROSTA-GROUP-SETUP.md`):

```python
rep(r'''Today this is two SQL lines (an in-app "Add staff group" form is Phase 4 of MYROSTA-MULTIORG-BUILD.md):''',
    r'''**In the app (since 16 Sep 2026):** an admin of any group at the hospital taps their initials (top right; More on a phone) → **Add a staff group**, types the group's name, what its people are called, and optionally a second admin's email, and taps **Create**. The app switches into the new group, empty, and the *What kind of group is this?* card greets them. The group id is generated (`swift-nurses`), never typed. Nothing below is needed for that.

**Support path (SQL), for a hospital that has no group yet or an admin who cannot sign in:**''')
rep(r'''| **Scribe follows a consultant's shift** | Small build, after the site's consultants are live |''',
    r'''| **Scribe sees the consultants on a shift** | Built 16 Sep 2026: Settings → Group → *Show on the booking sheet* names the groups whose people appear under each half of the day sheet and the Day board, read-only. A hard link to one consultant is not built |''')
rep(r'''| **"Who's on today" across groups** | MYROSTA-DEPARTMENT-BOARD.md **v2** — 4–6 days, after the production cutover |''',
    r'''| **"Who's on today" across groups** | Built 16 Sep 2026: Day board → **Whole department**, once each group switches on *Publish to the department board* (Settings → Group). Names, slots and times only |''')
```

- [ ] **Step 6: Apply it and commit.**

```bash
python3 $SP/rep.py MYROSTA-GROUP-SETUP.md $SP/dg7-runbook.py
git add app.html tests/suite.js MYROSTA-GROUP-SETUP.md
git commit -q -m "Department groups: an admin adds a staff group from their account menu: one database call makes the registry row, the empty record and the admins, and the app reloads into the new group, which takes its name and what its people are called on first load. The runbook points here" && git log --oneline -1
```

Expected: `replacements: 3`.

---

### Task 8: Release — prove the guards, the release note, the synced copies, the browser check

**Files:**
- Modify: `app.html` (`WHATS_NEW`, `const BUILD`), `CHANGELOG.md`, `deploy/app.html`, `preview.html`, `deploy/demo.html`
- Test: `tests/suite.js` (the `department groups` block), `$SP/dg-mutate.py`

- [ ] **Step 1: Write the failing test for the release copy.** Create `$SP/dg8-suite.py`:

```python
rep(r'''      // ---- department groups: later tasks add their tests above this line''', r'''      // ---- release
      T("release: What's new names the board and the group sheet on the release day, in three lines", WHATS_NEW[0].on==="2026-09-16" && /Who's on/.test(WHATS_NEW[0].title) && WHATS_NEW[0].lines.length===3 && WHATS_NEW[0].lines.some(function(l){ return /whole department/i.test(l); }) && WHATS_NEW[0].lines.some(function(l){ return /Add a staff group/.test(l); }) && BUILD==="2026-09-16");

      // ---- department groups: later tasks add their tests above this line''')
# the two open-swaps tests pinned the NEWEST note; that note is now one place down, so they find it by its date
rep(r'''WHATS_NEW[0].title==="Swap without naming a colleague" && WHATS_NEW[0].lines.join(" ").indexOf("Ask everyone")>=0; })());''',
    r'''WHATS_NEW.filter(function(x){ return x.on==="2026-09-15"; })[0].title==="Swap without naming a colleague" && WHATS_NEW.filter(function(x){ return x.on==="2026-09-15"; })[0].lines.join(" ").indexOf("Ask everyone")>=0; })());''')
rep(r'''        var l=WHATS_NEW[0].lines;
        return l.length===3 && l.join(" ").indexOf("every shift")<0''',
    r'''        var l=WHATS_NEW.filter(function(x){ return x.on==="2026-09-15"; })[0].lines;
        return l.length===3 && l.join(" ").indexOf("every shift")<0''')
```

- [ ] **Step 2: Write What's new and the changelog.** Create `$SP/dg8-app.py`:

```python
rep(r'''const BUILD="2026-09-15"''', r'''const BUILD="2026-09-16"''')
rep(r'''const WHATS_NEW=[{on:"2026-09-15",title:"Swap without naming a colleague"''',
    r'''const WHATS_NEW=[{on:"2026-09-16",title:"Who's on across the department",lines:["The Day board can show the whole department: a column per staff group, today or any day in the next fortnight, printable for handover.","Each group chooses whether to publish to the board (Settings → Group); only names, slots and times ever leave a group, and a scribe's booking sheet can name the consultants holding that shift.","Admins: Add a staff group from your account menu instead of asking for it."]},{on:"2026-09-15",title:"Swap without naming a colleague"''')
```

Create `$SP/dg8-changelog.py`:

```python
rep(r'''# Myrosta — changelog

## 15 Sep 2026 — Phone alerts: a claim no longer alerts every phone''', r'''# Myrosta — changelog

## 16 Sep 2026 — Who's on across the department, and a group made in the app

- **The Day board can show the whole department.** A switch, *This group · Whole department*, appears once a hospital has two groups: a column per staff group, today by default, any day from yesterday to a fortnight ahead, "on now" marked by the clock, a card per group on a phone, and a Print button for the handover sheet.
- **Each group decides whether it is on the board.** Settings → Group gains *Publish to the department board*, off by default and on the Get started list. A group that publishes writes a small digest of its live roster — names, slots, periods, times, on-call and call-ins, and who is away by name — thirty seconds after a change lands, and only when the digest actually changed. Contacts, pay, requests, notes and leave reasons never leave the group. Drafts and rounds still booking are never published.
- **A scribe's sheet can name the consultants on that shift.** The same card lists the hospital's other groups; the ones ticked appear, read-only, under each half on the day sheet and on the group's own Day board.
- **Add a staff group from the app.** An admin of any group at the hospital finds *Add a staff group* under their initials (More on a phone): the group's name, what its people are called, an optional second admin. The app opens the new group empty, with the *What kind of group is this?* card, and the group takes its name on its first load. `MYROSTA-GROUP-SETUP.md` now starts here; the SQL stays as the support path.
- **Werribee sees almost nothing new**: one group in its hospital, so no *Whole department* switch, no Get started row and nothing published. Settings → Group does gain the Department board section, which says there is no other group at the hospital yet, and its admin also gains **Add a staff group** in the account menu once the SQL has run (the button needs only a hospital id).
- **Deploy note (once, by hand):** paste `supabase/prod-department.sql` into the SQL editor after this build is live (it adds a hospitals registry, `create_group`, the board table and its readers; `my_orgs()` gains a fifth column), then run `supabase/isolation-test.html` v4 as two users before making any group. Edge Functions unchanged; nothing calls notify-shifts.

## 15 Sep 2026 — Phone alerts: a claim no longer alerts every phone''')
```

- [ ] **Step 3: Apply all three and run the tests.**

```bash
python3 $SP/rep.py tests/suite.js $SP/dg8-suite.py
python3 $SP/rep.py app.html $SP/dg8-app.py
python3 $SP/rep.py CHANGELOG.md $SP/dg8-changelog.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 3`, `replacements: 2`, `replacements: 1`, then `893 passed, 0 failed` and no `build:` lint line. (The two open-swaps tests that pinned the newest note now find their note by its date; the build test's rule — three site-neutral lines in the newest note — is kept.)

- [ ] **Step 4: Prove every guard is tested.** Create `$SP/dg-mutate.py`. Each mutation breaks one rule in a copy of the repo; the suite must fail on every copy.

```python
# $SP/dg-mutate.py — python3 $SP/dg-mutate.py ; exits 1 if any mutation survives
import pathlib, subprocess, shutil, sys, os
SP = pathlib.Path(os.environ.get("SP", os.path.dirname(os.path.abspath(__file__))))
root = pathlib.Path(os.environ.get("ROOT", "/Users/ranjithkandavelu/Desktop/Claude/Myrosta")); work = SP / "dgmut"   # ROOT: a tree with every task applied
BS = chr(92)
def fix(t): return t.replace("@U@", BS + "u")
M = [
 ("window from yesterday", "const from=iso(addDays(parseISO(todayISO),-1));", "const from=todayISO;"),
 ("published only", 'return !!cyc&&!cyc.archived&&cyc.status==="published"; }', 'return !!cyc&&!cyc.archived&&cyc.status!=="draft"; }'),
 ("hash gate", "if(h===_digestHash&&!force)return null; _digestHash=h;", "_digestHash=h;"),
 ("markup stripped", "replace(/[<>@U@0000-@U@001f@U@007f]/g,\"\")", "replace(/[@U@0000-@U@001f@U@007f]/g,\"\")"),
 ("no publish while off", "const on=!!(S.board&&S.board.publish); if(!on&&!force)return null;", "const on=!!(S.board&&S.board.publish);"),
 ("own timer", "_digestTimer=setTimeout(digestPublish,30000); return true;", "_cloudTimer=setTimeout(digestPublish,30000); return true;"),
 ("two groups for the department", "hospGroups().length>=2; }", "hospGroups().length>=1; }"),
 ("own row never from the cache", "return (list||[]).filter(x=>x&&x.org!==_org).map(", "return (list||[]).filter(x=>!!x).map("),
 ("own column live on screen", "if(g.org===_org)return {org:g.org,label:g.label,data:buildDigestAll(S,today),updated:null,own:true};", "if(false)return null;"),
 ("names escaped on the board", '<span class="grow">${escapeHTML(e.n||"")}</span>', '<span class="grow">${e.n||""}</span>'),
 ("away escaped on the board", 'display:inline-block">${escapeHTML(String(n))}</span>', 'display:inline-block">${String(n)}</span>'),
 ("sheet shows only the chosen half", 'es=((day&&day.on)||[]).filter(e=>(e.p||"")===p);', 'es=((day&&day.on)||[]);'),
 ("first load only once", "if(!groupIsFresh())return false;", ""),
 ("only an admin adds a group", 'return cloudOn()&&authState==="in"&&_realAdmin&&!!_orgHospitalId; }', 'return cloudOn()&&authState==="in"&&!!_orgHospitalId; }'),
 ("cst appears nowhere", "if((a&&a.kind===\"leave\")||", "if((a&&(a.kind===\"leave\"||a.kind===\"cst\"))||"),
]
def sync():
    subprocess.run(["rsync","-a","--delete","--exclude",".git","--exclude","*.mp4","--exclude","graphify-out","--exclude","myrosta-deploy.zip",str(root)+"/",str(work)+"/"],check=True)
survived = []
for name, old, new in M:
    sync(); app = work / "app.html"; t = app.read_text(encoding="utf-8"); o = fix(old); n = fix(new)
    if t.count(o) != 1: print("ANCHOR MISSING for %r: %d" % (name, t.count(o))); survived.append(name); continue
    app.write_text(t.replace(o, n), encoding="utf-8")
    subprocess.run([sys.executable, "tools/build-demo.py"], cwd=work, capture_output=True)
    out = subprocess.run([sys.executable, "tests/run.py"], cwd=work, capture_output=True, text=True).stdout
    killed = ("failed" in out and " 0 failed" not in out) or "HARNESS ERROR" in out
    print(("killed  " if killed else "SURVIVED") + "  " + name)
    if not killed: survived.append(name)
print("mutations:", len(M), "survived:", len(survived)); sys.exit(1 if survived else 0)
```

```bash
SP=$SP ROOT=/Users/ranjithkandavelu/Desktop/Claude/Myrosta python3 $SP/dg-mutate.py
```

Expected: fifteen `killed` lines and `mutations: 15 survived: 0`. A `SURVIVED` line means a guard has no test that bites: add the test to the block before going on, never weaken the guard.

- [ ] **Step 5: Sync the deployed copies and rebuild the demo.**

```bash
python3 - <<'PYEOF'
import pathlib, re
root = pathlib.Path("/Users/ranjithkandavelu/Desktop/Claude/Myrosta")
app = (root / "app.html").read_text(encoding="utf-8")
(root / "deploy" / "app.html").write_text(app, encoding="utf-8")
m = re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",', app); assert m
(root / "preview.html").write_text(app.replace(m.group(0), 'const CLOUD={ url:"", key:"",', 1), encoding="utf-8")
print("synced deploy/app.html and preview.html")
PYEOF
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
python3 tests/run.py deploy/app.html 2>&1 | tail -1
```

Expected: `synced deploy/app.html and preview.html`, then `893 passed, 0 failed` for both `app.html` and `deploy/app.html`.

- [ ] **Step 6: Check it in the browser.** (This needs the Browser pane, so the controller does it; an implementer without one skips it and says so.) The demo runs in local mode, where the cloud is off, so the board and the group sheet cannot show there; what can be checked is that nothing regressed. Start the `landing` preview (it serves `deploy/`) and open `http://localhost:8899/demo.html`. Clear the site's local storage first. As Dr Jordan Lee: open **Day board** and confirm it shows the group as before with no *Whole department* switch; open **Book shifts**, tap a day, confirm the sheet reads as before; switch **View as → Admin**, open **Settings → Group** and confirm there is no *Department board* section and the account menu has no *Add a staff group* row; read the console for errors. Then, on staging (the owner's job, recorded in the report): sign in as User A, Settings → Group → *Publish to the department board*, Day board → *Whole department*, and as User B the column for A appears within a minute.

- [ ] **Step 7: Commit the release.**

```bash
git add app.html tests/suite.js CHANGELOG.md deploy/app.html deploy/demo.html preview.html
git commit -q -m "Department groups release: Who's on across the department from the Day board, each group's Publish switch, the scribes' sheet line, and Add a staff group from the account menu. 893 passes, 15 mutations killed. Deploy note: paste supabase/prod-department.sql after this build is live and run the isolation page v4" && git log --oneline -1
```

Then tell the owner, in this order: push; wait for myrosta.com.au to carry build 16 Sep 2026; paste `supabase/prod-department.sql`; run `supabase/isolation-test.html` v4 as two users on production; only then make SWIFT's four groups from the account menu and switch on *Publish to the department board* in all five.
