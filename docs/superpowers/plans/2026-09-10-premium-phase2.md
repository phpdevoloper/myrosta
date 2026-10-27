# Premium Phase 2 — Site 2's first hour · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Line numbers are from `main` at 9a0d5c5 (9 Sep 2026); re-grep before editing.

**Goal:** A new staff group's first hour makes sense: the app asks what kind of group it is and seeds honest defaults, staff never see a half-built draft, the audit log reads like a record, publishing asks properly and leaves a receipt, every empty screen points at the next step or a filled-in roster, and the admin can invite their people and publish with a message that really reaches them.

**Architecture:** Presentation, copy, one visibility layer (`draftHidden()` in `render()`'s dispatch), additive state (`cset().preset`, `cyc.statusLog`, `staff.invitedTs`, `S.outbox` merged by id), and one Edge Function extension (notify-rounds drains an outbox). Engine untouched (`canBook`, `pickCheck`, `setShift`, `cloudCommit`, `normalize` semantics); `render()`/`wire()` architecture and every existing id kept; no new tabs (NAV_ORDER fixed).

**Tech Stack:** as every phase (single-file vanilla JS, `python3 tests/run.py`, deploy = `app.html` + `deploy/app.html` + `preview.html`, `python3 tools/build-demo.py`; Deno for `supabase/functions/notify-rounds`).

**Spec:** `MYROSTA-PREMIUM-STRATEGY.md` Phase 2 (items 10–15) and its "Out of scope" list (no sample-data loader, no sign-in logging, no per-person reminder preference, no new tabs, no confetti). Design specs from the 9 Sep readers (workflow wf_78e22fb1-b73).

## Global Constraints

- Suite green (366 + 9 lints at start). `tests/suite.js:489–490` — a fresh `defaultState()` ticks nothing but the cycle: presets never call `markAnswered`.
- The pilot group (branding.name set, staff present) never sees a first-run or preset card; the demo seed sets `branding.name` so the demo never does either.
- Lints: no hex outside `:root`/`PALETTE`, no px font sizes, no emoji (SVG only), retired classes stay retired, `.ph{` forbidden.
- New top-level arrays that two admins may write concurrently go into `mergeOnto`'s `ID_ARRAYS`; new fields on a cycle merge per field on their own.
- Every task ends with `cp app.html deploy/app.html`, `python3 tools/build-demo.py`, suite green, one commit.

---

### Task 1: "What kind of group is this?" (item 10)

**Files:** `app.html` — `defaultState()` (~504), after `featOn()` (~857), the roleSuggest datalist (~1931), the fatigue hint (~2091), `prepareNext()` (~978), `setupChecklist()` (~3236, ~3243), `setupGuideHTML()` (~3267), `ensureStaff()` (~3027), `applyStaffList()` (~3209), the Add staff handler (~3986), `wire()` setup block after `renderZoneList()` (~4022), CSS after `.ckrow` (~225) and in the phone block (~435). `tests/suite.js` after line 490.

- [x] Tests: a fresh `defaultState()` has zones Resus/Acute/Fast track/Paeds (ids resus/acute/fast-track/paeds, no pmLabel), staffing 3–4, fairness snake; `viewSetup()` on a fresh admin renders `#card-kind` with six `[data-gkind]` tiles above `#card-guide`; `applyGroupKind("nurses")` sets roleNoun nurse, zones Triage + Staff nurse 1–3 (on S and cset()), cover 2–4, rounds, guarded, `S.features.cst===false`, `S.features.rosteron===false`, `cset().preset==="nurses"`, one `settings.preset` audit line, nothing answered, checklist role row shows the noun unticked ("from the preset"), zones row unticked; `staffDefaults()` gives 40/76 for nurses on an 8-week cycle and 20/76 with no preset; `applyGroupKind("scribes")` gives rolling; `applyGroupKind("other")` clears the noun; `applyGroupKind` returns false once staff exist; every preset's `cover[1] <= zones.length`; the pilot fixture never renders `#card-kind`; the existing 489–490 fresh-group test still passes.
- [x] Build per the presets spec: `defaultZones()`, `GROUP_KINDS`, `groupKind()`, `kindZoneNames()`, `groupIsFresh()`, `staffDefaults()`, `applyGroupKind()`, `groupKindCardHTML()`; `setupGuideHTML()` prepends the card while fresh; checklist `DEF=kindZoneNames()` + `nounSeeded`; the three staff-creation paths take `staffDefaults()`; `prepareNext` copies `preset`; datalist gains "junior doctor" and "clerk"; fatigue hint loses ROC+OC; `.kindgrid`/`.kind` CSS; wire `[data-gkind]` (Something else → `go("setup",{anchor:"brandCard"})` and focus `#brRole`).
- [x] Commit `"Premium 2: what kind of group is this? — six presets seed a fresh group; the defaults are no longer one hospital's codes"`.

### Task 2: A draft isn't shown to staff until it's published (item 11)
_(detail from the draft-hidden spec)_ `draftHidden(cyc)` = `!isAdmin() && cyc.status==="draft"`; the dispatch renders a calm card for roster/selfroster/daily/equity/my; staff's `#cycleSel` lists only non-draft cycles; staff land on the latest published (else open) cycle at sign-in and when a push turns their cycle into a draft; the stepper says "Staff don't see this cycle in the app until you publish it."; View as (a real admin) still sees drafts.

### Task 3: Audit log reads like a record (item 12)
_(detail from the audit spec)_ newest-first timeline with day headers, plain-word sentences for every action key (raw key as a muted tag fallback), Timeline | By person segment, filter chips (device-only), Download as CSV, seeded demo entries (DEMO_KEY bump).

### Task 4: Publish: a real dialog, then a receipt on the step (item 13)
_(detail from the publish spec)_ `openConfirm(opts)` → Promise, used by the `[data-status]` handler; `cyc.statusLog` written in `setCycleStatus` (`{to,ts,by,notified}`); done steps carry "Published Sat 20 Sept, 9:12 am · 36 notified".

### Task 5: Empty states point at a filled-in roster (item 14)
_(detail from the empty spec)_ `firstRunHTML()` on every admin tab while the group has no staff (template · upload · zones and cover · "See a filled-in roster" → demo, stripped from the demo build); staff empty states by phase; "Nobody yet — AM needs 4, PM needs 4"; Fairness empty state.

### Task 6: Invite your nurses; publish really notifies (item 15)
_(detail from the invite spec)_ checklist row + composer dialog (Copy message / Send to N by text and email), `S.outbox` drained by notify-rounds (CAS first, then send; `staff.invitedTs`), publish enqueues one message per person once per cycle, group name in every round message, the denied screen reworded for staff. Deploy: `supabase functions deploy notify-rounds`; test on the staging org first.

### Task 7: Sync, measure, skeptics, docs, merge
- [x] Sync copies, rebuild demo, measure at 375/1280, skeptic Workflow (3 lenses + refuters), fix confirmed, CHANGELOG, strategy note, as-built, fast-forward `main`, user pushes.

## As built (10 Sep 2026)

- All six items shipped on `premium-phase2`; suite 418 tests + 10 lints (from 366 + 9); the demo rebuilt (DEMO_KEY v4, a seeded week of audit history).
- The design workflow (wf_78e22fb1-b73) delivered two specs before the session limit (presets, cross-cutting facts); items 11–15 were built from the strategy, the reviewers' original proposals and the code, with the same test-first flow.
- Departures and decisions: Nurses seed four slots (Triage, Staff nurse 1–3) because the engine caps a period at its zone count, so a 2–4 cover needs four slots; nouns "junior doctor" and "clerk"; a preset writes `cset().rosterMode`/`fairness` without ticking rows 8/8a (seeds, never decides); `draftHidden()` applies only in cloud mode and never to a real admin (`_realAdmin`) so View as still previews drafts and the demo hides nothing; the stepper note says "until you open booking or publish it" (open cycles are visible); receipts carry `notified` (in-app, everyone) and `sent` (queued texts/emails); `openConfirm()` takes `onDone` as well as returning a promise (the suite is synchronous); the audit filter and view are module-level device state; the first-run card stands in for the whole view on roster/selfroster/equity/my and sits above viewStaff/viewDaily; the demo link is gated by `location.pathname`; the invite row is a checklist `<a data-invite>` (not a `go()` anchor); the outbox lives in `S.outbox` merged by id, pruned 30 days after `sent`; a person with a mobile gets a text only (no duplicate email); publish notices use `pub-<cycle>-<sid>` ids so two admins cannot double-queue; notify-rounds stamps `sent` before the CAS write and sends only when the write wins.
- Measurement: kind tiles 3-up at 1280 / 2-up at 375 (91 px tall); first-run card 430 px at 1280; audit rows wrap time · who / sentence on phones; the confirm dialog focuses its action; receipts render on Close booking and Publish; the "still being prepared" card sits under the open-round banner; the invite composer is 350 px wide on a phone. Two defects found by measurement and fixed: button-styled links were underlined, and the My shifts range inputs (plus two other direct bindings) were unguarded, so a stand-in screen aborted the rest of `wire()`.
- Skeptic workflow (wf_ce92442a-cdd): three lenses, 17 findings, every one verified by an independent refuter, all 17 fixed with regression tests; the design cross-check's deltas applied in the same commit. Suite 428 tests + 10 lints. The late design specs for items 11–15 were compared against the as-built code; their remaining ideas (a `cy` field on audit rows, `byName` on receipts, an Invite again control, bcc on round emails) are follow-ups, not blockers.
- Deploy: `supabase functions deploy notify-rounds` and `supabase functions deploy notify-shifts` after the push (honest sends with retries; reminders skip drafts); try Send on the staging group before the pilot's.
