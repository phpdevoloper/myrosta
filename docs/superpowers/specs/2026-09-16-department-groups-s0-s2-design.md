# Department groups S0–S2 — add a group, the digest, Who's on · design · 16 Sep 2026

**Programme:** `2026-09-16-staff-group-modules-programme.md` (sub-projects S0, S1, S2).
**Status:** approved in brainstorm; ready for a plan.
**Supersedes:** MYROSTA-DEPARTMENT-BOARD.md v2 where they differ (v2's schema and rules are kept; the UI placement, window and the group-creation flow are new here).

## 1. Goal

After this ships, a hospital admin can make a staff group from inside the app, every group can publish a safe extract of its live roster, anyone in the hospital can open one **Who's on** board across all groups, and a scribe's booking sheet shows which consultants hold the shift they are picking. SWIFT's four remaining groups are created this way.

**Non-goals:** the console (S5), tags and rules (S3), own hours (S4), any write from one group into another, realtime push of board changes (polling is enough), a public or unauthenticated board.

## 2. Database (one idempotent SQL file: `supabase/prod-department.sql`; staging copy `supabase/staging-department.sql`)

### 2.1 Hospitals become ids

```sql
create table if not exists hospitals ( id text primary key, name text not null, created timestamptz default now() );
alter table orgs add column if not exists hospital_id text references hospitals(id);
-- backfill: one hospital per distinct non-empty orgs.hospital string, id = slug of the name
```

`orgs.hospital` (free text) stays for display; after backfill it is written only by `create_group`. `my_orgs()` gains a fifth column, `hospital_id`, after its existing four (`org, role, label, hospital`), so the picker and `resolveOrg()` keep working; `resolveOrg()` stores it as `_orgHospitalId` when present and `""` on a database that has not had this SQL (then nothing publishes and no switch appears). `S.branding.hospital` stays an app-side display override for the masthead only; it never reaches the database.

### 2.2 `create_group`

```sql
create or replace function public.create_group(p_sibling_org text, p_label text, p_noun text,
                                               p_admin2_email text default null)
returns text language plpgsql security definer set search_path=public as $$
-- 1. require is_admin_member(p_sibling_org); take its hospital_id (must be non-null)
-- 2. org id = hospital_id || '-' || slug(p_label); if taken, append -2, -3 …
-- 3. insert orgs(org,label,hospital,hospital_id); insert org_state(org,'{}'::jsonb,now())
-- 4. insert roster_members(org,email,role,name,phone) for the caller, copying email AND phone
--    from their p_sibling_org membership row so either sign-in works; role 'admin'
-- 5. if p_admin2_email is given: insert roster_members(org, lower(p_admin2_email), 'admin')
-- 6. return the new org id
$$;
grant execute on function public.create_group(text,text,text,text) to authenticated;
```

Rules: only an admin of a group in the hospital may add a sibling group; the caller never supplies the hospital; the label is trimmed and limited to 40 characters; `p_noun` is stored by the app into the new group's `S.branding.roleNoun` after it switches in (the registry does not carry the noun — it is cosmetic, not identity). Every insert is `on conflict do nothing` except the caller's admin row, which upserts to `role='admin'`.

### 2.3 `board_slice` (as v2 §3, with the hospital registry)

```sql
create table if not exists board_slice (
  hospital_id text not null references hospitals(id) on delete cascade,
  org         text not null references orgs(org) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated     timestamptz not null default now(),
  primary key (hospital_id, org) );
alter table board_slice enable row level security;
revoke all on public.board_slice from anon;
grant select, insert, update on public.board_slice to authenticated;
revoke delete on public.board_slice from authenticated;
-- read: any member of any group in this hospital
-- write (insert/update): only your own group's row, and only under that group's real hospital_id
```

`updated` is set by a trigger to `now()` on every write; the client's value is ignored. A check constraint rejects `octet_length(data::text) > 131072` (128 KB).

### 2.4 `hospital_groups` and `board_for_org`

```sql
create or replace function public.hospital_groups(p_org text)
returns table(org text, label text) language sql security definer set search_path=public as $$
  -- require is_member(p_org); return (org, label) for every orgs row sharing that org's hospital_id, ordered by label
$$;
```

The app calls it once per session when the Day board or the Group card opens; its rows drive the *Whole department* switch (shown when it returns two or more groups) and the *Show on the booking sheet* checkboxes. It reveals only registry labels, which the picker already shows to every member of the hospital.

```sql
create or replace function public.board_for_org(p_org text)
returns table(org text, label text, hospital_id text, hospital text, data jsonb, updated timestamptz)
language sql security definer set search_path=public as $$
  -- require is_member(p_org); return every board_slice row whose hospital_id = that org's hospital_id,
  -- joined to orgs for label, ordered by label
$$;
```

Group labels come from the registry, never from the payload, so no group can rename itself onto the handover sheet. The reader learns the hospital from their own membership, never from a client-supplied id.

### 2.5 Isolation test v4 (`supabase/isolation-test.html`)

Four new probes, run as User A and User B on staging, then on production before SWIFT's groups exist:

1. Unsigned (anon key, no session) `select` on `board_slice` returns 0 rows or an error.
2. A member of org A cannot insert or update a `board_slice` row for org B (0 rows affected, or RLS error).
3. A member of hospital A calling `board_for_org` or `hospital_groups` with their own org sees nothing from hospital B; calling either with an org they don't belong to errors.
4. A non-admin member calling `create_group` errors; an admin's call creates a group whose id the caller can then see in `my_orgs()`.

Plus the existing assertion that `relrowsecurity` is true for every table in `public` now includes `hospitals` (read-only to authenticated) and `board_slice`.

## 3. App state (per group, in the blob)

```js
S.board = { publish:false, show:[] }   // publish: this group's digest goes to the board; show: sibling org ids to display on the booking sheet
```

`normalize()` seeds it. Both are group-level (not per cycle): they are preferences about visibility, not roster rules. `mergeOnto` treats `board` as a plain top-level key (last device to change it wins; fine for two booleans and a list).

Local, per device, never in the blob: `_boardCache = { rows:[], fetched:0 }` and `_digestHash`, `_digestTimer`.

## 4. S1 — the digest

### 4.1 `buildDigest(S, cyc, todayISO)` — pure

Takes the state, the cycle and today; **never** calls `active()`, `cset()`, `effShiftTimes()` or `zoneLabel()` (they read per-device state). Reads `cyc.settings.zones`, `shiftTypesOf(cyc)`, `cyc.assign`, `cyc.oncall`, call-ins and `S.leave` for the window.

Window: from **yesterday** (`todayISO − 1`) to the **end of the cycle**. Only cycles with `status === "published"` and not archived (rolling "live" is `published`). If several published cycles overlap the window (a rolling cycle running while the next is published early), all are included; a day appears once.

Payload:

```js
{ v:1, noun:"nurse", days:{ "2026-10-26":{ on:[{n:"Ava Ng", r:"Triage", p:"AM", t:"10:00–17:00"},
                                             {n:"Sam Lee", r:"Resus", p:"PM", t:"17:00–22:00", oc:true},
                                             {n:"Ky Tran", r:"", p:"", t:"14:00–18:00", ci:true}],
                                         away:["Jo Park"] } } }
```

- `n` = the person's display name (`s.name`), `r` = zone label for that half (blank for a call-in), `p` = "AM" or "PM" (a whole-day shift produces two entries, one per half, each with the type's times), `t` = the shift's real times from the type (later S4's override), `oc` = holds an on-call window that day (a rider on the entry of the shift it follows, or its own entry with `r:""` when it is a stand-alone window), `ci` = a call-in with its logged hours.
- `away` = names on approved leave or marked unavailable that day. No leave code, no reason.
- Never included: emails, mobiles, payroll ids, EFT, quota, requests, notes, tokens, CST days (a CST day is neither on nor away).
- Entries sorted by `(p, r, n)`; days by key; keys serialised in sorted order. Two devices holding `S.staff` in different order, or different `S.activeId`, produce identical bytes (tested).
- Names are stored as plain text; the renderer escapes. The builder additionally strips `<`, `>` and control characters from `n` and `r` so a hostile name cannot even reach another group's device intact.
- If the serialised payload exceeds 120 KB, drop days from the far end until it fits and set `truncated:true`.

### 4.2 Publishing

`digestPublish()` runs when all of: cloud on, signed in, `S.board.publish`, the hospital known (`_orgHospitalId` from `my_orgs()`, §2.1; empty on a database without this SQL → no publishing). It builds the digest for every published cycle, computes a short hash of the bytes, and if the hash differs from `_digestHash`, upserts `board_slice` (`hospital_id` from `_orgHospitalId`, `org` = `_org`) and remembers the hash. Errors are logged and retried on the next trigger; never toasted to staff.

Triggers, all through **its own** 30-second trailing timer (`_digestTimer`) — never `_cloudTimer`, `_savePending` or `_orgUpdated`:

- after every successful `cloudSave` and `cloudCommit`;
- after a remote apply (realtime handler or CAS reload), because another device's change may be the one that matters;
- on `setCycleStatus` (a cycle taken back to draft publishes its days as empty on the next build — the build simply no longer includes it);
- when `S.board.publish` is switched on (immediate) or off (immediate write of `{v:1, noun, days:{}}` — delete is revoked, so an empty digest is how a group leaves the board).

Any device of the group may publish; the hash gate stops loops, and because the bytes are deterministic two devices race to write the same content.

### 4.3 Reading

`boardFetch()` calls `board_for_org(_org)`, keeps the rows in `_boardCache` with the fetch time, and drops the calling group's own row in favour of the live local roster (so the group's own column is never stale). Refresh on opening the department view, every 60 s while it is open, and on a Refresh button. A row older than 15 minutes shows "updated 22 min ago" beside the group name; a group with no row shows "not published yet".

## 5. S2 — Who's on

### 5.1 Day board switch

`viewDaily()` gains a segmented control **This group · Whole department** next to Day / Week, shown only when cloud is on and `hospital_groups(_org)` returns two or more groups (§2.4). `dailyScope` is per-device UI state like `dailyMode`.

**Whole department, desktop:** one column per group in registry-label order — the group name as header with its noun and "updated …" line; under it a section per period (AM, then On call / call-ins, then PM, matching the group view) listing `r · n`; then *Away* as a muted list; "on now" rows highlighted when the clock is inside `t`. Date navigation is the existing prev / date / next, limited to −1 … +14 days from today (the digest carries the whole cycle, but the board is a day sheet). Print: a one-page landscape sheet, "Printed <date> from Myrosta" foot, as the fairness summary prints.

**Phones:** one card per group, collapsed to a count line ("3 nurses · 2 on now"), tap to expand.

Rows are built with `document.createElement` / `textContent` — never string-interpolated HTML — and the six existing `nameOf()` sites that interpolate raw into `innerHTML` are fixed in the same pass (board v2 §8).

### 5.2 Scribes' booking sheet

Settings → Group card: **Show on the booking sheet** — checkboxes for the hospital's other groups (from `hospital_groups`, §2.4), saved to `S.board.show`. In `daySheetHTML(isoD)`, under each period's cover line, one muted line per chosen group: "Consultants on: Dr A · Resus, Dr B" from `_boardCache` (fetched on opening the sheet if older than 60 s); "Consultants haven't published to the board" when there is no row; nothing when `show` is empty. Read-only; no link to the entry, no effect on `canBook`.

The same line appears in the group's own Day board (This group view) under each period, so an admin placing scribes sees the consultants too.

### 5.3 Checklist and settings

- Get started gains **"Publish to the department board"** (done when `S.board.publish` is on), anchor the Group card, shown only when cloud is on and `hospital_groups` returns two or more.
- Group card gains the *Publish to the department board* switch (with the sentence "Shares names, slots and times with the other groups at <hospital>. Never contacts, pay or leave reasons.") and the *Show on the booking sheet* checkboxes.
- Audit: `settings.board` ("Changed the department board settings") — a string-literal key with an `AUDIT_WORDS` sentence.

## 6. S0 — add a staff group

**Where:** the account popover on desktop and the More sheet on phones, a row **+ Add a staff group** under Switch roster, shown when cloud is on, the person is an admin of the current group, and the current group has a hospital (`_orgHospitalId`).

**The sheet:** Group name (required), *What are its people called?* (singular, the same datalist as the Group card), *Second admin's email* (optional). Primary button "Create <name>". Copy under it: "You become its admin. It starts empty; the next screen asks what kind of group it is."

**On save:** call `create_group(_org, label, noun, admin2)`. On success: write `myrosta_org = <new id>` and `location.reload()` (the existing switch path — no in-place org swap, so no cache can bleed between groups). On the first load of the new group the app sees an empty blob, seeds `defaultState()`, sets `S.branding.name = label`, `S.branding.roleNoun = noun`, logs `group.create` ("Created the staff group") in the new group's audit, and shows the *What kind of group is this?* card as today. The label typed is also the registry label, so the picker shows it at once.

Errors shown in the sheet in words: "Only an admin can add a group" · "A group needs a name" · "Couldn't reach the server — try again" · "That name is taken here — the id would clash" (the function appends -2 instead, so this last one should not occur; it is the fallback).

`MYROSTA-GROUP-SETUP.md` Part A is rewritten to point here; the two SQL lines remain as the support path.

## 7. Tests

**Unit (tests/suite.js, self-contained blocks, relative dates):**
- `buildDigest`: published cycle only (draft, open, closed, archived excluded); window from yesterday to cycle end; a whole-day shift yields two entries with its own times; an on-call holder gets `oc`; a call-in appears with its hours and no zone; leave and UA appear in `away` by name only; CST days appear nowhere; no key other than `n r p t oc ci` ever appears on an entry; determinism (two permuted `S.staff`, two different `S.activeId`, identical bytes); the 120 KB truncation; hostile characters stripped from names.
- Publishing: hash gate (same bytes → no write); publish switch off → empty digest written; no publish when cloud off, when the hospital is unknown, when the switch is off; the digest timer is not `_cloudTimer` (stub both and assert independence).
- Board rendering: rows rendered with `textContent` (a name containing `<b>` renders literally); own group's column comes from local state; "not published yet" and "updated N min ago" states.
- Booking sheet: chosen sibling groups' lines appear under the right period; nothing when `show` is empty; the line has no data-book / data-pick attribute.
- S0: the create sheet is hidden for non-admins and without a hospital; success path writes `myrosta_org` and reloads (stub `location.reload`); the first load of an empty blob applies name and noun and logs `group.create`.

**Lints:** `AUDIT_WORDS` sentences for `settings.board` and `group.create`; the existing audit-key lint; demo equality (the demo is local-mode and never shows the board switch — the seed is unchanged).

**Integration:** isolation test v4 (§2.5) on staging, then production. A manual check on staging with two groups: publish from group A, open the board in group B, see A's column; take A's cycle back to draft, see A's column empty within a minute.

## 8. Rollout

1. Paste `supabase/prod-department.sql`; run isolation test v4 on production; confirm `my_orgs()` still answers for Werribee.
2. Push the app build (BUILD = CHANGELOG date). Werribee sees nothing new: one group in its hospital, so no switch, no board row, no checklist item.
3. In SWIFT · Consultants: **+ Add a staff group** ×4 (Nurses, Junior doctors, Scribes, Clerical/admin); in each, the kind card, then Get started; switch on *Publish to the department board* in all five; in Scribes, *Show on the booking sheet: Consultants*.
4. Guides: a Who's on section in both SWIFT guides; the admin guide's go-live checklist gains "Publish to the department board".

## 9. Risks and how the design meets them

| Risk | Answer |
|---|---|
| One group overwrites another's board data | One row per (hospital, group); the write policy checks `is_member(org)` and the row's real `hospital_id` |
| A typo splits or merges hospitals | Hospitals are ids in a registry; the client never sends one |
| Republish loops between devices | Deterministic bytes + hash gate; server-stamped `updated` |
| A board publish strands a roster save | Own timer; never touches `_cloudTimer`, `_savePending`, `_orgUpdated`, `_remoteBase` |
| Stored XSS across groups | Names sanitised at build, rendered as text, six raw sites fixed |
| Draft or half-built roster broadcast | Only `published` cycles; a cycle taken back to draft drops out on the next build |
| A hostile client pushes megabytes | 128 KB check constraint; 120 KB client cap with truncation |
| Adding a group from the wrong seat | Only an admin of a sibling group; the hospital is derived server-side; audit in the new group |
| Cache bleed on switching into the new group | Reload through the existing `myrosta_org` path, which the cutover already hardened |

## As built (final review, 17 Sep 2026)

- **F1** — `groupFirstLoad()` sets only `S.branding.roleNoun`; the new group's name comes from the registry label (`groupName()` falls back to `_orgLabel`), not from first load, so `groupIsFresh()` stays true and the *What kind of group is this?* card shows.
- **F2** — `openDaySheet()` calls `groupsFetch()` alongside `boardFetch()` whenever the group has chosen something to show, so the scribes' sheet line has `_hospGroups` on a fresh page load, not only after the Day board has been opened once.
- **F3** — a switch-OFF write that fails is retried: a module-level `_digestPendingOff` flag, set by `setBoardPublish(false)`, keeps `digestSchedule()` arming its 30-second timer (and `digestPublish()` treating the off-write as forced) until the write lands and `digestLanded(false)` clears it.
- **F4** — the isolation page's v4 board probes: the "other org" `board_for_org` probe is gated by `single` like its neighbouring forgery probe instead of a hardcoded `test-orgC`; an authenticated unfiltered `board_slice` read must return only this hospital's rows; a delete-revoked probe (impossible filter); an own-org write under a forged `hospital_id` must be denied; a seeded `board_slice` row for `test-orgC` under `other-hospital` gives the "same hospital only" probes a foreign row to fail on.
- **F5** — `prod-department.sql` (and, identically, `staging-department.sql`) section 7 gains a verification query grouping `orgs` by `hospital_id`, so a backfill that accidentally merges two tenants whose hospital names slug alike is visible before anyone goes on.
- **M5** — `digestTrim`'s 120 KB cap is measured in UTF-8 bytes (`utf8Len`), not JavaScript characters, so the server's 131072-byte check can never reject what the client kept.
- **M6** — the release is dated 17 Sep 2026 (`BUILD`, `WHATS_NEW[0].on`, the CHANGELOG heading, and the release test all moved together; the clock rolled per Decision 11).
