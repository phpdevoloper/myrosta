# Premium Phase 1 — First sight and the booking moment · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Line numbers are from `main` at c227758 (9 Sep 2026); re-grep before editing.

**Goal:** In the first ten seconds the app looks made for this department, and the booking moment answers in words and motion: the mark breathes while the roster arrives, the sign-in is a front door, the masthead names the hospital, the sheets are designed surfaces, and confirming picks paints instantly, settles the rows, hands back a receipt and moves the quota bar.

**Architecture:** Presentation, copy and two device-side flags. `_selfChange` marks a render caused by a tap on this device (never by `bgRender()`/cloud); `_justBooked`/`_inflight` sets carry one-shot classes into the next render. All motion is CSS keyframes on one-shot classes applied by the templates, so the global reduced-motion rule silences it and nothing survives a re-render. Engine (`canBook`, `pickCheck`, `setShift`, `cloudCommit`'s CAS loop) untouched; `render()`/`wire()` architecture unchanged; every existing id kept.

**Tech Stack:** as every phase (single-file vanilla JS, `python3 tests/run.py`, deploy = `app.html` + `deploy/app.html` + `preview.html`, `python3 tools/build-demo.py` for the demo).

**Spec:** `MYROSTA-PREMIUM-STRATEGY.md` Phase 1 (items 1–9) and its "Out of scope" list (no effects queue, no count-ups, no 8 s receipt timer, no rail sweep or UPDATED eyebrow, no sound, no change to header height / tab set / NAV_ORDER).

## Global Constraints

- Suite green (311 + lints). New tests in `tests/suite.js`; keep `pickorg`/`orgerror` sign-in assertions (suite ~112–146), `cycleSel` aria-label (~643), `data-stoggle`, `dPrev`, and every id `wire()` binds.
- Protected strengths: the navy hero and its rail, the period colours, the capacity prose, the confirm texts, the open-round banner, the day sheet's reasons, the 44 px floor.
- Motion only on self-originated renders while the document is visible; never on `bgRender()`; reduced motion → the global rule.
- Lints: no emoji (use `ic()`), no hex outside `:root`/`PALETTE`, no px font sizes, retired classes stay retired.
- The demo is rebuilt (`tools/build-demo.py`) after every task that touches `app.html`; the landing page is untouched.

---

### Task 1: The mark breathes on cold load; the spreadsheet library loads lazily

**Files:** `app.html` — `authScreen()` `checking` branch (~1535), the mark SVG (~412), the SheetJS `<script>` tag (head), CSS.

- [x] Tests: `authScreen()` with `authState="checking"` contains `class="markbeat"` and no "Connecting…" text; the head's xlsx script tag carries `defer`; `viewMy()` is unaffected.
- [x] Replace the spinner card with: the mark at 44 px whose three bars carry ids `mk-am mk-pm mk-cst` and a `markbeat` class — `@keyframes markbeat{0%,100%{opacity:.35}50%{opacity:1}}` staggered 0/.4/.8 s over 1.2 s; beneath it a silhouette: a `.nextcard` with `border-left-color:var(--navy-muted)` holding two rounded bars, and three hairline rows; a `.topbar.loading::after` 2 px teal hairline that grows to 70 % over 1.5 s and completes when `authState` becomes `in`. Under reduced motion: static bars, no hairline.
- [x] `defer` on the SheetJS script (grep confirms `XLSX.` is used only inside import/export handlers).
- [x] Commit `"Premium 1: the mark breathes on cold load; SheetJS deferred"`.

### Task 2: Sign-in as the front door

**Files:** `app.html` — `authScreen()` login and OTP branches (~1544–1558), `wireAuth` (~1561–1586), CSS.

- [x] Tests: the login screen contains "No password", "6-digit code", "Hosted in Australia", both channel rows (`data-am="sms"`, `data-am="email"`) with icons; the OTP screen's `#authCode` has `inputmode="numeric" autocomplete="one-time-code" maxlength="6"`; all ids kept (`authSend authEmail authPhoneInput authCode authVerify authResend`).
- [x] Markup: a centred column (max-width 400) on the page ground: the mark at 56 px; the hospital name in navy when known (`S.branding.hospital` or `_orgHospital`), else the wordmark; "Your roster, on your phone." at `--fs-lg`; two full-width 56 px channel rows ("Text me a code · to your mobile" / "Email me a code") replacing the segmented control; the field and one primary button; then "No password — we text (or email) you a 6-digit code, then you stay signed in on this phone. Hosted in Australia."; the shared-computer checkbox under a `<details class="sec">` "Using a ward PC?". OTP: `#authCode` at `--fs-xl`, letter-spacing .35em, centred, tabular; an `oninput` that triggers Verify when six digits are present; sub copy "Texted to ••• ••• 123 — it fills itself on this phone." Keep the `pickorg`/`orgerror` branches untouched.
- [x] Commit `"Premium 1: the sign-in is a front door"`.

### Task 3: Masthead, cycle chip, desktop chrome

**Files:** `app.html` — topbar markup (~411–420), `applyBranding` (~797–802), `render()` (~1598–1627), `NAV_ORDER` (~1511), `moreSheetHTML` (~1522), CSS `.brand`, `#cycleSel`, phone rules, `.tabs`.

- [x] Tests: after `S.branding={hospital:"Northern Hospital",name:"Nurses"}; applyBranding()`, the brand element renders an eyebrow "Northern Hospital" and the group "Nurses"; with no hospital the eyebrow is "Myrosta" and the group is the wordmark/group; `render()` writes short cycle option labels ("7 Sept – 1 Nov") and a status tag element `#cycleStatus` beside the select ("Booking open"); the desktop tab strip contains two `.tabsep` dividers; the account popover markup contains `#viewAs` and `#logoutBtn`.
- [x] Masthead: `.brand` becomes two lines — `<span class="brand-eyebrow">` (eyebrow style) + the group at `--fs-lg`; `applyBranding` sets both (hospital from branding or `_orgHospital`, group from branding.name or `_orgLabel`); document.title "Group · Hospital · Myrosta". Cycle chip: `render()` writes short labels into `#cycleSel` options and a `.tag` `#cycleStatus` beside it (phones: chip row = select + tag; the select keeps its aria-label). Desktop: `NAV_GROUPS` (admin: roster/selfroster/daily/requests · my/staff/setup/planner/equity · messages/audit/help; staff analogous) rendered with `.tabsep` dividers, the last cluster right-aligned at `--fs-sm`; a 32 px initials avatar button (`#acctBtn`) opens a popover (`#acctPop`, absolutely positioned, built from the More sheet's account rows) holding View as, Switch roster, Calendar feed, Sign out — `#viewAs`, `#switchOrgBtn`, `#logoutBtn` ids preserved inside it; Escape/outside click closes.
- [x] Commit `"Premium 1: the department's masthead, a two-line cycle chip, tab clusters and an account avatar"`.

### Task 4: A page-title tier; the day list edge to edge

**Files:** `app.html` — `viewMy`, `viewSelfRoster`, `viewRequests`, `viewRosterMobile`, `viewMessages` first headings; CSS.

- [x] Tests: on a phone (`isMobile` stubbed true) `viewMy()` starts with `<header class="ph"><h1>My shifts</h1>` and the sub carries the person and group; `viewSelfRoster()`'s list card carries `class="card list"`; desktop output unchanged (`isMobile` false → no `.ph`).
- [x] `pageHead(title, sub)` helper; used on the five staff screens when `isMobile()`; CSS `.ph h1{font-size:var(--fs-xl);letter-spacing:-.02em}`; `@media(max-width:640px){.card.list{padding:0 0 8px;border:0;background:none;box-shadow:none}.card.list .dayrow{padding:8px 14px}}`.
- [x] Commit `"Premium 1: a page-title tier on phones; the day list runs edge to edge"`.

### Task 5: Roster grid furniture

**Files:** `app.html` — `viewRoster` head and cover rows (~2248–2263), CSS `table.roster`.

- [x] Tests: the grid's Monday header cells and body cells carry class `mon`; the day header shows the month name only on Mondays and the 1st; the cover row `<tr>` carries `class="coverrow"`.
- [x] CSS: `th.mon,td.mon{border-left:2px solid var(--line2)}`; the cover row sticky under the day header with a measured offset (`--hd1` set in `render()` from the header row's height); `tbody tr:hover td{background:var(--hover)}` (not on `.namecol`).
- [x] Commit `"Premium 1: Monday rules, a sticky cover row, month names only where they change"`.

### Task 6: More and Notifications as designed surfaces

**Files:** `app.html` — `moreSheetHTML` (~1522–1532), `notifsSheetHTML` (~2521–2528), `NIC`/`TIC`, CSS.

- [x] Tests: `moreSheetHTML()` starts with an account header carrying the person's initials and "Emergency Medicine · synced/local"; every nav row carries an svg and a `.rowsub` promise; `notifsSheetHTML()` groups rows under `.sheetlbl` "Today"/"Yesterday"/"Earlier" and each row has a `.nicon`.
- [x] Promises: Day board "Who's on today, by zone" · Leave "The year's leave, whole team" · Fairness "Who's carrying the tough shifts" · Messages "Your admin and the group" · Help "Guide, questions, feedback" · Audit log "Every change, who and when" · Staff/Settings for admins. Notification icons by target (selfroster→cal, requests→check/help, openshifts→live, else bell) on a 32 px `--accent-bg` disc; timestamps "15:01" under Today, "Tue 8 Sept" otherwise.
- [x] Commit `"Premium 1: More and Notifications as designed surfaces"`.

### Task 7: Confirm paints now, rows settle, a receipt, the hero moves; sync state that speaks when it matters

**Files:** `app.html` — `srBatchBook` (~1159–1166), `srFooterHTML` (~2493), `dayRowHTML` (~2460), `bookingStatusHTML`, `commitGuarded` (~715), `cloudCommit` (~688), `viewMy` hero (~3547), `render()` (`#cloudPill` ~1594), `save()`/`_syncedOk()`/`cloudErr()`, CSS.

- [x] Tests: after `srBatchBook()` on a fixture pick, `_receipt` is set and `srFooterHTML()` renders `.srfoot.done` with "Booked 1 · 12 of 14" (or "That's your share — 14 of 14 booked." when quota reached) and buttons `#rcCal`/`#rcDone`; `dayRowHTML` for a key in `_justBooked` carries class `just`; `viewMy()` right after a self-originated booking renders `.qfill` with `data-from` (the old width) so the drain step can animate; `cloudStateHTML()` returns "" when synced and idle, "Saving…" while `_savePending`, "Offline · saved on this phone" on error; `_selfChange` is false after `bgRender()`.
- [x] Optimistic paint: in `srBatchBook` render immediately after the synchronous `mutate()` (picks are already in `active().assign`), keep `_srPick` until the promise settles, add the Confirm button's id to `_inflight` so `wire()` renders it disabled with `aria-busy` and "Saving…"; on settle clear and render the receipt. Same `_inflight` pattern for `commitGuarded`'s cloud branch (Claim/Agree). Receipt: `.srfoot.done` in the footer's place — check icon + one sentence ("That's your share — 14 of 14 booked." when quota reached, else "Booked N · b of q") + "Add to calendar" (`go("my",{anchor:"calSec"})`) + "Done"; stays until the next tap/render. Rows: `.dayrow.just` → `@keyframes settle` 900 ms from `--accent-bg`. Hero: `viewMy` writes `data-from` on `.qfill` when `_selfChange` and the booked count changed since `_heroSeen`; `render()`'s last step sets the width from `data-from` then to the real width on the next frame (snaps when `requestAnimationFrame` is missing or reduced motion). Sync dot: `#cloudPill` becomes a 6 px dot + word: "Saving…" (pulsing) after 400 ms of `_savePending`, "Saved" for 1.2 s, "Offline · saved on this phone" in `--warn-t` on error, "Back online — syncing" on the online event; shown on phones too. `_selfChange` set by handlers (via `wire()`'s click delegation or a helper `self(fn)`), cleared at the end of `render()`; `bgRender()` never sets it.
- [x] Commit `"Premium 1: confirm paints now, rows settle, a receipt, the hero's bar moves; sync state that speaks when it matters"`.

### Task 8: Claim goes busy, then the row says it's yours

**Files:** `app.html` — `marketMyHTML` (~1266–1276), the claim handler (~4013), CSS.

- [x] Tests: with an id in `_inflight`, `marketMyHTML()` renders that button disabled with `aria-busy="true"` and "Claiming…"; after a successful claim `_settled` holds the shift and `marketMyHTML()` renders `.listrow.settled` with "Sat 19 Sept PM · EPIC is yours — it's on your roster." and a "See it" button; with `S.marketClaim==="approve"` the sentence is "Asked — your admin decides. You'll be told."
- [x] Commit `"Premium 1: claiming goes busy, then the row says it's yours"`.

### Task 9: Requests tell their own story

**Files:** `app.html` — `viewRequests` peer row + Agree handler (~2606, ~4105), `myReqRow` (~2721), `REQ_STATUS`, `saveLocal` (`_reqSeenTs`), CSS.

- [x] Tests: after `agreeSwap()` from the peer's view, `_settled` renders "You agreed — Sam Patel has been told and it's gone to admin." for that render; a leave request decided after `_reqSeenTs` renders "Approved Tue 9 Sept · Mon 12 – Fri 16 Oct is off your roster." with an "Update my calendar" button; a swap "Approved · you now work Sat 12 SSU PM; Sun 13 is Sam's."; admin rows unchanged.
- [x] Commit `"Premium 1: requests tell their own story"`.

### Task 10: Sync, measure, skeptics, docs, merge

- [x] `cp` deploy/preview; `python3 tools/build-demo.py`; suite on all; rebuild the review copy; measure at 375/1280: cold-load silhouette (simulate `checking`), sign-in, masthead height ≤ 112, cycle status never truncated, tab clusters, avatar popover, page heads, Monday rules, sheets, confirm → receipt → hero bar animates (JS: `.qfill` width before/after), sync dot states, claim busy, request rows; reduced-motion emulation; screenshots.
- [x] Workflow: 3 skeptics (motion gating and render architecture: `_selfChange`, `bgRender`, reduced motion, the optimistic paint vs CAS failure; markup/id regressions: every id `wire()` binds, the sign-in tests, `cycleSel`, the popover on ≤640; copy and claims vs the app). Fix confirmed items.
- [x] CHANGELOG "9 Sep 2026 — Premium phase 1"; strategy note DONE; as-built here; fast-forward `main`; user pushes.

## Self-review
- Coverage: strategy items 1–9 → Tasks 1–9; the out-of-scope list respected (no effects queue: effects are set-driven classes; no count-ups; no rail sweep; no 8 s timer; no sound).
- Names used consistently: `_selfChange`, `_justBooked`, `_inflight`, `_settled`, `_receipt`, `_heroSeen`, `_reqSeenTs`, `pageHead()`, `cloudStateHTML()`, `NAV_GROUPS`, `#cycleStatus`, `#acctBtn/#acctPop`, `.tabsep`, `.ph`, `.card.list`, `.mon`, `.coverrow`, `.rowsub`, `.nicon`, `.srfoot.done`, `.dayrow.just`, `.listrow.settled`, `.markbeat`.

## As built (9 Sep 2026)

- All ten tasks shipped on `premium-phase1` (14 commits); suite 366 tests + 9 lints green (from 311 + 8); the demo rebuilt from the branch.
- Departures from the plan: the mark's bars use classes `mk-am/mk-pm/mk-cst` (not ids) and three new tokens `--mark-am/--mark-pm/--mark-cst` mirrored in `PALETTE` (the hex lint scans the script too); the sign-in shows the hospital from `S.branding.hospital` or `_orgHospital` and the wordmark otherwise; `#cloudPill` moved inside `#cycleWrap` as `.sync` and is shown on phones (the offline word takes its own line there); the receipt carries `cycleId` and self-checks the live count at paint; `_settled` carries `cycleId` and See it carries the cycle; `_heroSeen` is per cycle; `_reqSeenTs` is device-local per viewer (localStorage, marked when leaving the Requests tab); the Roster page title says "12 consultants · week by week" (the chip already shows the dates); the calendar buttons say "Add to calendar" and become "Your calendar feed has it" for people with a live feed; the page-head class is scoped `header.ph` (the bare `.ph` is the public-holiday token) with a lint guarding it; the reduced-motion rule now covers pseudo-elements and removes the cold-load hairline.
- Measured in the browser pane at 375 and 1280: header 112 px on phones (136 while offline), chip never truncated, receipt above the bottom bar with its buttons beneath the sentence, the popover 280 px under the avatar, Monday rules 2 px, cover row sticky at the measured header height. The hero bar's transition cannot be observed in the pane (the document reports hidden, which is the gate), so it was verified by the suite's `data-from` assertions.
- Skeptic workflow: three lenses (motion/render, markup/ids/a11y, copy/claims), 17 findings, every one verified by an independent refuter, all 17 fixed with regression tests.
