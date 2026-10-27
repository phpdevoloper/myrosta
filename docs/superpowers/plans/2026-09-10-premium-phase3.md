# Premium Phase 3 — The app carries its own name · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Line numbers are from `main` at fabc1c0 (10 Sep 2026); re-grep before editing.

**Goal:** Everything that leaves the app, or sits beside it, says where it came from and what it stands for: trust facts and a What's new note inside the app, the mark and the hospital on the two printed pages and the two human-read exports, calendar events and reminders that name the hospital, an Add to Home Screen card on iPhone, and one share button each for a person's week and for the demo.

**Architecture:** Copy, markup and device-local flags only. `BUILD` and `WHATS_NEW` are hand-curated constants tied to `CHANGELOG.md` by a lint; device-local state lives in `localStorage` under `KEY` suffixes (never in the shared blob); one `shareText()` helper (native share, clipboard fallback); one `printHeadHTML()`; the ics function and notify-shifts gain the hospital and group. Engine untouched; render()/wire() architecture and every id kept; no new tabs.

**Tech Stack:** as every phase (single-file vanilla JS, `python3 tests/run.py`, deploy = `app.html` + `deploy/app.html` + `preview.html`, `python3 tools/build-demo.py`; Deno functions pasted into the Supabase dashboard editor).

**Spec:** `MYROSTA-PREMIUM-STRATEGY.md` Phase 3 (items 16–20) and its "Out of scope" list (no share row in More, no second share button in Calendar & export, no Hospital · Group row in More, no Android install prompt, no confetti, no new tabs).

## Global Constraints

- Suite green (428 + 10 lints at start). Lints: no hex outside `:root`/`PALETTE` (the exports read `PALETTE`), no px font sizes, no emoji (SVG icons only), retired classes, `.ph{` scoped, every audit key worded.
- Once-per-device cards are dismissable, never before sign-in, never in the demo (`inDemo()`), never in local mode.
- CSV, payroll and EFT files stay byte-identical; a test proves it.
- The ics feed never carries colleagues, cover counts or the token.
- Every task ends with `cp app.html deploy/app.html`, `python3 tools/build-demo.py`, suite green, one commit.

---

### Task 1: Trust facts and What's new (item 16)
- [x] Tests: `BUILD` equals the date of CHANGELOG.md's first heading (lint); the More sheet carries an About block with Privacy, Support and the trust line, no second Hospital · Group row; a fresh device is stamped silently and sees no What's new row; an older stamp shows a pinned first row in Notifications, counts one unread, and opening Help's What's new section clears it; `inDemo()` shows nothing; the sign-in door carries the Sydney line.
- [x] Build: `const BUILD`, `WHATS_NEW`, `seenBuild()`/`markBuildSeen()`, the About rows in `moreSheetHTML`, the pinned row in `notifsSheetHTML`, `unreadCount` + badge, Help's What's new section (`id="whatsnew"`), the door line, the lint.
- [x] Commit `"Premium 3: trust facts in More and on the door; What's new once per release, never on a first day"`.

### Task 2: Paper and exports carry the mark (item 17)
- [x] Tests: `printHeadHTML()` markup on `#eqCard` and `#capCard` (hidden on screen, shown in print); the Excel roster header names hospital · group, cycle, status, date and myrosta.com.au; the RosterOn workbook's row 2 text; Roster as CSV, the payroll file and the EFT tracker unchanged byte for byte.
- [x] Build: `printHeadHTML(title)`, `.printhead`/`.printfoot` print CSS, `id="eqCard"`, `eqPrint` scoped like `capPrint`, the .xls header, the RosterOn row 2.
- [x] Commit `"Premium 3: paper and the two human-read exports carry the mark, the hospital, the date and myrosta.com.au"`.

### Task 3: Calendar events and reminders name the hospital (item 18)
- [x] Tests: `exportICS` output has `LOCATION`, `DESCRIPTION` (own shift only, ending with the Myrosta line), `URL`, escaped commas and no colleague names; `X-WR-CALNAME` names the hospital or group; the function mirrors it; notify-shifts subject/body carry the hospital or group.
- [x] Build: `icsText()` escaping, the three properties in `exportICS` and `supabase/functions/ics/index.ts`, the reminder subject in `notify-shifts`.
- [x] Commit `"Premium 3: calendar events and reminders say where they come from"`.

### Task 4: Add to Home Screen card (item 19)
- [x] Tests: `a2hsCardHTML()` renders only for iOS Safari not standalone, cloud, signed in, not demo, not dismissed; Not now persists (30-day re-show, then never); the standalone first-launch toast fires once; Help has a fifth Getting-started step.
- [x] Build: `TIC.share`, `a2hsCardHTML()` under the action row in `viewMy`, `a2hsLater` wiring, the Help step.
- [x] Commit `"Premium 3: an Add to Home Screen card on iPhone, once per device; a fifth step in Help"`.

### Task 5: Share my week, share the demo (item 20)
- [x] Tests: `shareWeekText(sid)` exact output for a fixture week (folded off days, times, the closing line); the button only on a person's own view; Help's share row; the door's "New here?" line; none of it inside the demo; `shareText()` falls back to the clipboard.
- [x] Build: `shareText(o)`, `shareWeekText(sid)`, the `#shareWeek` button in the week-strip header, `#shareDemo` in Help, the door line.
- [x] Commit `"Premium 3: share my week, share the demo"`.

### Task 6: Sync, measure, skeptics, docs, merge
- [x] Sync copies, rebuild demo, measure at 375/1280, skeptic Workflow (3 lenses + refuters), fix confirmed, CHANGELOG, strategy note, as-built, fast-forward `main`, user pushes; paste `ics` and `notify-shifts` into the dashboard editor.

## As built (10 Sep 2026)

- All five items shipped on `premium-phase3`; the runner reports 466 passes (tests + 12 lints, from 456); the demo rebuilt.
- Decisions: What's new is cloud-only and device-local (`KEY+"_seenBuild"`), stamped silently in `render()` on a fresh device, cleared by Mark all read, by closing the sheet (which marks read) or by opening Help; the About block sits at the end of More with no second hospital row; the door-foot carries the Sydney line and, from item 20, "New here?"; `printHeadHTML()` renders on every Equity/Capacity paint but is `display:none` off paper; `icsText(sid)` is the tested core of `exportICS`; folding is by bytes (74 + the space) so multi-byte text never splits mid-character; the Home Screen card is gated on cloud + signed in + iPhone-not-standalone + not demo, dismissable twice (30 days apart), then never; `shareText()` tries the native sheet, then the clipboard, then an honest toast; the week text is built from `getShift(sid)` only; the Help share row uses the existing `.fbprompt` style.
- Measured at 375 px: the card, the Share button, the pinned row (badge 4 = 3 + note), the About block, Help's share row, five steps and the What's new section render; the print head is hidden on screen.
- Deploy: paste `supabase/functions/ics/index.js` and `supabase/functions/notify-shifts/index.ts` into the dashboard editor after the push (no CLI on this Mac).
- Reviews: the design workflow's five late specs were judged against the as-built code and their deltas applied (site-neutral What's new with a relaxed changelog lint, Australia once on the door, the trust line in Help's footer, hospital-or-group placement with hours in every calendar event, the registry fallback in both functions, the iOS-only toast, no Share the demo inside the demo). The skeptic workflow (three lenses, 21 agents across two runs after a session limit) confirmed 15 findings (nine distinct); all fixed with regression tests. One review subagent switched the working tree to another branch mid-run; the fix is `git checkout premium-phase3` — commits were never at risk.
