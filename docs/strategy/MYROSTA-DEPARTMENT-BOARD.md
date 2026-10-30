# Myrosta — "Who's on today" (department board) · spec v2 · 18 Aug 2026

**The idea:** one screen showing who is on **right now across every staff group** in the hospital — consultants, junior doctors, nurses, scribes, admin. The app version of the whiteboard in the department, and the feature that turns "five rosters" into "one department".

**Status:** designed, **not built**. Build it **after** the multi-org production cutover, not before (see §10).

> **v2 supersedes v1 (17 Aug).** An adversarial review found v1's schema structurally unable to keep its own promise: a single row per hospital cannot stop one staff group overwriting another's data, because Postgres RLS is **row**-level. v1's DDL also shipped with no RLS at all, and its "deterministic rebuild" claim was false. Everything below is the corrected design. **Do not build from v1.**

---

## 1. Why it needs a design at all

Each staff group is stored as its **own record** (its own `org_state` row) — that is what keeps a 100-nurse roster from syncing to every scribe's phone, and what stops one group reading another's leave reasons. So the board cannot simply "read everything".

**The design: each group publishes a small digest of its own; everyone in the hospital reads all the digests.**

## 2. What is shared — and what is never shared

| Published | Deliberately NOT published |
|---|---|
| Staff **display name** | Email, mobile, employee number |
| **Role / zone** (Triage, Resus…) | EFT, quota, hours, anything pay-related |
| **Shift period + times** | Leave **reasons**, request threads, comments |
| On-call flag | Fairness/equity stats, audit trail |
| — | The leave **type** (AL/CME/sick) |

Group name and role noun are **not** in the payload — they are joined server-side from the registry (§4), so no group can publish under another group's name on a clinical handover screen.

Window: **today + 7 days** (configurable 1–14). Nothing historical.

## 3. Schema — one row per (hospital, group)

**This is the single most important correction.** v1 proposed one row per hospital with "each app writes its own slice". Postgres RLS is row-level: any policy permitting the nurses' app to UPDATE that row permits it to rewrite **every** byte, including the consultants' slice — a hand-rolled call skips the browser-side merge entirely. A scribe could blank the handover board or forge names into Resus, and v1's own promised test ("a member cannot overwrite another group's slice") could never pass.

```sql
create table if not exists hospitals ( id text primary key, name text not null );
alter table orgs add column if not exists hospital_id text references hospitals(id);

create table if not exists board_slice (
  hospital_id text not null references hospitals(id) on delete cascade,
  org         text not null references orgs(org) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated     timestamptz not null default now(),
  primary key (hospital_id, org)
);
alter table board_slice enable row level security;
revoke all on public.board_slice from anon;                     -- the anon key is embedded in the app
grant select, insert, update on public.board_slice to authenticated;
revoke delete on public.board_slice from authenticated;

-- read: any member of any group in this hospital
create policy "board read" on board_slice for select to authenticated
  using ( exists (select 1 from roster_members m join orgs o on o.org = m.org
                   where o.hospital_id = board_slice.hospital_id and public.is_member(m.org)) );
-- write: only your own group's row, and only under its real hospital
create policy "board write" on board_slice for all to authenticated
  using ( public.is_member(org)
          and exists (select 1 from orgs o where o.org = board_slice.org
                        and o.hospital_id = board_slice.hospital_id) )
  with check ( public.is_member(org)
          and exists (select 1 from orgs o where o.org = board_slice.org
                        and o.hospital_id = board_slice.hospital_id) );
```

Why this shape: it reuses `is_member(org)` — the helper already proven 12/12 by the isolation test — removes the shared-row merge entirely, removes CAS contention that would grow with group count, and makes opt-out or rename a row lifecycle instead of orphaned jsonb keys.

**Never reuse the roster's CAS token** (`_orgUpdated` belongs to `org_state`) for this table.

## 4. Hospital identity must be an id, not free text

Today there are **two** independent free-text hospital strings: `orgs.hospital` (registry) and `S.branding.hospital` (blob, editable by any group admin). No FK, no case folding. "Werribee Mercy ED" vs "werribee mercy ED" silently splits one department into two half-empty boards — and two unrelated sites that both type "ED" get **merged into one board**, a cross-hospital disclosure caused by a typo.

- `hospitals(id, name)` is the source of truth; `orgs.hospital_id` is a foreign key.
- The client **never** supplies the hospital on a write — the policy derives it from `orgs`.
- `S.branding.hospital` becomes display-only (or is dropped in favour of the registry name).

Serve the board through a security-definer `board_for_hospital(p_hospital_id)` that joins `orgs` and returns each group's **`label` from the registry**, so group identity is server-authored.

## 5. Slice payload

```js
{ days: { "2026-08-18": [ {n:"N. Taylor", r:"Triage", p:"AM", t:"10:00–17:00", oc:false} ] } }
```
~5–15 KB for a whole department. No group name, no role noun, no ids beyond what is displayed.

## 6. Building the slice deterministically (v1's claim was false)

Two devices in the same group would have produced **different bytes**, turning any "publish only if changed" gate into a republish loop:
- `effShiftTimes()` → `shiftTimesOf(active())`, and `active()` keys off `S.activeId`, which is deliberately **per-device**.
- `zoneLabel()` reads `S.zones`, which `hydrateCycleSettings()` points at the active cycle.
- `_mergeIdArray` returns `myAdds.concat(out)`, so two fully-synced devices legitimately hold `S.staff` in **different order**.

**Fix:** `buildSlice(cyc)` takes the cycle as an argument and must not call `active()`, `effShiftTimes()` or `cset()`. Read zones as `(cyc.settings && cyc.settings.zones) || S.zones || []`. Sort entries by `(staffId, period, zoneId)`, stringify with sorted keys, and hash-gate the write. **Test with two permuted `S.staff` arrays and two different `S.activeId` values → identical bytes.**

## 7. Publish policy

- **Only `status === "published"` cycles.** Never `open` — that is the cycle being self-rostered, so v1 would have broadcast a half-built roster and turned 30 people booking into tens of hospital-wide writes.
- **Its own `_boardTimer` / `_boardPending`, 30–60 s trailing debounce.** Never reuse `_cloudTimer` / `_savePending` — a board publish would cancel a pending roster save and strand a booking.
- `updated` stamped by the **server** (`now()`), not the client clock.
- **Size cap in the publish path** (reject > 64 KB) and a day-key whitelist, so no client can push megabytes into every phone in the department.
- Republish triggers must include **membership and staff-status changes**, or someone who has left stays named on the wall sheet for up to 7 days.

## 8. Rendering — escape everything

`escapeHTML()` exists but six `nameOf()` call sites interpolate raw into `innerHTML`. Today that is an admin attacking their own group; on a hospital-wide board it becomes **cross-tenant stored XSS** running in every group's session. Build board rows with `createElement`/`textContent`, sanitise at publish time, and fix the six existing sites in the same pass.

## 9. Where it appears

A **Today** tab (when the module is on): a column per group, today by default, ±7 days, "on now" highlighted by clock time. Phone: one card per group, collapsed to "3 nurses · 2 consultants · 1 scribe", tap to expand. Printable one-page department sheet for handover. Settings per hospital: board on/off (default **off**), window, show-away, visible-to — the last stored in a `hospital_board_cfg` table the **read policy actually reads**, not a UI-only claim.

## 10. Sequencing and size

**Build after the multi-org production cutover.** Building it first would put multi-org RLS, board RLS and four edge functions into a single production window and invalidate the isolation evidence already banked.

**Estimate: 4–6 days** (v1 said 2–3, which omitted the hospitals registry, the publish RPC, the settings table, the escaping sweep and the extra isolation probes).

New isolation probes required: an **unauthenticated** read of `board_slice` (the current test signs in before every probe, so it structurally cannot catch a missing-RLS bug); a member of group A writing group B's row; a member of hospital A reading hospital B's board; and an assertion that `relrowsecurity` is true for every table in `public`.

## 11. Open questions for the site

1. Show who is **on call** overnight even though nobody is rostered 23:00–10:00?
2. Should "away today" cross groups (fact only, no reason), or is presence-only enough?
3. Visible to **all staff**, or in-charge/admins only?
4. Printed morning sheet, or screen only?
