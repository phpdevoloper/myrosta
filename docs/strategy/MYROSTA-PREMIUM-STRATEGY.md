<!-- Produced 9 Sep 2026 from rendered-screen observations (scratchpad/premium-review/observations.md) by four independent reviewers
     (first-sight premium feel · delight · self-marketing hooks · trust and first run), each proposal checked by a sceptic against app.html,
     then synthesised. Sibling of MYROSTA-UI-STRATEGY.md (the six UI phases, all shipped 8 Sep 2026). Status: awaiting the owner's choice of phase. -->

# Myrosta — Premium strategy · 9 Sep 2026

**Thesis.** Premium here means three things. The app looks made for this department: the hospital in the masthead, period colours carried into motion, a grid that reads like a calendar. It says what it just did, in words, when it matters: booked, claimed, published, approved, saving. And it carries its own name into the places the roster is seen: calendars, reminders, printouts, a shared week. All of it is presentation, copy or messaging: engine, sync and the protected list untouched; `python3 tests/run.py` green after every item; each phase ships alone.

## Phase 1 — First sight and the booking moment (now · about 10 days)

**DONE 9 Sep 2026** — built on branch `premium-phase1`, plan `docs/superpowers/plans/2026-09-09-premium-phase1.md`, all nine items shipped (see CHANGELOG 9 Sep 2026 — Premium phase 1).

Why: today nothing moves, every card matches, and confirming ends in "Booked 1."

1. **The mark breathes on cold load** (½ day, `authScreen()`, `render()`) — the mark's bars pulse instead of a spinner; returning staff phones see a silhouette of the next-shift card; the xlsx script is deferred.
2. **Sign-in as the front door** (½ day, `authScreen()`, `wireAuth`) — title "Sign in"; sub "No password — we text (or email) you a 6-digit code, then you stay signed in on this phone. Hosted in Australia."; the sixth digit verifies itself.
3. **Masthead, cycle chip, desktop chrome** (S 1½ days, then M 1–2 days, topbar, `applyBranding`, `render()`, `moreSheetHTML`) — the hospital as an eyebrow over the group name, from branding or the orgs row; the cycle select stays the control under a two-line chip "7 Sept – 1 Nov" with a status tag; a divider after the fourth tab; then an initials avatar holding View as and Sign out.
4. **A page-title tier; the day list edge to edge** (½ day, the five phone views) — one `pageHead()` before the first card; the Book shifts card loses its box.
5. **Roster grid furniture** (1 day, `viewRoster`) — cover row truly sticky, a 2 px Monday rule, the month name only on Mondays and the 1st.
6. **More and Notifications as designed surfaces** (½ day, `moreSheetHTML`, `notifsSheetHTML`) — an initials header; an icon and a one-line promise per row ("Who's on today, by zone"); notification rows get a destination icon and day-aware stamps.
7. **Confirm: paint now, rows settle, a receipt, the hero moves** (2½ days, `srBatchBook`, `srFooterHTML`, `viewMy`, `#cloudPill`) — render before the cloud round trip (closes a double-tap defect); booked rows settle from `--accent-bg`; the navy footer becomes a receipt — "Booked 3 · 12 of 14" or "That's your share — 14 of 14 booked." with Add to calendar and Done; back on My shifts the quota bar moves to its new width, never on background renders; "Cloud on" becomes a dot: "Saving…" after 400 ms, "Offline · saved on this phone".
8. **Claim goes busy, then the row says it's yours** (½ day, claim handler, `marketMyHTML`) — "Claiming…" on a disabled button; on success "**Sat 19 Sept PM · EPIC** is yours — it's on your roster."
9. **Requests tell their own story** (1 day, `viewRequests`, `myReqRow`) — after Agree: "You agreed — Sam Patel has been told and it's gone to admin."; decided rows show "Approved 9 Sept" and "Those days are off your roster."

## Phase 2 — Site 2's first hour (October, before their admins sign in · 7 days)

**DONE 10 Sep 2026** — built on branch `premium-phase2`, plan `docs/superpowers/plans/2026-09-10-premium-phase2.md`, all six items shipped (see CHANGELOG 10 Sep 2026 — Premium phase 2).

Why: an empty group says "Add or import your consultants" over one hospital's zone codes.

10. **"What kind of group is this?"** (1½ days, `viewSetup`, `setupChecklist`) — default zones become Resus, Acute, Fast track, Paeds; six preset tiles (Consultants, Nurses, Junior doctors, Scribes, Clerical/admin, Something else) set role noun, zones, CST and roster mode; only while the group is empty.
11. **A draft isn't shown to staff until it's published** (½ day, `render()` dispatch, `roundStepperHTML`) — a `draftHidden()` guard on roster, booking, day board, fairness and My shifts; staff land on the published cycle; the stepper says "Staff don't see this cycle in the app until you publish it."
12. **Audit log reads like a record** (1 day, `viewAudit`, demo-seed) — newest-first timeline, plain-word actions ("Changed roster status"), filter chips, CSV, seeded demo entries.
13. **Publish: a real dialog, then a receipt on the step** (½ day, status handler, `roundStepperHTML`) — `openConfirm()` replaces native `confirm()`; done steps read "Published Sat 20 Sept, 9:12 am · 36 notified".
14. **Empty states point at a filled-in roster** (½ day, `emptyState`, five call sites) — "Add your nurses", "Upload a roster", "See a filled-in roster" (the demo) replace every "No staff yet" sentence.
15. **Invite your nurses; publish really notifies** (M 2–3 days, `setupChecklist`, `setCycleStatus`, notify-rounds) — a checklist row composes "<Hospital> · <Group>: your roster is moving to Myrosta. Sign in at myrosta.com.au with this number — a 6-digit code by text, no password."; publish queues one text and email per person. Test org first — it texts real phones.

## Phase 3 — The app carries its own name (before the 23 Nov round · 4 days, all S)

**DONE 10 Sep 2026** — built on branch `premium-phase3`, plan `docs/superpowers/plans/2026-09-10-premium-phase3.md`, all five items shipped (see CHANGELOG 10 Sep 2026 — Premium phase 3).

Why: exports are anonymous, a calendar event says only "EPIC (AM)", and the app can't reach its own demo.

16. **Trust facts and What's new** (½ day, `moreSheetHTML`, `notifsSheetHTML`) — More gains Privacy, Support and "Stored in Sydney, Australia · every change is logged · Build 9 Sep 2026"; one "What's new" row in the bell per release, never on a first day; a lint ties each date to CHANGELOG.md.
17. **Paper and exports carry the mark** (½ day, `capacityCardHTML`, `exportRosterXLS`) — a print-only head on the fairness summary and capacity business case ("Printed 9 Sep 2026 from Myrosta / myrosta.com.au"); the Excel roster and RosterOn workbook get Hospital · Group, cycle, date and myrosta.com.au; CSV and payroll files stay byte-clean.
18. **Calendar events and reminders name the hospital** (1½ days, functions/ics, `exportICS`, notify-shifts) — events get LOCATION, a DESCRIPTION ending "Swap or offer this shift in Myrosta: https://myrosta.com.au"; reminders get the subject "Tomorrow Thu 10 Sept: AM · EPIC · 08:00–16:00 — Werribee Mercy ED".
19. **Add to Home Screen card** (½ day, `viewMy`, `viewHelp`) — iPhone Safari, once per device: "Put Myrosta on your Home Screen — tap Share then Add to Home Screen. It opens like an app and stays signed in."; a fifth Getting-started step in Help.
20. **Share my week, share the demo** (1 day, `weekStripHTML`, `viewHelp`, `authScreen`) — a Share button on the Next 7 days strip (own shifts only, ending "— from Myrosta"); in Help "Showing Myrosta to another department? The demo is this app with made‑up staff." plus Share; on the sign-in card "New here? Try the demo · About Myrosta".

## Out of scope / deliberately not doing

- Dark mode, tablet layout (already deferred).
- Gamification, streaks, confetti.
- A generic after-render effects queue.
- Count-ups, an 8 s receipt timer, failures inside the receipt, an "UPDATED" eyebrow or rail sweep on the hero.
- An Android install prompt.
- A production sample-data loader.
- Sign-in logging in the audit (Supabase's auth log has it).
- Per-person reminder preference.
- A share row in More, a second share button in Calendar & export, a Hospital · Group row in More (duplicates).
- Changing header height, tab set or NAV_ORDER.
