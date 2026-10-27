# Myrosta — B‑ready multi‑tenant foundation (build plan)

> **FULL ADVERSARIAL AUDIT + FIX PASS — 19 Aug 2026.** Four independent audits (app org-plumbing, SQL trio, edge functions, injection) over the finished branch: 20 findings, all fixed same day; 95/95 tests. Highlights: the ROLLBACK script would have aborted on a policy dependency (orgs-read-own uses is_member(text)) — the dependent policy is now dropped first; shared-device sign-out left the dirty-flag/merge-base behind (next sign-in would have pushed a wiped roster) — all three cache keys now cleared, and the boot merge additionally requires the cached blob to exist; a transient cloudLoad failure could have carried another group's boot-loaded cache into the session — now reloads this org's own cache or stops at a retry card; a token-refresh re-entry after another tab switched groups now reloads instead of mixing orgs; migration scripts were NOT idempotent (vestigial 2-col my_orgs → 42P13 on re-run) — removed; notify-rounds/notify-shifts gained an opt-in CRON_SECRET gate (they were publicly invocable), fail-closed member queries, per-cycle zone labels, counts-only responses; ics token fast-path serialisation fixed; **26 stored-XSS interpolations escaped** (staff names, leave codes, zone labels across messages/swaps/audit/planner/daily/next-shift) + spreadsheet-imported codes sanitised at import; verified sound by the same audits: orgKey scoping complete, push-send airtight (two audits independently), prod SQL contract matches the app exactly, cross-org XSS surface closed.
>
> **REALTIME VERIFIED ON STAGING — 19 Aug 2026:** with the org-scoped policies active, live sync still delivers and stays isolated — User A's channel received A's own org's writes (2/2), User B's own-org channel received B's (1/1), and B subscribed to org A's filter received **zero events**. Postgres_changes evaluates the new is_member(org) per subscriber correctly. The two-browser check remains a cutover gate (runbook 1.12).
>
> **PHASE 3 VERIFIED LIVE ON STAGING — 17 Aug 2026:** grouped picker renders "Test Hospital → Consultants / Nurses" (labels from the `orgs` registry via `my_orgs()`); as orgA admin, saving name/hospital/role/colour rebranded the header ("Test ED" + "Test Hospital" subtitle), the tab title, the `--brand-primary` var (#7A2E8E) and the role noun ("Add your nurses"); the equity feature flag hid the Equity tab live; **and orgB's record was untouched** (branding/features undefined; User B still cannot read orgA at all — 0 rows). Branding is per-org data, isolated by the same RLS.
>
> **PHASE 3 BUILT — 17 Aug 2026 (branch):** per-org **branding** (`S.branding`: name, hospital, roleNoun, primary colour → header, title, accent, `--brand-primary`), **feature flags** (`S.features`: rosteron, equity, planner, marketplace — default ON, gate tabs/buttons/cards), **role noun** (`ROLE()/ROLES()/ROLEC()` replace ~15 user-facing "consultant" strings; import parsers untouched), **hospital umbrella** (`orgs` registry table + `my_orgs()` returns label+hospital → picker groups by hospital), Admin settings "Organisation & branding" card. SQL additions are in `supabase/staging-multiorg.sql` (§5b) — re-run it on staging (idempotent) before re-testing the picker.
>
> **LIVE APP TEST PASSED — 17 Aug 2026** (staging build served at myrosta.com.au/staging-multiorg.html, wired to the staging DB, isolated storage key). Verified in the browser: **single-org user (+a)** → my_orgs() = 1 → no picker, straight in as Admin, `_org=test-orgA`, `_legacyDb=false`, ⇄ Org button hidden. **Two-org user (+ab)** → picker "Choose your organisation" lists test-orgA + test-orgB → pick orgB → choice saved → reload honours the saved choice (no picker) → loads orgB's data → matched to the staff record → staff view "User AB" → ⇄ Org button visible → click → choice cleared → picker returns. Also observed: a member of orgB with no Staff record correctly lands on the "No access yet" screen (strictness preserved). Note: `deploy/staging-multiorg.html` is a temporary unlinked/noindex page — DELETE it when multi-org merges.
>
> **ISOLATION TEST PASSED — 17 Aug 2026.** Run on the staging project via `supabase/isolation-test.html` after `supabase/staging-multiorg.sql`: **12/12 probes PASS as User A (orgA) and 12/12 as User B (orgB)** — other org's `org_state` and `roster_members` return 0 rows filtered and unfiltered; cross-org UPDATE affects 0 rows; cross-org UPSERT rejected by RLS ("new row violates row-level security policy"); own-org write allowed; DELETE revoked ("permission denied"). The hard gate is cleared; the same page must be re-run after ANY future RLS change. Note: staging has no SMTP — test users are password users created under Authentication → Users with Auto Confirm.
>
> **STATUS (10 Aug 2026):** Phase 2 (app-side org resolution + picker + org-scoped member ops) is **BUILT on branch `multiorg`** — with one improvement over this plan: `resolveOrg()` falls back to single-org mode when `my_orgs()` doesn't exist yet, so the app code is deployable *before* the SQL migration with zero behaviour change. Phase 1 SQL below is ready to run on a **staging** project. Phases 3–4 + the isolation test are next. Do not merge to main until the isolation test passes.

Goal: make Myrosta run as **one codebase / one deployment** serving many organisations, each fully isolated, so onboarding a new org is "insert a row + invite an admin" and updates ship everywhere at once. Your current org becomes **org #1** — no throwaway bridge, no data migration.

**Why this is feasible now (not a rewrite):** the hard parts already exist — real **Supabase Auth (JWT)**, an **RLS allow‑list** (`roster_members` + `is_member()`/`is_admin_member()` policies on `org_state`), a **per‑org blob** (`org_state` keyed by `org`), and realtime **already filtered by org** (`cloudSubscribe`, app.html:498). This plan only adds an **`org` dimension** to what's there.

---

## Guardrails / sequencing (read first)
1. **Do this AFTER the pilot.** Never run the migration or app surgery on the live project while staff are using it. Use a **staging Supabase project** (clone) + a branch of `app.html` first.
2. **Backward compatible by design.** The SQL defaults everything to `org='ed-default'`, so your existing data and members keep working through the migration. The app defaults `_org` to `CLOUD.org`, so each step is incremental — nothing breaks half‑done.
3. **Deploy order is APP → EDGE FUNCTIONS → SQL.** The new app is provably inert on the old schema
   (`_legacyDb` guards every org-aware write), and the new functions all carry pre-migration fallbacks,
   so both can ship early and safely. Doing SQL first would leave old cached browsers writing
   `roster_members` deletes with no `org` filter (`cloudMemberRemove`), which under the composite key
   strips a person from *every* organisation the caller administers.
4. **The isolation test proves RLS only.** It runs through the anon key, so it can never catch a bug in
   an edge function (those use the service-role key, which bypasses RLS entirely) and it never opens a
   Realtime channel. Both must be checked separately — see Phase 3b and the verification list.
5. **The isolation test (last section) is a hard gate.** Do NOT onboard a second real org until Org A is provably *denied* Org B.

---

## Phase 1 — SQL migration (org-scoped RLS)

> **Do not copy SQL out of this document.** The runnable, current scripts live in the repo — the
> block that used to sit here drifted out of date (2-column `my_orgs()` where the app now reads four,
> no `orgs` registry, and it silently dropped the `revoke delete` hardening):
>
> | Script | Use |
> |---|---|
> | `supabase/staging-multiorg.sql` | **Staging only.** Full schema + migration + test organisations and users. Says so in its header. |
> | `supabase/prod-multiorg.sql` | **The production migration.** No fixtures, no table creation; preconditions in the header; ends with three verification queries. |
> | `supabase/rollback-multiorg.sql` | **Rollback.** Policies and helpers only — see the warning below. |

**What the migration actually does:** adds `org` to `roster_members` (default `'ed-default'`, so every
existing row keeps working), swaps the primary key to `(org,email)`, replaces the two membership
helpers with org-scoped versions, repoints the three policies at them, adds `my_orgs()` and the `orgs`
registry, and re-asserts the delete hardening. **It never touches `org_state` row contents** — no
roster data moves, which is why the rollback is cheap.

## Phase 2 — App: runtime org resolution + picker
Replace the hardcoded org with a runtime value; resolve it from the user's memberships at sign‑in.

**2a. Introduce `_org`** (near the `CLOUD` const / the auth globals, app.html:376):
```js
let _org = CLOUD.org;          // default/bootstrap; overwritten at sign-in
let _orgChoices = [];          // for the picker when a user is in >1 org
```

**2b. Swap `CLOUD.org` → `_org`** in every data call (5 functions):
- `cloudLoad` (446), `cloudSave` (462/465/468/469), `cloudCommit` (478/483/487) — the `.eq("org", …)` and the upsert `{org: …}`.
- `cloudMembersLoad` (517) — add `.eq("org", _org)`; `cloudMemberAdd/SetRole/Remove` (518‑520) and the Sync upsert (533) — include `org:_org` in the row and `.eq("org",_org)` on delete.
- `cloudSubscribe` (498) — change `"org-"+CLOUD.org` and `filter:"org=eq."+CLOUD.org` to use `_org`. (Already org‑filtered — just the variable changes.)

**2c. Resolve the org in `handleAuth`** (539). After a session is established and *before* resolving the staff id, insert:
```js
async function resolveOrg(){
  const {data,error}=await _sb.rpc("my_orgs");
  const orgs = (!error && data) ? data : [];
  if(!orgs.length){ authState="denied"; return false; }          // not a member anywhere
  const saved = localStorage.getItem("myrosta_org");
  if(orgs.length===1){ _org=orgs[0].org; }
  else if(saved && orgs.find(o=>o.org===saved)){ _org=saved; }
  else { _orgChoices=orgs; authState="pickorg"; render(); return false; }  // >1 → pick
  localStorage.setItem("myrosta_org", _org);
  return true;
}
```
In `handleAuth`, once `session` exists: `if(!(await resolveOrg())) return;` then continue to load `_org`'s blob + members + resolve `S.viewAs` as today.

**2d. Add the picker screen** (in the auth render, alongside the `authState==="denied"` block, app.html:958):
```js
if(authState==="pickorg") return `<div class="card" style="max-width:440px;margin:24px auto"><h2>Choose your organisation</h2>
  <div class="sub">You have access to more than one.</div>
  <div class="flexbtns" style="flex-direction:column;gap:8px;margin-top:12px">
  ${_orgChoices.map(o=>`<button class="btn primary" data-pickorg="${o.org}">${o.org}${o.role==="admin"?" · admin":""}</button>`).join("")}</div></div>`;
```
Wire it: `data-pickorg` → set `_org`, `localStorage.setItem("myrosta_org",…)`, then re‑run the post‑resolve load (or simplest: `location.reload()` after saving the choice). Add a "Switch organisation" item under sign‑out for multi‑org users (clears `myrosta_org`, reloads).

**2e. Phase out hardcoded `adminEmails`/`allowedDomains`** → admin comes from `roster_members.role` per org (already supported via `_members`); keep `adminEmails` only as an emergency bootstrap.

---

## Phase 3 — Per‑org config (branding + feature flags) — *store in the blob*
Keep config as data in each org's `org_state` (already synced + RLS‑isolated — no new table/policies). Two blocks on `S`:
```js
S.branding = { name:"Myrosta", logoUrl:"", primary:"#0E7C66", sender:"noreply@myrosta.com.au" };
S.features = { rosteronExport:true, sms:true, leavePlanner:true /* … */ };
```
Apply at render (defaults = current look, so absent config is backward compatible):
- **Branding:** set the brand CSS var from `S.branding.primary`; header name/logo from `name`/`logoUrl`; `document.title`.
- **Features:** gate UI with `if(S.features?.rosteronExport){…}` etc.
An admin edits these in **Admin settings** (new "Branding" card). Because it's data, it works **identically whether you stay on separate‑project (A) or go multi‑tenant (B)** — this is the piece that keeps both paths open.

---

## Phase 3c — CRITICAL FIX: the device cache was not org-scoped (found by review, 18 Aug 2026)

**Defect (branch only — `main`/the live pilot never had org switching, so it was never exposed).** `const KEY="ed-roster-v1"` was a single cache key shared by every organisation, and neither the picker nor ⇄ Group cleared it. A person belonging to two staff groups with **one unsynced edit** in group A who switched to group B would hit the boot-merge path in `handleAuth` (`_dirty` + `_base` from group A merged onto group B's freshly loaded remote), and the debounced `cloudSave` 600 ms later would **write group A's staff, cycles, leave and audit into group B's live roster**. No attacker required — a legitimate dual-group member (exactly a hospital director across five groups) doing something ordinary. RLS cannot prevent it: they are a member of both.

**Fix.** `orgKey(sfx)` scopes the cache, its dirty flag and its merge base per organisation. The bootstrap organisation (`CLOUD.org`) keeps the bare key, so upgrading an existing single-org deployment orphans nobody's cached data. A second guard clears a stale dirty/base pair whenever the resolved org differs from `myrosta_last_org`. The push device id stays global (one identity per device). Seven regression tests pin it, including "group A's blob is invisible to group B" and "group A's own data survives for when they return".

**Verified:** the five-group staging demo was audited afterwards — all groups intact, no bleed.

## Phase 3b — SERVER-SIDE functions must be made multi-org too (added 18 Aug 2026)

**This was nearly missed.** The app and the database were made org-aware; the four Supabase Edge Functions were written when one organisation existed and were **not**. All four are now fixed on the branch — but they must be **redeployed**, and two env vars must be **unset**, as part of the migration.

| Function | Was | Now |
|---|---|---|
| `push-send` | 🔴 **Security hole.** Checked the allow-list across *all* organisations, then took the target org **from the request body** → any member of any organisation could push arbitrary notifications to another organisation's staff. | Allow-list check is scoped to the org in the body; falls back to unscoped on a pre-migration database. |
| `ics` (calendar feed) | Read one hard-wired org (`MYROSTA_ORG`) → every other organisation's calendar links would 404. | Resolves which organisation owns the token: fast `contains` lookup, falling back to a scan of all organisations. Existing subscribed links keep working. |
| `notify-rounds` | One org (`ORG`), **and** read the allow-list unscoped → could email other organisations' staff about this organisation's round. | Loops every organisation; allow-list scoped per org (legacy fallback); one failing org doesn't stop the rest. |
| `notify-shifts` | One org (`ORG`), **and hardcoded 08:00–16:00 / 15:30–23:30** → would tell any organisation with different hours the wrong times (also wrong for org #1 whenever shift times are edited — a live latent bug). | Loops every organisation; reads each shift's **own cycle** shift times, falling back to org default then built-ins. |

### Migration steps for the server side (do WITH the SQL migration)

1. Redeploy all four functions from `supabase/functions/*` (Edge Functions → each function → paste → Deploy).
2. **Unset `ORG`** on `notify-rounds` and `notify-shifts`, and **unset `MYROSTA_ORG`** on `ics`. If `ORG` is left set, that function silently serves only that one organisation — new organisations get no round emails and no shift reminders, with no error anywhere. (`ORG` is retained deliberately as an *optional* single-organisation restriction — useful for testing, dangerous if forgotten.)
3. Re-run the **isolation test**, and additionally verify by hand: a second organisation's staff member can load their calendar feed; `notify-rounds` invoked manually returns one result per organisation.

### Known limitation (accepted for now)

`ics` may fall back to scanning every organisation's state per request if the JSON containment filter isn't available. Fine at a handful of organisations; the proper fix is the long-noted "move calendar tokens to their own table", which becomes worthwhile as organisations grow.

## Phase 4 — Onboarding a new org (v1 = 2 SQL lines; console later)
```sql
insert into org_state(org,data,updated) values ('<neworg>', '{}'::jsonb, now()) on conflict do nothing;
insert into roster_members(org,email,role,name)
  values ('<neworg>','admin@neworg.org','admin','Admin') on conflict (org,email) do update set role='admin';
```
That admin signs in → `my_orgs()` returns `<neworg>` → they import their roster, set branding, add staff (which syncs their org's `roster_members`). Later: replace the SQL with a small **super‑admin "Create org"** form gated to a super‑admin role.

---

## THE ISOLATION TEST (hard gate — must pass before any 2nd real org)
Prove Org A cannot see Org B. Run against **staging** with two test orgs and two test users (userA ∈ orgA only, userB ∈ orgB only), using `@supabase/supabase-js` + the anon key:

1. Sign in as **userA** (OTP). Assert:
   - `rpc("my_orgs")` returns **only** `orgA`.
   - `from("org_state").select("data").eq("org","orgB")` → **0 rows** (RLS denies).
   - `from("org_state").update({data:{hacked:true}}).eq("org","orgB")` → affects **0 rows** / error.
   - `from("roster_members").select("*").eq("org","orgB")` → **0 rows**.
2. Repeat mirrored as **userB** against `orgA`.
3. Any non‑empty cross‑org read/write = **FAIL, do not ship.**

Automate this as a small Node script and re‑run it after any RLS change. This is the load‑bearing security of the whole model — treat it like the concurrency tests we run on `mergeOnto`.

---

## Rollback & effort
- **Rollback:** run `supabase/rollback-multiorg.sql` (policies + helpers only; ~10 lines of real work).
  ⚠️ **Do NOT revert the `(org,email)` primary key** — the earlier advice here said to "drop the org PK
  change last", which is wrong: reverting to `primary key (email)` *fails* as soon as one person belongs
  to two organisations, which is exactly the state you are in when rolling back, and it errors halfway
  through. It is also unnecessary — the old app never names `org`, and the column default keeps its
  writes landing on `ed-default`. Dropping `my_orgs()` alone is enough to return the new app to
  single-org mode.
- **Effort:** SQL ~1 h; app org‑resolution + picker ~½–1 day; branding/features theming ~½ day; isolation test ~1–2 h (mandatory). Total: a **contained developer task (days, not weeks)** because auth + RLS + per‑org blob already exist.
- **Who:** the RLS + isolation test genuinely want a developer's eyes; the app changes are in the same single‑file style you already maintain.

*General implementation guidance, not a substitute for a developer's review of the RLS before it holds real multi‑org data.*
